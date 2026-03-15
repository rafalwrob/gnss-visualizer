/**
 * Mutowalny obiekt do współdzielenia stanu animacji między komponentami R3F.
 * NIE jest to React state — zmiany nie powodują re-renderów.
 * Używany w useFrame() do czytania czasu bez subskrypcji Zustand.
 */
export const anim = {
  timeSec: 0,
  traceHours: 12,
  animating: false,
  animSpeed: 1,
  showHarmonics: true,
  useEcef: false,
  /** Tryb czasu rzeczywistego — timeSec = (Date.now() - realtimeOriginMs) / 1000 */
  realtimeClock: false,
  realtimeOriginMs: 0,
};
