import { create } from 'zustand';

interface TimeState {
  timeHours: number;
  traceHours: number;
  animating: boolean;
  animSpeed: number;

  setTimeHours: (t: number) => void;
  setTraceHours: (t: number) => void;
  setAnimating: (a: boolean) => void;
  setAnimSpeed: (s: number) => void;
}

export const useTimeStore = create<TimeState>((set) => ({
  timeHours: 0,
  traceHours: 12,
  animating: false,
  animSpeed: 1.0,

  setTimeHours: (t) => set({ timeHours: Math.max(0, t % 48) }),
  setTraceHours: (t) => set({ traceHours: t }),
  setAnimating: (a) => set({ animating: a }),
  setAnimSpeed: (s) => set({ animSpeed: s }),
}));
