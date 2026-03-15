import type { GnssSystem } from '../types/satellite';
export type { GnssSystem };

/** Stała grawitacyjna Ziemi [m³/s²] */
export const MU = 3.986005e14;

/** Prędkość kątowa obrotu Ziemi [rad/s] */
export const OMEGA_E = 7.2921151467e-5;

/** Promień równikowy Ziemi [m] (WGS-84) */
export const R_E = 6378137.0;

/** Spłaszczenie WGS-84 (b = a*(1-f)) */
export const WGS84_B = 6356752.3142;

/** e² WGS-84 */
export const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (R_E * R_E);

export interface GnssSystemInfo {
  name: string;
  /** Typowa półoś wielka [m] */
  a: number;
  /** Inklinacja [rad] */
  i0: number;
  /** Typowy mimośród */
  e: number;
  /** Kolor hex */
  color: string;
  /** Okres orbitalny [h] */
  period: number;
}

export const GNSS_SYSTEMS: Record<GnssSystem, GnssSystemInfo> = {
  gps: { name: 'GPS', a: 26559800, i0: 55 * (Math.PI / 180), e: 0.005, color: '#1f6feb', period: 11.97 },
  galileo: { name: 'Galileo', a: 29600000, i0: 56 * (Math.PI / 180), e: 0.002, color: '#f0883e', period: 14.08 },
  glonass: { name: 'GLONASS', a: 25510000, i0: 64.8 * (Math.PI / 180), e: 0.001, color: '#da3633', period: 11.26 },
  beidou: { name: 'BeiDou', a: 27906000, i0: 55 * (Math.PI / 180), e: 0.001, color: '#f7c948', period: 12.63 },
  qzss: { name: 'QZSS', a: 42164000, i0: 43 * (Math.PI / 180), e: 0.075, color: '#3fb950', period: 23.93 },
  navic: { name: 'NavIC', a: 42164000, i0: 29 * (Math.PI / 180), e: 0.001, color: '#a5d6ff', period: 23.93 },
  sbas: { name: 'SBAS', a: 42164000, i0: 0, e: 0.0001, color: '#8957e5', period: 23.93 },
};

/** Kolory płaszczyzn orbitalnych dla każdego systemu */
export const PLANE_COLORS: Record<GnssSystem, string[]> = {
  gps:     ['#79c0ff', '#58a6ff', '#388bfd', '#1f6feb', '#2d73b8', '#1a4a8a'],
  galileo: ['#ffa05c', '#f0883e', '#d96820'],
  glonass: ['#ff8878', '#e84040', '#b91c1c'],
  beidou:  ['#fde047', '#f7c948', '#d4a017', '#a07810'],
  qzss:    ['#4ade80', '#3fb950', '#22863a'],
  navic:   ['#7dd3fc', '#a5d6ff', '#38bdf8'],
  sbas:    ['#c4b5fd', '#8957e5', '#6e40c9'],
};
