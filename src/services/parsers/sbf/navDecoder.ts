import type { KeplerianEphemeris } from '../../../types/ephemeris';
import type { GnssSystem } from '../../../types/satellite';
import type { ParsedOrbitRecord } from '../protocolAdapter';
import { GNSS_SYSTEMS, MU } from '../../../constants/gnss';
import { mapSvid } from './sbfUtils';
import { almanacToKepler, glonassStateToKepler } from './orbitConversion';

const PI = Math.PI;

const BLOCK_GAL_NAV = 4002;
const BLOCK_GLO_NAV = 4004;
const BLOCK_GLO_ALM = 4005;
const BLOCK_GAL_ALM = 4003;
const BLOCK_BDS_NAV = 4081;
const BLOCK_BDS_ALM = 4119;
const BLOCK_QZS_ALM = 4116;
const BLOCK_GPS_NAV = 5891;
const BLOCK_GPS_ALM = 5892;

interface DecodedOrbit extends ParsedOrbitRecord {}

function readF32(dv: DataView, offset: number): number {
  return dv.getFloat32(offset, true);
}

function readF64(dv: DataView, offset: number): number {
  return dv.getFloat64(offset, true);
}

function readU32(dv: DataView, offset: number): number {
  return dv.getUint32(offset, true);
}

function semicirclesToRad(value: number): number {
  return value * PI;
}

function makeEphemeris(fields: Pick<KeplerianEphemeris, 'a' | 'e' | 'i0' | 'Omega0' | 'omega' | 'M0' | 'toe'>): KeplerianEphemeris {
  return {
    a: fields.a,
    e: fields.e,
    i0: fields.i0,
    Omega0: fields.Omega0,
    OmegaDot: 0,
    omega: fields.omega,
    M0: fields.M0,
    dn: 0,
    IDOT: 0,
    Cuc: 0,
    Cus: 0,
    Crc: 0,
    Crs: 0,
    Cic: 0,
    Cis: 0,
    toe: fields.toe,
  };
}

function isSaneEphemeris(eph: KeplerianEphemeris): boolean {
  return Number.isFinite(eph.a) &&
    Number.isFinite(eph.e) &&
    Number.isFinite(eph.i0) &&
    Number.isFinite(eph.Omega0) &&
    Number.isFinite(eph.omega) &&
    Number.isFinite(eph.M0) &&
    Number.isFinite(eph.toe) &&
    eph.a > 1.0e7 &&
    eph.a < 5.0e7 &&
    eph.e >= 0 &&
    eph.e < 1.0 &&
    eph.toe >= 0 &&
    eph.toe <= 604800;
}

function wrap(system: GnssSystem, prn: number, eph: KeplerianEphemeris | null): DecodedOrbit | null {
  if (!eph || !isSaneEphemeris(eph)) return null;
  return { prn, system, eph };
}

function decodeGpsLikeNav(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 128) return null;
  const sat = mapSvid(block[14]);
  if (!sat) return null;

  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
  const sqrtA = readF64(dv, 80);
  return wrap(sat.system, sat.prn, makeEphemeris({
    a: sqrtA * sqrtA,
    e: readF64(dv, 68),
    i0: semicirclesToRad(readF64(dv, 108)),
    Omega0: semicirclesToRad(readF64(dv, 96)),
    omega: semicirclesToRad(readF64(dv, 120)),
    M0: semicirclesToRad(readF64(dv, 56)),
    toe: readU32(dv, 32),
  }));
}

function decodeGalNav(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 104) return null;
  const sat = mapSvid(block[14]);
  if (!sat || sat.system !== 'galileo') return null;

  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);
  const sqrtA = readF64(dv, 16);
  return wrap(sat.system, sat.prn, makeEphemeris({
    a: sqrtA * sqrtA,
    e: readF64(dv, 32),
    i0: semicirclesToRad(readF64(dv, 40)),
    Omega0: semicirclesToRad(readF64(dv, 48)),
    omega: semicirclesToRad(readF64(dv, 24)),
    M0: semicirclesToRad(readF64(dv, 56)),
    toe: readU32(dv, 100),
  }));
}

function decodeGloNav(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 80) return null;
  const sat = mapSvid(block[14]);
  if (!sat || sat.system !== 'glonass') return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  const eph = glonassStateToKepler(
    readF64(dv, 16),
    readF64(dv, 24),
    readF64(dv, 32),
    readF32(dv, 40),
    readF32(dv, 44),
    readF32(dv, 48),
    readU32(dv, 60),
  );
  return wrap(sat.system, sat.prn, eph);
}

function decodeGpsAlm(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 56) return null;
  const sat = mapSvid(block[14]);
  if (!sat || sat.system !== 'gps') return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  return wrap(sat.system, sat.prn, almanacToKepler('gps', {
    sqrtA: readF32(dv, 32),
    e: readF32(dv, 16),
    deltaI: semicirclesToRad(readF32(dv, 24)),
    Omega0: semicirclesToRad(readF32(dv, 36)),
    OmegaDot: semicirclesToRad(readF32(dv, 28)),
    omega: semicirclesToRad(readF32(dv, 40)),
    M0: semicirclesToRad(readF32(dv, 44)),
    toe: readU32(dv, 20),
  }));
}

function decodeGalAlm(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 60) return null;
  const sat = mapSvid(block[54]);
  if (!sat || sat.system !== 'galileo') return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  return wrap(sat.system, sat.prn, almanacToKepler('galileo', {
    sqrtA: readF32(dv, 32),
    e: readF32(dv, 16),
    deltaI: semicirclesToRad(readF32(dv, 24)),
    Omega0: semicirclesToRad(readF32(dv, 36)),
    OmegaDot: semicirclesToRad(readF32(dv, 28)),
    omega: semicirclesToRad(readF32(dv, 40)),
    M0: semicirclesToRad(readF32(dv, 44)),
    toe: readU32(dv, 20),
  }));
}

function decodeBdsAlm(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 52) return null;
  const sat = mapSvid(block[14]);
  if (!sat || sat.system !== 'beidou') return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  return wrap(sat.system, sat.prn, almanacToKepler('beidou', {
    sqrtA: readF32(dv, 20),
    e: readF32(dv, 24),
    deltaI: semicirclesToRad(readF32(dv, 44)),
    Omega0: semicirclesToRad(readF32(dv, 36)),
    OmegaDot: semicirclesToRad(readF32(dv, 40)),
    omega: semicirclesToRad(readF32(dv, 28)),
    M0: semicirclesToRad(readF32(dv, 32)),
    toe: readU32(dv, 16),
  }));
}

function decodeQzsAlm(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 56) return null;
  const sat = mapSvid(block[14] + 180);
  if (!sat || sat.system !== 'qzss') return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  return wrap(sat.system, sat.prn, almanacToKepler('qzss', {
    sqrtA: readF32(dv, 32),
    e: readF32(dv, 16),
    deltaI: semicirclesToRad(readF32(dv, 24)),
    Omega0: semicirclesToRad(readF32(dv, 36)),
    OmegaDot: semicirclesToRad(readF32(dv, 28)),
    omega: semicirclesToRad(readF32(dv, 40)),
    M0: semicirclesToRad(readF32(dv, 44)),
    toe: readU32(dv, 20),
  }));
}

function decodeGloAlm(block: Uint8Array): DecodedOrbit | null {
  if (block.length < 52) return null;
  const sat = mapSvid(block[14]);
  if (!sat || sat.system !== 'glonass') return null;
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength);

  const nominalPeriod = 40544;
  const deltaT = readF32(dv, 36);
  const period = nominalPeriod + deltaT;
  const a = Math.cbrt(MU * Math.pow(period / (2 * PI), 2));
  const nominalI = GNSS_SYSTEMS.glonass.i0;
  const deltaI = semicirclesToRad(readF32(dv, 24));

  return wrap(sat.system, sat.prn, {
    a,
    e: readF32(dv, 16),
    i0: nominalI + deltaI,
    Omega0: semicirclesToRad(readF32(dv, 28)),
    OmegaDot: 0,
    omega: semicirclesToRad(readF32(dv, 36 - 4)),
    M0: 0,
    dn: 0,
    IDOT: 0,
    Cuc: 0,
    Cus: 0,
    Crc: 0,
    Crs: 0,
    Cic: 0,
    Cis: 0,
    toe: readU32(dv, 20),
  });
}

export function decodeNavBlock(blockId: number, block: Uint8Array): DecodedOrbit | null {
  switch (blockId) {
    case BLOCK_GPS_NAV:
    case BLOCK_BDS_NAV:
      return decodeGpsLikeNav(block);
    case BLOCK_GAL_NAV:
      return decodeGalNav(block);
    case BLOCK_GLO_NAV:
      return decodeGloNav(block);
    default:
      return null;
  }
}

export function decodeAlmanacBlock(blockId: number, block: Uint8Array): DecodedOrbit | null {
  switch (blockId) {
    case BLOCK_GPS_ALM:
      return decodeGpsAlm(block);
    case BLOCK_GAL_ALM:
      return decodeGalAlm(block);
    case BLOCK_GLO_ALM:
      return decodeGloAlm(block);
    case BLOCK_BDS_ALM:
      return decodeBdsAlm(block);
    case BLOCK_QZS_ALM:
      return decodeQzsAlm(block);
    default:
      return null;
  }
}
