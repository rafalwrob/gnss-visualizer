export interface EcefCoord {
  x: number;
  y: number;
  z: number;
}

export interface EciCoord {
  x: number;
  y: number;
  z: number;
}

export interface EnuCoord {
  east: number;
  north: number;
  up: number;
}

export interface AzEl {
  az: number; // [deg] 0=N, 90=E
  el: number; // [deg] 0=horizon, 90=zenith
  range: number; // [m]
}
