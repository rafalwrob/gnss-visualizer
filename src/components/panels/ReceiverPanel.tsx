import { useRef, useState, useMemo } from 'react';
import { useReceiverStore } from '../../store/receiverStore';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useObserverStore } from '../../store/observerStore';
import { UbxAdapter } from '../../services/parsers/ubx/ubxAdapter';
import { NmeaAdapter } from '../../services/parsers/nmea';
import { SbfAdapter } from '../../services/parsers/sbf/sbfAdapter';
import { SerialConnection } from '../../services/receiver/serialConnection';
import { readFileWithAdapter } from '../../services/receiver/fileReader';
import { loadPluginFromFile } from '../../services/parsers/pluginLoader';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { ProtocolAdapter, ParsedData } from '../../services/parsers/protocolAdapter';
import type { GnssSystem } from '../../types/satellite';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { satElevAz } from '../../services/coordinates/ecefEnu';
import { SkyPlot } from './SkyPlot';
import { RawDataPanel } from './RawDataPanel';
import { ProtocolBuilder } from './ProtocolBuilder';

function formatPrn(system: GnssSystem, prn: number): string {
  const prefix: Record<GnssSystem, string> = {
    gps: 'G', galileo: 'E', glonass: 'R', beidou: 'C', qzss: 'J', navic: 'I', sbas: 'S',
  };
  return `${prefix[system]}${String(prn).padStart(2, '0')}`;
}

function systemColor(system: GnssSystem): string {
  return GNSS_SYSTEMS[system]?.color ?? '#8b949e';
}

function receiverTowSec(): number {
  const receiver = useReceiverStore.getState();
  const latestMeasurement = receiver.recentMeasurements[receiver.recentMeasurements.length - 1];
  if (latestMeasurement) return latestMeasurement.tow;
  if (receiver.positionFix?.utcMs != null) return receiver.positionFix.utcMs / 1000;
  const gpsEpochMs = Date.UTC(1980, 0, 6, 0, 0, 0, 0);
  return Math.floor((Date.now() - gpsEpochMs) / 1000) % 604800;
}

function refreshDerivedObservations() {
  const receiver = useReceiverStore.getState();
  const fix = receiver.positionFix;
  if (!fix || fix.fixType === 'none') return;

  const snrByPrn = new Map<string, number>();
  for (const meas of receiver.recentMeasurements) {
    snrByPrn.set(formatPrn(meas.system, meas.prn), meas.snr);
  }

  const towSec = receiverTowSec();
  const sourceSats = receiver.displaySource === 'almanac'
    ? receiver.almanacSatellites
    : useSatelliteStore.getState().satellites;

  const observations = sourceSats
    .map((sat) => {
      const { x, y, z } = computeGPSPosition(sat.eph, towSec, true, true);
      const { az, el } = satElevAz(x, y, z, fix.lat, fix.lon, fix.alt);
      return {
        prn: sat.prn,
        system: sat.system,
        azimuth: az,
        elevation: el,
        snr: snrByPrn.get(sat.prn) ?? 0,
        used: el > 0,
      };
    })
    .filter(obs => Number.isFinite(obs.azimuth) && Number.isFinite(obs.elevation) && obs.elevation >= 0)
    .sort((a, b) => b.elevation - a.elevation);

  receiver.setObservations(observations);
}

const STATUS_COLORS: Record<string, string> = {
  disconnected: '#6e7681',
  connecting: '#f7c948',
  connected: '#3fb950',
  error: '#da3633',
};

const STATUS_LABELS: Record<string, string> = {
  disconnected: 'Brak połączenia',
  connecting: 'Łączenie...',
  connected: 'Połączono',
  error: 'Błąd',
};

const serialConn = new SerialConnection();
let activeAdapter: ProtocolAdapter = new UbxAdapter();

type ReceiverTab = 'connect' | 'position' | 'sky' | 'signals' | 'raw';

const TABS: { id: ReceiverTab; label: string }[] = [
  { id: 'connect',   label: 'Połącz'  },
  { id: 'position',  label: 'Pozycja' },
  { id: 'sky',       label: 'Sky'     },
  { id: 'signals',   label: 'Sygnały' },
  { id: 'raw',       label: 'Pomiary' },
];

// ─── TAB: Połączenie ────────────────────────────────────────────────────────

interface TabConnectProps {
  fileReading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  pluginInputRef: React.RefObject<HTMLInputElement | null>;
  showBuilder: boolean;
  showTools: boolean;
  setShowBuilder: (v: boolean) => void;
  setShowTools: (v: (prev: boolean) => boolean) => void;
  handleSerial: () => void;
  handleFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePluginFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function TabConnect({
  fileReading, fileInputRef, pluginInputRef, showBuilder, showTools,
  setShowBuilder, setShowTools, handleSerial, handleFile, handlePluginFile,
}: TabConnectProps) {
  const status = useReceiverStore(s => s.status);
  const activeProtocol = useReceiverStore(s => s.activeProtocol);
  const fileProgress = useReceiverStore(s => s.fileProgress);
  const loadedPlugins = useReceiverStore(s => s.loadedPlugins);
  const setActiveProtocol = useReceiverStore(s => s.setActiveProtocol);
  const removePlugin = useReceiverStore(s => s.removePlugin);

  const protocols = [
    { id: 'ubx',  label: 'u-blox UBX' },
    { id: 'sbf',  label: 'Septentrio SBF' },
    { id: 'nmea', label: 'NMEA 0183' },
    ...loadedPlugins.map(p => ({ id: p.name, label: p.name })),
  ];

  return (
    <div className="space-y-3">
      {showBuilder && <ProtocolBuilder onClose={() => setShowBuilder(false)} />}

      <div>
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-2">Protokół</div>
        <div className="flex flex-wrap gap-1.5">
          {protocols.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProtocol(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                activeProtocol === p.id
                  ? 'bg-[#1f6feb] border-[#1f6feb] text-white font-medium'
                  : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {SerialConnection.isSupported() ? (
        <button
          onClick={handleSerial}
          className={`w-full py-2.5 rounded-lg text-sm border transition-all font-medium ${
            status === 'connected'
              ? 'bg-[#da3633]/20 border-[#da3633] text-[#da3633] hover:bg-[#da3633]/30'
              : 'bg-[#21262d] border-[#30363d] text-[#e6edf3] hover:border-[#58a6ff]'
          }`}
        >
          {status === 'connected' ? 'Rozłącz serial' : 'Połącz przez serial (USB)'}
        </button>
      ) : (
        <div className="text-[#6e7681] text-xs py-1">WebSerial wymaga Chrome albo Edge.</div>
      )}

      <button
        onClick={() => setShowTools(v => !v)}
        className="w-full py-2 rounded-lg text-xs border border-[#30363d] bg-[#161b22] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff] transition-all"
      >
        {showTools ? 'Ukryj narzędzia' : 'Narzędzia protokołu'}
      </button>

      {showTools && (
        <div className="space-y-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={fileReading}
            className="w-full py-2.5 rounded-lg text-sm border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:border-[#58a6ff] transition-all disabled:opacity-50"
          >
            {fileReading ? `Wczytywanie... ${fileProgress}%` : 'Otwórz plik (.ubx .nmea .bin .sbf)'}
          </button>
          <input ref={fileInputRef} type="file" accept=".ubx,.nmea,.bin,.sbf,.txt" className="hidden" onChange={handleFile} />

          <div className="flex gap-2">
            <button
              onClick={() => pluginInputRef.current?.click()}
              className="flex-1 py-2 rounded-lg text-xs border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:border-[#58a6ff] transition-all"
            >
              Załaduj plik .js
            </button>
            <button
              onClick={() => setShowBuilder(true)}
              className="flex-1 py-2 rounded-lg text-xs border border-[#1f6feb]/60 bg-[#1f6feb]/10 text-[#58a6ff] hover:bg-[#1f6feb]/20 transition-all"
            >
              Kreator protokołu
            </button>
          </div>
          <input ref={pluginInputRef} type="file" accept=".js" className="hidden" onChange={handlePluginFile} />

          {loadedPlugins.length > 0 && (
            <div className="space-y-1.5">
              {loadedPlugins.map(p => (
                <div key={p.name} className="flex items-center justify-between bg-[#161b22] rounded-lg px-3 py-2">
                  <span className="text-xs text-[#3fb950]">ok {p.name}</span>
                  <button onClick={() => removePlugin(p.name)} className="text-[#da3633] hover:text-red-400 text-sm">×</button>
                </div>
              ))}
            </div>
          )}

          {fileReading && (
            <div className="h-1.5 bg-[#21262d] rounded overflow-hidden">
              <div className="h-full bg-[#1f6feb] transition-all" style={{ width: `${fileProgress}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB: Pozycja / Status ──────────────────────────────────────────────────

function TabPosition() {
  const status = useReceiverStore(s => s.status);
  const errorMessage = useReceiverStore(s => s.errorMessage);
  const bytesReceived = useReceiverStore(s => s.bytesReceived);
  const messagesDecoded = useReceiverStore(s => s.messagesDecoded);
  const ephemerisCount = useReceiverStore(s => s.ephemerisCount);
  const almanacCount = useReceiverStore(s => s.almanacCount);
  const displaySource = useReceiverStore(s => s.displaySource);
  const positionFix = useReceiverStore(s => s.positionFix);
  const recentObservations = useReceiverStore(s => s.recentObservations);
  const setDisplaySource = useReceiverStore(s => s.setDisplaySource);

  return (
    <div className="space-y-3">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2.5 flex items-center gap-2.5">
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === 'connected' || status === 'connecting' ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
        <span className="text-sm font-medium" style={{ color: STATUS_COLORS[status] }}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {errorMessage && (
        <div className="text-xs text-[#da3633] bg-[#da3633]/10 rounded-lg px-3 py-2">{errorMessage}</div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Bajty',  value: bytesReceived > 1024 ? `${(bytesReceived / 1024).toFixed(1)}k` : String(bytesReceived) },
          { label: 'Wiad.', value: String(messagesDecoded) },
          { label: 'Eph.',  value: String(ephemerisCount) },
          { label: 'Alm.',  value: String(almanacCount) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#161b22] rounded-lg p-2 text-center">
            <div className="text-[#6e7681] text-[10px] mb-0.5">{label}</div>
            <div className="text-[#e6edf3] text-sm font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-1.5">Źródło satelitów</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setDisplaySource('ephemeris'); refreshDerivedObservations(); }}
            className={`py-2 rounded-lg text-xs border transition-all ${
              displaySource === 'ephemeris'
                ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                : 'bg-[#161b22] border-[#30363d] text-[#8b949e]'
            }`}
          >
            Efemerydy
          </button>
          <button
            onClick={() => {
              if (almanacCount > 0) { setDisplaySource('almanac'); refreshDerivedObservations(); }
            }}
            disabled={almanacCount === 0}
            className={`py-2 rounded-lg text-xs border transition-all ${
              displaySource === 'almanac'
                ? 'bg-[#f7c948] border-[#f7c948] text-[#0d1117]'
                : 'bg-[#161b22] border-[#30363d] text-[#8b949e] disabled:opacity-40'
            }`}
          >
            Almanachy
          </button>
        </div>
      </div>

      {positionFix && positionFix.fixType !== 'none' ? (
        <div className="bg-[#0d2a1a] border border-[#238636] rounded-xl px-3 py-2.5 text-xs font-mono text-[#3fb950]">
          <div className="font-bold text-sm mb-1.5">
            Fix: {positionFix.fixType.toUpperCase()}
            {positionFix.hdop != null && (
              <span className="ml-2 font-normal text-[#6e7681]">HDOP {positionFix.hdop.toFixed(1)}</span>
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-[#6e7681]">Szer. geogr.</span>
              <span className="tabular-nums">{positionFix.lat.toFixed(6)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e7681]">Dług. geogr.</span>
              <span className="tabular-nums">{positionFix.lon.toFixed(6)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e7681]">Wysokość</span>
              <span className="tabular-nums">{positionFix.alt.toFixed(1)} m</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-3 text-xs text-[#484f58] text-center">
          Brak fixa pozycji
        </div>
      )}

      {recentObservations.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-2 text-xs font-mono text-[#6e7681]">
          Obserwacje: <span className="text-[#e6edf3] font-bold">{recentObservations.length}</span> sat.
        </div>
      )}
    </div>
  );
}

// ─── TAB: Sygnały ───────────────────────────────────────────────────────────

function TabSignals() {
  const measurements = useReceiverStore(s => s.recentMeasurements);
  const observations = useReceiverStore(s => s.recentObservations);

  const sats = useMemo(() => {
    const map = new Map<string, { system: GnssSystem; snr: number; el: number; az: number; bands: string[] }>();
    for (const m of measurements) {
      const prn = formatPrn(m.system, m.prn);
      const existing = map.get(prn);
      if (!existing) {
        map.set(prn, { system: m.system, snr: m.snr, el: 0, az: 0, bands: [m.freqBand] });
      } else {
        if (m.snr > existing.snr) existing.snr = m.snr;
        if (!existing.bands.includes(m.freqBand)) existing.bands.push(m.freqBand);
      }
    }
    for (const obs of observations) {
      const entry = map.get(obs.prn);
      if (entry) { entry.el = obs.elevation; entry.az = obs.azimuth; }
    }
    return [...map.entries()].sort((a, b) => b[1].el - a[1].el || b[1].snr - a[1].snr);
  }, [measurements, observations]);

  if (sats.length === 0) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-6 text-xs text-[#484f58] text-center font-mono">
        Brak pomiarów sygnału
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3">
      <div className="text-[#8b949e] text-[10px] uppercase tracking-widest mb-3 font-mono">
        C/N₀ — {sats.length} satelitów
      </div>
      <div className="space-y-2">
        {sats.map(([prn, info]) => {
          const color = systemColor(info.system);
          const pct = Math.min(100, (info.snr / 60) * 100);
          const snrColor = info.snr >= 40 ? '#3fb950' : info.snr >= 25 ? '#f7c948' : '#f85149';
          return (
            <div key={prn} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-8 font-bold flex-shrink-0" style={{ color }}>{prn}</span>
              <div className="flex-1 h-3 bg-[#21262d] rounded overflow-hidden">
                <div className="h-full rounded transition-all" style={{ width: `${pct}%`, backgroundColor: snrColor }} />
              </div>
              <span className="w-8 text-right tabular-nums flex-shrink-0" style={{ color: snrColor }}>
                {info.snr}
              </span>
              {info.el > 0 && (
                <span className="w-9 text-right text-[#484f58] tabular-nums flex-shrink-0">
                  {info.el.toFixed(0)}°
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[9px] text-[#484f58] font-mono">
        <span>0</span><span>15</span><span>30</span><span>45</span><span>60 dBHz</span>
      </div>
    </div>
  );
}

// ─── Główny komponent ───────────────────────────────────────────────────────

export function ReceiverPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pluginInputRef = useRef<HTMLInputElement>(null);
  const [fileReading, setFileReading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [activeTab, setActiveTab] = useState<ReceiverTab>('connect');

  function getAdapter(): ProtocolAdapter {
    const { activeProtocol, loadedPlugins } = useReceiverStore.getState();
    if (activeProtocol === 'ubx') return new UbxAdapter();
    if (activeProtocol === 'nmea') return new NmeaAdapter();
    if (activeProtocol === 'sbf') return new SbfAdapter();
    return loadedPlugins.find(p => p.name === activeProtocol) ?? new UbxAdapter();
  }

  function handleData(data: ParsedData) {
    const store = useReceiverStore.getState();

    if (data.measurements?.length) store.addMeasurements(data.measurements);
    if (data.observations?.length) store.setObservations(data.observations);

    if (data.ephemerides?.length) {
      store.incrementEphemeris(data.ephemerides.length);
      const satStore = useSatelliteStore.getState();
      const sats = [...satStore.satellites];
      for (const { prn, system, eph } of data.ephemerides) {
        const prnStr = formatPrn(system, prn);
        const idx = sats.findIndex(s => s.prn === prnStr);
        const record = { prn: prnStr, system, plane: 0, color: systemColor(system), eph };
        if (idx >= 0) sats[idx] = record;
        else sats.push(record);
      }
      satStore.setSatellites(sats);
      satStore.setMode('constellation');
    }

    if (data.almanacs?.length) {
      store.incrementAlmanac(data.almanacs.length);
      const current = [...useReceiverStore.getState().almanacSatellites];
      for (const { prn, system, eph } of data.almanacs) {
        const prnStr = formatPrn(system, prn);
        const idx = current.findIndex(s => s.prn === prnStr);
        const record = { prn: prnStr, system, plane: 0, color: systemColor(system), eph };
        if (idx >= 0) current[idx] = record;
        else current.push(record);
      }
      useReceiverStore.getState().setAlmanacSatellites(current);
    }

    if (data.positionFix && data.positionFix.fixType !== 'none') {
      store.setPositionFix(data.positionFix);
      const observer = useObserverStore.getState();
      observer.setLat(data.positionFix.lat);
      observer.setLon(data.positionFix.lon);
      observer.setAlt(data.positionFix.alt);
    }

    if (!data.observations?.length) {
      refreshDerivedObservations();
    }
  }

  async function handleSerial() {
    const store = useReceiverStore.getState();
    if (store.status === 'connected') {
      await serialConn.disconnect();
      store.setStatus('disconnected');
      return;
    }
    activeAdapter = getAdapter();
    await serialConn.connect(activeAdapter, {
      onData: handleData,
      onStatus: (s, err) => useReceiverStore.getState().setStatus(s, err),
      onBytes: (n) => useReceiverStore.getState().incrementBytes(n),
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFileReading(true);
    useReceiverStore.getState().setFileProgress(0);
    try {
      await readFileWithAdapter(
        file, getAdapter(), handleData,
        pct => useReceiverStore.getState().setFileProgress(pct),
        n => useReceiverStore.getState().incrementBytes(n),
      );
    } finally {
      setFileReading(false);
      useReceiverStore.getState().setFileProgress(100);
      refreshDerivedObservations();
    }
  }

  async function handlePluginFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const plugin = await loadPluginFromFile(file);
      useReceiverStore.getState().addPlugin(plugin);
      useReceiverStore.getState().setActiveProtocol(plugin.name);
    } catch (err) {
      alert(`Błąd ładowania pluginu: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="font-mono">
      {/* Pasek zakładek */}
      <div className="flex mb-4 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[11px] font-mono transition-all ${
              activeTab === tab.id
                ? 'bg-[#1f6feb] text-white font-medium'
                : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'connect' && (
        <TabConnect
          fileReading={fileReading}
          fileInputRef={fileInputRef}
          pluginInputRef={pluginInputRef}
          showBuilder={showBuilder}
          showTools={showTools}
          setShowBuilder={setShowBuilder}
          setShowTools={setShowTools}
          handleSerial={handleSerial}
          handleFile={handleFile}
          handlePluginFile={handlePluginFile}
        />
      )}

      {activeTab === 'position' && <TabPosition />}
      {activeTab === 'sky' && <SkyPlot />}
      {activeTab === 'signals' && <TabSignals />}
      {activeTab === 'raw' && <RawDataPanel />}
    </div>
  );
}
