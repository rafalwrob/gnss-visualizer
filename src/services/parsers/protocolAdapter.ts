import type { GnssSystem } from '../../types/satellite';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import type { RawMeasurement, SatelliteObservation } from '../../types/rawMeasurement';
import type { KlobucharParams } from '../../types/ionosphere';

export type { RawMeasurement, SatelliteObservation };
export interface ParsedOrbitRecord {
  prn: number;
  system: GnssSystem;
  eph: KeplerianEphemeris;
}

export interface PositionFix {
  lat: number;
  lon: number;
  alt: number;
  hdop?: number;
  fixType: 'none' | '2d' | '3d' | 'dgps';
  utcMs?: number;
}

export interface ParsedData {
  measurements?: RawMeasurement[];
  observations?: SatelliteObservation[];
  ephemerides?: ParsedOrbitRecord[];
  almanacs?: ParsedOrbitRecord[];
  positionFix?: PositionFix;
  klobuchar?: KlobucharParams;
}

export interface ProtocolAdapter {
  name: string;
  description: string;
  feed(chunk: Uint8Array): ParsedData;
  reset(): void;
}
