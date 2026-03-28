/** Mutable singleton — czytany w useFrame bez Zustand overhead */

function getCurrentDayOfYear(): number {
  const now = new Date();
  return Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      86400000
  );
}

export const celestialAnim = {
  dayOfYear: getCurrentDayOfYear(), // 0-365
  animating: false,
  animSpeed: 30.0, // dni na sekundę
};
