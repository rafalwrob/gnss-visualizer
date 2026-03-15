import { describe, it, expect } from 'vitest';
import { UbxFramer } from './ubxFramer';

/** Buduje poprawną ramkę UBX */
function buildFrame(cls: number, id: number, payload: number[]): Uint8Array {
  const len = payload.length;
  const buf = [0xB5, 0x62, cls, id, len & 0xFF, (len >> 8) & 0xFF, ...payload, 0, 0];
  let ckA = 0, ckB = 0;
  for (let i = 2; i < 6 + len; i++) {
    ckA = (ckA + buf[i]) & 0xFF;
    ckB = (ckB + ckA) & 0xFF;
  }
  buf[6 + len] = ckA;
  buf[7 + len] = ckB;
  return new Uint8Array(buf);
}

describe('UbxFramer', () => {
  it('parsuje prostą ramkę w jednym kawałku', () => {
    const framer = new UbxFramer();
    const frame = buildFrame(0x02, 0x15, [1, 2, 3, 4]);
    const result = framer.feed(frame);
    expect(result).toHaveLength(1);
    expect(result[0].cls).toBe(0x02);
    expect(result[0].id).toBe(0x15);
    expect(Array.from(result[0].payload)).toEqual([1, 2, 3, 4]);
  });

  it('parsuje ramkę podzieloną na fragmenty', () => {
    const framer = new UbxFramer();
    const frame = buildFrame(0x0A, 0x04, [0xAA, 0xBB]);
    // Wyślij po 1 bajcie
    const frames = [];
    for (const byte of frame) {
      frames.push(...framer.feed(new Uint8Array([byte])));
    }
    expect(frames).toHaveLength(1);
    expect(frames[0].cls).toBe(0x0A);
    expect(frames[0].id).toBe(0x04);
  });

  it('odrzuca ramkę ze złym checksumem', () => {
    const framer = new UbxFramer();
    const frame = buildFrame(0x02, 0x15, [1, 2]);
    // Zepsuj checksum
    const bad = new Uint8Array(frame);
    bad[bad.length - 1] ^= 0xFF;
    const result = framer.feed(bad);
    expect(result).toHaveLength(0);
  });

  it('parsuje dwie ramki z rzędu', () => {
    const framer = new UbxFramer();
    const f1 = buildFrame(0x01, 0x07, [0x01]);
    const f2 = buildFrame(0x02, 0x13, [0x05, 0x06]);
    const combined = new Uint8Array([...f1, ...f2]);
    const result = framer.feed(combined);
    expect(result).toHaveLength(2);
    expect(result[0].cls).toBe(0x01);
    expect(result[1].cls).toBe(0x02);
  });

  it('ignoruje śmieci przed nagłówkiem', () => {
    const framer = new UbxFramer();
    const frame = buildFrame(0x02, 0x15, [0xAA]);
    const garbage = new Uint8Array([0xFF, 0x00, 0x12, ...frame]);
    const result = framer.feed(garbage);
    expect(result).toHaveLength(1);
  });

  it('reset() czyści bufor', () => {
    const framer = new UbxFramer();
    const frame = buildFrame(0x02, 0x15, [1, 2, 3]);
    // Wyślij tylko połowę
    framer.feed(frame.slice(0, 4));
    framer.reset();
    // Po resecie kompletna ramka powinna działać
    const result = framer.feed(frame);
    expect(result).toHaveLength(1);
  });
});
