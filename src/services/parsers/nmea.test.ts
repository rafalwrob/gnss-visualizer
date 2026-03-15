import { describe, it, expect } from 'vitest';
import { NmeaAdapter } from './nmea';

function makeChecksum(sentence: string): string {
  let cs = 0;
  for (let i = 1; i < sentence.length; i++) {
    cs ^= sentence.charCodeAt(i);
  }
  return cs.toString(16).toUpperCase().padStart(2, '0');
}

function sentence(body: string): string {
  return `$${body}*${makeChecksum('$' + body)}\n`;
}

function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe('NmeaAdapter', () => {
  it('parsuje GGA i zwraca positionFix', () => {
    const adapter = new NmeaAdapter();
    const ggaBody = 'GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,';
    const data = adapter.feed(encode(sentence(ggaBody)));
    expect(data.positionFix).toBeDefined();
    expect(data.positionFix?.fixType).toBe('3d');
    expect(data.positionFix?.lat).toBeCloseTo(48 + 7.038 / 60, 3);
    expect(data.positionFix?.lon).toBeCloseTo(11 + 31.0 / 60, 3);
    expect(data.positionFix?.alt).toBeCloseTo(545.4, 1);
  });

  it('GGA fixQuality=0 → fixType=none', () => {
    const adapter = new NmeaAdapter();
    const ggaBody = 'GPGGA,123519,4807.038,N,01131.000,E,0,00,,,M,,M,,';
    const data = adapter.feed(encode(sentence(ggaBody)));
    expect(data.positionFix?.fixType).toBe('none');
  });

  it('parsuje GSV multi-sentence i buforuje do ostatniego', () => {
    const adapter = new NmeaAdapter();
    // 2 zdania GSV z łącznie 5 satelitami (pierwsze 4, drugie 1)
    const gsv1 = 'GPGSV,2,1,05,01,40,020,45,02,30,120,38,03,20,200,30,04,10,300,25';
    const gsv2 = 'GPGSV,2,2,05,05,05,050,20';

    // Pierwsze zdanie nie powinno zwracać danych
    const d1 = adapter.feed(encode(sentence(gsv1)));
    expect(d1.observations).toBeUndefined();

    // Drugie zdanie — kompletna grupa
    const d2 = adapter.feed(encode(sentence(gsv2)));
    expect(d2.observations).toBeDefined();
    expect(d2.observations).toHaveLength(5);
    expect(d2.observations![0].prn).toBe('G01');
    expect(d2.observations![0].elevation).toBe(40);
    expect(d2.observations![0].azimuth).toBe(20);
    expect(d2.observations![0].snr).toBe(45);
  });

  it('mapuje talker GL → glonass', () => {
    const adapter = new NmeaAdapter();
    const gsv = 'GLGSV,1,1,01,65,50,100,40';
    const data = adapter.feed(encode(sentence(gsv)));
    expect(data.observations?.[0].system).toBe('glonass');
    expect(data.observations?.[0].prn).toBe('R65');
  });

  it('odrzuca zdania z błędnym checksumem', () => {
    const adapter = new NmeaAdapter();
    const bad = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*ZZ\n';
    const data = adapter.feed(encode(bad));
    expect(data.positionFix).toBeUndefined();
  });

  it('reset() czyści bufor GSV', () => {
    const adapter = new NmeaAdapter();
    const gsv1 = 'GPGSV,2,1,05,01,40,020,45,02,30,120,38,03,20,200,30,04,10,300,25';
    adapter.feed(encode(sentence(gsv1)));
    adapter.reset();
    // Po resecie pierwsze zdanie znowu nie daje obserwacji
    const d = adapter.feed(encode(sentence(gsv1)));
    expect(d.observations).toBeUndefined();
  });
});
