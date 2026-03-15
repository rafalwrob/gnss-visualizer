import type { KeplerianEphemeris } from '../../../types/ephemeris';
import type { GnssSystem } from '../../../types/satellite';

const PI = Math.PI;

interface SfrbxResult {
  prn: number;
  system: GnssSystem;
  eph: KeplerianEphemeris;
}

/** Wyciąga n bitów unsigned zaczynając od MSB=msb (0=bit29) z 30-bit word */
function unsignedBits(word: number, msb: number, n: number): number {
  return (word >>> (29 - msb)) & ((1 << n) - 1);
}

/** Sign-extend n-bitową wartość do int32 */
function signExtend(val: number, bits: number): number {
  const sign = 1 << (bits - 1);
  return (val & sign) ? val - (1 << bits) : val;
}

/** Wyciąga n bitów signed z 30-bit word */
function signedBits(word: number, msb: number, n: number): number {
  return signExtend(unsignedBits(word, msb, n), n);
}

interface SubframeBuffer {
  sf1?: number[];
  sf2?: number[];
  sf3?: number[];
}

export class SfrbxDecoder {
  private buffers = new Map<string, SubframeBuffer>();

  /**
   * Przetwarza ramkę UBX-RXM-SFRBX.
   * Zwraca efemerydy gdy SF1+SF2+SF3 kompletne (tylko GPS L1 C/A).
   */
  feed(payload: Uint8Array): SfrbxResult | null {
    if (payload.length < 8) return null;
    const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    const gnssId = dv.getUint8(0);
    const svId = dv.getUint8(1);
    const numWords = dv.getUint8(4);

    // Obsługujemy tylko GPS (gnssId=0)
    if (gnssId !== 0) return null;
    if (payload.length < 8 + numWords * 4) return null;

    // Wyciągnij dwrd[] — bity [29:0] każdego słowa
    const dwrd: number[] = [];
    for (let i = 0; i < numWords; i++) {
      dwrd.push(dv.getUint32(8 + i * 4, true) & 0x3FFFFFFF);
    }
    if (dwrd.length < 2) return null;

    // Subframe ID z HOW (word 2 = dwrd[1]), bity [19:17]
    const sfId = unsignedBits(dwrd[1], 19, 3);
    if (sfId < 1 || sfId > 3) return null;

    const key = `${gnssId}-${svId}`;
    const buf: SubframeBuffer = this.buffers.get(key) ?? {};

    if (sfId === 1) buf.sf1 = dwrd;
    else if (sfId === 2) buf.sf2 = dwrd;
    else if (sfId === 3) buf.sf3 = dwrd;

    this.buffers.set(key, buf);

    if (buf.sf1 && buf.sf2 && buf.sf3) {
      const eph = this._decode(buf.sf1, buf.sf2, buf.sf3);
      if (eph) {
        this.buffers.delete(key);
        return { prn: svId, system: 'gps', eph };
      }
    }
    return null;
  }

  reset(): void {
    this.buffers.clear();
  }

  private _decode(sf1: number[], sf2: number[], sf3: number[]): KeplerianEphemeris | null {
    if (sf1.length < 10 || sf2.length < 10 || sf3.length < 10) return null;

    // ── Subframe 1 (words 3-10 = dwrd[2..9]) ──
    const week10 = unsignedBits(sf1[2], 22, 10);
    const tgd = signedBits(sf1[6], 15, 8) * Math.pow(2, -31);
    const toc = unsignedBits(sf1[7], 23, 16) * 16;
    const af2 = signedBits(sf1[8], 7, 8) * Math.pow(2, -55);
    const af1 = signedBits(sf1[8], 23, 16) * Math.pow(2, -43);
    const af0Raw = unsignedBits(sf1[9], 29, 22);
    const af0 = signExtend(af0Raw, 22) * Math.pow(2, -31);

    // Suppress unused vars (tgd, toc, af2, af1, af0 — używane w pełnym dekoderze zegarowym)
    void tgd; void toc; void af2; void af1; void af0;

    // ── Subframe 2 (words 3-10 = dwrd[2..9]) ──
    const Crs = signedBits(sf2[2], 23, 16) * Math.pow(2, -5);
    const dn = signedBits(sf2[3], 23, 16) * Math.pow(2, -43) * PI;
    const M0_hi = signedBits(sf2[3], 7, 8);
    const M0_lo = unsignedBits(sf2[4], 29, 24); // tylko 24 bity młodsze
    const M0 = (M0_hi * Math.pow(2, 24) + M0_lo) * Math.pow(2, -31) * PI;
    const Cuc = signedBits(sf2[4], 5, 16) * Math.pow(2, -29);
    const e_hi = signedBits(sf2[5], 29, 8);
    const e_lo = unsignedBits(sf2[6], 29, 24);
    const e = (((e_hi & 0xFF) * Math.pow(2, 24)) + e_lo) * Math.pow(2, -33);
    const Cus = signedBits(sf2[6], 5, 16) * Math.pow(2, -29);
    const sqrtA_hi = unsignedBits(sf2[7], 29, 8);
    const sqrtA_lo = unsignedBits(sf2[8], 29, 24);
    const sqrtA = (sqrtA_hi * Math.pow(2, 24) + sqrtA_lo) * Math.pow(2, -19);
    const a = sqrtA * sqrtA;
    const toe = unsignedBits(sf2[8], 5, 16) * 16;

    // ── Subframe 3 (words 3-10 = dwrd[2..9]) ──
    const Cic = signedBits(sf3[2], 23, 16) * Math.pow(2, -29);
    const Omega0_hi = signedBits(sf3[2], 7, 8);
    const Omega0_lo = unsignedBits(sf3[3], 29, 24);
    const Omega0 = (Omega0_hi * Math.pow(2, 24) + Omega0_lo) * Math.pow(2, -31) * PI;
    const Cis = signedBits(sf3[3], 5, 16) * Math.pow(2, -29);
    const i0_hi = signedBits(sf3[4], 29, 8);
    const i0_lo = unsignedBits(sf3[5], 29, 24);
    const i0 = (i0_hi * Math.pow(2, 24) + i0_lo) * Math.pow(2, -31) * PI;
    const Crc = signedBits(sf3[5], 5, 16) * Math.pow(2, -5);
    const omega_hi = signedBits(sf3[6], 29, 8);
    const omega_lo = unsignedBits(sf3[7], 29, 24);
    const omega = (omega_hi * Math.pow(2, 24) + omega_lo) * Math.pow(2, -31) * PI;
    const OmegaDot = signedBits(sf3[7], 5, 24) * Math.pow(2, -43) * PI;
    const IDOT_raw = unsignedBits(sf3[9], 13, 14);
    const IDOT = signExtend(IDOT_raw, 14) * Math.pow(2, -43) * PI;

    void week10;

    return {
      a, e, i0, Omega0, OmegaDot, omega, M0,
      dn, IDOT, Cuc, Cus, Crc, Crs, Cic, Cis, toe,
    };
  }
}
