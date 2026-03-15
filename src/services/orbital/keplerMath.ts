import { MU, OMEGA_E, R_E, WGS84_E2 } from '../../constants/gnss';
import type { KeplerianEphemeris, EcefPosition, LatLonAlt } from '../../types/ephemeris';

/** Rozwiązanie równania Keplera metodą Newtona-Raphsona */
export function solveKepler(M: number, e: number, maxIter = 50, tol = 1e-12): number {
  let E = M;
  for (let i = 0; i < maxIter; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

export interface OrbitalStepData {
  tk: number;
  n: number;
  M: number;
  E: number;
  nu: number;
  phi: number;
  r: number;
  u: number;
  x_op: number;
  y_op: number;
  Omega: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Propagator Keplera GPS/Galileo (IS-GPS-200 + harmoniki sferyczne J2).
 * @param eph    Elementy orbitalne
 * @param tSec   Czas od toe [s]
 * @param ecef   true = ECEF, false = ECI
 * @param harmonics true = korektury perturbacyjne (Crc, Crs, Cuc, Cus, Cic, Cis, dn, IDOT)
 */
export function computeGPSPosition(
  eph: KeplerianEphemeris,
  tSec: number,
  ecef: boolean,
  harmonics: boolean,
): OrbitalStepData {
  const { a, e, i0, Omega0, OmegaDot, omega, M0, dn, IDOT, Cuc, Cus, Crc, Crs, Cic, Cis, toe } = eph;

  // Krok 1: czas od efemerydy
  let tk = tSec - toe;
  // Korekcja zawijania tygodnia GPS
  if (tk > 302400) tk -= 604800;
  if (tk < -302400) tk += 604800;

  // Krok 2: ruch średni
  const n0 = Math.sqrt(MU / Math.pow(a, 3));
  const n = n0 + (harmonics ? dn : 0);
  const M = M0 + n * tk;

  // Krok 3: anomalia ekscentryczna
  const E = solveKepler(M, e);

  // Krok 4: anomalia prawdziwa
  const sinE = Math.sin(E);
  const cosE = Math.cos(E);
  const nu = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e);

  // Krok 5: argument szerokości
  const phi = nu + omega;

  // Krok 6: korekcje harmoniczne
  let du = 0, dr = 0, di = 0;
  if (harmonics) {
    const sin2phi = Math.sin(2 * phi);
    const cos2phi = Math.cos(2 * phi);
    du = Cus * sin2phi + Cuc * cos2phi;
    dr = Crs * sin2phi + Crc * cos2phi;
    di = Cis * sin2phi + Cic * cos2phi;
  }
  const u = phi + du;
  const r = a * (1 - e * cosE) + (harmonics ? dr : 0);
  const i = i0 + (harmonics ? di : 0) + IDOT * tk;

  // Krok 7: pozycja w płaszczyźnie orbity
  const x_op = r * Math.cos(u);
  const y_op = r * Math.sin(u);

  // Krok 8: RAAN
  const Omega = Omega0 + (OmegaDot - (ecef ? OMEGA_E : 0)) * tk - (ecef ? OMEGA_E * toe : 0);

  // Krok 9: transformacja do XYZ
  const cosO = Math.cos(Omega);
  const sinO = Math.sin(Omega);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);

  const x = x_op * cosO - y_op * cosI * sinO;
  const y = x_op * sinO + y_op * cosI * cosO;
  const z = y_op * sinI;

  return { tk, n, M, E, nu, phi, r, u, x_op, y_op, Omega, x, y, z };
}

/** Konwersja ECEF [m] → geodetyczna (Bowring iteracyjna) */
export function ecefToLatLon(x: number, y: number, z: number): LatLonAlt {
  const lon = Math.atan2(y, x) * (180 / Math.PI);
  const p = Math.sqrt(x * x + y * y);

  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  for (let k = 0; k < 5; k++) {
    const sinLat = Math.sin(lat);
    const N = R_E / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
    lat = Math.atan2(z + WGS84_E2 * N * sinLat, p);
  }

  const latDeg = lat * (180 / Math.PI);
  const sinLatFinal = Math.sin(latDeg * (Math.PI / 180));
  const N = R_E / Math.sqrt(1 - WGS84_E2 * sinLatFinal * sinLatFinal);
  const alt = p / Math.cos(lat) - N;

  return { lat: latDeg, lon, alt };
}

/** Okres orbitalny [s] */
export function orbitalPeriod(a: number): number {
  return 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU);
}

/** Pozycja ECEF jako prosty obiekt (shortcut) */
export function satEcefPosition(
  eph: KeplerianEphemeris,
  tSec: number,
  harmonics = true,
): EcefPosition {
  const { x, y, z } = computeGPSPosition(eph, tSec, true, harmonics);
  return { x, y, z };
}
