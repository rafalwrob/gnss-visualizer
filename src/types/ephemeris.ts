/** Elementy orbitalne satelity GNSS (Keplerian + perturbacje) */
export interface KeplerianEphemeris {
  /** Półoś wielka [m] */
  a: number;
  /** Mimośród */
  e: number;
  /** Inklinacja [rad] */
  i0: number;
  /** RAAN — długość węzła wstępującego [rad] */
  Omega0: number;
  /** Prędkość kątowa RAAN [rad/s] */
  OmegaDot: number;
  /** Argument perygeum [rad] */
  omega: number;
  /** Anomalia średnia na toe [rad] */
  M0: number;
  /** Korekcja ruchu średniego [rad/s] */
  dn: number;
  /** Prędkość kątowa inklinacji [rad/s] */
  IDOT: number;
  /** Perturbacje harmoniczne: Cuc, Cus [rad], Crc, Crs [m], Cic, Cis [rad] */
  Cuc: number;
  Cus: number;
  Crc: number;
  Crs: number;
  Cic: number;
  Cis: number;
  /** Czas efemerydy [s od tygodnia GPS] */
  toe: number;
}

export interface EcefPosition {
  x: number;
  y: number;
  z: number;
}

export interface LatLonAlt {
  lat: number; // [deg]
  lon: number; // [deg]
  alt: number; // [m]
}
