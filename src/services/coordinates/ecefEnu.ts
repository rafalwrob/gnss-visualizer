import { R_E, WGS84_E2 } from '../../constants/gnss';

const DEG = Math.PI / 180;

export interface ElevAz { el: number; az: number; }

export interface DopResult {
  gdop: number;
  pdop: number;
  hdop: number;
  vdop: number;
  tdop: number;
}

/** Inwersja macierzy 4×4 — eliminacja Gaussa z pivotowaniem częściowym */
function invert4x4(m: number[][]): number[][] | null {
  const aug = m.map((row, i) => [
    ...row,
    ...Array.from({ length: 4 }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let col = 0; col < 4; col++) {
    let maxRow = col;
    for (let row = col + 1; row < 4; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) return null;
    const scale = aug[col][col];
    for (let j = 0; j < 8; j++) aug[col][j] /= scale;
    for (let row = 0; row < 4; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 8; j++) aug[row][j] -= f * aug[col][j];
    }
  }
  return aug.map(row => row.slice(4));
}

/**
 * Oblicza DOP (Dilution of Precision) na podstawie elewacji/azymutów widocznych satelitów.
 * Wymaga minimum 4 satelitów. Zwraca null gdy geometria jest zdegenerowana.
 *
 * Algorytm: H = macierz kierunków (N×4), Q = (H^T·H)^-1
 * GDOP=√(ΣQ_ii), PDOP=√(Q₀₀+Q₁₁+Q₂₂), HDOP=√(Q₀₀+Q₁₁), VDOP=√Q₂₂, TDOP=√Q₃₃
 */
export function computeDOP(sats: { el: number; az: number }[]): DopResult | null {
  if (sats.length < 4) return null;

  // Macierz H (N×4): [e, n, u, 1] per satelita (układ ENU + czas)
  const H: number[][] = sats.map(({ el, az }) => {
    const elR = el * DEG;
    const azR = az * DEG;
    return [
      Math.cos(elR) * Math.sin(azR), // East
      Math.cos(elR) * Math.cos(azR), // North
      Math.sin(elR),                  // Up
      1,                              // czas
    ];
  });

  // A = H^T · H (4×4)
  const A: number[][] = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) =>
      H.reduce((s, row) => s + row[i] * row[j], 0),
    ),
  );

  const Q = invert4x4(A);
  if (!Q) return null;

  const sq = (v: number) => Math.sqrt(Math.max(0, v));
  return {
    gdop: sq(Q[0][0] + Q[1][1] + Q[2][2] + Q[3][3]),
    pdop: sq(Q[0][0] + Q[1][1] + Q[2][2]),
    hdop: sq(Q[0][0] + Q[1][1]),
    vdop: sq(Q[2][2]),
    tdop: sq(Q[3][3]),
  };
}

/** Geodetyczna (stopnie, m) → ECEF (metry) */
export function latLonAltToEcef(
  latDeg: number,
  lonDeg: number,
  altM: number,
): { x: number; y: number; z: number } {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const N = R_E / Math.sqrt(1 - WGS84_E2 * Math.sin(lat) ** 2);
  return {
    x: (N + altM) * Math.cos(lat) * Math.cos(lon),
    y: (N + altM) * Math.cos(lat) * Math.sin(lon),
    z: (N * (1 - WGS84_E2) + altM) * Math.sin(lat),
  };
}

/**
 * Elevation i azymut satelity z pozycji obserwatora.
 * @param satX/Y/Z  — pozycja satelity ECEF [m]
 * @param obsLat/Lon — pozycja obserwatora [stopnie]
 * @param obsAlt     — wys. obserwatora nad elipsoidą [m]
 * @returns el — elewacja [°], az — azymut [°, N=0, E=90]
 */
export function satElevAz(
  satX: number, satY: number, satZ: number,
  obsLat: number, obsLon: number, obsAlt: number,
): ElevAz {
  const obs = latLonAltToEcef(obsLat, obsLon, obsAlt);
  const dx = satX - obs.x;
  const dy = satY - obs.y;
  const dz = satZ - obs.z;

  const lat = obsLat * DEG;
  const lon = obsLon * DEG;

  // Transformacja ECEF → ENU
  const e =  -Math.sin(lon) * dx + Math.cos(lon) * dy;
  const n =  -Math.sin(lat) * Math.cos(lon) * dx
             -Math.sin(lat) * Math.sin(lon) * dy
             + Math.cos(lat) * dz;
  const u =   Math.cos(lat) * Math.cos(lon) * dx
             + Math.cos(lat) * Math.sin(lon) * dy
             + Math.sin(lat) * dz;

  const dist = Math.sqrt(e * e + n * n + u * u);
  const el = Math.asin(u / dist) / DEG;
  const az = ((Math.atan2(e, n) / DEG) + 360) % 360;

  return { el, az };
}
