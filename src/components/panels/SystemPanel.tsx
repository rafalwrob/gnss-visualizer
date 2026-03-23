import { useEffect, useState } from 'react';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useUiStore } from '../../store/uiStore';
import { useTimeStore } from '../../store/timeStore';
import { useObserverStore } from '../../store/observerStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { GnssSystem } from '../../types/satellite';
import { fetchConstellation, getCacheAge, clearCache, isOnlineSupported } from '../../services/api/celestrak';
import { anim } from '../scene/animState';

const SYSTEMS: GnssSystem[] = ['gps', 'galileo', 'glonass', 'beidou', 'qzss', 'navic'];

const SAT_COUNT: Record<GnssSystem, string> = {
  gps: '24 MEO',
  galileo: '24 MEO',
  glonass: '24 MEO',
  beidou: '24+3+3',
  qzss: '3+1',
  navic: '3+4',
  sbas: '9 GEO',
};

type FetchState = 'idle' | 'loading' | 'ok' | 'error';

function formatAge(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'przed chwila';
  if (min < 60) return `${min} min temu`;
  return `${Math.floor(min / 60)} h temu`;
}

export function SystemPanel() {
  const { mode, activeSystem, setMode, setActiveSystem, loadExample, setSatellites } = useSatelliteStore();
  const { onlineMode, setOnlineMode, activeTab } = useUiStore();
  const { setAnimating } = useTimeStore();
  const { enabled: obsEnabled, setEnabled: setObsEnabled } = useObserverStore();
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [fetchError, setFetchError] = useState('');
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  const receiverLocked = activeTab === 'receiver';

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
        setFetchError(e.message ?? 'Blad polaczenia');
      });
  }

  useEffect(() => {
    if (!onlineMode || receiverLocked) return;
    doFetch(activeSystem);
  }, [onlineMode, activeSystem, receiverLocked]);

  function handleOfflineClick() {
    if (receiverLocked) return;
    if (obsEnabled) setObsEnabled(false);
    if (onlineMode) {
      anim.realtimeClock = false;
      setOnlineMode(false);
      setAnimating(false);
      setFetchState('idle');
    }
  }

  function handleOnlineClick() {
    if (receiverLocked) return;
    if (obsEnabled) setObsEnabled(false);
    if (!onlineMode) setOnlineMode(true);
  }

  function handleVisibilityClick() {
    if (receiverLocked) return;
    if (obsEnabled) {
      setObsEnabled(false);
    } else {
      if (onlineMode) {
        anim.realtimeClock = false;
        setOnlineMode(false);
        setAnimating(false);
        setFetchState('idle');
      }
      setObsEnabled(true);
    }
  }

  function handleRefresh() {
    if (receiverLocked) return;
    clearCache(activeSystem);
    doFetch(activeSystem);
  }

  const dataMode = obsEnabled ? 'visibility' : onlineMode ? 'online' : 'offline';

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 font-mono">
      <div className="text-[#8b949e] text-[11px] uppercase tracking-wider mb-2">System GNSS</div>
      {receiverLocked && (
        <div className="mb-3 text-[11px] text-[#f7c948] bg-[#f7c948]/10 border border-[#f7c948]/30 rounded-lg px-2.5 py-2">
          Tryb odbiornika jest aktywny. Zamknij panel odbiornika, aby odblokowac te ustawienia.
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {SYSTEMS.map(sys => {
          const info = GNSS_SYSTEMS[sys];
          const active = activeSystem === sys;
          return (
            <button
              key={sys}
              onClick={() => !receiverLocked && setActiveSystem(sys)}
              disabled={receiverLocked}
              className={`py-2 rounded text-xs font-bold transition-all border flex flex-col items-center gap-0.5 ${
                active
                  ? 'text-white border-transparent'
                  : 'bg-transparent text-[#8b949e] border-[#30363d] hover:border-[#58a6ff] hover:text-[#e6edf3] disabled:opacity-40 disabled:hover:border-[#30363d] disabled:hover:text-[#8b949e]'
              }`}
              style={active ? { backgroundColor: info.color, borderColor: info.color } : {}}
            >
              <span>{info.name}</span>
              <span className={`text-[10px] font-normal ${active ? 'text-white/75' : 'text-[#484f58]'}`}>
                {SAT_COUNT[sys]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5 mb-2">
        {(['single', 'constellation'] as const).map(m => (
          <button
            key={m}
            onClick={() => !receiverLocked && setMode(m)}
            disabled={receiverLocked}
            className={`flex-1 py-1.5 rounded text-[11px] border transition-all ${
              mode === m
                ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] disabled:opacity-40 disabled:hover:border-[#30363d]'
            }`}
          >
            {m === 'single' ? 'Pojedynczy' : 'Konstelacja'}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 mb-2">
        <button
          onClick={handleOfflineClick}
          disabled={receiverLocked}
          className={`flex-1 py-1.5 rounded text-[11px] border transition-all ${
            dataMode === 'offline'
              ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
              : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#58a6ff] disabled:opacity-40 disabled:hover:border-[#30363d]'
          }`}
        >
          Offline
        </button>
        <button
          onClick={handleOnlineClick}
          disabled={receiverLocked}
          className={`flex-1 py-1.5 rounded text-[11px] border transition-all ${
            dataMode === 'online'
              ? 'bg-[#238636] border-[#238636] text-white'
              : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#3fb950] disabled:opacity-40 disabled:hover:border-[#30363d]'
          }`}
        >
          Online
        </button>
        <button
          onClick={handleVisibilityClick}
          disabled={receiverLocked}
          className={`flex-1 py-1.5 rounded text-[11px] border transition-all ${
            dataMode === 'visibility'
              ? 'bg-[#6e40c9] border-[#6e40c9] text-white'
              : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#a371f7] disabled:opacity-40 disabled:hover:border-[#30363d]'
          }`}
        >
          Widocznosc
        </button>
      </div>

      {onlineMode && !receiverLocked && (
        <div className="mt-1">
          {!isOnlineSupported(activeSystem) && (
            <div className="text-[#8b949e] text-[11px]">
              {GNSS_SYSTEMS[activeSystem].name} niedostepny online
            </div>
          )}
          {isOnlineSupported(activeSystem) && fetchState === 'loading' && (
            <div className="text-[#58a6ff] text-[11px] animate-pulse">
              Pobieranie {GNSS_SYSTEMS[activeSystem].name}...
            </div>
          )}
          {isOnlineSupported(activeSystem) && fetchState === 'ok' && (
            <div className="flex items-center justify-between">
              <span className="text-[#3fb950] text-[11px]">
                ok {cacheAge !== null ? formatAge(cacheAge) : 'zaladowano'}
              </span>
              <button onClick={handleRefresh} className="text-[#58a6ff] text-[11px] hover:text-[#79c0ff]">
                Odswiez
              </button>
            </div>
          )}
          {fetchState === 'error' && (
            <div className="text-[#f85149] text-[11px] leading-tight">x {fetchError}</div>
          )}
        </div>
      )}

      {dataMode === 'offline' && (
        <button
          onClick={() => !receiverLocked && loadExample()}
          disabled={receiverLocked}
          className="w-full mt-2 py-2 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-[11px] transition-colors disabled:opacity-40"
        >
          Zaladuj przyklad
        </button>
      )}
    </div>
  );
}
