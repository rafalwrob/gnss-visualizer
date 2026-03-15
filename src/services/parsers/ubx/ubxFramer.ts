export interface UbxFrame {
  cls: number;
  id: number;
  payload: Uint8Array;
}

export class UbxFramer {
  private buf: number[] = [];

  feed(chunk: Uint8Array): UbxFrame[] {
    const frames: UbxFrame[] = [];
    for (let i = 0; i < chunk.length; i++) {
      this.buf.push(chunk[i]);
      const f = this._tryParse();
      if (f) frames.push(f);
    }
    return frames;
  }

  reset(): void {
    this.buf = [];
  }

  private _tryParse(): UbxFrame | null {
    // Szukaj nagłówka 0xB5 0x62
    while (this.buf.length >= 2) {
      if (this.buf[0] === 0xB5 && this.buf[1] === 0x62) break;
      this.buf.shift();
    }
    // Minimalny nagłówek: sync(2) + class(1) + id(1) + len(2) + CK_A(1) + CK_B(1) = 8B
    if (this.buf.length < 8) return null;

    const len = this.buf[4] | (this.buf[5] << 8);
    const totalLen = 6 + len + 2; // sync(2) + class + id + len(2) + payload + ck(2)
    if (this.buf.length < totalLen) return null;

    // Weryfikacja checksumy (Fletcher 8-bit nad bajtami [2..5+len])
    let ckA = 0, ckB = 0;
    for (let i = 2; i < 6 + len; i++) {
      ckA = (ckA + this.buf[i]) & 0xFF;
      ckB = (ckB + ckA) & 0xFF;
    }
    const rxCkA = this.buf[6 + len];
    const rxCkB = this.buf[7 + len];

    const frame = this.buf.splice(0, totalLen);

    if (ckA !== rxCkA || ckB !== rxCkB) {
      // Zły checksum — usuń tylko sync byte i spróbuj ponownie
      this.buf.unshift(...frame.slice(1));
      return null;
    }

    return {
      cls: frame[2],
      id: frame[3],
      payload: new Uint8Array(frame.slice(6, 6 + len)),
    };
  }
}
