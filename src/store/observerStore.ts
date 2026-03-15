import { create } from 'zustand';
import type { SatelliteRecord, GnssSystem } from '../types/satellite';

export type SysFetchStatus = 'idle' | 'loading' | 'ok' | 'error';

export interface SystemFetchInfo {
  status: SysFetchStatus;
  count: number;
}

interface ObserverState {
  /** Czy tryb widoczności jest aktywny */
  enabled: boolean;
  lat: number;
  lon: number;
  /** Wysokość nad elipsoidą WGS-84 [m] */
  alt: number;
  /** Minimalna elewacja do uznania satelity za widocznego [°] */
  minElevation: number;

  /** Wszystkie satelity ze wszystkich konstelacji (CelesTrak live) */
  allSats: SatelliteRecord[];
  /** Stan pobierania per-system */
  systemStatus: Partial<Record<GnssSystem, SystemFetchInfo>>;
  fetchError: string;

  setEnabled: (v: boolean) => void;
  setLat: (v: number) => void;
  setLon: (v: number) => void;
  setAlt: (v: number) => void;
  setMinElevation: (v: number) => void;
  setAllSats: (sats: SatelliteRecord[]) => void;
  setSystemStatus: (sys: GnssSystem, info: SystemFetchInfo) => void;
  setFetchError: (e: string) => void;
  reset: () => void;
}

export const useObserverStore = create<ObserverState>((set) => ({
  enabled: false,
  lat: 52.2297,
  lon: 21.0122,
  alt: 100,
  minElevation: 5,

  allSats: [],
  systemStatus: {},
  fetchError: '',

  setEnabled: (v) => set({ enabled: v }),
  setLat: (v) => set({ lat: v }),
  setLon: (v) => set({ lon: v }),
  setAlt: (v) => set({ alt: v }),
  setMinElevation: (v) => set({ minElevation: v }),
  setAllSats: (sats) => set({ allSats: sats }),
  setSystemStatus: (sys, info) =>
    set((s) => ({ systemStatus: { ...s.systemStatus, [sys]: info } })),
  setFetchError: (e) => set({ fetchError: e }),
  reset: () => set({ allSats: [], systemStatus: {}, fetchError: '' }),
}));
