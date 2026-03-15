import type { GnssSystem } from './satellite';

export type FreqBand = 'L1' | 'L2' | 'L5' | 'E1' | 'E5a' | 'E5b' | 'G1' | 'G2' | 'B1' | 'B2' | 'B3';

export interface RawMeasurement {
  tow: number;
  week: number;
  prn: number;
  system: GnssSystem;
  pseudorange: number;
  carrierPhase?: number;
  doppler?: number;
  snr: number;
  lockTime?: number;
  freqBand: FreqBand;
  trackingFlags?: number;
}

export interface SatelliteObservation {
  prn: string;
  system: GnssSystem;
  azimuth: number;
  elevation: number;
  snr: number;
  used: boolean;
}
