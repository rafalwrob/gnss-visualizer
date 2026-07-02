import type { KeplerianEphemeris } from './ephemeris';

export type GnssSystem = 'gps' | 'galileo' | 'glonass' | 'beidou' | 'qzss' | 'navic' | 'sbas';

/** Surowe elementy średnie z GP/TLE — pozwalają przeliczyć efemerydę na nową kotwicę czasu */
export interface GpMeta {
  /** Epoka elementów [Unix ms] */
  epochMs: number;
  /** Ruch średni [rad/s] */
  n: number;
  /** Półoś wielka [m] */
  a: number;
  e: number;
  /** Inklinacja [rad] */
  i: number;
  /** RAAN w epoce [rad, inercjalny — względem punktu γ] */
  raan: number;
  /** Argument perygeum [rad] */
  argp: number;
  /** Anomalia średnia w epoce [rad] */
  m: number;
  /** Precesja węzła J2 [rad/s] */
  raanDot: number;
}

export interface SatelliteRecord {
  prn: string;
  system: GnssSystem;
  plane: number;
  color: string;
  eph: KeplerianEphemeris;
  /** Surowe elementy GP — do przeliczenia eph przy zmianie czasu symulacji */
  gpMeta?: GpMeta;
  /** TLE lines z CelesTrak GP JSON — używane przez propagator SGP4 */
  tleLine1?: string;
  tleLine2?: string;
  /** Sparsowany obiekt satellite.js SatRec (twoline2satrec) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  satrec?: any;
}

export interface SatDbEntry {
  name: string;
  block: string;
  launched: string;
  norad: number;
  freqs: string[];
}
