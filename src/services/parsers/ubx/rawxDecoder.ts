import type { RawMeasurement } from '../../../types/rawMeasurement';
import type { GnssSystem } from '../../../types/satellite';
import type { FreqBand } from '../../../types/rawMeasurement';

// gnssId → GnssSystem
function mapGnssId(id: number): GnssSystem | null {
  switch (id) {
    case 0: return 'gps';
    case 2: return 'galileo';
    case 3: return 'beidou';
    case 5: return 'qzss';
    case 6: return 'glonass';
    default: return null;
  }
}

// sigId → pasmo częstotliwości
function mapFreqBand(gnssId: number, sigId: number): FreqBand {
  switch (gnssId) {
    case 0: // GPS
      return sigId === 3 ? 'L2' : sigId === 4 ? 'L5' : 'L1';
    case 2: // Galileo
      return sigId === 5 ? 'E5a' : sigId === 6 ? 'E5b' : 'E1';
    case 3: // BeiDou
      return sigId === 2 ? 'B2' : sigId === 3 ? 'B3' : 'B1';
    case 6: // GLONASS
      return sigId === 2 ? 'G2' : 'G1';
    default:
      return 'L1';
  }
}

/**
 * Dekoduje UBX-RXM-RAWX (cls=0x02, id=0x15)
 */
export function decodeRawx(payload: Uint8Array): RawMeasurement[] {
  if (payload.length < 16) return [];

  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const rcvTow = dv.getFloat64(0, true);
  const week = dv.getUint16(8, true);
  const numMeas = dv.getUint8(11);

  const result: RawMeasurement[] = [];
  for (let i = 0; i < numMeas; i++) {
    const off = 16 + i * 32;
    if (off + 32 > payload.length) break;

    const prMes = dv.getFloat64(off, true);
    const cpMes = dv.getFloat64(off + 8, true);
    const doMes = dv.getFloat32(off + 16, true);
    const gnssId = dv.getUint8(off + 20);
    const svId = dv.getUint8(off + 21);
    const sigId = dv.getUint8(off + 22);
    const cno = dv.getUint8(off + 26);
    const trkStat = dv.getUint8(off + 30);

    const system = mapGnssId(gnssId);
    if (!system) continue;
    if (prMes === 0) continue; // brak pomiaru

    result.push({
      tow: rcvTow,
      week,
      prn: svId,
      system,
      pseudorange: prMes,
      carrierPhase: (trkStat & 0x01) ? cpMes : undefined,
      doppler: doMes,
      snr: cno,
      freqBand: mapFreqBand(gnssId, sigId),
      trackingFlags: trkStat,
    });
  }
  return result;
}
