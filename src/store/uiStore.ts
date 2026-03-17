import { create } from 'zustand';

type Panel = 'steps' | 'freq' | 'pos' | 'alm' | 'iono' | 'satellites' | null;
export type LeftTab = 'orbital' | 'satellites' | 'kepler' | 'settings' | 'visibility' | 'receiver' | 'signals';

interface UiState {
  openPanel: Panel;
  showGroundTrack: boolean;
  showHarmonics: boolean;
  useEcef: boolean;
  showEciAxes: boolean;
  showSignalLines: boolean;
  showEnuAxes: boolean;
  onlineMode: boolean;
  activeTab: LeftTab | null;

  setOpenPanel: (p: Panel) => void;
  togglePanel: (p: Exclude<Panel, null>) => void;
  setShowGroundTrack: (v: boolean) => void;
  setShowHarmonics: (v: boolean) => void;
  setUseEcef: (v: boolean) => void;
  setShowEciAxes: (v: boolean) => void;
  setShowSignalLines: (v: boolean) => void;
  setShowEnuAxes: (v: boolean) => void;
  setOnlineMode: (v: boolean) => void;
  setActiveTab: (t: LeftTab | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  openPanel: null,
  showGroundTrack: true,
  showHarmonics: true,
  useEcef: false,
  showEciAxes: false,
  showSignalLines: false,
  showEnuAxes: false,
  onlineMode: false,
  activeTab: 'orbital',

  setOpenPanel: (p) => set({ openPanel: p }),
  togglePanel: (p) => set(s => ({ openPanel: s.openPanel === p ? null : p })),
  setShowGroundTrack: (v) => set({ showGroundTrack: v }),
  setShowHarmonics: (v) => set({ showHarmonics: v }),
  setUseEcef: (v) => set({ useEcef: v }),
  setShowEciAxes: (v) => set({ showEciAxes: v }),
  setShowSignalLines: (v) => set({ showSignalLines: v }),
  setShowEnuAxes: (v) => set({ showEnuAxes: v }),
  setOnlineMode: (v) => set({ onlineMode: v }),
  setActiveTab: (t) => set({ activeTab: t }),
}));
