import type { GnssSystem } from '../../../types/satellite';
import type { FreqBand } from '../../../types/rawMeasurement';

export function mapSvid(svid: number): { system: GnssSystem; prn: number } | null {
  if (svid >= 1 && svid <= 37)    return { system: 'gps',     prn: svid };
  if (svid >= 38 && svid <= 61)   return { system: 'glonass', prn: svid - 37 };
  if (svid >= 71 && svid <= 102)  return { system: 'galileo', prn: svid - 70 };
  if (svid >= 120 && svid <= 140) return { system: 'sbas',    prn: svid };
  if (svid >= 141 && svid <= 172) return { system: 'beidou',  prn: svid - 140 };
  if (svid >= 181 && svid <= 187) return { system: 'qzss',    prn: svid - 180 };
  return null;
}

// sigType = bajt Type & 0x1F (lower 5 bits = SigIdxLo)
export function mapFreqBand(svid: number, sigType: number): FreqBand {
  const s = sigType & 0x1F;
  if (svid >= 1 && svid <= 37) {        // GPS
    if (s === 2 || s === 3) return 'L2';
    if (s === 4)             return 'L5';
    return 'L1';
  }
  if (svid >= 38 && svid <= 61) {       // GLONASS
    if (s === 2 || s === 3) return 'G2';
    return 'G1';
  }
  if (svid >= 71 && svid <= 102) {      // Galileo
    if (s === 4)             return 'E5a';
    if (s === 5 || s === 6)  return 'E5b';
    return 'E1';
  }
  if (svid >= 141 && svid <= 172) {     // BeiDou
    if (s === 2 || s === 3)  return 'B2';
    if (s === 4 || s === 5)  return 'B3';
    return 'B1';
  }
  if (svid >= 181 && svid <= 187) {     // QZSS
    if (s === 3 || s === 4)  return 'L5';
    return 'L1';
  }
  return 'L1';
}
