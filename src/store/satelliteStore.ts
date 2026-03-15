import { create } from 'zustand';
import type { SatelliteRecord } from '../types/satellite';
import type { KeplerianEphemeris } from '../types/ephemeris';
import { GNSS_SYSTEMS, PLANE_COLORS } from '../constants/gnss';

interface SatelliteState {
  /** Aktywna konstelacja (pusta = tryb pojedynczego satelity) */
  satellites: SatelliteRecord[];
  /** Indeks zaznaczonego satelity */
  selectedIndex: number;
  /** Tryb: 'single' | 'constellation' */
  mode: 'single' | 'constellation';
  /** Efemerida aktywnego/ręcznego satelity */
  singleEph: KeplerianEphemeris;
  /** Aktywny system GNSS dla trybu single */
  activeSystem: 'gps' | 'galileo' | 'glonass';

  setSatellites: (sats: SatelliteRecord[]) => void;
  selectSatellite: (idx: number) => void;
  setMode: (m: 'single' | 'constellation') => void;
  setSingleEph: (eph: KeplerianEphemeris) => void;
  setActiveSystem: (sys: 'gps' | 'galileo' | 'glonass') => void;
  loadExample: () => void;
}

const defaultEph = (): KeplerianEphemeris => ({
  a: 26559800, e: 0.005, i0: 55 * (Math.PI / 180),
  Omega0: 0, OmegaDot: -8.0e-9, omega: 0, M0: 0,
  dn: 4.0e-9, IDOT: 2.0e-10,
  Cuc: 1.0e-6, Cus: 1.0e-6, Crc: 200, Crs: 20,
  Cic: 1.0e-7, Cis: 1.0e-7, toe: 0,
});

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
      singleEph: {
        ...defaultEph(),
        a: info.a,
        i0: info.i0,
        e: info.e,
      },
    });
  },

  loadExample: () => {
    const { activeSystem } = get();
    const cfgMap = {
      gps:     { planes: 6, spp: 4, a: 26559800, i0: 55 * (Math.PI / 180),   e: 0.001, OmegaDot: -8.0e-9 },
      galileo: { planes: 3, spp: 8, a: 29600000, i0: 56 * (Math.PI / 180),   e: 0.001, OmegaDot: -5.3e-9 },
      glonass: { planes: 3, spp: 8, a: 25510000, i0: 64.8 * (Math.PI / 180), e: 0.001, OmegaDot: -9.3e-9 },
    };
    const cfg = cfgMap[activeSystem];
    const colors = PLANE_COLORS[activeSystem];
    const raanStep = (2 * Math.PI) / cfg.planes;
    const sats: SatelliteRecord[] = [];

    for (let p = 0; p < cfg.planes; p++) {
      for (let s = 0; s < cfg.spp; s++) {
        const prn = String.fromCharCode(65 + p) + (s + 1);
        sats.push({
          prn, system: activeSystem, plane: p, color: colors[p % colors.length],
          eph: {
            a: cfg.a, e: cfg.e, i0: cfg.i0, Omega0: p * raanStep,
            OmegaDot: cfg.OmegaDot, omega: 0, M0: (s / cfg.spp) * 2 * Math.PI,
            dn: 4e-9, IDOT: 0, Cuc: 0, Cus: 0, Crc: 0, Crs: 0, Cic: 0, Cis: 0, toe: 0,
          },
        });
      }
    }
    set({ satellites: sats, selectedIndex: 0, mode: 'constellation', singleEph: { ...sats[0].eph } });
  },
}));
