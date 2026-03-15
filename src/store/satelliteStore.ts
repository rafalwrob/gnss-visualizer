import { create } from 'zustand';
import type { SatelliteRecord, GnssSystem } from '../types/satellite';
import type { KeplerianEphemeris } from '../types/ephemeris';
import { GNSS_SYSTEMS, PLANE_COLORS } from '../constants/gnss';

const PI = Math.PI;
const D = (deg: number) => deg * PI / 180;  // degrees → radians

interface SatelliteState {
  satellites: SatelliteRecord[];
  selectedIndex: number;
  mode: 'single' | 'constellation';
  singleEph: KeplerianEphemeris;
  activeSystem: GnssSystem;

  setSatellites: (sats: SatelliteRecord[]) => void;
  selectSatellite: (idx: number) => void;
  setMode: (m: 'single' | 'constellation') => void;
  setSingleEph: (eph: KeplerianEphemeris) => void;
  setActiveSystem: (sys: GnssSystem) => void;
  loadExample: () => void;
}

const defaultEph = (): KeplerianEphemeris => ({
  a: 26559800, e: 0.005, i0: D(55),
  Omega0: 0, OmegaDot: -8.0e-9, omega: 0, M0: 0,
  dn: 4.0e-9, IDOT: 0, Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0, toe: 0,
});

function sat(
  prn: string, system: GnssSystem, plane: number,
  color: string, eph: Partial<KeplerianEphemeris>
): SatelliteRecord {
  return {
    prn, system, plane, color,
    eph: {
      a: 42164000, e: 0, i0: 0, Omega0: 0, OmegaDot: 0,
      omega: 0, M0: 0, dn: 0, IDOT: 0,
      Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0, toe: 0,
      ...eph,
    },
  };
}

/** GPS: Walker 24/6/2, MEO, a=26 560 km, i=55° */
function buildGPS(): SatelliteRecord[] {
  const c = PLANE_COLORS.gps;
  const sats: SatelliteRecord[] = [];
  for (let p = 0; p < 6; p++) {
    for (let s = 0; s < 4; s++) {
      sats.push(sat(`G${String(p * 4 + s + 1).padStart(2, '0')}`, 'gps', p, c[p],
        { a: 26559800, e: 0.001, i0: D(55), Omega0: D(p * 60), OmegaDot: -8.0e-9, M0: D(s * 90) }
      ));
    }
  }
  return sats;
}

/** Galileo: Walker 24/3/1, MEO, a=29 600 km, i=56° */
function buildGalileo(): SatelliteRecord[] {
  const c = PLANE_COLORS.galileo;
  const sats: SatelliteRecord[] = [];
  for (let p = 0; p < 3; p++) {
    for (let s = 0; s < 8; s++) {
      sats.push(sat(`E${String(p * 8 + s + 1).padStart(2, '0')}`, 'galileo', p, c[p],
        { a: 29600000, e: 0.001, i0: D(56), Omega0: D(p * 120), OmegaDot: -5.3e-9, M0: D(s * 45) }
      ));
    }
  }
  return sats;
}

/** GLONASS: Walker 24/3/1, MEO, a=25 510 km, i=64.8° */
function buildGLONASS(): SatelliteRecord[] {
  const c = PLANE_COLORS.glonass;
  const sats: SatelliteRecord[] = [];
  for (let p = 0; p < 3; p++) {
    for (let s = 0; s < 8; s++) {
      sats.push(sat(`R${String(p * 8 + s + 1).padStart(2, '0')}`, 'glonass', p, c[p],
        { a: 25510000, e: 0.001, i0: D(64.8), Omega0: D(p * 120), OmegaDot: -9.3e-9, M0: D(s * 45) }
      ));
    }
  }
  return sats;
}

/**
 * BeiDou BDS-3: 24 MEO + 3 IGSO + 3 GEO = 30 sats
 * MEO: 3 płaszczyzny × 8, a=27 906 km, i=55°
 * IGSO: geosynchroniczne nachylone i=55°, figure-8 nad Azją (RAAN 118°, 238°, 358°)
 * GEO: geostacjonarne 80°E, 110.5°E, 140°E
 */
function buildBeiDou(): SatelliteRecord[] {
  const c = PLANE_COLORS.beidou;
  const sats: SatelliteRecord[] = [];

  // MEO: 3 planes × 8 sats
  for (let p = 0; p < 3; p++) {
    for (let s = 0; s < 8; s++) {
      sats.push(sat(`CM${String(p * 8 + s + 1).padStart(2, '0')}`, 'beidou', p, c[p % 4],
        { a: 27906000, e: 0.001, i0: D(55), Omega0: D(p * 120), OmegaDot: -7.3e-9, M0: D(s * 45) }
      ));
    }
  }

  // IGSO: 3 sats, RAAN 120° od siebie, zaczynając od 118°E
  // (intersection ground tracks nad Azją ~118°E wg dokumentacji BDS)
  const igsoRaan = [118, 238, 358];
  igsoRaan.forEach((raan, k) => {
    sats.push(sat(`CI${k + 1}`, 'beidou', 3 + k, c[3],
      { a: 42164000, e: 0.001, i0: D(55), Omega0: D(raan), OmegaDot: 0, omega: 0, M0: D(k * 120) }
    ));
  });

  // GEO: 3 saty, Omega0 = długość geograficzna (przy GMST=0)
  const geoLon = [80, 110.5, 140];
  geoLon.forEach((lon, k) => {
    sats.push(sat(`CG${k + 1}`, 'beidou', 6 + k, c[2],
      { a: 42164000, e: 0.0001, i0: D(0.5), Omega0: D(lon), OmegaDot: 0 }
    ));
  });

  return sats;
}

/**
 * QZSS: 3 QZO + 1 GEO = 4 saty
 * QZO: geosynchroniczne eliptyczne e=0.075, i=43°, ω=270° (apogeum nad półkulą N)
 *   RAAN=45° → apogeum nad 135°E (Japonia) przy GMST=0
 *   3 saty przesuniete o 120° w anomalii średniej → pokrycie ciągłe
 * GEO: 127°E
 */
function buildQZSS(): SatelliteRecord[] {
  const c = PLANE_COLORS.qzss;
  const sats: SatelliteRecord[] = [];

  // 3 QZO - ta sama płaszczyzna (RAAN=45°), offset M0 zaczynając od apogeum
  // M0=180° → satelita ZACZYNA w apogeum → RAAN+90°=135°E = Japonia ✓
  // Kolejne 2 saty przesunięte o 120°: 300°, 60° → ciągłe pokrycie
  const qzoM0 = [180, 300, 60];
  for (let k = 0; k < 3; k++) {
    sats.push(sat(`J${k + 1}`, 'qzss', k, c[0],
      {
        a: 42165000, e: 0.075, i0: D(43),
        Omega0: D(45),          // RAAN=45° → apogeum nad 135°E (Japonia)
        omega: D(270),          // ω=270° → apogeum w półkuli N
        OmegaDot: 0,
        M0: D(qzoM0[k]),
      }
    ));
  }

  // 1 GEO przy 127°E
  sats.push(sat('JG1', 'qzss', 3, c[1],
    { a: 42164000, e: 0.0001, i0: D(0.5), Omega0: D(127), OmegaDot: 0 }
  ));

  return sats;
}

/**
 * NavIC (IRNSS): 3 GEO + 4 GSO = 7 saty
 * GEO: 32.5°E, 83°E, 129.5°E (geostacjonarne nad Oceanem Indyjskim)
 * GSO: nachylone geosynchroniczne i=29°, 2 płaszczyzny:
 *   Płaszczyzna A: RAAN=55°E, 2 saty (M0=0° i 180°) → figure-8 nad 55°E
 *   Płaszczyzna B: RAAN=111.75°E, 2 saty (M0=0° i 180°) → figure-8 nad 111.75°E
 */
function buildNavIC(): SatelliteRecord[] {
  const c = PLANE_COLORS.navic;
  const sats: SatelliteRecord[] = [];

  // GEO: 3 saty
  const geoLon = [32.5, 83, 129.5];
  geoLon.forEach((lon, k) => {
    sats.push(sat(`IG${k + 1}`, 'navic', k, c[0],
      { a: 42164000, e: 0.0001, i0: D(0.5), Omega0: D(lon), OmegaDot: 0 }
    ));
  });

  // GSO Płaszczyzna A (55°E): 2 saty, M0=90° (+29°N) i M0=270° (-29°S)
  // → wyraźnie oddzielone w szerokości geograficznej, oba przy 55°E
  sats.push(sat('II1', 'navic', 3, c[1],
    { a: 42164000, e: 0.001, i0: D(29), Omega0: D(55), OmegaDot: 0, omega: 0, M0: D(90) }
  ));
  sats.push(sat('II2', 'navic', 3, c[1],
    { a: 42164000, e: 0.001, i0: D(29), Omega0: D(55), OmegaDot: 0, omega: 0, M0: D(270) }
  ));

  // GSO Płaszczyzna B (111.75°E): 2 saty, M0=90° i M0=270°
  sats.push(sat('II3', 'navic', 4, c[2],
    { a: 42164000, e: 0.001, i0: D(29), Omega0: D(111.75), OmegaDot: 0, omega: 0, M0: D(90) }
  ));
  sats.push(sat('II4', 'navic', 4, c[2],
    { a: 42164000, e: 0.001, i0: D(29), Omega0: D(111.75), OmegaDot: 0, omega: 0, M0: D(270) }
  ));

  return sats;
}

/** SBAS: GEO saty augmentacji (WAAS/EGNOS/MSAS/GAGAN) */
function buildSBAS(): SatelliteRecord[] {
  const c = PLANE_COLORS.sbas;
  // Reprezentatywne długości geograficzne satelitów SBAS (WAAS, EGNOS, MSAS, GAGAN)
  const lons = [133.9, 107.3, -107.3, 15.5, 21.5, -15.5, 140, 145, 83];
  const names = ['W133', 'W107', 'W253', 'E15', 'E21', 'E345', 'M140', 'M145', 'G83'];
  return lons.map((lon, k) =>
    sat(`S${String(k + 1).padStart(2, '0')}`, 'sbas', k, c[k % c.length],
      { a: 42164000, e: 0.0001, i0: D(0.5), Omega0: D(lon < 0 ? lon + 360 : lon), OmegaDot: 0 }
    )
  );
}

function buildConstellation(system: GnssSystem): SatelliteRecord[] {
  switch (system) {
    case 'gps':     return buildGPS();
    case 'galileo': return buildGalileo();
    case 'glonass': return buildGLONASS();
    case 'beidou':  return buildBeiDou();
    case 'qzss':    return buildQZSS();
    case 'navic':   return buildNavIC();
    case 'sbas':    return buildSBAS();
    default:        return [];
  }
}

export const useSatelliteStore = create<SatelliteState>((set, get) => ({
  satellites: [],
  selectedIndex: -1,
  mode: 'single',
  singleEph: defaultEph(),
  activeSystem: 'gps',

  setSatellites: (sats) => set({ satellites: sats, selectedIndex: sats.length > 0 ? 0 : -1 }),
  selectSatellite: (idx) => {
    const { satellites } = get();
    const s = satellites[idx];
    if (s) set({ selectedIndex: idx, singleEph: { ...s.eph } });
  },
  setMode: (m) => set({ mode: m }),
  setSingleEph: (eph) => set({ singleEph: eph }),

  setActiveSystem: (sys) => {
    const info = GNSS_SYSTEMS[sys];
    const base = { ...defaultEph(), a: info.a, i0: info.i0, e: info.e };

    // Dla systemów geosynchronicznych defaultEph() ma Omega0=0 (→ 0°E, Afryka)
    // Ustawiamy sensowną pozycję startową w trybie pojedynczym
    const overrides: Partial<KeplerianEphemeris> = (() => {
      switch (sys) {
        case 'qzss':
          // QZO: apogeum nad 135°E (Japonia), M0=180° = start w apogeum
          return { Omega0: D(45), omega: D(270), M0: D(180) };
        case 'navic':
          // GSO: figura-8 nad Indiami, centrum 83°E, start na równiku
          return { a: 42164000, i0: D(29), Omega0: D(83), omega: 0, M0: 0 };
        case 'beidou':
          // Użyj MEO (nie GEO) jako domyślnego dla pojedynczego satelity
          return { a: 27906000, i0: D(55), Omega0: D(90), OmegaDot: -7.3e-9 };
        case 'sbas':
          // GEO nad 83°E (GAGAN nad Indiami)
          return { Omega0: D(83), i0: D(0.5) };
        default:
          return {};
      }
    })();

    set({ activeSystem: sys, singleEph: { ...base, ...overrides } });
  },

  loadExample: () => {
    const { activeSystem } = get();
    const sats = buildConstellation(activeSystem);
    set({ satellites: sats, selectedIndex: 0, mode: 'constellation', singleEph: { ...sats[0].eph } });
  },
}));
