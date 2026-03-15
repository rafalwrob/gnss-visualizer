import { useRef, useState } from 'react';
import { useReceiverStore } from '../../store/receiverStore';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useObserverStore } from '../../store/observerStore';
import { UbxAdapter } from '../../services/parsers/ubx/ubxAdapter';
import { NmeaAdapter } from '../../services/parsers/nmea';
import { SerialConnection } from '../../services/receiver/serialConnection';
import { readFileWithAdapter } from '../../services/receiver/fileReader';
import { loadPluginFromFile } from '../../services/parsers/pluginLoader';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { ProtocolAdapter, ParsedData } from '../../services/parsers/protocolAdapter';
import type { GnssSystem } from '../../types/satellite';
import { SkyPlot } from './SkyPlot';
import { RawDataPanel } from './RawDataPanel';

function formatPrn(system: GnssSystem, prn: number): string {
  const prefix: Record<GnssSystem, string> = {
    gps: 'G', galileo: 'E', glonass: 'R', beidou: 'C', qzss: 'J', navic: 'I', sbas: 'S',
  };
  return `${prefix[system]}${String(prn).padStart(2, '0')}`;
}

function systemColor(system: GnssSystem): string {
  return GNSS_SYSTEMS[system]?.color ?? '#8b949e';
}

const statusColors: Record<string, string> = {
  disconnected: '#6e7681',
  connecting: '#f7c948',
  connected: '#3fb950',
  error: '#da3633',
};
const statusLabels: Record<string, string> = {
  disconnected: 'Brak połączenia',
  connecting: 'Łączenie...',
  connected: 'Połączono',
  error: 'Błąd',
};

const serialConn = new SerialConnection();
let activeAdapter: ProtocolAdapter = new UbxAdapter();

export function ReceiverPanel() {
  const store = useReceiverStore();
  const { loadedPlugins } = store;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pluginInputRef = useRef<HTMLInputElement>(null);
  const [fileReading, setFileReading] = useState(false);

  function getAdapter(): ProtocolAdapter {
    if (store.activeProtocol === 'ubx') return new UbxAdapter();
    if (store.activeProtocol === 'nmea') return new NmeaAdapter();
    const plugin = loadedPlugins.find(p => p.name === store.activeProtocol);
    return plugin ?? new UbxAdapter();
  }

  function handleData(data: ParsedData) {
    if (data.measurements?.length) {
      store.addMeasurements(data.measurements);
    }
    if (data.observations?.length) {
      store.setObservations(data.observations);
    }
    if (data.ephemerides?.length) {
      store.incrementEphemeris(data.ephemerides.length);
      const sats = [...useSatelliteStore.getState().satellites];
      for (const { prn, system, eph } of data.ephemerides) {
        const prnStr = formatPrn(system, prn);
        const idx = sats.findIndex(s => s.prn === prnStr);
        const record = { prn: prnStr, system, plane: 0, color: systemColor(system), eph };
        if (idx >= 0) sats[idx] = record;
        else sats.push(record);
      }
      useSatelliteStore.getState().setSatellites(sats);
    }
    if (data.positionFix && data.positionFix.fixType !== 'none') {
      store.setPositionFix(data.positionFix);
      useObserverStore.getState().setLat(data.positionFix.lat);
      useObserverStore.getState().setLon(data.positionFix.lon);
      useObserverStore.getState().setAlt(data.positionFix.alt);
    }
  }

  async function handleSerial() {
    if (store.status === 'connected') {
      await serialConn.disconnect();
      store.setStatus('disconnected');
      return;
    }
    activeAdapter = getAdapter();
    await serialConn.connect(activeAdapter, {
      onData: handleData,
      onStatus: (s, err) => store.setStatus(s, err),
      onBytes: (n) => store.incrementBytes(n),
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const adapter = getAdapter();
    setFileReading(true);
    store.setFileProgress(0);
    try {
      await readFileWithAdapter(file, adapter, handleData, (pct) => {
        store.setFileProgress(pct);
      });
    } finally {
      setFileReading(false);
      store.setFileProgress(100);
    }
  }

  async function handlePluginFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const plugin = await loadPluginFromFile(file);
      store.addPlugin(plugin);
      store.setActiveProtocol(plugin.name);
    } catch (err) {
      alert(`Błąd ładowania pluginu: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const status = store.status;
  const protocols = [
    { id: 'ubx', label: 'UBX' },
    { id: 'nmea', label: 'NMEA' },
    ...loadedPlugins.map(p => ({ id: p.name, label: p.name })),
  ];

  const serialSupported = SerialConnection.isSupported();

  return (
    <div className="space-y-2 font-mono">

      {/* Wybór protokołu */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2">Protokół</div>
        <div className="flex flex-wrap gap-1">
          {protocols.map(p => (
            <button
              key={p.id}
              onClick={() => store.setActiveProtocol(p.id)}
              className={`px-2 py-1 rounded text-[10px] border transition-all ${
                store.activeProtocol === p.id
                  ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                  : 'bg-transparent border-[#30363d] text-[#6e7681] hover:border-[#58a6ff] hover:text-[#58a6ff]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Serial */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2">Serial (WebSerial)</div>
        {serialSupported ? (
          <button
            onClick={handleSerial}
            className={`w-full py-1.5 rounded text-[10px] border transition-all ${
              status === 'connected'
                ? 'bg-[#da3633]/20 border-[#da3633] text-[#da3633] hover:bg-[#da3633]/30'
                : 'bg-[#21262d] border-[#30363d] text-[#e6edf3] hover:border-[#58a6ff]'
            }`}
          >
            {status === 'connected' ? '⏹ Rozłącz serial' : '🔌 Połącz serial'}
          </button>
        ) : (
          <div className="text-[#6e7681] text-[9px]">
            WebSerial wymaga Chrome lub Edge. Firefox nie obsługuje.
          </div>
        )}
      </div>

      {/* Plik */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2">Plik binarny / NMEA</div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={fileReading}
          className="w-full py-1.5 rounded text-[10px] border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:border-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {fileReading ? `Wczytywanie... ${store.fileProgress}%` : '📂 Otwórz plik (.ubx .nmea .bin .txt)'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ubx,.nmea,.bin,.txt"
          className="hidden"
          onChange={handleFile}
        />
        {fileReading && (
          <div className="mt-2 h-1.5 bg-[#21262d] rounded overflow-hidden">
            <div
              className="h-full bg-[#1f6feb] transition-all"
              style={{ width: `${store.fileProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Plugin */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2">Plugin protokołu (.js)</div>
        <button
          onClick={() => pluginInputRef.current?.click()}
          className="w-full py-1.5 rounded text-[10px] border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:border-[#58a6ff]"
        >
          📦 Załaduj protokół .js
        </button>
        <input
          ref={pluginInputRef}
          type="file"
          accept=".js"
          className="hidden"
          onChange={handlePluginFile}
        />
        {loadedPlugins.length > 0 && (
          <div className="mt-2 space-y-1">
            {loadedPlugins.map(p => (
              <div key={p.name} className="flex items-center justify-between text-[9px]">
                <span className="text-[#3fb950]">✓ {p.name}</span>
                <button
                  onClick={() => store.removePlugin(p.name)}
                  className="text-[#da3633] hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2">Status</div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`w-2 h-2 rounded-full ${status === 'connected' || status === 'connecting' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: statusColors[status] }}
          />
          <span className="text-[10px]" style={{ color: statusColors[status] }}>
            {statusLabels[status]}
          </span>
        </div>
        {store.errorMessage && (
          <div className="text-[#da3633] text-[9px] mb-2">{store.errorMessage}</div>
        )}

        {/* Liczniki */}
        <div className="grid grid-cols-3 gap-1 text-center">
          {[
            { label: 'Bajty', value: store.bytesReceived > 1024
                ? `${(store.bytesReceived / 1024).toFixed(1)}k`
                : String(store.bytesReceived) },
            { label: 'Wiad.', value: String(store.messagesDecoded) },
            { label: 'Efem.', value: String(store.ephemerisCount) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#161b22] rounded p-1">
              <div className="text-[#6e7681] text-[8px]">{label}</div>
              <div className="text-[#e6edf3] text-[10px] font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* Pozycja */}
        {store.positionFix && store.positionFix.fixType !== 'none' && (
          <div className="mt-2 text-[9px] text-[#3fb950]">
            <div>Lat: {store.positionFix.lat.toFixed(6)}°</div>
            <div>Lon: {store.positionFix.lon.toFixed(6)}°</div>
            <div>Alt: {store.positionFix.alt.toFixed(1)} m ({store.positionFix.fixType})</div>
          </div>
        )}
      </div>

      <SkyPlot />
      <RawDataPanel />
    </div>
  );
}
