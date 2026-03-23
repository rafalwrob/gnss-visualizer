export interface SbfBlock {
  blockId: number;
  tow: number;
  wnc: number;
  block: Uint8Array; // pełny blok od sync do końca
}

// CRC-16 CCITT (poly 0x1021) — tablica look-up generowana raz
const CRC_TABLE = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let j = 0; j < 8; j++) {
      c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1);
    }
    t[i] = c & 0xFFFF;
  }
  return t;
})();

function crc16(buf: number[], start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >> 8) ^ buf[i]) & 0xFF]) & 0xFFFF;
  }
  return crc;
}

export class SbfFramer {
  private buf: number[] = [];

  feed(chunk: Uint8Array): SbfBlock[] {
    const blocks: SbfBlock[] = [];
    for (let i = 0; i < chunk.length; i++) {
      this.buf.push(chunk[i]);
      const b = this._tryParse();
      if (b) blocks.push(b);
    }
    return blocks;
  }

  reset(): void {
    this.buf = [];
  }

  private _tryParse(): SbfBlock | null {
    // Szukaj sync $@ (0x24 0x40)
    while (this.buf.length >= 2) {
      if (this.buf[0] === 0x24 && this.buf[1] === 0x40) break;
      this.buf.shift();
    }
    // Minimalny nagłówek: 8 bajtów (sync+CRC+ID+Length)
    if (this.buf.length < 8) return null;

    const length = this.buf[6] | (this.buf[7] << 8);
    if (length < 8 || length > 4096) {
      // Nieprawidłowa długość — przesuń o 1 i szukaj dalej
      this.buf.shift();
      return null;
    }
    if (this.buf.length < length) return null;

    // Weryfikacja CRC — obliczane od bajtu 4 do length-1
    const rxCrc = this.buf[2] | (this.buf[3] << 8);
    const calcCrc = crc16(this.buf, 4, length);
    const raw = this.buf.splice(0, length);

    if (calcCrc !== rxCrc) {
      // Zły CRC — usuń tylko sync i spróbuj ponownie
      this.buf.unshift(...raw.slice(1));
      return null;
    }

    const blockId = (raw[4] | (raw[5] << 8)) & 0x1FFF;
    const tow = (raw[8] | (raw[9] << 8) | (raw[10] << 8 * 2) | (raw[11] << 8 * 3)) >>> 0;
    const wnc = raw[12] | (raw[13] << 8);

    return { blockId, tow, wnc, block: new Uint8Array(raw) };
  }
}
