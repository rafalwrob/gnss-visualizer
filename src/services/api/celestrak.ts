import { twoline2satrec, json2satrec, propagate, gstime, eciToEcf } from 'satellite.js';
import type { SatelliteRecord, GnssSystem, GpMeta } from '../../types/satellite';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { MU, R_E, PLANE_COLORS } from '../../constants/gnss';

const PI2 = 2 * Math.PI;
const D   = (deg: number) => deg * Math.PI / 180;
const SEC_PER_DAY = 86400;
const J2  = 1.0826257e-3;

interface GpRecord {
  OBJECT_NAME:       string;
  NORAD_CAT_ID:      number;
  EPOCH:             string;
  MEAN_MOTION:       number;   // obroty/dobę
  ECCENTRICITY:      number;
  INCLINATION:       number;   // stopnie
  RA_OF_ASC_NODE:    number;   // stopnie
  ARG_OF_PERICENTER: number;   // stopnie
  MEAN_ANOMALY:      number;   // stopnie
  SEMIMAJOR_AXIS?:   number;   // km (opcjonalne)
  TLE_LINE1?:        string;   // dla propagatora SGP4
  TLE_LINE2?:        string;
}

interface SystemConfig {
  /** CelesTrak GROUP= parametr (alternatywa: catnrList) */
  group?: string;
  /** Lista NORAD CATNR — gdy GROUP nie istnieje (np. QZSS) */
  catnrList?: number[];
  /** Prefiks PRN (G, E, R, C, J, I) */
  prefix: string;
  /** Liczba płaszczyzn orbitalnych (do podziału kolorów) */
  planes: number;
  /** Filtr nazwy obiektu (pusty = brak filtrowania) */
  nameFilter: string;
  /** Wyciągnij numer PRN z nazwy satelity */
  prnExtract: (name: string, idx: number) => string;
}

/** Prędkość precesji węzła wstępującego J2 [rad/s] */
function omegaDotJ2(a: number, i: number, e: number, n: number): number {
  const ratio = R_E / a;
  return -1.5 * n * J2 * ratio * ratio * Math.cos(i) / Math.pow(1 - e * e, 2);
}

const CONFIGS: Partial<Record<GnssSystem, SystemConfig>> = {
  gps: {
    group: 'gps-ops', prefix: 'G', planes: 6, nameFilter: 'GPS',
    prnExtract: (name, idx) => {
      const m = name.match(/PRN\s*(\d+)/i);
      return m ? `G${m[1].padStart(2, '0')}` : `G${String(idx + 1).padStart(2, '0')}`;
    },
  },
  galileo: {
    group: 'galileo', prefix: 'E', planes: 3, nameFilter: '',
    prnExtract: (name, idx) => {
      const m = name.match(/GALILEO\s*(\d+)/i) ?? name.match(/GSAT0*(\d+)/i);
      return m ? `E${String(parseInt(m[1])).padStart(2, '0')}` : `E${String(idx + 1).padStart(2, '0')}`;
    },
  },
  glonass: {
    group: 'glo-ops', prefix: 'R', planes: 3, nameFilter: '',
    prnExtract: (_name, idx) => `R${String(idx + 1).padStart(2, '0')}`,
  },
  beidou: {
    group: 'beidou', prefix: 'C', planes: 4, nameFilter: '',
    prnExtract: (_name, idx) => `C${String(idx + 1).padStart(2, '0')}`,
  },
  qzss: {
    // CelesTrak nie ma GROUP=qzss — pobieramy po NORAD CATNR
    // QZS-2, QZS-3, QZS-4, QZS-1R (operacyjne od 2017-2021)
    // POMINIĘTY: QZS-1 (NORAD 37158) — wycofany 2021, na orbicie cmentarnej (a=46098km, T=27.4h)
    catnrList: [42738, 42917, 42965, 49336],
    prefix: 'J', planes: 1, nameFilter: '',
    prnExtract: (_name, idx) => `J${String(idx + 1).padStart(2, '0')}`,
  },
  navic: {
    group: 'irnss', prefix: 'I', planes: 2, nameFilter: '',
    prnExtract: (name, idx) => {
      const m = name.match(/IRNSS-1([A-I])/i);
      if (m) return `I${String(m[1].toUpperCase().charCodeAt(0) - 64).padStart(2, '0')}`;
      return `I${String(idx + 1).padStart(2, '0')}`;
    },
  },
};

// ---------- Cache ----------

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 godzina
const cacheKey = (sys: GnssSystem) => `celestrak_v2_${sys}`;

interface GpCache { timestamp: number; data: GpRecord[]; }

function readCache(sys: GnssSystem): GpRecord[] | null {
  const raw = localStorage.getItem(cacheKey(sys));
  if (!raw) return null;
  const c: GpCache = JSON.parse(raw);
  return Date.now() - c.timestamp < CACHE_TTL_MS ? c.data : null;
}

function writeCache(sys: GnssSystem, data: GpRecord[]) {
  localStorage.setItem(cacheKey(sys), JSON.stringify({ timestamp: Date.now(), data }));
}

// ---------- Fetch ----------

const BASE = 'https://celestrak.org/NORAD/elements/gp.php';

async function fetchOne(url: string): Promise<GpRecord[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CelesTrak ${res.status}: ${res.statusText}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as GpRecord[];
  } catch {
    // CelesTrak zwraca tekst błędu gdy endpoint nie istnieje
    const msg = text.slice(0, 120).replace(/<[^>]+>/g, '').trim();
    throw new Error(`CelesTrak: ${msg || 'nieprawidłowa odpowiedź'}`);
  }
}

async function fetchGp(system: GnssSystem): Promise<GpRecord[]> {
  const cfg = CONFIGS[system];
  if (!cfg) throw new Error(`System ${system} nie jest obsługiwany w trybie online`);

  const cached = readCache(system);
  if (cached) return cached;

  let data: GpRecord[];
  if (cfg.catnrList) {
    // Parallel fetch po NORAD CATNR (dla systemów bez dedykowanej grupy)
    const results = await Promise.all(
      cfg.catnrList.map(id => fetchOne(`${BASE}?CATNR=${id}&FORMAT=json`))
    );
    data = results.flat();
  } else {
    data = await fetchOne(`${BASE}?GROUP=${cfg.group}&FORMAT=json`);
  }

  writeCache(system, data);
  return data;
}

// ---------- GP → SatelliteRecord ----------

/**
 * Przelicza surowe elementy GP na efemerydę zakotwiczoną w anchorMs.
 *
 * Konwencja: computeGPSPosition(eph, t, ecef=true) z toe=0 liczy
 *   Ω_ecef(t) = Ω₀ + (Ω̇ − ωₑ)·t
 * więc Ω₀ musi być długością geograficzną węzła w chwili anchor:
 *   Ω₀ = RAAN_inercjalny(anchor) − GMST(anchor)
 * Bez odjęcia GMST cała konstelacja byłaby obrócona wokół osi Z
 * o kąt gwiazdowy Greenwich (błąd el/az/śladów do 360°).
 */
export function anchorEphemeris(meta: GpMeta, anchorMs: number): KeplerianEphemeris {
  const dt   = (anchorMs - meta.epochMs) / 1000;
  const gmst = gstime(new Date(anchorMs)); // [rad]

  const M0     = ((meta.m + meta.n * dt) % PI2 + PI2) % PI2;
  const Omega0 = ((meta.raan + meta.raanDot * dt - gmst) % PI2 + PI2) % PI2;

  return {
    a: meta.a, e: meta.e, i0: meta.i,
    Omega0, OmegaDot: meta.raanDot,
    omega: meta.argp,
    M0, dn: 0, IDOT: 0,
    Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0,
    toe: 0,
  };
}

/** Przelicza efemerydy rekordów na nową kotwicę czasu (rekordy bez gpMeta pozostają bez zmian) */
export function reanchorRecords(sats: SatelliteRecord[], anchorMs: number): SatelliteRecord[] {
  return sats.map(s => s.gpMeta ? { ...s, eph: anchorEphemeris(s.gpMeta, anchorMs) } : s);
}

function gpToRecord(gp: GpRecord, anchorMs: number, system: GnssSystem, cfg: SystemConfig, idx: number): SatelliteRecord {
  const i  = D(gp.INCLINATION);
  const e  = gp.ECCENTRICITY;
  const n  = (gp.MEAN_MOTION * PI2) / SEC_PER_DAY;
  const a  = gp.SEMIMAJOR_AXIS ? gp.SEMIMAJOR_AXIS * 1000 : Math.cbrt(MU / (n * n));
  const wd = omegaDotJ2(a, i, e, n);

  const meta: GpMeta = {
    epochMs: Date.parse(gp.EPOCH),
    n, a, e, i,
    raan: D(gp.RA_OF_ASC_NODE),
    argp: D(gp.ARG_OF_PERICENTER),
    m: D(gp.MEAN_ANOMALY),
    raanDot: wd,
  };

  const eph = anchorEphemeris(meta, anchorMs);

  // Kolor płaszczyzny wg inercjalnego RAAN (stabilny, niezależny od pory doby)
  const raanNow  = ((meta.raan + wd * ((anchorMs - meta.epochMs) / 1000)) % PI2 + PI2) % PI2;
  const colors   = PLANE_COLORS[system];
  const planeDeg = 360 / cfg.planes;
  const plane    = Math.min(Math.floor((raanNow * 180 / Math.PI) / planeDeg), colors.length - 1);
  const color    = colors[plane];
  const prn      = cfg.prnExtract(gp.OBJECT_NAME, idx);

  const record: SatelliteRecord = { prn, system, plane, color, eph, gpMeta: meta };
  if (gp.TLE_LINE1 && gp.TLE_LINE2) {
    record.tleLine1 = gp.TLE_LINE1;
    record.tleLine2 = gp.TLE_LINE2;
    try {
      record.satrec = twoline2satrec(gp.TLE_LINE1, gp.TLE_LINE2);
    } catch {
      // ignoruj błędy parsowania TLE — fallback do Keplera
    }
  } else {
    // GP JSON (format OMM) nie zawiera linii TLE — buduj SatRec bezpośrednio z OMM
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      record.satrec = json2satrec(gp as any);
    } catch {
      // fallback do Keplera
    }
  }
  return record;
}

// ---------- Publiczne API ----------

/**
 * Pobiera aktualną konstelację GNSS z CelesTrak (cache 1h).
 * Obsługuje: GPS, Galileo, GLONASS, BeiDou, QZSS, NavIC.
 * @param anchorMs Unix ms, w którym timeSec=0 (domyślnie teraz) —
 *                 musi odpowiadać originowi zegara animacji.
 */
export async function fetchConstellation(system: GnssSystem, anchorMs: number = Date.now()): Promise<SatelliteRecord[]> {
  const cfg = CONFIGS[system];
  if (!cfg) throw new Error(`System ${system} nie jest obsługiwany w trybie online`);

  const records = await fetchGp(system);

  const byName = cfg.nameFilter
    ? records.filter(r => r.OBJECT_NAME.toUpperCase().includes(cfg.nameFilter.toUpperCase()))
    : records;

  // Usuń obiekty których orbita przecina Ziemię (np. satelity w orbicie transferowej)
  // Perigeum musi być >10% ponad powierzchnią Ziemi
  const MIN_PERIGEE = R_E * 1.1;
  const sane = byName.filter(r => {
    const n = (r.MEAN_MOTION * PI2) / SEC_PER_DAY;
    const a = r.SEMIMAJOR_AXIS ? r.SEMIMAJOR_AXIS * 1000 : Math.cbrt(MU / (n * n));
    return a * (1 - r.ECCENTRICITY) > MIN_PERIGEE;
  });

  return sane
    .map((r, idx) => gpToRecord(r, anchorMs, system, cfg, idx))
    .sort((a, b) => a.prn.localeCompare(b.prn, undefined, { numeric: true }));
}

/** Czy dany system GNSS jest obsługiwany w trybie online */
export function isOnlineSupported(system: GnssSystem): boolean {
  return system in CONFIGS;
}

/** Zwraca wiek danych w cache [ms] lub null */
export function getCacheAge(system: GnssSystem): number | null {
  const raw = localStorage.getItem(cacheKey(system));
  if (!raw) return null;
  return Date.now() - JSON.parse(raw).timestamp;
}

/** Usuwa cache danego systemu — wymusza świeże pobranie */
export function clearCache(system: GnssSystem) {
  localStorage.removeItem(cacheKey(system));
}

// Zachowanie kompatybilności wstecznej dla GPS
export const fetchGpsConstellation = () => fetchConstellation('gps');
export const clearGpsCache         = () => clearCache('gps');

/**
 * Propaguje pozycję satelity metodą SGP4 (satellite.js).
 * @param satrec  Obiekt SatRec z twoline2satrec (przechowywany w SatelliteRecord.satrec)
 * @param date    Data/czas propagacji
 * @returns Pozycja ECEF w metrach lub null gdy propagacja się nie powiodła
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function propagateSGP4(satrec: any, date: Date): { x: number; y: number; z: number } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = propagate(satrec, date) as any;
    if (!result || !result.position || typeof result.position === 'boolean') return null;
    const gmst = gstime(date);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ecf = eciToEcf(result.position, gmst) as any;
    // satellite.js zwraca km → konwertuj na metry
    return { x: ecf.x * 1000, y: ecf.y * 1000, z: ecf.z * 1000 };
  } catch {
    return null;
  }
}
