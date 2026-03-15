import { describe, it, expect } from 'vitest';
import { decodeRawx } from './rawxDecoder';

/** Buduje minimalne payload UBX-RXM-RAWX */
function buildRawxPayload(opts: {
  rcvTow: number;
  week: number;
  measurements: Array<{
    prMes: number;
    cpMes: number;
    doMes: number;
    gnssId: number;
    svId: number;
    sigId: number;
    cno: number;
    trkStat: number;
  }>;
}): Uint8Array {
  const numMeas = opts.measurements.length;
  const buf = new ArrayBuffer(16 + numMeas * 32);
  const dv = new DataView(buf);
  dv.setFloat64(0, opts.rcvTow, true);
  dv.setUint16(8, opts.week, true);
  dv.setUint8(11, numMeas);
  for (let i = 0; i < numMeas; i++) {
    const m = opts.measurements[i];
    const off = 16 + i * 32;
    dv.setFloat64(off, m.prMes, true);
    dv.setFloat64(off + 8, m.cpMes, true);
    dv.setFloat32(off + 16, m.doMes, true);
    dv.setUint8(off + 20, m.gnssId);
    dv.setUint8(off + 21, m.svId);
    dv.setUint8(off + 22, m.sigId);
    dv.setUint8(off + 26, m.cno);
    dv.setUint8(off + 30, m.trkStat);
  }
  return new Uint8Array(buf);
}

describe('decodeRawx', () => {
  it('dekoduje pomiar GPS L1', () => {
    const payload = buildRawxPayload({
      rcvTow: 123456.789,
      week: 2300,
      measurements: [{
        prMes: 23000000.5,
        cpMes: 121412345.5,
        doMes: -500.0,
        gnssId: 0, // GPS
        svId: 7,
        sigId: 0,  // L1
        cno: 45,
        trkStat: 0x01, // carrier phase valid
      }],
    });
    const result = decodeRawx(payload);
    expect(result).toHaveLength(1);
    expect(result[0].system).toBe('gps');
    expect(result[0].prn).toBe(7);
    expect(result[0].pseudorange).toBeCloseTo(23000000.5, 1);
    expect(result[0].snr).toBe(45);
    expect(result[0].freqBand).toBe('L1');
    expect(result[0].tow).toBeCloseTo(123456.789, 3);
    expect(result[0].week).toBe(2300);
  });

  it('mapuje gnssId=2 → galileo', () => {
    const payload = buildRawxPayload({
      rcvTow: 0,
      week: 1,
      measurements: [{
        prMes: 25000000,
        cpMes: 0,
        doMes: 0,
        gnssId: 2, // Galileo
        svId: 3,
        sigId: 0,
        cno: 35,
        trkStat: 0,
      }],
    });
    const result = decodeRawx(payload);
    expect(result[0].system).toBe('galileo');
  });

  it('ignoruje nieznane gnssId', () => {
    const payload = buildRawxPayload({
      rcvTow: 0,
      week: 1,
      measurements: [{
        prMes: 25000000,
        cpMes: 0,
        doMes: 0,
        gnssId: 99, // nieznane
        svId: 1,
        sigId: 0,
        cno: 30,
        trkStat: 0,
      }],
    });
    expect(decodeRawx(payload)).toHaveLength(0);
  });

  it('ignoruje pomiary z prMes=0', () => {
    const payload = buildRawxPayload({
      rcvTow: 100,
      week: 1,
      measurements: [{
        prMes: 0,
        cpMes: 0,
        doMes: 0,
        gnssId: 0,
        svId: 5,
        sigId: 0,
        cno: 20,
        trkStat: 0,
      }],
    });
    expect(decodeRawx(payload)).toHaveLength(0);
  });

  it('mapuje sigId=3 GPS → L2', () => {
    const payload = buildRawxPayload({
      rcvTow: 0,
      week: 1,
      measurements: [{
        prMes: 23500000,
        cpMes: 0,
        doMes: 0,
        gnssId: 0,
        svId: 12,
        sigId: 3, // L2
        cno: 38,
        trkStat: 0,
      }],
    });
    expect(decodeRawx(payload)[0].freqBand).toBe('L2');
  });
});
