import { create } from 'zustand';

interface TimeState {
  /** Czas symulacji [h] od toe */
  timeHours: number;
  /** Długość śladów orbitalnych [h] */
  traceHours: number;
  /** Czy animacja jest włączona */
  animating: boolean;
  /** Mnożnik prędkości animacji */
  animSpeed: number;

  setTimeHours: (t: number) => void;
  setTraceHours: (t: number) => void;
  setAnimating: (a: boolean) => void;
  setAnimSpeed: (s: number) => void;
  tick: () => void;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  timeHours: 0,
  traceHours: 12,
  animating: false,
  animSpeed: 1.0,

  setTimeHours: (t) => set({ timeHours: Math.max(0, t % 48) }),
  setTraceHours: (t) => set({ traceHours: t }),
  setAnimating: (a) => set({ animating: a }),
  setAnimSpeed: (s) => set({ animSpeed: s }),

  tick: () => {
    const { timeHours, animSpeed } = get();
    const next = (timeHours + 0.02 * animSpeed) % 48;
    set({ timeHours: next });
  },
}));
