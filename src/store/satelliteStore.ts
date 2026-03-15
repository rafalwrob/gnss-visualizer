import { create } from 'zustand';
import type { SatelliteRecord, GnssSystem } from '../types/satellite';
import type { KeplerianEphemeris } from '../types/ephemeris';
import { GNSS_SYSTEMS, PLANE_COLORS } from '../constants/gnss';

const PI = Math.PI;

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
  a: 26559800, e: 0.005, i0: 55 * (PI / 180),
  Omega0: 0, OmegaDot: -8.0e-9, omega: 0, M0: 0,
  dn: 4.0e-9, IDOT: 2.0e-10,
  Cuc: 1.0e-6, Cus: 1.0e-6, Crc: 200, Crs: 20,
  Cic: 1.0e-7, Cis: 1.0e-7, toe: 0,
});

/** Generuje jednolity rój satelitów na kołowych orbitach MEO */
function genMeo(params: {
  planes: number; spp: number;
  a: number; i0: number; e: number; OmegaDot: number;
  prefix: string; system: GnssSystem;
}): SatelliteRecord[] {
  const { planes, spp, a, i0, e, OmegaDot, prefix, system } = params;
  const colors = PLANE_COLORS[system];
  const raanStep = (2 * PI) / planes;
  const sats: SatelliteRecord[] = [];
  for (let p = 0; p < planes; p++) {
    for (let s = 0; s < spp; s++) {
      sats.push({
        prn: `${prefix}${String(p * spp + s + 1).padStart(2, '0')}`,
        system, plane: p,
        color: colors[p % colors.length],
        eph: {
          a, e, i0, Omega0: p * raanStep,
          OmegaDot, omega: 0,
          M0: (s / spp) * 2 * PI,
          dn: 4e-9, IDOT: 0, Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0, toe: 0,
        },
      });
    }
  }
  return sats;
}

/** Generuje satelity geosynchroniczne (GEO / IGSO / GSO) */
function genGeo(params: {
  count: number; i0: number; e: number;
  omega: number; raanStart: number; raanStep: number;
  m0s?: number[];
  prefix: string; system: GnssSystem; planeOffset?: number;
}): SatelliteRecord[] {
  const { count, i0, e, omega, raanStart, raanStep, prefix, system, planeOffset = 0 } = params;
  const colors = PLANE_COLORS[system];
  const sats: SatelliteRecord[] = [];
  for (let k = 0; k < count; k++) {
    sats.push({
      prn: `${prefix}${String(k + 1).padStart(2, '0')}`,
      system, plane: planeOffset + k,
      color: colors[(planeOffset + k) % colors.length],
      eph: {
        a: 42164000, e, i0, omega,
        Omega0: raanStart + k * raanStep,
        OmegaDot: 0,
        M0: params.m0s ? params.m0s[k] : 0,
        dn: 0, IDOT: 0, Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0, toe: 0,
      },
    });
  }
  return sats;
}

/** Buduje pełną konstelację dla danego systemu */
function buildConstellation(system: GnssSystem): SatelliteRecord[] {
  switch (system) {
    case 'gps':
      return genMeo({ planes: 6, spp: 4, a: 26559800, i0: 55 * PI / 180, e: 0.001, OmegaDot: -8.0e-9, prefix: 'G', system });

    case 'galileo':
      return genMeo({ planes: 3, spp: 8, a: 29600000, i0: 56 * PI / 180, e: 0.001, OmegaDot: -5.3e-9, prefix: 'E', system });

    case 'glonass':
      return genMeo({ planes: 3, spp: 8, a: 25510000, i0: 64.8 * PI / 180, e: 0.001, OmegaDot: -9.3e-9, prefix: 'R', system });

    case 'beidou': {
      // BDS-3: 24 MEO (3 płaszczyzny × 8) + 3 IGSO + 3 GEO
      const meo = genMeo({ planes: 3, spp: 8, a: 27906000, i0: 55 * PI / 180, e: 0.001, OmegaDot: -7.3e-9, prefix: 'CM', system });
      // IGSO: geosynchroniczne nachylone (figura-8 nad Azją), RAAN ≈ 55°, 175°, 295°
      const igso = genGeo({
        count: 3, i0: 55 * PI / 180, e: 0.001, omega: 0,
        raanStart: 55 * PI / 180, raanStep: 120 * PI / 180,
        prefix: 'CI', system, planeOffset: 3,
      });
      // GEO: 3 saty geostacjonarne (RAAN rozmieszczone po równiku)
      const geo = genGeo({
        count: 3, i0: 0, e: 0.0001, omega: 0,
        raanStart: 80 * PI / 180, raanStep: 40 * PI / 180,
        prefix: 'CG', system, planeOffset: 6,
      });
      return [...meo, ...igso, ...geo];
    }

    case 'qzss': {
      // 3 QZO (Quasi-Zenith Orbit): geosynchroniczne, i=43°, e=0.075, ω=270°
      // Wszystkie w tej samej płaszczyźnie (RAAN ≈ 130°E), offset M0 o 120°
      const qzo = genGeo({
        count: 3, i0: 43 * PI / 180, e: 0.075,
        omega: 270 * PI / 180,          // argument peryapsis = 270° → apogeum nad Japonią
        raanStart: 130 * PI / 180, raanStep: 0,  // ta sama RAAN
        m0s: [0, 2 * PI / 3, 4 * PI / 3],
        prefix: 'J', system, planeOffset: 0,
      });
      // 1 GEO przy 127°E
      const geo = genGeo({
        count: 1, i0: 0, e: 0.0001, omega: 0,
        raanStart: 127 * PI / 180, raanStep: 0,
        prefix: 'JG', system, planeOffset: 3,
      });
      return [...qzo, ...geo];
    }

    case 'navic': {
      // NavIC: 3 GEO + 4 GSO (nachylone geosynchroniczne, i=29°)
      // GEO przy 32.5°E, 83°E, 129.5°E
      const geo = genGeo({
        count: 3, i0: 0, e: 0.0001, omega: 0,
        raanStart: 32.5 * PI / 180,
        raanStep: 0,
        m0s: [0, 50.5 * PI / 180, 97 * PI / 180],  // różne M0 zamiast RAAN
        prefix: 'IG', system, planeOffset: 0,
      });
      // GSO: 2 pary, RAAN ≈ 55°E i ≈ 111.75°E, każda para M0=0 i M0=π
      const gso = genGeo({
        count: 4, i0: 29 * PI / 180, e: 0.001, omega: 0,
        raanStart: 55 * PI / 180,
        raanStep: 0,
        m0s: [0, PI, 56.75 * PI / 180, PI + 56.75 * PI / 180],
        prefix: 'II', system, planeOffset: 3,
      });
      // Napraw RAAN dla pary 2 (111.75°E)
      gso[2].eph.Omega0 = 111.75 * PI / 180;
      gso[3].eph.Omega0 = 111.75 * PI / 180;
      return [...geo, ...gso];
    }

    case 'sbas': {
      // SBAS: WAAS (2), EGNOS (3), MSAS (2), GAGAN (2) — GEO przy różnych długościach
      const longitudes = [133.9, 107.3, 98, 120.5, 15.5, 21.5, 25, 140, 145];
      const colors = PLANE_COLORS.sbas;
      return longitudes.map((lon, k) => ({
        prn: `S${String(k + 1).padStart(2, '0')}`,
        system: 'sbas' as GnssSystem, plane: k,
        color: colors[k % colors.length],
        eph: {
          a: 42164000, e: 0.0001, i0: 0, omega: 0,
          Omega0: lon * PI / 180,
          OmegaDot: 0, M0: 0,
          dn: 0, IDOT: 0, Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0, toe: 0,
        },
      }));
    }

    default:
      return [];
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
    const sat = satellites[idx];
    if (sat) set({ selectedIndex: idx, singleEph: { ...sat.eph } });
  },
  setMode: (m) => set({ mode: m }),
  setSingleEph: (eph) => set({ singleEph: eph }),

  setActiveSystem: (sys) => {
    const info = GNSS_SYSTEMS[sys];
    set({
      activeSystem: sys,
      singleEph: { ...defaultEph(), a: info.a, i0: info.i0, e: info.e },
    });
  },

  loadExample: () => {
    const { activeSystem } = get();
    const sats = buildConstellation(activeSystem);
    set({ satellites: sats, selectedIndex: 0, mode: 'constellation', singleEph: { ...sats[0].eph } });
  },
}));
