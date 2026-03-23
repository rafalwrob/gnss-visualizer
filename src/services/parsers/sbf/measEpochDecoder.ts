import type { RawMeasurement } from '../../../types/rawMeasurement';
import { mapSvid, mapFreqBand } from './sbfUtils';

/**
 * Dekoduje MeasEpoch (block ID 4027)
 * Zwraca pomiary z Type1 sub-bloków (primary signal per satelita).
 */
export function decodeMeasEpoch(block: Uint8Array): RawMeasurement[] {
  if (block.length < 20) return [];

  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  const tow  = dv.getUint32(8, true);  // [ms]
  const wnc  = dv.getUint16(12, true);
  const n1   = block[14]; // liczba Type1 sub-bloków
  const sb1  = block[15]; // rozmiar Type1 sub-bloku (typowo 20)
  const sb2  = block[16]; // rozmiar Type2 sub-bloku (typowo 12)

  if (sb1 < 20 || block.length < 20 + n1 * sb1) return [];

  const towSec = tow === 0xFFFFFFFF ? 0 : tow / 1000;
  const result: RawMeasurement[] = [];

  let off = 20; // Type1 sub-bloki zaczynają się od bajtu 20

  for (let i = 0; i < n1; i++) {
    if (off + sb1 > block.length) break;

    const sigType = block[off + 1];
    const svid    = block[off + 2];
    const codeMsb = block[off + 3] & 0x0F;
    const codeLsb = dv.getUint32(off + 4, true);
    const doppler = dv.getInt32(off + 8, true);       // × 0.0001 Hz
    const carrLsb = dv.getUint16(off + 12, true);     // × 0.001 cycles
    const carrMsb = dv.getInt8(off + 14);              // × 65.536 cycles
    const cn0Raw  = block[off + 15];                   // × 0.25 dB-Hz
    const n2      = block[off + 19]; // liczba Type2 sub-bloków dla tego satelity

    const sat = mapSvid(svid);
    if (sat && codeLsb > 0) {
      const pseudorange = (codeMsb * 4294967296 + codeLsb) * 0.001;
      const carrierPhase = (carrMsb * 65536 + carrLsb) * 0.001;

      result.push({
        tow:          towSec,
        week:         wnc,
        prn:          sat.prn,
        system:       sat.system,
        pseudorange,
        carrierPhase: carrierPhase !== 0 ? carrierPhase : undefined,
        doppler:      doppler * 0.0001,
        snr:          cn0Raw * 0.25,
        freqBand:     mapFreqBand(svid, sigType),
      });
    }

    // Przesuń o rozmiar Type1 + N2 × rozmiar Type2
    off += sb1 + n2 * sb2;
  }

  return result;
}
