import { describe, it, expect } from 'vitest';
import { latLonAltToEcef, satElevAz, computeDOP } from './ecefEnu';
import { ecefToLatLon } from '../orbital/keplerMath';
import { R_E } from '../../constants/gnss';

// ─── latLonAltToEcef ──────────────────────────────────────────────────────────

describe('latLonAltToEcef', () => {
  it('punkt na równiku lon=0 alt=0 → x≈R_E, y≈0, z≈0', () => {
    const { x, y, z } = latLonAltToEcef(0, 0, 0);
    expect(x).toBeCloseTo(R_E, 0);
    expect(y).toBeCloseTo(0, 3);
    expect(z).toBeCloseTo(0, 3);
  });

  it('round-trip Warszawa: lat=52.23, lon=21.01, alt=100m', () => {
    const { x, y, z } = latLonAltToEcef(52.23, 21.01, 100);
    const back = ecefToLatLon(x, y, z);
    expect(Math.abs(back.lat - 52.23)).toBeLessThan(1e-6);
    expect(Math.abs(back.lon - 21.01)).toBeLessThan(1e-6);
    expect(Math.abs(back.alt - 100)).toBeLessThan(0.1);
  });

  it('biegun północny: lat=90 → x≈0, y≈0, z>0', () => {
    const { x, y, z } = latLonAltToEcef(90, 0, 0);
    expect(x).toBeCloseTo(0, 0);
    expect(y).toBeCloseTo(0, 3);
    expect(z).toBeGreaterThan(0);
  });
});

// ─── satElevAz ────────────────────────────────────────────────────────────────

describe('satElevAz', () => {
  it('satelita wprost nad głową (el≈90°)', () => {
    // obserwator na równiku, sat powyżej tego samego miejsca
    const { x: ox } = latLonAltToEcef(0, 0, 0);
    const { el } = satElevAz(ox * 2, 0, 0, 0, 0, 0);
    expect(el).toBeCloseTo(90, 0);
  });

  it('satelita na horyzoncie na północy (el≈0°, az≈0°)', () => {
    // obserwator na równiku lon=0, sat daleko w kierunku +Z (north)
    // ECEF z ob=(R_E,0,0), sat=(R_E, 0, R_E*10000) → dx=0,dy=0,dz=very large
    const { el, az } = satElevAz(R_E, 0, R_E * 10000, 0, 0, 0);
    expect(el).toBeCloseTo(0, 1);
    expect(az).toBeCloseTo(0, 1);  // north = 0°
  });

  it('satelita na wschodzie (az≈90°)', () => {
    // obserwator na równiku lon=0, sat na tym samym lat, przesunięty na wschód
    // W ENU: east=+Y ze względu na wzór, sprawdzamy az≈90
    const { x: ox, y: oy, z: oz } = latLonAltToEcef(0, 0, 0);
    const { az } = satElevAz(ox, oy + R_E * 10000, oz, 0, 0, 0);
    expect(az).toBeCloseTo(90, 0);
  });
});

// ─── computeDOP ───────────────────────────────────────────────────────────────

describe('computeDOP', () => {
  it('< 4 satelity → null', () => {
    const sats = [
      { el: 45, az: 0 },
      { el: 45, az: 120 },
      { el: 45, az: 240 },
    ];
    expect(computeDOP(sats)).toBeNull();
  });

  it('zdegenerowana geometria (identyczne wektory) → null', () => {
    const sats = Array.from({ length: 4 }, () => ({ el: 45, az: 90 }));
    expect(computeDOP(sats)).toBeNull();
  });

  it('dobra geometria → PDOP < 3', () => {
    // 1 satelita zenital + 3 na el=15° w odstępach 120°
    const sats = [
      { el: 90, az: 0 },
      { el: 15, az: 0 },
      { el: 15, az: 120 },
      { el: 15, az: 240 },
    ];
    const dop = computeDOP(sats);
    expect(dop).not.toBeNull();
    expect(dop!.pdop).toBeLessThan(3);
  });

  it('zła geometria (saty skupione na NE, różne el) → PDOP > 5', () => {
    // Brak pokrycia S/W → słabe PDOP; różne el unikają osobliwości macierzy
    const sats = [
      { el: 5,  az: 10 },
      { el: 20, az: 20 },
      { el: 35, az: 15 },
      { el: 50, az: 25 },
    ];
    const dop = computeDOP(sats);
    expect(dop).not.toBeNull();
    expect(dop!.pdop).toBeGreaterThan(5);
  });

  it('zwraca wszystkie składowe DOP', () => {
    const sats = [
      { el: 90, az: 0 },
      { el: 20, az: 0 },
      { el: 20, az: 90 },
      { el: 20, az: 180 },
      { el: 20, az: 270 },
    ];
    const dop = computeDOP(sats);
    expect(dop).not.toBeNull();
    expect(dop!.gdop).toBeGreaterThan(0);
    expect(dop!.pdop).toBeGreaterThan(0);
    expect(dop!.hdop).toBeGreaterThan(0);
    expect(dop!.vdop).toBeGreaterThan(0);
    expect(dop!.tdop).toBeGreaterThan(0);
    // GDOP ≥ PDOP (zawiera składową czasową)
    expect(dop!.gdop).toBeGreaterThanOrEqual(dop!.pdop);
  });
});
