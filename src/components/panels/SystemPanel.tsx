import { useEffect, useState } from 'react';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useUiStore } from '../../store/uiStore';
import { useTimeStore } from '../../store/timeStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { GnssSystem } from '../../types/satellite';
import { fetchConstellation, getCacheAge, clearCache, isOnlineSupported } from '../../services/api/celestrak';
import { anim } from '../scene/animState';

const SYSTEMS: GnssSystem[] = ['gps', 'galileo', 'glonass', 'beidou', 'qzss', 'navic'];

const SAT_COUNT: Record<GnssSystem, string> = {
  gps:     '24 MEO',
  galileo: '24 MEO',
  glonass: '24 MEO',
  beidou:  '24+3+3',
  qzss:    '3+1',
  navic:   '3+4',
  sbas:    '9 GEO',
};

type FetchState = 'idle' | 'loading' | 'ok' | 'error';

function formatAge(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'przed chwilą';
  if (min < 60) return `${min} min temu`;
  return `${Math.floor(min / 60)} h temu`;
}

export function SystemPanel() {
  const { mode, activeSystem, setMode, setActiveSystem, loadExample, setSatellites } = useSatelliteStore();
  const { onlineMode, setOnlineMode } = useUiStore();
  const { setAnimating } = useTimeStore();
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchError, setFetchError] = useState('');
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  function doFetch(system: GnssSystem) {
    setFetchState('loading');
    setFetchError('');
    fetchConstellation(system)
      .then(sats => {
        anim.realtimeOriginMs = Date.now();
        anim.realtimeClock = true;
        setSatellites(sats);
        setMode('constellation');
        setFetchState('ok');
        setCacheAge(getCacheAge(system));
      })
      .catch(e => {
        setFetchState('error');
        setFetchError(e.message ?? 'Błąd połączenia');
      });
  }

  // Gdy tryb online — pobierz dane dla aktywnego systemu
  useEffect(() => {
    if (!onlineMode) return;
    doFetch(activeSystem);
  }, [onlineMode, activeSystem]);

  function handleOnlineToggle() {
    if (onlineMode) {
      anim.realtimeClock = false;
      setOnlineMode(false);
      setAnimating(false);
      setFetchState('idle');
    } else {
      setOnlineMode(true);
    }
  }

  function handleRefresh() {
    clearCache(activeSystem);
    doFetch(activeSystem);
  }

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs font-mono">
      <div className="text-[#8b949e] mb-2 text-[10px] uppercase tracking-wider">System GNSS</div>

      <div className="grid grid-cols-3 gap-1 mb-3">
        {SYSTEMS.map(sys => {
          const info = GNSS_SYSTEMS[sys];
          const active = activeSystem === sys;
          return (
            <button
              key={sys}
              onClick={() => setActiveSystem(sys)}
              className={`py-1.5 rounded text-[10px] font-bold transition-all border flex flex-col items-center gap-0.5 ${
                active
                  ? 'text-white border-transparent'
                  : 'bg-transparent text-[#8b949e] border-[#30363d] hover:border-[#58a6ff] hover:text-[#e6edf3]'
              }`}
              style={active ? { backgroundColor: info.color, borderColor: info.color } : {}}
            >
              <span>{info.name}</span>
              <span className={`text-[8px] font-normal ${active ? 'text-white/70' : 'text-[#484f58]'}`}>
                {SAT_COUNT[sys]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setMode('single')}
          className={`flex-1 py-1 rounded text-[10px] border transition-all ${
            mode === 'single'
              ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
              : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
          }`}
        >
          Pojedynczy
        </button>
        <button
          onClick={() => setMode('constellation')}
          className={`flex-1 py-1 rounded text-[10px] border transition-all ${
            mode === 'constellation'
              ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
              : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
          }`}
        >
          Konstelacja
        </button>
      </div>

      {/* Online / Offline */}
      <div className="border border-[#30363d] rounded p-2 mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[#8b949e] text-[10px]">Dane na żywo</span>
          <button
            onClick={handleOnlineToggle}
            className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
              onlineMode
                ? 'bg-[#238636] border-[#238636] text-white'
                : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#3fb950]'
            }`}
          >
            {onlineMode ? '● ONLINE' : '○ OFFLINE'}
          </button>
        </div>

        {onlineMode && !isOnlineSupported(activeSystem) && (
          <div className="text-[#8b949e] text-[9px]">
            System {GNSS_SYSTEMS[activeSystem].name} niedostępny online
          </div>
        )}

        {onlineMode && isOnlineSupported(activeSystem) && fetchState === 'loading' && (
          <div className="text-[#58a6ff] text-[9px] animate-pulse">
            Pobieranie {GNSS_SYSTEMS[activeSystem].name} z CelesTrak…
          </div>
        )}

        {onlineMode && isOnlineSupported(activeSystem) && fetchState === 'ok' && (
          <div className="flex items-center justify-between">
            <span className="text-[#3fb950] text-[9px]">
              ✓ {cacheAge !== null ? formatAge(cacheAge) : 'załadowano'}
            </span>
            <button
              onClick={handleRefresh}
              className="text-[#58a6ff] text-[9px] hover:text-[#79c0ff]"
            >
              Odśwież
            </button>
          </div>
        )}

        {fetchState === 'error' && (
          <div className="text-[#f85149] text-[9px] leading-tight">
            ✗ {fetchError}
          </div>
        )}
      </div>

      {!onlineMode && (
        <button
          onClick={loadExample}
          className="w-full py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-[10px] transition-colors"
        >
          Załaduj przykład
        </button>
      )}
    </div>
  );
}
