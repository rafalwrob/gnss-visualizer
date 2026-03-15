import { useState, useEffect, useRef } from 'react';
import { useObserverStore } from '../../store/observerStore';
import { fetchConstellation } from '../../services/api/celestrak';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { satElevAz } from '../../services/coordinates/ecefEnu';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import { anim } from '../scene/animState';
import type { GnssSystem } from '../../types/satellite';

const SYSTEMS: GnssSystem[] = ['gps', 'galileo', 'glonass', 'beidou', 'qzss', 'navic'];

const SYS_SHORT: Record<GnssSystem, string> = {
  gps: 'GPS', galileo: 'GAL', glonass: 'GLO', beidou: 'BDS',
  qzss: 'QZS', navic: 'NAV', sbas: 'SBAS',
};

interface VisibleSat {
  prn: string;
  system: GnssSystem;
  color: string;
  el: number;
  az: number;
}

function fmt(v: number, dec: number) {
  return v.toFixed(dec);
}

export function VisibilityPanel() {
  const {
    enabled, lat, lon, alt, minElevation, allSats, systemStatus, fetchError,
    setEnabled, setLat, setLon, setAlt, setMinElevation,
    setAllSats, setSystemStatus, setFetchError, reset,
  } = useObserverStore();

  const [latInput, setLatInput] = useState(fmt(lat, 4));
  const [lonInput, setLonInput] = useState(fmt(lon, 4));
  const [altInput, setAltInput] = useState(fmt(alt, 0));
  const [locating, setLocating] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [visibleList, setVisibleList] = useState<VisibleSat[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Przelicz listę widocznych satelitów co 2 s gdy tryb aktywny
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!enabled || allSats.length === 0) { setVisibleList([]); return; }

    function computeList() {
      const timeSec = anim.realtimeClock
        ? (Date.now() - anim.realtimeOriginMs) / 1000
        : anim.timeSec;
      const list: VisibleSat[] = [];
      for (const sat of allSats) {
        const { x, y, z } = computeGPSPosition(sat.eph, timeSec, true, false);
        const { el, az } = satElevAz(x, y, z, lat, lon, alt);
        if (el >= minElevation) {
          list.push({ prn: sat.prn, system: sat.system, color: sat.color, el, az });
        }
      }
      list.sort((a, b) => b.el - a.el);
      setVisibleList(list);
    }

    computeList();
    intervalRef.current = setInterval(computeList, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [enabled, allSats, lat, lon, alt, minElevation]);

  async function handleFetch() {
    const parsedLat = parseFloat(latInput);
    const parsedLon = parseFloat(lonInput);
    const parsedAlt = parseFloat(altInput) || 0;

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setFetchError('Nieprawidłowe współrzędne');
      return;
    }

    reset();
    setFetching(true);
    setFetchError('');
    setEnabled(false);

    SYSTEMS.forEach(sys => setSystemStatus(sys, { status: 'loading', count: 0 }));

    const promises = SYSTEMS.map(async (sys) => {
      try {
        const sats = await fetchConstellation(sys);
        setSystemStatus(sys, { status: 'ok', count: sats.length });
        return sats;
      } catch {
        setSystemStatus(sys, { status: 'error', count: 0 });
        return [];
      }
    });

    const results = await Promise.all(promises);
    const all = results.flat();

    setAllSats(all);
    setLat(parsedLat);
    setLon(parsedLon);
    setAlt(parsedAlt);
    setFetching(false);
    setEnabled(true);
  }

  function handleDisable() {
    setEnabled(false);
    reset();
    setVisibleList([]);
  }

  function handleGeolocation() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatInput(pos.coords.latitude.toFixed(4));
        setLonInput(pos.coords.longitude.toFixed(4));
        setAltInput(((pos.coords.altitude ?? 0)).toFixed(0));
        setLocating(false);
      },
      () => setLocating(false),
    );
  }

  // Liczby per-system
  const countBySys: Partial<Record<GnssSystem, number>> = {};
  for (const s of visibleList) {
    countBySys[s.system] = (countBySys[s.system] ?? 0) + 1;
  }

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs font-mono space-y-3">

      {/* Pozycja obserwatora */}
      <div>
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2">Pozycja obserwatora</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <div>
            <div className="text-[#484f58] text-[9px] mb-0.5">Szer. geogr. [°]</div>
            <input
              type="number" step="0.0001" value={latInput}
              onChange={e => setLatInput(e.target.value)}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5 text-[#e6edf3] text-[10px] focus:border-[#58a6ff] outline-none"
            />
          </div>
          <div>
            <div className="text-[#484f58] text-[9px] mb-0.5">Dług. geogr. [°]</div>
            <input
              type="number" step="0.0001" value={lonInput}
              onChange={e => setLonInput(e.target.value)}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5 text-[#e6edf3] text-[10px] focus:border-[#58a6ff] outline-none"
            />
          </div>
          <div>
            <div className="text-[#484f58] text-[9px] mb-0.5">Wys. n. el. [m]</div>
            <input
              type="number" step="1" value={altInput}
              onChange={e => setAltInput(e.target.value)}
              className="w-full bg-[#161b22] border border-[#30363d] rounded px-1.5 py-0.5 text-[#e6edf3] text-[10px] focus:border-[#58a6ff] outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGeolocation}
              disabled={locating}
              className="w-full py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-[9px] transition-colors disabled:opacity-50"
            >
              {locating ? '…' : '📍 Moja pozycja'}
            </button>
          </div>
        </div>
      </div>

      {/* Maska elewacji */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#8b949e] text-[9px]">Maska elewacji</span>
          <span className="text-[#a371f7] text-[10px]">{minElevation}°</span>
        </div>
        <input
          type="range" min={0} max={30} step={1} value={minElevation}
          onChange={e => setMinElevation(parseInt(e.target.value))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-[9px] text-[#484f58]">
          <span>0°</span><span>10°</span><span>20°</span><span>30°</span>
        </div>
      </div>

      {/* Przycisk fetch */}
      <div className="flex gap-1">
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex-1 py-1.5 rounded text-[10px] font-bold border transition-all disabled:opacity-50 bg-[#238636] border-[#238636] text-white hover:bg-[#2ea043]"
        >
          {fetching ? 'Pobieranie…' : enabled ? '↺ Odśwież dane' : '▶ Pobierz i włącz'}
        </button>
        {enabled && (
          <button
            onClick={handleDisable}
            className="px-2 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] border border-[#30363d] text-[9px] transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status pobierania */}
      {Object.keys(systemStatus).length > 0 && (
        <div className="border border-[#21262d] rounded p-2">
          <div className="text-[#484f58] text-[9px] mb-1.5">Status pobierania</div>
          <div className="grid grid-cols-3 gap-1">
            {SYSTEMS.map(sys => {
              const info = systemStatus[sys];
              if (!info) return null;
              const color = info.status === 'ok' ? '#3fb950'
                : info.status === 'error' ? '#f85149'
                : '#58a6ff';
              return (
                <div key={sys} className="flex items-center gap-1">
                  <span style={{ color }} className="text-[9px]">
                    {info.status === 'ok' ? '✓' : info.status === 'error' ? '✗' : '…'}
                  </span>
                  <span className="text-[#8b949e] text-[9px]">
                    {SYS_SHORT[sys]}
                  </span>
                  {info.status === 'ok' && (
                    <span className="text-[#484f58] text-[9px]">{info.count}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fetchError && (
        <div className="text-[#f85149] text-[9px]">✗ {fetchError}</div>
      )}

      {/* Lista widocznych satelitów */}
      {enabled && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#3fb950] text-[9px] font-bold">
              ▲ Widoczne: {visibleList.length}
            </span>
            <span className="text-[#484f58] text-[9px]">
              {Object.entries(countBySys)
                .map(([sys, cnt]) => `${SYS_SHORT[sys as GnssSystem]}:${cnt}`)
                .join('  ')}
            </span>
          </div>

          {visibleList.length === 0 ? (
            <div className="text-[#484f58] text-[9px]">Brak widocznych satelitów powyżej {minElevation}°</div>
          ) : (
            <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5">
              {/* Nagłówek */}
              <div className="grid text-[9px] text-[#484f58] mb-1" style={{ gridTemplateColumns: '2.5rem 1fr 3rem 3rem' }}>
                <span>PRN</span>
                <span>System</span>
                <span className="text-right">El.</span>
                <span className="text-right">Az.</span>
              </div>
              {visibleList.map(s => (
                <div
                  key={s.prn}
                  className="grid items-center text-[9px] py-0.5 border-b border-[#161b22]"
                  style={{ gridTemplateColumns: '2.5rem 1fr 3rem 3rem' }}
                >
                  <span className="font-bold" style={{ color: s.color }}>{s.prn}</span>
                  <span className="text-[#484f58]">{GNSS_SYSTEMS[s.system]?.name}</span>
                  <span className="text-right text-[#e6edf3]">{s.el.toFixed(1)}°</span>
                  <span className="text-right text-[#8b949e]">{s.az.toFixed(0)}°</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[#484f58] text-[9px] mt-1.5">
            Pozycja: {lat.toFixed(4)}°N  {lon.toFixed(4)}°E  {alt.toFixed(0)} m
          </div>
        </div>
      )}
    </div>
  );
}
