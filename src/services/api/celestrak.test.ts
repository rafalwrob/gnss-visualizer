import { describe, it, expect } from 'vitest';
import { twoline2satrec } from 'satellite.js';
import { anchorEphemeris, propagateSGP4 } from './celestrak';
import { computeGPSPosition } from '../orbital/keplerMath';
import { satElevAz } from '../coordinates/ecefEnu';
import { MU } from '../../constants/gnss';
import type { GpMeta } from '../../types/satellite';

const PI2 = 2 * Math.PI;
const D = (deg: number) => deg * Math.PI / 180;
const J2 = 1.0826257e-3;
const R_E = 6378137;

// Fixture: NAVSTAR 62 (USA 201), GPS Block IIR-M, NORAD 32711
// Elementy GP z CelesTrak, epoka 2026-07-01T02:17:44.477088Z
const TLE1 = '1 32711U 08012A   26182.09565367  .00000035  00000+0  00000+0 0  9991';
const TLE2 = '2 32711  54.4990 149.3692 0211504 248.0010 109.7035  2.00572867134032';

const GP = {
  EPOCH: '2026-07-01T02:17:44.477088',
  MEAN_MOTION: 2.00572867,      // obr/dobę
  ECCENTRICITY: 0.02115048,
  INCLINATION: 54.499,          // °
  RA_OF_ASC_NODE: 149.3692,     // °
  ARG_OF_PERICENTER: 248.001,   // °
  MEAN_ANOMALY: 109.7035,       // °
};

function buildMeta(): GpMeta {
  const n = (GP.MEAN_MOTION * PI2) / 86400;
  const a = Math.cbrt(MU / (n * n));
  const i = D(GP.INCLINATION);
  const e = GP.ECCENTRICITY;
  const ratio = R_E / a;
  const raanDot = -1.5 * n * J2 * ratio * ratio * Math.cos(i) / Math.pow(1 - e * e, 2);
  return {
    epochMs: Date.parse(GP.EPOCH + 'Z'),
    n, a, e, i,
    raan: D(GP.RA_OF_ASC_NODE),
    argp: D(GP.ARG_OF_PERICENTER),
    m: D(GP.MEAN_ANOMALY),
    raanDot,
  };
}

describe('anchorEphemeris — zgodność propagatora Keplera z SGP4 w ECEF', () => {
  const satrec = twoline2satrec(TLE1, TLE2);
  const meta = buildMeta();
  const anchorMs = Date.parse('2026-07-02T12:00:00Z');
  const eph = anchorEphemeris(meta, anchorMs);

  it('pozycja ECEF w t=0 zgodna z SGP4 (tolerancja 300 km ≪ błąd GMST ~kilka tys. km)', () => {
    const kep = computeGPSPosition(eph, 0, true, false);
    const sgp = propagateSGP4(satrec, new Date(anchorMs))!;
    expect(sgp).not.toBeNull();
    const d = Math.hypot(kep.x - sgp.x, kep.y - sgp.y, kep.z - sgp.z);
    expect(d).toBeLessThan(300_000);
  });

  it('pozycja ECEF po 2h nadal zgodna z SGP4', () => {
    const t = 7200;
    const kep = computeGPSPosition(eph, t, true, false);
    const sgp = propagateSGP4(satrec, new Date(anchorMs + t * 1000))!;
    const d = Math.hypot(kep.x - sgp.x, kep.y - sgp.y, kep.z - sgp.z);
    expect(d).toBeLessThan(300_000);
  });

  it('elewacja/azymut z Warszawy zgodne między propagatorami (<1.5°)', () => {
    const kep = computeGPSPosition(eph, 0, true, false);
    const sgp = propagateSGP4(satrec, new Date(anchorMs))!;
    const a = satElevAz(kep.x, kep.y, kep.z, 52.23, 21.01, 100);
    const b = satElevAz(sgp.x, sgp.y, sgp.z, 52.23, 21.01, 100);
    expect(Math.abs(a.el - b.el)).toBeLessThan(1.5);
    const dAz = Math.abs(((a.az - b.az + 540) % 360) - 180);
    expect(dAz).toBeLessThan(1.5);
  });

  it('promień orbity ~26 560 km (sanity check GPS MEO)', () => {
    const kep = computeGPSPosition(eph, 0, true, false);
    const r = Math.hypot(kep.x, kep.y, kep.z);
    expect(r).toBeGreaterThan(25_000_000);
    expect(r).toBeLessThan(28_000_000);
  });
});
