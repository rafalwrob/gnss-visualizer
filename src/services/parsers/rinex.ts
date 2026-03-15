import type { SatelliteRecord, GnssSystem } from '../../types/satellite';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import type { KlobucharParams } from '../../types/ionosphere';
import { PLANE_COLORS } from '../../constants/gnss';

export interface RinexParseResult {
  satellites: SatelliteRecord[];
  klobuchar?: KlobucharParams;
  version: number;
}

/**
 * Parser RINEX nawigacyjny v2 i v3 (GPS + Galileo).
 * Porzuca duplikaty PRN — zachowuje pierwszą efemerydę.
 */
export function parseRinex(text: string): RinexParseResult {
  const lines = text.split('\n');
  let i = 0;
  let version = 3;
  let klobuchar: KlobucharParams | undefined;

  // Parsuj nagłówek
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes('RINEX VERSION / TYPE')) {
      version = parseFloat(line.substring(0, 9).trim());
    }
    if (line.includes('ION ALPHA') || line.includes('IONOSPHERIC CORR') && line.includes('GPSA')) {
      klobuchar = parseKlobucharAlpha(line, klobuchar);
    }
    if (line.includes('ION BETA') || line.includes('IONOSPHERIC CORR') && line.includes('GPSB')) {
      klobuchar = parseKlobucharBeta(line, klobuchar);
    }
    if (line.includes('END OF HEADER')) { i++; break; }
    i++;
  }

  const isV3 = version >= 3;
  const seen = new Set<string>();
  const satellites: SatelliteRecord[] = [];

  while (i < lines.length) {
    const line = lines[i];
    if (!line || !line.trim() || line.startsWith('>')) { i++; continue; }

    let sys: string;
    let prn: string;

    if (isV3) {
      if (!line.match(/^[GE]\d{2}/)) { i++; continue; }
      sys = line[0];
      prn = line.substring(0, 3).trim();
    } else {
      if (!line.match(/^\s{0,2}\d{1,2}\s/)) { i++; continue; }
      sys = 'G';
      prn = 'G' + line.substring(0, 2).trim().padStart(2, '0');
    }
    i++;

    const orbitLines: string[] = [];
    for (let k = 0; k < 7 && i < lines.length; k++) {
      orbitLines.push(lines[i++]);
    }
    if (orbitLines.length < 5) continue;
    if (seen.has(prn)) continue;
    seen.add(prn);

    try {
      const eph = parseEphemerisLines(orbitLines, isV3);
      if (!eph) continue;

      const sysName: GnssSystem = sys === 'E' ? 'galileo' : 'gps';
      const colors = PLANE_COLORS[sysName];
      satellites.push({
        prn,
        system: sysName,
        plane: 0,
        color: colors[satellites.length % colors.length],
        eph,
      });
    } catch {
      // pomiń uszkodzony rekord
    }
  }

  return { satellites, klobuchar, version };
}

function parseEphemerisLines(orbitLines: string[], isV3: boolean): KeplerianEphemeris | null {
  const vals = isV3 ? valsV3 : valsV2;
  const o1 = vals(orbitLines[0]);
  const o2 = vals(orbitLines[1]);
  const o3 = vals(orbitLines[2]);
  const o4 = vals(orbitLines[3]);
  const o5 = vals(orbitLines[4]);

  const sqrtA = o2[3];
  if (!sqrtA || sqrtA < 1000) return null;

  return {
    a: sqrtA * sqrtA,
    e: o2[1],
    i0: o4[0],
    Omega0: o3[2],
    OmegaDot: o4[3],
    omega: o4[2],
    M0: o1[3],
    dn: o1[2],
    IDOT: o5[0],
    Cuc: o2[0],
    Cus: o2[2],
    Crc: o4[1],
    Crs: o1[1],
    Cic: o3[1],
    Cis: o3[3],
    toe: 0,
  };
}

function valsV3(line: string): number[] {
  const v: number[] = [];
  for (let j = 0; j < 4; j++) {
    const s = line.substring(4 + j * 19, 4 + j * 19 + 19).trim().replace(/[Dd]/g, 'E');
    v.push(s ? parseFloat(s) : 0);
  }
  return v;
}

function valsV2(line: string): number[] {
  const parts = line.trim().replace(/[Dd]/g, 'E').split(/\s+/);
  return [0, 1, 2, 3].map(k => (parts[k] ? parseFloat(parts[k]) : 0));
}

function parseKlobucharAlpha(line: string, prev?: KlobucharParams): KlobucharParams {
  const base = prev ?? { a0: 0, a1: 0, a2: 0, a3: 0, b0: 0, b1: 0, b2: 0, b3: 0 };
  const nums = extractScientificNums(line.substring(0, 60));
  return { ...base, a0: nums[0] ?? 0, a1: nums[1] ?? 0, a2: nums[2] ?? 0, a3: nums[3] ?? 0 };
}

function parseKlobucharBeta(line: string, prev?: KlobucharParams): KlobucharParams {
  const base = prev ?? { a0: 0, a1: 0, a2: 0, a3: 0, b0: 0, b1: 0, b2: 0, b3: 0 };
  const nums = extractScientificNums(line.substring(0, 60));
  return { ...base, b0: nums[0] ?? 0, b1: nums[1] ?? 0, b2: nums[2] ?? 0, b3: nums[3] ?? 0 };
}

function extractScientificNums(s: string): number[] {
  return (s.match(/-?\d+\.\d+[EeDd][+-]?\d+/g) ?? []).map(n => parseFloat(n.replace(/[Dd]/g, 'E')));
}
