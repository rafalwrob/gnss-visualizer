import { create } from 'zustand';

function getCurrentDayOfYear(): number {
  const now = new Date();
  return Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      86400000
  );
}

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

export type CelestialViewMode = 'geocentric' | 'heliocentric';

interface CelestialState {
  vis: CelestialVisibility;
  activeInfo: string | null;
  dayOfYear: number;       // 0–365 (synchronizowane z celestialAnim co ~15 klatek)
  animating: boolean;
  animSpeed: number;       // dni/sekundę
  viewMode: CelestialViewMode;
  toggle: (key: keyof CelestialVisibility) => void;
  setActiveInfo: (key: string | null) => void;
  setDayOfYear: (d: number) => void;
  setAnimating: (a: boolean) => void;
  setAnimSpeed: (s: number) => void;
  setViewMode: (m: CelestialViewMode) => void;
}

const initial = getCurrentDayOfYear();

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
  dayOfYear: initial,
  animating: false,
  animSpeed: 30,
  viewMode: 'geocentric',
  toggle: (key) => set((s) => ({ vis: { ...s.vis, [key]: !s.vis[key] } })),
  setActiveInfo: (key) => set({ activeInfo: key }),
  setDayOfYear: (d) => set({ dayOfYear: ((d % 365) + 365) % 365 }),
  setAnimating: (a) => set({ animating: a }),
  setAnimSpeed: (s) => set({ animSpeed: s }),
  setViewMode: (m) => set({ viewMode: m }),
}));

// ---------------------------------------------------------------------------
// Helpers (używane też poza sceną)
// ---------------------------------------------------------------------------

const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface DayInfo {
  dateLabel: string;   // np. "28 mar"
  season: string;      // np. "Równonoc wiosenna"
  color: string;
}

export function getDayInfo(rawDay: number): DayInfo {
  const d = ((rawDay % 365) + 365) % 365;

  // Specjalne daty (±7 dni tolerancja)
  const special: [number, string, string][] = [
    [79,  'Równonoc wiosenna (~20 mar)',   '#22c55e'],
    [172, 'Przesilenie letnie (~21 cze)',  '#f97316'],
    [265, 'Równonoc jesienna (~23 wrz)',   '#ef4444'],
    [356, 'Przesilenie zimowe (~21 gru)',  '#3b82f6'],
  ];
  for (const [ref, label, color] of special) {
    const dist = Math.min(Math.abs(d - ref), 365 - Math.abs(d - ref));
    if (dist < 8) return { dateLabel: label.split('(')[1].replace(')', '').trim(), season: label.split('(')[0].trim(), color };
  }

  // Zwykła data
  let rem = Math.floor(d);
  let month = 0;
  while (month < 11 && rem >= DAYS_IN_MONTH[month]) {
    rem -= DAYS_IN_MONTH[month];
    month++;
  }
  return { dateLabel: `${rem + 1} ${MONTHS_PL[month]}`, season: '', color: '#8b949e' };
}
