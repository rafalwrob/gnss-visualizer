import type { ProtocolAdapter, ParsedData, PositionFix } from './protocolAdapter';
import type { RawMeasurement, SatelliteObservation } from '../../types/rawMeasurement';
import type {
  ProtocolSchema, FieldDef, ChecksumType,
} from '../../types/protocolSchema';
import type { GnssSystem } from '../../types/satellite';
import type { FreqBand } from '../../types/rawMeasurement';

// ── Checksum ─────────────────────────────────────────────────────────────────

function checksumSize(type: ChecksumType): number {
  if (type === 'none') return 0;
  if (type === 'xor' || type === 'sum8') return 1;
  return 2; // fletcher8, crc16
}

function verifyChecksum(type: ChecksumType, data: number[], rxA: number, rxB: number): boolean {
  if (type === 'none') return true;

  if (type === 'fletcher8') {
    let a = 0, b = 0;
    for (const byte of data) { a = (a + byte) & 0xFF; b = (b + a) & 0xFF; }
    return a === rxA && b === rxB;
  }
  if (type === 'xor') {
    let x = 0;
    for (const byte of data) x ^= byte;
    return x === rxA;
  }
  if (type === 'sum8') {
    let s = 0;
    for (const byte of data) s = (s + byte) & 0xFF;
    return s === rxA;
  }
  if (type === 'crc16') {
    let crc = 0xFFFF;
    for (const byte of data) {
      crc ^= byte << 8;
      for (let i = 0; i < 8; i++) {
        if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        else crc = (crc << 1) & 0xFFFF;
      }
    }
    return crc === ((rxA << 8) | rxB);
  }
  return true;
}

// ── Field reader ─────────────────────────────────────────────────────────────

function readField(dv: DataView, field: FieldDef, baseOffset: number, le: boolean): unknown {
  const off = baseOffset + field.offset;
  let val: number;
  switch (field.type) {
    case 'u8':  val = dv.getUint8(off); break;
    case 'u16': val = dv.getUint16(off, le); break;
    case 'u32': val = dv.getUint32(off, le); break;
    case 'i8':  val = dv.getInt8(off); break;
    case 'i16': val = dv.getInt16(off, le); break;
    case 'i32': val = dv.getInt32(off, le); break;
    case 'f32': return (dv.getFloat32(off, le)) * (field.scale ?? 1);
    case 'f64': return (dv.getFloat64(off, le)) * (field.scale ?? 1);
    default: return 0;
  }
  if (field.map) return field.map[val] ?? val;
  return val * (field.scale ?? 1);
}

function parseFields(payload: Uint8Array, fields: FieldDef[], itemOffset: number, le: boolean): Record<string, unknown> {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const key = field.as ?? field.name;
    result[key] = readField(dv, field, itemOffset, le);
  }
  return result;
}

// ── Output builders ──────────────────────────────────────────────────────────

function buildPositionFix(fields: Record<string, unknown>): PositionFix | null {
  const lat = fields.lat as number;
  const lon = fields.lon as number;
  if (lat == null || lon == null) return null;
  return {
    lat,
    lon,
    alt: (fields.alt as number) ?? 0,
    hdop: fields.hdop as number | undefined,
    fixType: (fields.fixType as PositionFix['fixType']) ?? '3d',
    utcMs: fields.utcMs as number | undefined,
  };
}

function buildMeasurement(fields: Record<string, unknown>): RawMeasurement | null {
  const prn = fields.prn as number;
  const pseudorange = fields.pseudorange as number;
  if (prn == null || pseudorange == null) return null;
  return {
    tow: (fields.tow as number) ?? 0,
    week: (fields.week as number) ?? 0,
    prn,
    system: (fields.system as GnssSystem) ?? 'gps',
    pseudorange,
    carrierPhase: fields.carrierPhase as number | undefined,
    doppler: fields.doppler as number | undefined,
    snr: (fields.snr as number) ?? 0,
    freqBand: (fields.freqBand as FreqBand) ?? 'L1',
    trackingFlags: fields.trackingFlags as number | undefined,
  };
}

function prnStr(system: GnssSystem, num: number): string {
  const pfx: Record<GnssSystem, string> = {
    gps:'G', galileo:'E', glonass:'R', beidou:'C', qzss:'J', navic:'I', sbas:'S',
  };
  return `${pfx[system] ?? '?'}${String(num).padStart(2, '0')}`;
}

function buildObservation(fields: Record<string, unknown>): SatelliteObservation | null {
  const system = (fields.system as GnssSystem) ?? 'gps';
  const prnNum = fields.prnNum as number;
  const prn = typeof fields.prn === 'string'
    ? fields.prn
    : prnStr(system, prnNum ?? 0);
  return {
    prn,
    system,
    azimuth: (fields.azimuth as number) ?? 0,
    elevation: (fields.elevation as number) ?? 0,
    snr: (fields.snr as number) ?? 0,
    used: (fields.used as unknown) === true || (fields.used as number) === 1,
  };
}

// ── SchemaAdapter (framer + dispatcher) ──────────────────────────────────────

export class SchemaAdapter implements ProtocolAdapter {
  readonly name: string;
  readonly description: string;
  private buf: number[] = [];
  private schema: ProtocolSchema;

  constructor(schema: ProtocolSchema) {
    this.schema = schema;
    this.name = schema.name;
    this.description = schema.description;
  }

  feed(chunk: Uint8Array): ParsedData {
    for (let i = 0; i < chunk.length; i++) this.buf.push(chunk[i]);
    const result: ParsedData = {};

    let frame = this._tryFrame();
    while (frame) {
      const partial = this._dispatch(frame.msgId, frame.payload);
      mergeData(result, partial);
      frame = this._tryFrame();
    }
    return result;
  }

  reset(): void {
    this.buf = [];
  }

  private _tryFrame(): { msgId: number; payload: Uint8Array } | null {
    const cfg = this.schema.frame;
    const sync = cfg.sync;
    const csSize = checksumSize(cfg.checksum);
    const trailerSize = cfg.trailer?.length ?? 0;

    while (true) {
      // Znajdź sync
      if (this.buf.length < sync.length) return null;
      let syncIdx = -1;
      outer: for (let i = 0; i <= this.buf.length - sync.length; i++) {
        for (let j = 0; j < sync.length; j++) {
          if (this.buf[i + j] !== sync[j]) continue outer;
        }
        syncIdx = i;
        break;
      }
      if (syncIdx < 0) {
        // Brak sync — zachowaj ostatnie sync.length-1 bajtów
        this.buf = this.buf.slice(-(sync.length - 1));
        return null;
      }
      if (syncIdx > 0) this.buf = this.buf.slice(syncIdx);

      // Czy mamy pełny nagłówek?
      if (this.buf.length < cfg.headerSize) return null;

      // Odczytaj msgId i payloadLen z nagłówka
      const le = cfg.endian === 'LE';
      const msgId = readInt(this.buf, cfg.msgId.offset, cfg.msgId.size, le);
      const payloadLen = readInt(this.buf, cfg.payloadLen.offset, cfg.payloadLen.size, le);

      const totalLen = cfg.headerSize + payloadLen + csSize + trailerSize;
      if (this.buf.length < totalLen) return null;

      // Weryfikacja checksumy
      if (cfg.checksum !== 'none') {
        const checked = this.buf.slice(sync.length, cfg.headerSize + payloadLen);
        const csOff = cfg.headerSize + payloadLen;
        const ok = verifyChecksum(cfg.checksum, checked, this.buf[csOff], this.buf[csOff + 1] ?? 0);
        if (!ok) {
          this.buf = this.buf.slice(1);
          continue;
        }
      }

      // Weryfikacja trailera
      if (cfg.trailer?.length) {
        const trOff = cfg.headerSize + payloadLen + csSize;
        for (let i = 0; i < cfg.trailer.length; i++) {
          if (this.buf[trOff + i] !== cfg.trailer[i]) {
            this.buf = this.buf.slice(1);
            continue; // outer loop
          }
        }
      }

      const payload = new Uint8Array(this.buf.slice(cfg.headerSize, cfg.headerSize + payloadLen));
      this.buf = this.buf.slice(totalLen);
      return { msgId, payload };
    }
  }

  private _dispatch(msgId: number, payload: Uint8Array): ParsedData {
    const def = this.schema.messages[msgId];
    if (!def) return {};

    const le = this.schema.frame.endian === 'LE';
    const result: ParsedData = {};

    if (!def.repeat) {
      // Pojedynczy element
      const fields = parseFields(payload, def.fields, 0, le);
      applySingleOutput(result, def.output, fields);
    } else {
      // Powtarzający się element
      const rp = def.repeat;
      const countDv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      const count = rp.countSize === 1
        ? countDv.getUint8(rp.countOffset)
        : countDv.getUint16(rp.countOffset, le);
      const headerPayloadOffset = rp.countOffset + rp.countSize;
      for (let i = 0; i < count; i++) {
        const itemOff = headerPayloadOffset + i * rp.itemSize;
        if (itemOff + rp.itemSize > payload.byteLength) break;
        const fields = parseFields(payload, def.fields, itemOff, le);
        applyArrayOutput(result, def.output, fields);
      }
    }

    return result;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readInt(buf: number[], offset: number, size: 1 | 2 | 4, le: boolean): number {
  if (size === 1) return buf[offset];
  if (size === 2) return le
    ? (buf[offset] | (buf[offset + 1] << 8))
    : ((buf[offset] << 8) | buf[offset + 1]);
  // 4
  if (le) return (buf[offset] | (buf[offset+1]<<8) | (buf[offset+2]<<16) | (buf[offset+3]<<24)) >>> 0;
  return ((buf[offset]<<24) | (buf[offset+1]<<16) | (buf[offset+2]<<8) | buf[offset+3]) >>> 0;
}

function applySingleOutput(result: ParsedData, output: string, fields: Record<string, unknown>): void {
  if (output === 'positionFix') {
    const fix = buildPositionFix(fields);
    if (fix) result.positionFix = fix;
  } else if (output === 'measurements') {
    const m = buildMeasurement(fields);
    if (m) result.measurements = [...(result.measurements ?? []), m];
  } else if (output === 'observations') {
    const o = buildObservation(fields);
    if (o) result.observations = [...(result.observations ?? []), o];
  }
}

function applyArrayOutput(result: ParsedData, output: string, fields: Record<string, unknown>): void {
  applySingleOutput(result, output, fields);
}

function mergeData(target: ParsedData, src: ParsedData): void {
  if (src.positionFix) target.positionFix = src.positionFix;
  if (src.measurements?.length) target.measurements = [...(target.measurements ?? []), ...src.measurements];
  if (src.observations?.length) target.observations = [...(target.observations ?? []), ...src.observations];
  if (src.ephemerides?.length) target.ephemerides = [...(target.ephemerides ?? []), ...src.ephemerides];
  if (src.klobuchar) target.klobuchar = src.klobuchar;
}
