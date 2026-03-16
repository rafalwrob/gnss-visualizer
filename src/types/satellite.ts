import type { KeplerianEphemeris } from './ephemeris';

export type GnssSystem = 'gps' | 'galileo' | 'glonass' | 'beidou' | 'qzss' | 'navic' | 'sbas';

export interface SatelliteRecord {
  prn: string;
  system: GnssSystem;
  plane: number;
  color: string;
  eph: KeplerianEphemeris;
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
