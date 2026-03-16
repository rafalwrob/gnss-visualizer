import { useState, useEffect, useRef } from 'react';
import { useObserverStore } from '../../store/observerStore';
import { fetchConstellation, propagateSGP4 } from '../../services/api/celestrak';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { satElevAz, computeDOP } from '../../services/coordinates/ecefEnu';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import { SkyPlot } from './SkyPlot';
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

function dopColor(pdop: number): string {
  if (pdop < 2) return '#3fb950';   // zielony — doskonały
  if (pdop < 4) return '#d29922';   // żółty — dobry
  if (pdop < 6) return '#f0883e';   // pomarańczowy — umiarkowany
  return '#f85149';                  // czerwony — słaby
}

export function VisibilityPanel() {
  const {
    enabled, lat, lon, alt, minElevation, allSats, systemStatus, fetchError,
    enabledSystems, toggleSystem,
    setEnabled, setLat, setLon, setAlt, setMinElevation,
    setAllSats, setSystemStatus, setFetchError, reset,
  } = useObserverStore();

  const [latInput, setLatInput] = useState(fmt(lat, 4));
  const [lonInput, setLonInput] = useState(fmt(lon, 4));
  const [altInput, setAltInput] = useState(fmt(alt, 0));
  const [locating, setLocating] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [visibleList, setVisibleList] = useState<VisibleSat[]>([]);
  const [useSGP4, setUseSGP4] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Przelicz listę widocznych satelitów co 2 s gdy tryb aktywny
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!enabled || allSats.length === 0) { setVisibleList([]); return; }

    function computeList() {
      const timeSec = anim.realtimeClock
        ? (Date.now() - anim.realtimeOriginMs) / 1000
        : anim.timeSec;
      const date = anim.realtimeClock
        ? new Date(anim.realtimeOriginMs + timeSec * 1000)
        : new Date(anim.simulationOriginMs + timeSec * 1000);

      const list: VisibleSat[] = [];
      for (const sat of allSats) {
        if (!enabledSystems[sat.system]) continue;
        let x: number, y: number, z: number;
        if (useSGP4 && sat.satrec) {
          const pos = propagateSGP4(sat.satrec, date);
          if (!pos) continue;
          ({ x, y, z } = pos);
        } else {
          ({ x, y, z } = computeGPSPosition(sat.eph, timeSec, true, false));
        }
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
  }, [enabled, allSats, lat, lon, alt, minElevation, enabledSystems, useSGP4]);

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

  const dop = computeDOP(visibleList.map(s => ({ el: s.el, az: s.az })));
  const hasSGP4 = allSats.some(s => Boolean(s.satrec));

  return (
    <div className="space-y-4 font-mono">

      {/* Pozycja obserwatora */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Pozycja obserwatora</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <div className="text-[#484f58] text-xs mb-1">Szer. geogr. [°]</div>
            <input
              type="number" step="0.0001" value={latInput}
              onChange={e => setLatInput(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-[#e6edf3] focus:border-[#58a6ff] outline-none"
            />
          </div>
          <div>
            <div className="text-[#484f58] text-xs mb-1">Dług. geogr. [°]</div>
            <input
              type="number" step="0.0001" value={lonInput}
              onChange={e => setLonInput(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-[#e6edf3] focus:border-[#58a6ff] outline-none"
            />
          </div>
          <div>
            <div className="text-[#484f58] text-xs mb-1">Wys. n. el. [m]</div>
            <input
              type="number" step="1" value={altInput}
              onChange={e => setAltInput(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-[#e6edf3] focus:border-[#58a6ff] outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleGeolocation}
              disabled={locating}
              className="w-full py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-xs transition-colors disabled:opacity-50"
            >
              {locating ? '…' : '📍 Moja pozycja'}
            </button>
          </div>
        </div>
      </div>

      {/* Maska elewacji */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#6e7681] text-[10px] uppercase tracking-widest">Maska elewacji</span>
          <span className="text-xs text-[#a371f7] font-bold">{minElevation}°</span>
        </div>
        <input
          type="range" min={0} max={30} step={1} value={minElevation}
          onChange={e => setMinElevation(parseInt(e.target.value))}
          className="w-full accent-purple-500"
        />
        <div className="flex justify-between text-xs text-[#484f58] mt-1">
          <span>0°</span><span>10°</span><span>20°</span><span>30°</span>
        </div>
      </div>

      {/* Przycisk fetch */}
      <div className="flex gap-2">
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex-1 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 bg-[#238636] border-[#238636] text-white hover:bg-[#2ea043]"
        >
          {fetching ? 'Pobieranie…' : enabled ? '↺ Odśwież dane' : '▶ Pobierz i włącz'}
        </button>
        {enabled && (
          <button
            onClick={handleDisable}
            className="px-3 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] border border-[#30363d] text-xs transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status pobierania */}
      {Object.keys(systemStatus).length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Status pobierania</div>
          <div className="grid grid-cols-3 gap-1.5">
            {SYSTEMS.map(sys => {
              const info = systemStatus[sys];
              if (!info) return null;
              const color = info.status === 'ok' ? '#3fb950'
                : info.status === 'error' ? '#f85149'
                : '#58a6ff';
              return (
                <div key={sys} className="flex items-center gap-1.5">
                  <span style={{ color }} className="text-xs">
                    {info.status === 'ok' ? '✓' : info.status === 'error' ? '✗' : '…'}
                  </span>
                  <span className="text-xs text-[#8b949e]">{SYS_SHORT[sys]}</span>
                  {info.status === 'ok' && (
                    <span className="text-xs text-[#484f58]">{info.count}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fetchError && (
        <div className="text-xs text-[#f85149] px-1">✗ {fetchError}</div>
      )}

      {/* Filtr konstelacji — tylko gdy dane załadowane */}
      {enabled && allSats.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Konstelacje</div>
          <div className="flex flex-wrap gap-1.5">
            {SYSTEMS.map(sys => {
              const info = GNSS_SYSTEMS[sys];
              const active = enabledSystems[sys];
              const total = allSats.filter(s => s.system === sys).length;
              if (total === 0) return null;
              return (
                <button
                  key={sys}
                  onClick={() => toggleSystem(sys)}
                  className="px-2 py-1 rounded-lg text-xs font-bold border transition-all"
                  style={active
                    ? { backgroundColor: info.color + '33', borderColor: info.color, color: info.color }
                    : { backgroundColor: 'transparent', borderColor: '#30363d', color: '#484f58' }
                  }
                >
                  {SYS_SHORT[sys]} {total}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista widocznych satelitów */}
      {enabled && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#6e7681] text-[10px] uppercase tracking-widest">Widoczne satelity</div>
            <span className="text-xs text-[#3fb950] font-bold">{visibleList.length}</span>
          </div>

          {/* DOP */}
          {dop && (
            <div className="mb-3 p-2 bg-[#0d1117] rounded-lg border border-[#21262d]">
              <div className="text-[9px] text-[#484f58] uppercase tracking-widest mb-1.5">DOP</div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <div className="text-[9px] text-[#484f58]">PDOP</div>
                  <div className="text-[11px] font-bold font-mono" style={{ color: dopColor(dop.pdop) }}>{dop.pdop.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#484f58]">HDOP</div>
                  <div className="text-[11px] font-mono text-[#8b949e]">{dop.hdop.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#484f58]">VDOP</div>
                  <div className="text-[11px] font-mono text-[#8b949e]">{dop.vdop.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#484f58]">GDOP</div>
                  <div className="text-[11px] font-mono text-[#8b949e]">{dop.gdop.toFixed(1)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Przełącznik propagatora SGP4 — tylko gdy TLE dostępne */}
          {hasSGP4 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] text-[#484f58]">Propagator:</span>
              <button
                onClick={() => setUseSGP4(false)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${!useSGP4 ? 'bg-[#1f6feb] border-[#388bfd] text-white' : 'bg-transparent border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}
              >Kepler</button>
              <button
                onClick={() => setUseSGP4(true)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${useSGP4 ? 'bg-[#1f6feb] border-[#388bfd] text-white' : 'bg-transparent border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}
              >SGP4</button>
            </div>
          )}

          {visibleList.length === 0 ? (
            <div className="text-xs text-[#484f58]">Brak widocznych powyżej {minElevation}°</div>
          ) : (
            <div className="space-y-0.5 max-h-64 overflow-y-auto">
              <div className="grid text-[10px] text-[#484f58] mb-2" style={{ gridTemplateColumns: '2.5rem 1fr 3rem 3rem' }}>
                <span>PRN</span>
                <span>System</span>
                <span className="text-right">El.</span>
                <span className="text-right">Az.</span>
              </div>
              {visibleList.map(s => (
                <div
                  key={s.prn}
                  className="grid items-center text-xs py-0.5 border-b border-[#21262d]"
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

          <div className="text-[10px] text-[#484f58] mt-3">
            {lat.toFixed(4)}°N · {lon.toFixed(4)}°E · {alt.toFixed(0)} m n.p.m.
          </div>
        </div>
      )}

      {/* Sky Plot — pokazywany gdy są widoczne satelity */}
      {enabled && visibleList.length > 0 && (
        <SkyPlot
          observations={visibleList.map(s => ({
            prn: s.prn,
            system: s.system,
            azimuth: s.az,
            elevation: s.el,
          }))}
          size={230}
        />
      )}
    </div>
  );
}
