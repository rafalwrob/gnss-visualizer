/**
 * Mutowalny obiekt do współdzielenia stanu animacji między komponentami R3F.
 * NIE jest to React state — zmiany nie powodują re-renderów.
 * Używany w useFrame() do czytania czasu bez subskrypcji Zustand.
 */
export const anim = {
  timeSec: 0,
  traceHours: 2,
  animating: false,
  animSpeed: 1,
  showHarmonics: true,
  useEcef: false,
  /** Live mode: timeSec śledzi zegar ścienny 1:1 */
  realtimeClock: false,
  realtimeOriginMs: 0,
};
