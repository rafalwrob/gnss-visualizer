import { create } from 'zustand';

export interface CelestialVisibility {
  sphere: boolean;
  equator: boolean;
  ecliptic: boolean;
  equinoxPoints: boolean;
  solsticePoints: boolean;
  raCircles: boolean;
  decParallels: boolean;
  poles: boolean;
  icrsAxes: boolean;
  sunMarker: boolean;
}

interface CelestialState {
  vis: CelestialVisibility;
  activeInfo: string | null;
  toggle: (key: keyof CelestialVisibility) => void;
  setActiveInfo: (key: string | null) => void;
}

export const useCelestialStore = create<CelestialState>((set) => ({
  vis: {
    sphere: true,
    equator: true,
    ecliptic: true,
    equinoxPoints: true,
    solsticePoints: true,
    raCircles: true,
    decParallels: true,
    poles: true,
    icrsAxes: true,
    sunMarker: true,
  },
  activeInfo: null,
  toggle: (key) =>
    set((s) => ({ vis: { ...s.vis, [key]: !s.vis[key] } })),
  setActiveInfo: (key) => set({ activeInfo: key }),
}));
