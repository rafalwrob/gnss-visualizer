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
  { name: 'L5/E5a', freq: 1176.45, width: 24, systems: ['gps', 'galileo'], color: '#1f6feb', signals: ['L5',    'E5a']                    },
  { name: 'E5b',    freq: 1207.14, width: 24, systems: ['galileo'],         color: '#f0883e', signals: ['E5b']                             },
  { name: 'L2',     freq: 1227.60, width: 20, systems: ['gps'],             color: '#1f6feb', signals: ['P(Y)',  'L2C', 'M']               },
  { name: 'G2',     freq: 1246,    width: 14, systems: ['glonass'],         color: '#da3633', signals: ['L2OF', 'L2SF']                    },
  { name: 'E6',     freq: 1278.75, width: 40, systems: ['galileo'],         color: '#f0883e', signals: ['E6-CS', 'E6-PRS']                 },
  { name: 'L1/E1',  freq: 1575.42, width: 24, systems: ['gps', 'galileo'], color: '#1f6feb', signals: ['C/A',   'P(Y)', 'M', 'E1-OS', 'E1-PRS'] },
  { name: 'G1',     freq: 1602,    width: 16, systems: ['glonass'],         color: '#da3633', signals: ['L1OF', 'L1SF']                    },
  { name: 'B1',     freq: 1561.10, width:  4, systems: ['beidou'],          color: '#f7c948', signals: ['B1I']                             },
  { name: 'B2',     freq: 1207.14, width: 24, systems: ['beidou'],          color: '#f7c948', signals: ['B2I']                             },
  { name: 'B3',     freq: 1268.52, width: 24, systems: ['beidou'],          color: '#d4a017', signals: ['B3I']                             },
];
