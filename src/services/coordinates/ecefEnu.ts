import { R_E, WGS84_E2 } from '../../constants/gnss';

const DEG = Math.PI / 180;

export interface ElevAz { el: number; az: number; }

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
