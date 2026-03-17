import type { GnssSystem } from '../types/satellite';

export interface FrequencyBand {
  name: string;
  freq: number;     // [MHz] środek pasma
  width: number;    // [MHz] szerokość
  systems: GnssSystem[];
  color: string;
  signals: string[]; // kody sygnałów w tym paśmie
}

export const FREQ_BANDS: FrequencyBand[] = [
  // GPS
  { name: 'L5',   freq: 1176.45, width: 24, systems: ['gps'],     color: '#388bfd', signals: ['L5 I', 'L5 Q']              },
  { name: 'L2',   freq: 1227.60, width: 20, systems: ['gps'],     color: '#1f6feb', signals: ['P(Y)', 'L2C', 'L2M']        },
  { name: 'L1',   freq: 1575.42, width: 24, systems: ['gps'],     color: '#58a6ff', signals: ['C/A', 'P(Y)', 'L1M']        },
  // Galileo
  { name: 'E5a',  freq: 1176.45, width: 24, systems: ['galileo'], color: '#d29922', signals: ['E5a-I', 'E5a-Q']            },
  { name: 'E5b',  freq: 1207.14, width: 24, systems: ['galileo'], color: '#f0883e', signals: ['E5b-I', 'E5b-Q']            },
  { name: 'E6',   freq: 1278.75, width: 40, systems: ['galileo'], color: '#ffa657', signals: ['E6-B', 'E6-C', 'E6-PRS']    },
  { name: 'E1',   freq: 1575.42, width: 24, systems: ['galileo'], color: '#f0883e', signals: ['E1-B (OS)', 'E1-C', 'E1-PRS'] },
  // GLONASS
  { name: 'G2',   freq: 1246.00, width: 14, systems: ['glonass'], color: '#da3633', signals: ['L2OF', 'L2SF']              },
  { name: 'G1',   freq: 1602.00, width: 16, systems: ['glonass'], color: '#f85149', signals: ['L1OF', 'L1SF']              },
  // BeiDou
  { name: 'B1I',  freq: 1561.10, width:  4, systems: ['beidou'],  color: '#f7c948', signals: ['B1I']                       },
  { name: 'B2I',  freq: 1207.14, width: 24, systems: ['beidou'],  color: '#d4a017', signals: ['B2I']                       },
  { name: 'B3I',  freq: 1268.52, width: 24, systems: ['beidou'],  color: '#e3b341', signals: ['B3I']                       },
];
