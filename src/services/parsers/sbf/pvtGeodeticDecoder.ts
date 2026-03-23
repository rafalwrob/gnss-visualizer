import type { PositionFix } from '../protocolAdapter';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Dekoduje PVTGeodetic (block ID 4007)
 */
export function decodePvtGeodetic(block: Uint8Array): PositionFix | null {
  if (block.length < 70) return null;

  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  const tow   = dv.getUint32(8, true);
  if (tow === 0xFFFFFFFF) return null; // brak czasu

  const mode  = block[14];
  const error = block[15];
  if (error !== 0) return null; // błąd pozycji

  const modeType = mode & 0x0F;
  if (modeType === 0) return null; // brak rozwiązania

  const lat    = dv.getFloat64(16, true); // [rad]
  const lon    = dv.getFloat64(24, true); // [rad]
  const height = dv.getFloat64(32, true); // [m]

  // Sanity check
  if (!isFinite(lat) || !isFinite(lon) || !isFinite(height)) return null;

  // HAcc [cm] na offsecie 90-91 → metry
  const hacc = block.length >= 92 ? dv.getUint16(90, true) * 0.01 : undefined;
  const hdop  = hacc !== undefined ? hacc / 5 : undefined;

  let fixType: PositionFix['fixType'];
  if (modeType === 1)      fixType = '3d';
  else if (modeType >= 2)  fixType = 'dgps';
  else                     fixType = 'none';

  return {
    lat:     lat * RAD_TO_DEG,
    lon:     lon * RAD_TO_DEG,
    alt:     height,
    hdop,
    fixType,
    utcMs:   tow,
  };
}
