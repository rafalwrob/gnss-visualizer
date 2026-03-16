import type { KlobucharParams } from '../../types/ionosphere';

export const DEFAULT_KLOBUCHAR: KlobucharParams = {
  a0: 1.49e-8, a1: 0.0, a2: -5.96e-8, a3: 5.96e-8,
  b0: 7.34e4,  b1: 0.0, b2: -6.55e4,  b3: 1.97e5,
};

/**
 * Model jonosfery Klobuchar (IS-GPS-200).
 * Zwraca opóźnienie jonosferyczne [m] dla L1.
 *
 * @param elevDeg   Kąt elewacji satelity [°]
 * @param latUser   Szerokość geograficzna odbiornika [°]
 * @param lonUser   Długość geograficzna odbiornika [°]
 * @param azDeg     Azymut satelity [°]
 * @param gpsSec    Czas GPS od początku tygodnia [s]
 * @param params    Współczynniki Klobuchar (z nagłówka RINEX / nawigacji)
 */
export function klobucherDelay(
  elevDeg: number,
  latUser: number,
  lonUser: number,
  azDeg: number,
  gpsSec: number,
  params: KlobucharParams = DEFAULT_KLOBUCHAR,
): number {
  const { a0, a1, a2, a3, b0, b1, b2, b3 } = params;

  const elev = elevDeg / 180; // półokręgi
  const az = azDeg / 180;
  const phiU = latUser / 180;

  // Earth central angle
  const psi = 0.0137 / (elev + 0.11) - 0.022;

  // Subionospheric point latitude
  const phiI = Math.max(-0.416, Math.min(0.416, phiU + psi * Math.cos(az * Math.PI)));

  // Subionospheric point longitude (semicircles)
  const lambdaI = lonUser / 180 + (psi * Math.sin(az * Math.PI)) / Math.cos(phiI * Math.PI);

  // Geomagnetic latitude of subionospheric point
  const phiM = phiI + 0.064 * Math.cos((lambdaI - 1.617) * Math.PI);

  // Local time at subionospheric point
  let t = 4.32e4 * lambdaI + gpsSec;
  t = ((t % 86400) + 86400) % 86400;

  const phiM2 = phiM * phiM;
  const phiM3 = phiM2 * phiM;

  const A = Math.max(0, a0 + a1 * phiM + a2 * phiM2 + a3 * phiM3);
  const P = Math.max(72000, b0 + b1 * phiM + b2 * phiM2 + b3 * phiM3);
  const X = (2 * Math.PI * (t - 50400)) / P;

  // Oblique factor
  const F = 1 + 16 * Math.pow(0.53 - elev, 3);

  const T_iono = F * (Math.abs(X) < 1.57 ? 5e-9 + A * (1 - (X * X) / 2 + (X * X * X * X) / 24) : 5e-9);

  return T_iono * 3e8; // metry
}

/** Buduje siatkę opóźnień jonosferycznych (lat×lon) do wizualizacji */
export function buildIonoGrid(
  nLat: number,
  nLon: number,
  params: KlobucharParams = DEFAULT_KLOBUCHAR,
  gpsSec = 0,
): { grid: Float32Array; minV: number; maxV: number } {
  const grid = new Float32Array(nLat * nLon);
  let minV = Infinity;
  let maxV = -Infinity;

  for (let li = 0; li < nLat; li++) {
    const latM = -90 + (li + 0.5) * (180 / nLat);
    for (let lo = 0; lo < nLon; lo++) {
      const lonM = -180 + (lo + 0.5) * (360 / nLon);
      const localSec = (((lonM / 360) * 86400) + gpsSec + 86400) % 86400;
      const delay = klobucherDelay(90, latM, lonM, 0, localSec, params);
      grid[li * nLon + lo] = delay;
      if (delay < minV) minV = delay;
      if (delay > maxV) maxV = delay;
    }
  }

  return { grid, minV, maxV };
}
