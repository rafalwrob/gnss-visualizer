import { create } from 'zustand';
import { DEFAULT_KLOBUCHAR } from '../services/orbital/ionosphere';
import type { KlobucharParams } from '../types/ionosphere';

interface IonoState {
  enabled: boolean;
  alpha: [number, number, number, number];
  beta: [number, number, number, number];
  setEnabled: (v: boolean) => void;
  setAlpha: (i: 0 | 1 | 2 | 3, v: number) => void;
  setBeta: (i: 0 | 1 | 2 | 3, v: number) => void;
  getParams: () => KlobucharParams;
}

export const useIonoStore = create<IonoState>((set, get) => ({
  enabled: false,
  alpha: [DEFAULT_KLOBUCHAR.a0, DEFAULT_KLOBUCHAR.a1, DEFAULT_KLOBUCHAR.a2, DEFAULT_KLOBUCHAR.a3],
  beta:  [DEFAULT_KLOBUCHAR.b0, DEFAULT_KLOBUCHAR.b1, DEFAULT_KLOBUCHAR.b2, DEFAULT_KLOBUCHAR.b3],
  setEnabled: (v) => set({ enabled: v }),
  setAlpha: (i, v) => set(s => {
    const a = [...s.alpha] as [number, number, number, number];
    a[i] = v;
    return { alpha: a };
  }),
  setBeta: (i, v) => set(s => {
    const b = [...s.beta] as [number, number, number, number];
    b[i] = v;
    return { beta: b };
  }),
  getParams: () => {
    const { alpha: [a0, a1, a2, a3], beta: [b0, b1, b2, b3] } = get();
    return { a0, a1, a2, a3, b0, b1, b2, b3 };
  },
}));
