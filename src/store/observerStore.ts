import { create } from 'zustand';
import type { SatelliteRecord, GnssSystem } from '../types/satellite';

export type SysFetchStatus = 'idle' | 'loading' | 'ok' | 'error';

export interface SystemFetchInfo {
  status: SysFetchStatus;
  count: number;
}

const ALL_SYSTEMS: GnssSystem[] = ['gps', 'galileo', 'glonass', 'beidou', 'qzss', 'navic'];

function allEnabled(): Record<GnssSystem, boolean> {
  return Object.fromEntries(ALL_SYSTEMS.map(s => [s, true])) as Record<GnssSystem, boolean>;
}

interface ObserverState {
  /** Czy tryb widoczności jest aktywny */
  enabled: boolean;
  /** Czy trwa pobieranie danych */
  isFetching: boolean;
  lat: number;
  lon: number;
  /** Wysokość nad elipsoidą WGS-84 [m] */
  alt: number;
  /** Minimalna elewacja do uznania satelity za widocznego [°] */
  minElevation: number;

  /** Które konstelacje są widoczne (filtr wizualny) */
  enabledSystems: Record<GnssSystem, boolean>;

  /** Wszystkie satelity ze wszystkich konstelacji (CelesTrak live) */
  allSats: SatelliteRecord[];
  /** Stan pobierania per-system */
  systemStatus: Partial<Record<GnssSystem, SystemFetchInfo>>;
  fetchError: string;

  setEnabled: (v: boolean) => void;
  setIsFetching: (v: boolean) => void;
  setLat: (v: number) => void;
  setLon: (v: number) => void;
  setAlt: (v: number) => void;
  setMinElevation: (v: number) => void;
  toggleSystem: (sys: GnssSystem) => void;
  setAllSats: (sats: SatelliteRecord[]) => void;
  setSystemStatus: (sys: GnssSystem, info: SystemFetchInfo) => void;
  setFetchError: (e: string) => void;
  reset: () => void;
}

export const useObserverStore = create<ObserverState>((set) => ({
  enabled: false,
  isFetching: false,
  lat: 52.2297,
  lon: 21.0122,
  alt: 100,
  minElevation: 5,

  enabledSystems: allEnabled(),

  allSats: [],
  systemStatus: {},
  fetchError: '',

  setEnabled: (v) => set({ enabled: v }),
  setIsFetching: (v) => set({ isFetching: v }),
  setLat: (v) => set({ lat: v }),
  setLon: (v) => set({ lon: v }),
  setAlt: (v) => set({ alt: v }),
  setMinElevation: (v) => set({ minElevation: v }),
  toggleSystem: (sys) =>
    set((s) => ({ enabledSystems: { ...s.enabledSystems, [sys]: !s.enabledSystems[sys] } })),
  setAllSats: (sats) => set({ allSats: sats }),
  setSystemStatus: (sys, info) =>
    set((s) => ({ systemStatus: { ...s.systemStatus, [sys]: info } })),
  setFetchError: (e) => set({ fetchError: e }),
  reset: () => set({ allSats: [], systemStatus: {}, fetchError: '', enabledSystems: allEnabled() }),
}));
