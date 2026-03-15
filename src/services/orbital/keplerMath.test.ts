import { describe, it, expect } from 'vitest';
import { solveKepler, computeGPSPosition, ecefToLatLon, orbitalPeriod } from './keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';

const GPS_DEFAULT_EPH: KeplerianEphemeris = {
  a: 26559800, e: 0.005, i0: 55 * (Math.PI / 180),
  Omega0: 0, OmegaDot: -8.0e-9, omega: 0, M0: 0,
  dn: 4.0e-9, IDOT: 2.0e-10,
  Cuc: 1.0e-6, Cus: 1.0e-6, Crc: 200, Crs: 20,
  Cic: 1.0e-7, Cis: 1.0e-7, toe: 0,
};

describe('solveKepler', () => {
  it('M=0 → E=0', () => {
    expect(solveKepler(0, 0.005)).toBeCloseTo(0, 10);
  });

  it('M=E gdy e=0 (okrąg)', () => {
    const M = 1.234;
    expect(solveKepler(M, 0)).toBeCloseTo(M, 10);
  });

  it('spełnia równanie Keplera E - e*sin(E) = M', () => {
    const M = 2.5, e = 0.01;
    const E = solveKepler(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
  });

  it('wysokie e działa poprawnie', () => {
    const M = Math.PI / 2, e = 0.3;
    const E = solveKepler(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 8);
  });
});

describe('computeGPSPosition', () => {
  it('promień w pobliżu nominalnego GPS (~26 560 km)', () => {
    const pos = computeGPSPosition(GPS_DEFAULT_EPH, 0, false, true);
    const r = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
    expect(r).toBeGreaterThan(26_000_000);
    expect(r).toBeLessThan(27_000_000);
  });

  it('pozycja przesuwa się w czasie', () => {
    const p0 = computeGPSPosition(GPS_DEFAULT_EPH, 0, true, true);
    const p1 = computeGPSPosition(GPS_DEFAULT_EPH, 3600, true, true);
    const d = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2 + (p1.z - p0.z) ** 2);
    expect(d).toBeGreaterThan(1000); // musi się ruszyć
  });

  it('po jednym pełnym okresie satelita wraca do startu (ECI, OmegaDot=0)', () => {
    // OmegaDot=0 → brak precesji, orbita idealnie zamknięta
    const eph0: KeplerianEphemeris = { ...GPS_DEFAULT_EPH, OmegaDot: 0, dn: 0 };
    const T = orbitalPeriod(eph0.a);
    const p0 = computeGPSPosition(eph0, 0, false, false);
    const pT = computeGPSPosition(eph0, T, false, false);
    const d = Math.sqrt((pT.x - p0.x) ** 2 + (pT.y - p0.y) ** 2 + (pT.z - p0.z) ** 2);
    expect(d).toBeLessThan(1); // zamknięta orbita (Keplera)
  });

  it('Galileo: promień w pobliżu ~29 600 km', () => {
    const eph: KeplerianEphemeris = {
      ...GPS_DEFAULT_EPH, a: 29600000, i0: 56 * (Math.PI / 180), e: 0.002,
    };
    const pos = computeGPSPosition(eph, 0, false, false);
    const r = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
    expect(r).toBeGreaterThan(29_000_000);
    expect(r).toBeLessThan(30_500_000);
  });

  it('orbita jest prokoplanarna (z ≠ 0 dla i0=55°)', () => {
    const pos = computeGPSPosition(GPS_DEFAULT_EPH, 3600, false, false);
    expect(Math.abs(pos.z)).toBeGreaterThan(1_000_000);
  });
});

describe('ecefToLatLon', () => {
  it('punkt na biegunie północnym', () => {
    const { lat, alt } = ecefToLatLon(0, 0, 6356752);
    expect(lat).toBeCloseTo(90, 1);
    expect(alt).toBeLessThan(10000);
  });

  it('punkt na równiku / południk 0', () => {
    const { lat, lon, alt } = ecefToLatLon(6378137, 0, 0);
    expect(lat).toBeCloseTo(0, 1);
    expect(lon).toBeCloseTo(0, 1);
    expect(alt).toBeLessThan(5000);
  });

  it('satelita GPS: alt ~20 000 km', () => {
    const pos = computeGPSPosition(GPS_DEFAULT_EPH, 0, true, false);
    const { alt } = ecefToLatLon(pos.x, pos.y, pos.z);
    expect(alt / 1000).toBeGreaterThan(19_000);
    expect(alt / 1000).toBeLessThan(22_000);
  });
});

describe('orbitalPeriod', () => {
  it('GPS ~11.97h', () => {
    const T = orbitalPeriod(26559800);
    expect(T / 3600).toBeCloseTo(11.97, 0);
  });

  it('Galileo ~14.08h', () => {
    const T = orbitalPeriod(29600000);
    expect(T / 3600).toBeCloseTo(14.08, 0);
  });
});
