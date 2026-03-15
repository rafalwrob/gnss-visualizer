import type { GnssSystem } from './satellite';

export interface AlmanacRecord {
  prn: number;
  system: GnssSystem;
  /** Półoś wielka [m] */
  a: number;
  /** Mimośród */
  e: number;
  /** Inklinacja [rad] */
  i: number;
  /** RAAN [rad] */
  Omega0: number;
  /** Prędkość kątowa RAAN [rad/s] */
  OmegaDot: number;
  /** Argument perygeum [rad] */
  omega: number;
  /** Anomalia średnia [rad] */
  M0: number;
  /** Korekta zegara af0 [s] */
  af0: number;
  /** Korekta zegara af1 [s/s] */
  af1: number;
  /** Czas almanachu [s od tygodnia GPS] */
  toa: number;
  /** Tydzień almanachu GPS */
  week: number;
  /** Zdrowie satelity (0 = OK) */
  health: number;
}
