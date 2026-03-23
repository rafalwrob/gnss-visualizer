import { MU, OMEGA_E, GNSS_SYSTEMS } from '../../../constants/gnss';
import type { GnssSystem } from '../../../types/satellite';
import type { KeplerianEphemeris } from '../../../types/ephemeris';

const PI = Math.PI;
const TWO_PI = 2 * PI;

function norm(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function cross(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): [number, number, number] {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
}

function dot(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  return ax * bx + ay * by + az * bz;
}

function wrapAngle(angle: number): number {
  let out = angle % TWO_PI;
  if (out < 0) out += TWO_PI;
  return out;
}

function rotateEcefToEci(x: number, y: number, z: number, vx: number, vy: number, vz: number, towSec: number) {
  // Inference: GLONASS state is broadcast in Earth-fixed PZ-90.02.
  // Rotate around Earth's z-axis and add omega x r to convert velocity to inertial frame.
  const theta = OMEGA_E * towSec;
  const c = Math.cos(theta);
  const s = Math.sin(theta);

  const rx = c * x - s * y;
  const ry = s * x + c * y;
  const rz = z;

  const rvx = c * vx - s * vy;
  const rvy = s * vx + c * vy;
  const rvz = vz;

  return {
    x: rx,
    y: ry,
    z: rz,
    vx: rvx - OMEGA_E * ry,
    vy: rvy + OMEGA_E * rx,
    vz: rvz,
  };
}

export function stateVectorToKepler(
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  toe: number,
): KeplerianEphemeris | null {
  const r = norm(x, y, z);
  const v2 = vx * vx + vy * vy + vz * vz;
  if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(v2)) return null;

  const [hx, hy, hz] = cross(x, y, z, vx, vy, vz);
  const h = norm(hx, hy, hz);
  if (!Number.isFinite(h) || h <= 0) return null;

  const nx = -hy;
  const ny = hx;
  const n = Math.sqrt(nx * nx + ny * ny);

  const rv = dot(x, y, z, vx, vy, vz);
  const ex = ((v2 - MU / r) * x - rv * vx) / MU;
  const ey = ((v2 - MU / r) * y - rv * vy) / MU;
  const ez = ((v2 - MU / r) * z - rv * vz) / MU;
  const e = norm(ex, ey, ez);

  const a = 1 / ((2 / r) - (v2 / MU));
  const i0 = Math.acos(Math.max(-1, Math.min(1, hz / h)));

  const Omega0 = n > 1e-12 ? wrapAngle(Math.atan2(ny, nx)) : 0;

  let omega = 0;
  if (n > 1e-12 && e > 1e-10) {
    const cosOmega = Math.max(-1, Math.min(1, (nx * ex + ny * ey) / (n * e)));
    omega = Math.acos(cosOmega);
    if (ez < 0) omega = TWO_PI - omega;
  }

  let nu = 0;
  if (e > 1e-10) {
    const cosNu = Math.max(-1, Math.min(1, (ex * x + ey * y + ez * z) / (e * r)));
    nu = Math.acos(cosNu);
    if (rv < 0) nu = TWO_PI - nu;
  } else if (n > 1e-12) {
    const cosU = Math.max(-1, Math.min(1, (nx * x + ny * y) / (n * r)));
    nu = Math.acos(cosU);
    if (z < 0) nu = TWO_PI - nu;
  }

  const E = e < 1 ? 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2)) : nu;
  const M0 = wrapAngle(E - e * Math.sin(E));

  if (!Number.isFinite(a) || !Number.isFinite(e) || !Number.isFinite(i0) || a <= 0 || e >= 1) return null;

  return {
    a,
    e,
    i0,
    Omega0,
    OmegaDot: 0,
    omega: wrapAngle(omega),
    M0,
    dn: 0,
    IDOT: 0,
    Cuc: 0,
    Cus: 0,
    Crc: 0,
    Crs: 0,
    Cic: 0,
    Cis: 0,
    toe,
  };
}

export function glonassStateToKepler(
  xKm: number,
  yKm: number,
  zKm: number,
  vxKmS: number,
  vyKmS: number,
  vzKmS: number,
  toe: number,
): KeplerianEphemeris | null {
  const eci = rotateEcefToEci(
    xKm * 1000,
    yKm * 1000,
    zKm * 1000,
    vxKmS * 1000,
    vyKmS * 1000,
    vzKmS * 1000,
    toe,
  );
  return stateVectorToKepler(eci.x, eci.y, eci.z, eci.vx, eci.vy, eci.vz, toe);
}

export function almanacToKepler(
  system: GnssSystem,
  fields: {
    sqrtA: number;
    e: number;
    deltaI?: number;
    Omega0: number;
    OmegaDot?: number;
    omega: number;
    M0: number;
    toe: number;
  },
): KeplerianEphemeris {
  const info = GNSS_SYSTEMS[system];
  const nominalI = info.i0;
  const nominalSqrtA = Math.sqrt(info.a);
  const deltaI = fields.deltaI ?? 0;
  const OmegaDot = fields.OmegaDot ?? 0;

  // Galileo almanac carries SQRT_A relative to nominal; others are already absolute in this project flow.
  const sqrtA = system === 'galileo' ? nominalSqrtA + fields.sqrtA : fields.sqrtA;
  const a = sqrtA * sqrtA;
  const i0 = nominalI + deltaI;

  return {
    a,
    e: fields.e,
    i0,
    Omega0: fields.Omega0,
    OmegaDot,
    omega: fields.omega,
    M0: fields.M0,
    dn: 0,
    IDOT: 0,
    Cuc: 0,
    Cus: 0,
    Crc: 0,
    Crs: 0,
    Cic: 0,
    Cis: 0,
    toe: fields.toe,
  };
}
