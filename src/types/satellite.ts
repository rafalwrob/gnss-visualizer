import type { KeplerianEphemeris } from './ephemeris';

export type GnssSystem = 'gps' | 'galileo' | 'glonass' | 'beidou' | 'qzss' | 'navic' | 'sbas';

export interface SatelliteRecord {
  prn: string;
  system: GnssSystem;
  plane: number;
  color: string;
  eph: KeplerianEphemeris;
}

export interface SatDbEntry {
  name: string;
  block: string;
  launched: string;
  norad: number;
  freqs: string[];
}
