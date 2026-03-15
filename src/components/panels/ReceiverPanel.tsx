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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
      <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-3 font-mono">{title}</div>
      {children}
    </div>
  );
}

const serialConn = new SerialConnection();
let activeAdapter: ProtocolAdapter = new UbxAdapter();

export function ReceiverPanel() {
  const store = useReceiverStore();
  const { loadedPlugins } = store;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pluginInputRef = useRef<HTMLInputElement>(null);
  const [fileReading, setFileReading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  function getAdapter(): ProtocolAdapter {
    if (store.activeProtocol === 'ubx') return new UbxAdapter();
    if (store.activeProtocol === 'nmea') return new NmeaAdapter();
    return loadedPlugins.find(p => p.name === store.activeProtocol) ?? new UbxAdapter();
  }

  function handleData(data: ParsedData) {
    if (data.measurements?.length) store.addMeasurements(data.measurements);
    if (data.observations?.length) store.setObservations(data.observations);
    if (data.ephemerides?.length) {
      store.incrementEphemeris(data.ephemerides.length);
      const sats = [...useSatelliteStore.getState().satellites];
      for (const { prn, system, eph } of data.ephemerides) {
        const prnStr = formatPrn(system, prn);
        const idx = sats.findIndex(s => s.prn === prnStr);
        const record = { prn: prnStr, system, plane: 0, color: systemColor(system), eph };
        if (idx >= 0) sats[idx] = record; else sats.push(record);
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
    setFileReading(true);
    store.setFileProgress(0);
    try {
      await readFileWithAdapter(file, getAdapter(), handleData, pct => store.setFileProgress(pct));
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
    { id: 'ubx', label: 'u-blox UBX' },
    { id: 'nmea', label: 'NMEA 0183' },
    ...loadedPlugins.map(p => ({ id: p.name, label: p.name })),
  ];

  return (
    <div className="space-y-4 font-mono">
      {showBuilder && <ProtocolBuilder onClose={() => setShowBuilder(false)} />}

      {/* Protokół */}
      <SectionCard title="Protokół">
        <div className="flex flex-wrap gap-2">
          {protocols.map(p => (
            <button
              key={p.id}
              onClick={() => store.setActiveProtocol(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                store.activeProtocol === p.id
                  ? 'bg-[#1f6feb] border-[#1f6feb] text-white font-medium'
                  : 'border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Połączenie */}
      <SectionCard title="Połączenie">
        <div className="space-y-2">
          {/* Serial */}
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
            <div className="text-[#6e7681] text-xs py-1">
              WebSerial: wymagany Chrome lub Edge (Firefox nie obsługuje)
            </div>
          )}

          {/* Plik */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={fileReading}
            className="w-full py-2.5 rounded-lg text-sm border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:border-[#58a6ff] transition-all disabled:opacity-50"
          >
            {fileReading ? `Wczytywanie… ${store.fileProgress}%` : 'Otwórz plik (.ubx  .nmea  .bin)'}
          </button>
          <input ref={fileInputRef} type="file" accept=".ubx,.nmea,.bin,.txt" className="hidden" onChange={handleFile} />
          {fileReading && (
            <div className="h-1.5 bg-[#21262d] rounded overflow-hidden">
              <div className="h-full bg-[#1f6feb] transition-all" style={{ width: `${store.fileProgress}%` }} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Plugin protokołu */}
      <SectionCard title="Plugin protokołu (.js)">
        <div className="flex gap-2 mb-3">
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
                <span className="text-xs text-[#3fb950]">✓ {p.name}</span>
                <button onClick={() => store.removePlugin(p.name)} className="text-[#da3633] hover:text-red-400 text-sm">✕</button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Status i liczniki */}
      <SectionCard title="Status">
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === 'connected' || status === 'connecting' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: STATUS_COLORS[status] }}
          />
          <span className="text-sm font-medium" style={{ color: STATUS_COLORS[status] }}>
            {STATUS_LABELS[status]}
          </span>
        </div>
        {store.errorMessage && (
          <div className="text-xs text-[#da3633] mb-3 bg-[#da3633]/10 rounded-lg px-3 py-2">{store.errorMessage}</div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Bajty', value: store.bytesReceived > 1024 ? `${(store.bytesReceived / 1024).toFixed(1)} kB` : `${store.bytesReceived} B` },
            { label: 'Wiadomości', value: String(store.messagesDecoded) },
            { label: 'Efemerydy', value: String(store.ephemerisCount) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#161b22] rounded-lg p-2.5 text-center">
              <div className="text-[#6e7681] text-[10px] mb-1">{label}</div>
              <div className="text-[#e6edf3] text-sm font-bold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        {store.positionFix && store.positionFix.fixType !== 'none' && (
          <div className="bg-[#0d2a1a] border border-[#238636] rounded-lg px-3 py-2.5 text-xs text-[#3fb950] space-y-1">
            <div className="font-medium mb-1">Pozycja ({store.positionFix.fixType.toUpperCase()})</div>
            <div className="tabular-nums">Lat: {store.positionFix.lat.toFixed(6)}°</div>
            <div className="tabular-nums">Lon: {store.positionFix.lon.toFixed(6)}°</div>
            <div className="tabular-nums">Alt: {store.positionFix.alt.toFixed(1)} m</div>
          </div>
        )}
      </SectionCard>

      <SkyPlot />
      <RawDataPanel />
    </div>
  );
}
