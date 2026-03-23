import type { SatelliteObservation } from '../protocolAdapter';
import { mapSvid } from './sbfUtils';

/**
 * Dekoduje SatVisibility (block ID 4012)
 */
export function decodeSatVisibility(block: Uint8Array): SatelliteObservation[] {
  if (block.length < 16) return [];

  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  const n      = block[14]; // liczba satelitów
  const sbSize = block[15]; // rozmiar sub-bloku (typowo 8)

  if (sbSize < 8 || block.length < 16 + n * sbSize) return [];

  const result: SatelliteObservation[] = [];
  const GNSS_PREFIX: Record<string, string> = {
    gps: 'G', galileo: 'E', glonass: 'R', beidou: 'C', qzss: 'J', navic: 'I', sbas: 'S',
  };

  for (let i = 0; i < n; i++) {
    const off = 16 + i * sbSize;
    const svid      = block[off];
    const azimuth   = dv.getUint16(off + 2, true) * 0.01; // [deg]
    const elevation = dv.getInt16(off + 4, true) * 0.01;  // [deg]

    const sat = mapSvid(svid);
    if (!sat) continue;

    const prefix = GNSS_PREFIX[sat.system] ?? '?';
    result.push({
      prn:       `${prefix}${String(sat.prn).padStart(2, '0')}`,
      system:    sat.system,
      azimuth,
      elevation,
      snr:       0, // SatVisibility nie zawiera C/N₀
      used:      elevation > 0,
    });
  }

  return result;
}
