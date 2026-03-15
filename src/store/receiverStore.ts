import { create } from 'zustand';
import type { RawMeasurement, SatelliteObservation } from '../types/rawMeasurement';
import type { PositionFix, ProtocolAdapter } from '../services/parsers/protocolAdapter';

export type ReceiverStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const MAX_MEASUREMENTS = 200;

interface ReceiverState {
  status: ReceiverStatus;
  errorMessage: string;
  activeProtocol: string;
  loadedPlugins: ProtocolAdapter[];
  recentMeasurements: RawMeasurement[];
  recentObservations: SatelliteObservation[];
  positionFix: PositionFix | null;
  bytesReceived: number;
  messagesDecoded: number;
  ephemerisCount: number;
  fileProgress: number; // 0-100

  setStatus: (s: ReceiverStatus, err?: string) => void;
  setActiveProtocol: (name: string) => void;
  addPlugin: (plugin: ProtocolAdapter) => void;
  removePlugin: (name: string) => void;
  addMeasurements: (m: RawMeasurement[]) => void;
  setObservations: (obs: SatelliteObservation[]) => void;
  setPositionFix: (fix: PositionFix) => void;
  incrementBytes: (n: number) => void;
  incrementMessages: (n: number) => void;
  incrementEphemeris: (n: number) => void;
  setFileProgress: (pct: number) => void;
  reset: () => void;
}

export const useReceiverStore = create<ReceiverState>((set) => ({
  status: 'disconnected',
  errorMessage: '',
  activeProtocol: 'ubx',
  loadedPlugins: [],
  recentMeasurements: [],
  recentObservations: [],
  positionFix: null,
  bytesReceived: 0,
  messagesDecoded: 0,
  ephemerisCount: 0,
  fileProgress: 0,

  setStatus: (s, err) => set({ status: s, errorMessage: err ?? '' }),
  setActiveProtocol: (name) => set({ activeProtocol: name }),
  addPlugin: (plugin) => set(st => ({ loadedPlugins: [...st.loadedPlugins, plugin] })),
  removePlugin: (name) => set(st => ({ loadedPlugins: st.loadedPlugins.filter(p => p.name !== name) })),
  addMeasurements: (m) => set(st => {
    const combined = [...st.recentMeasurements, ...m];
    return {
      recentMeasurements: combined.slice(-MAX_MEASUREMENTS),
      messagesDecoded: st.messagesDecoded + m.length,
    };
  }),
  setObservations: (obs) => set({ recentObservations: obs }),
  setPositionFix: (fix) => set({ positionFix: fix }),
  incrementBytes: (n) => set(st => ({ bytesReceived: st.bytesReceived + n })),
  incrementMessages: (n) => set(st => ({ messagesDecoded: st.messagesDecoded + n })),
  incrementEphemeris: (n) => set(st => ({ ephemerisCount: st.ephemerisCount + n })),
  setFileProgress: (pct) => set({ fileProgress: pct }),
  reset: () => set({
    status: 'disconnected', errorMessage: '',
    recentMeasurements: [], recentObservations: [], positionFix: null,
    bytesReceived: 0, messagesDecoded: 0, ephemerisCount: 0, fileProgress: 0,
  }),
}));
