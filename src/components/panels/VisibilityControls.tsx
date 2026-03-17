import { useState } from 'react';
import { useObserverStore } from '../../store/observerStore';
import { useTimeStore } from '../../store/timeStore';
import { useUiStore } from '../../store/uiStore';
import { fetchConstellation } from '../../services/api/celestrak';
import { anim } from '../scene/animState';
import type { GnssSystem } from '../../types/satellite';

const SYSTEMS: GnssSystem[] = ['gps', 'galileo', 'glonass', 'beidou', 'qzss', 'navic'];
const SPEED_STEPS = [1, 10, 60, 300, 600, 1800, 3600];

function fmt(v: number, dec: number) { return v.toFixed(dec); }
function msToDateStr(ms: number) { return new Date(ms).toISOString().slice(0, 10); }
function msToTimeStr(ms: number) { return new Date(ms).toISOString().slice(11, 16); }

function MiniToggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </div>
  );
}

export function VisibilityControls() {
  const {
    enabled, lat, lon, alt, minElevation,
    setEnabled, setLat, setLon, setAlt, setMinElevation,
    setAllSats, setSystemStatus, setFetchError, setIsFetching, reset,
  } = useObserverStore();

  const { animating, animSpeed, traceHours, setAnimating, setAnimSpeed, setTimeHours, setTraceHours } = useTimeStore();
  const { showGroundTrack, setShowGroundTrack } = useUiStore();

  const [latInput, setLatInput] = useState(() => fmt(lat, 4));
  const [lonInput, setLonInput] = useState(() => fmt(lon, 4));
  const [altInput, setAltInput] = useState(() => fmt(alt, 0));
  const [locating, setLocating] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [simDate, setSimDate] = useState(() => msToDateStr(anim.simulationOriginMs));
  const [simTime, setSimTime] = useState(() => msToTimeStr(anim.simulationOriginMs));

  const speedIdx = Math.max(0, SPEED_STEPS.indexOf(animSpeed) === -1
    ? SPEED_STEPS.findIndex(s => s > animSpeed) - 1
    : SPEED_STEPS.indexOf(animSpeed));

  async function handleFetch() {
    const parsedLat = parseFloat(latInput);
    const parsedLon = parseFloat(lonInput);
    const parsedAlt = parseFloat(altInput) || 0;
    if (isNaN(parsedLat) || isNaN(parsedLon)) { setFetchError('Nieprawidłowe współrzędne'); return; }
    setIsFetching(true); reset(); setFetching(true); setFetchError(''); setEnabled(false);
    SYSTEMS.forEach(sys => setSystemStatus(sys, { status: 'loading', count: 0 }));
    const results = await Promise.all(SYSTEMS.map(async (sys) => {
      try {
        const sats = await fetchConstellation(sys);
        setSystemStatus(sys, { status: 'ok', count: sats.length });
        return sats;
      } catch { setSystemStatus(sys, { status: 'error', count: 0 }); return []; }
    }));
    setAllSats(results.flat()); setLat(parsedLat); setLon(parsedLon); setAlt(parsedAlt);
    setFetching(false); setEnabled(true); setIsFetching(false);
  }

  function applyDateTime() {
    const ms = new Date(`${simDate}T${simTime}:00Z`).getTime();
    if (isNaN(ms)) return;
    anim.simulationOriginMs = ms; anim.timeSec = 0; setTimeHours(0);
  }

  const inputCls = "w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-sm text-[#e6edf3] focus:border-[#58a6ff] outline-none font-mono";

  return (
    <div className="space-y-2 font-mono">

      {/* Pozycja obserwatora */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
        <div className="text-xs text-[#6e7681] uppercase tracking-widest mb-2">Pozycja obserwatora</div>
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <div>
            <div className="text-xs text-[#484f58] mb-1">Szer. geogr. °</div>
            <input type="number" step="0.0001" value={latInput} onChange={e => setLatInput(e.target.value)} className={inputCls} />
          </div>
          <div>
            <div className="text-xs text-[#484f58] mb-1">Dług. geogr. °</div>
            <input type="number" step="0.0001" value={lonInput} onChange={e => setLonInput(e.target.value)} className={inputCls} />
          </div>
          <div>
            <div className="text-xs text-[#484f58] mb-1">Wys. n. el. m</div>
            <input type="number" step="1" value={altInput} onChange={e => setAltInput(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  pos => { setLatInput(pos.coords.latitude.toFixed(4)); setLonInput(pos.coords.longitude.toFixed(4)); setAltInput(((pos.coords.altitude ?? 0)).toFixed(0)); setLocating(false); },
                  () => setLocating(false)
                );
              }}
              disabled={locating}
              className="w-full py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-sm transition-colors disabled:opacity-50"
            >
              {locating ? '…' : '📍 Moja pozycja'}
            </button>
          </div>
        </div>
      </div>

      {/* Maska elewacji + ślad orbity */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#6e7681] uppercase tracking-widest">Maska elewacji</span>
          <span className="text-sm text-[#a371f7] font-bold">{minElevation}°</span>
        </div>
        <input
          type="range" min={0} max={30} step={1} value={minElevation}
          onChange={e => setMinElevation(parseInt(e.target.value))}
          className="w-full accent-purple-500 mb-1"
        />
        <div className="flex justify-between text-xs text-[#484f58] mb-3">
          <span>0°</span><span>10°</span><span>20°</span><span>30°</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#c9d1d9]">Ślad naziemny orbit</span>
          <MiniToggle value={showGroundTrack} onChange={() => setShowGroundTrack(!showGroundTrack)} />
        </div>
      </div>

      {/* Suwak długości śladu orbity */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#6e7681] uppercase tracking-widest">Ślad orbity</span>
          <span className="text-sm text-[#58a6ff] font-bold">{traceHours}h</span>
        </div>
        <input
          type="range" min={0.5} max={12} step={0.5} value={traceHours}
          onChange={e => setTraceHours(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-[#484f58] mt-1">
          <span>0.5h</span><span>3h</span><span>6h</span><span>12h</span>
        </div>
      </div>

      {/* Czas symulacji */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
        <div className="text-xs text-[#6e7681] uppercase tracking-widest mb-2">Czas symulacji (UTC)</div>
        <div className="flex gap-1.5 mb-1.5">
          <input type="date" value={simDate} onChange={e => setSimDate(e.target.value)}
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-sm text-[#e6edf3] focus:border-[#58a6ff] outline-none" />
          <input type="time" value={simTime} onChange={e => setSimTime(e.target.value)}
            className="w-24 bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-sm text-[#e6edf3] focus:border-[#58a6ff] outline-none" />
        </div>
        <button onClick={applyDateTime}
          className="w-full py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-sm transition-colors">
          Zastosuj czas
        </button>
      </div>

      {/* Animacja */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setAnimating(!animating)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-bold border transition-all ${
              animating ? 'bg-[#da3633]/20 border-[#da3633] text-[#f85149]' : 'bg-[#238636]/20 border-[#238636] text-[#3fb950]'
            }`}
          >
            {animating ? '⏸ Stop' : '▶ Animuj'}
          </button>
          <span className="text-sm text-[#58a6ff] font-bold w-16 text-right">×{SPEED_STEPS[speedIdx]}</span>
        </div>
        <input
          type="range" min={0} max={SPEED_STEPS.length - 1} step={1} value={speedIdx}
          onChange={e => setAnimSpeed(SPEED_STEPS[parseInt(e.target.value)])}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-[#484f58] mt-1">
          <span>×1</span><span>×60</span><span>×600</span><span>×3600</span>
        </div>
      </div>

      {/* Przycisk fetch */}
      <div className="flex gap-2">
        <button
          onClick={handleFetch}
          disabled={fetching}
          className="flex-1 py-2 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 bg-[#238636] border-[#238636] text-white hover:bg-[#2ea043]"
        >
          {fetching ? 'Pobieranie…' : enabled ? '↺ Odśwież dane' : '▶ Pobierz i włącz'}
        </button>
        {enabled && (
          <button onClick={() => { setEnabled(false); reset(); }}
            className="px-3 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] text-[#8b949e] border border-[#30363d] text-sm transition-colors">
            ✕
          </button>
        )}
      </div>

    </div>
  );
}
