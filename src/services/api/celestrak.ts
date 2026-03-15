import type { SatelliteRecord, GnssSystem } from '../../types/satellite';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { MU, PLANE_COLORS } from '../../constants/gnss';

const PI2 = 2 * Math.PI;
const D = (deg: number) => deg * Math.PI / 180;
const SEC_PER_DAY = 86400;
const GPS_OMEGA_DOT = -8.0e-9; // rad/s (przybliżenie J2 dla GPS MEO)

interface GpRecord {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  EPOCH: string;            // ISO 8601
  MEAN_MOTION: number;      // obroty/dobę
  ECCENTRICITY: number;
  INCLINATION: number;      // stopnie
  RA_OF_ASC_NODE: number;   // stopnie
  ARG_OF_PERICENTER: number;// stopnie
  MEAN_ANOMALY: number;     // stopnie
  SEMIMAJOR_AXIS?: number;  // km (opcjonalne w API)
}

const CACHE_KEY = 'celestrak_gps_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 godzina

interface GpCache {
  timestamp: number;
  data: GpRecord[];
}

async function fetchFromNetwork(): Promise<GpRecord[]> {
  const url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CelesTrak ${res.status}: ${res.statusText}`);
  return res.json();
}

async function fetchGpsGp(): Promise<GpRecord[]> {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) {
    const cache: GpCache = JSON.parse(raw);
    if (Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return cache.data;
    }
  }
  const data = await fetchFromNetwork();
  localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  return data;
}

function gpToRecord(gp: GpRecord, nowSec: number): SatelliteRecord {
  const dt = nowSec - Date.parse(gp.EPOCH) / 1000;
  const n = (gp.MEAN_MOTION * PI2) / SEC_PER_DAY; // rad/s
  const a = gp.SEMIMAJOR_AXIS ? gp.SEMIMAJOR_AXIS * 1000 : Math.cbrt(MU / (n * n));

  // Propagacja M0 i Omega0 z epoki do teraz
  const M0 = ((D(gp.MEAN_ANOMALY) + n * dt) % PI2 + PI2) % PI2;
  const Omega0 = ((D(gp.RA_OF_ASC_NODE) + GPS_OMEGA_DOT * dt) % PI2 + PI2) % PI2;

  // Płaszczyzna po kącie RAAN (6 płaszczyzn GPS co 60°)
  const plane = Math.min(Math.floor((Omega0 * 180 / Math.PI) / 60), 5);
  const color = PLANE_COLORS.gps[plane];

  // Wyciągnij numer PRN z nazwy: "GPS BIIR-2  (PRN 13)" → "G13"
  const prnMatch = gp.OBJECT_NAME.match(/PRN\s*(\d+)/i);
  const prn = prnMatch ? `G${prnMatch[1].padStart(2, '0')}` : gp.OBJECT_NAME;

  const eph: KeplerianEphemeris = {
    a, e: gp.ECCENTRICITY,
    i0: D(gp.INCLINATION),
    Omega0, OmegaDot: GPS_OMEGA_DOT,
    omega: D(gp.ARG_OF_PERICENTER),
    M0, dn: 0, IDOT: 0,
    Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0,
    toe: 0,
  };

  return { prn, system: 'gps' as GnssSystem, plane, color, eph };
}

/** Pobiera aktualną konstelację GPS z CelesTrak (cache 1h). */
export async function fetchGpsConstellation(): Promise<SatelliteRecord[]> {
  const records = await fetchGpsGp();
  const nowSec = Date.now() / 1000;
  return records
    .filter(r => r.OBJECT_NAME.toUpperCase().includes('GPS'))
    .map(r => gpToRecord(r, nowSec))
    .sort((a, b) => a.prn.localeCompare(b.prn, undefined, { numeric: true }));
}

/** Zwraca czas ostatniego pobrania z cache lub null */
export function getCacheAge(): number | null {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  return Date.now() - JSON.parse(raw).timestamp;
}

/** Usuwa cache — wymusza świeże pobranie */
export function clearGpsCache() {
  localStorage.removeItem(CACHE_KEY);
}
