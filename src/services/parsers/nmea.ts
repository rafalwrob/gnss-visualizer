import type { ProtocolAdapter, ParsedData, PositionFix } from './protocolAdapter';
import type { SatelliteObservation } from '../../types/rawMeasurement';
import type { GnssSystem } from '../../types/satellite';

/** Mapa talker ID → GnssSystem */
function talkerId(talker: string): GnssSystem | null {
  switch (talker) {
    case 'GP': return 'gps';
    case 'GL': return 'glonass';
    case 'GA': return 'galileo';
    case 'GB':
    case 'BD': return 'beidou';
    case 'QZ': return 'qzss';
    default:   return 'gps'; // GN (mixed) → gps jako fallback
  }
}

function calcChecksum(sentence: string): number {
  let cs = 0;
  for (let i = 1; i < sentence.length; i++) {
    if (sentence[i] === '*') break;
    cs ^= sentence.charCodeAt(i);
  }
  return cs;
}

function verifyChecksum(sentence: string): boolean {
  const star = sentence.lastIndexOf('*');
  if (star < 0 || star + 3 > sentence.length) return false;
  const expected = parseInt(sentence.slice(star + 1, star + 3), 16);
  return calcChecksum(sentence) === expected;
}

/** Parsuje pole DDMM.MMMMM + 'N'/'S' / 'E'/'W' do stopni dziesiętnych */
function parseDegMin(val: string, dir: string): number {
  if (!val) return 0;
  const dot = val.indexOf('.');
  const degLen = dot - 2;
  const deg = parseFloat(val.slice(0, degLen));
  const min = parseFloat(val.slice(degLen));
  const dd = deg + min / 60;
  return (dir === 'S' || dir === 'W') ? -dd : dd;
}

interface GsvBuffer {
  total: number;
  sentences: string[][];
}

export class NmeaAdapter implements ProtocolAdapter {
  readonly name = 'NMEA 0183';
  readonly description = 'ASCII protokół NMEA (GGA, GSV)';

  private textBuf = '';
  // Bufor GSV per talker ID: czekamy na ostatnie zdanie w grupie
  private gsvBuf = new Map<string, GsvBuffer>();

  feed(chunk: Uint8Array): ParsedData {
    this.textBuf += new TextDecoder().decode(chunk);
    const lines = this.textBuf.split('\n');
    // Zostaw ostatnią (niekompletną) linię w buforze
    this.textBuf = lines.pop() ?? '';

    const result: ParsedData = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('$')) continue;
      if (!verifyChecksum(line)) continue;

      const star = line.lastIndexOf('*');
      const body = line.slice(1, star >= 0 ? star : undefined);
      const fields = body.split(',');
      if (fields.length < 1) continue;

      const talker = fields[0].slice(0, 2);
      const type = fields[0].slice(2);

      if (type === 'GGA') {
        const fix = this._parseGGA(fields, talker);
        if (fix) result.positionFix = fix;
      } else if (type === 'GSV') {
        const obs = this._feedGSV(fields, talker);
        if (obs) {
          result.observations = [...(result.observations ?? []), ...obs];
        }
      }
    }

    return result;
  }

  reset(): void {
    this.textBuf = '';
    this.gsvBuf.clear();
  }

  private _parseGGA(f: string[], talker: string): PositionFix | null {
    // $xxGGA,time,lat,N,lon,E,fix,numSV,hdop,alt,M,sep,M,diffAge,diffRef
    if (f.length < 10) return null;
    const fixQuality = parseInt(f[6]);
    if (fixQuality === 0) return { lat: 0, lon: 0, alt: 0, fixType: 'none' };

    const lat = parseDegMin(f[2], f[3]);
    const lon = parseDegMin(f[4], f[5]);
    const alt = parseFloat(f[9]) || 0;
    const hdop = parseFloat(f[8]) || undefined;

    let fixType: PositionFix['fixType'] = '3d';
    if (fixQuality === 2) fixType = 'dgps';

    void talker;
    return { lat, lon, alt, hdop, fixType };
  }

  private _feedGSV(f: string[], talker: string): SatelliteObservation[] | null {
    // $xxGSV,totalMsg,msgNum,totalSV,{prn,el,az,snr}*4
    if (f.length < 4) return null;
    const totalMsg = parseInt(f[1]);
    const msgNum = parseInt(f[2]);
    if (isNaN(totalMsg) || isNaN(msgNum)) return null;

    const system = talkerId(talker);

    const existing = this.gsvBuf.get(talker) ?? { total: totalMsg, sentences: [] };
    existing.sentences[msgNum - 1] = f;
    existing.total = totalMsg;
    this.gsvBuf.set(talker, existing);

    if (msgNum < totalMsg) return null; // Jeszcze nie ostatnie zdanie

    // Mamy komplet — wyciągnij obserwacje
    const obs: SatelliteObservation[] = [];
    for (const sentence of existing.sentences) {
      if (!sentence) continue;
      // pola satelitów zaczynają się od indeksu 4, po 4 pola na sat
      for (let i = 4; i + 3 < sentence.length; i += 4) {
        const prn = parseInt(sentence[i]);
        const el = parseFloat(sentence[i + 1]);
        const az = parseFloat(sentence[i + 2]);
        const snr = parseFloat(sentence[i + 3]) || 0;
        if (isNaN(prn) || prn <= 0) continue;

        const prnStr = this._formatPrn(system ?? 'gps', prn);
        obs.push({
          prn: prnStr,
          system: system ?? 'gps',
          azimuth: az || 0,
          elevation: el || 0,
          snr,
          used: snr > 0,
        });
      }
    }

    this.gsvBuf.delete(talker);
    return obs;
  }

  private _formatPrn(system: GnssSystem, prn: number): string {
    const prefix: Record<GnssSystem, string> = {
      gps: 'G', galileo: 'E', glonass: 'R', beidou: 'C', qzss: 'J', navic: 'I', sbas: 'S',
    };
    return `${prefix[system]}${String(prn).padStart(2, '0')}`;
  }
}
