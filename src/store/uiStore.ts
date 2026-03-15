import { create } from 'zustand';

type Panel = 'steps' | 'freq' | 'pos' | 'alm' | 'iono' | 'satellites' | null;

interface UiState {
  openPanel: Panel;
  showGroundTrack: boolean;
  showHarmonics: boolean;
  showIonoLayer: boolean;
  useEcef: boolean;
  showEciAxes: boolean;
  onlineMode: boolean;

  setOpenPanel: (p: Panel) => void;
  togglePanel: (p: Exclude<Panel, null>) => void;
  setShowGroundTrack: (v: boolean) => void;
  setShowHarmonics: (v: boolean) => void;
  setShowIonoLayer: (v: boolean) => void;
  setUseEcef: (v: boolean) => void;
  setShowEciAxes: (v: boolean) => void;
  setOnlineMode: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  openPanel: null,
  showGroundTrack: true,
  showHarmonics: true,
  showIonoLayer: false,
  useEcef: false,  // ECI domyślnie — czyste elipsy orbit
  showEciAxes: false,
  onlineMode: false,

  setOpenPanel: (p) => set({ openPanel: p }),
  togglePanel: (p) => set(s => ({ openPanel: s.openPanel === p ? null : p })),
  setShowGroundTrack: (v) => set({ showGroundTrack: v }),
  setShowHarmonics: (v) => set({ showHarmonics: v }),
  setShowIonoLayer: (v) => set({ showIonoLayer: v }),
  setUseEcef: (v) => set({ useEcef: v }),
  setShowEciAxes: (v) => set({ showEciAxes: v }),
  setOnlineMode: (v) => set({ onlineMode: v }),
}));
