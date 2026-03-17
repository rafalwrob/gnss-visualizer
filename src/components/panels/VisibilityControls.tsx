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

function msToDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function msToTimeStr(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}

export function VisibilityControls() {
  const {
    enabled, lat, lon, alt, minElevation,
    setEnabled, setLat, setLon, setAlt, setMinElevation,
    setAllSats, setSystemStatus, setFetchError, reset,
  } = useObserverStore();

  const { animating, animSpeed, setAnimating, setAnimSpeed, setTimeHours } = useTimeStore();
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

  function applyDateTime() {
    const ms = new Date(`${simDate}T${simTime}:00Z`).getTime();
    if (isNaN(ms)) return;
    anim.simulationOriginMs = ms;
    anim.timeSec = 0;
    setTimeHours(0);
  }

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

      {/* Ślad orbity */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Wizualizacja orbit</div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-[#c9d1d9] text-xs font-mono">Ślad naziemny</span>
          <div
            onClick={() => setShowGroundTrack(!showGroundTrack)}
            className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${showGroundTrack ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${showGroundTrack ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </label>
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

      {/* Czas symulacji */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Czas symulacji (UTC)</div>
        <div className="flex gap-2 mb-2">
          <input
            type="date" value={simDate}
            onChange={e => setSimDate(e.target.value)}
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-xs text-[#e6edf3] focus:border-[#58a6ff] outline-none"
          />
          <input
            type="time" value={simTime}
            onChange={e => setSimTime(e.target.value)}
            className="w-24 bg-[#0d1117] border border-[#30363d] rounded-lg px-2 py-1.5 text-xs text-[#e6edf3] focus:border-[#58a6ff] outline-none"
          />
        </div>
        <button
          onClick={applyDateTime}
          className="w-full py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-xs transition-colors"
        >
          Zastosuj czas
        </button>
      </div>

      {/* Animacja */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Animacja</div>
        <button
          onClick={() => setAnimating(!animating)}
          className={`w-full py-1.5 rounded-lg text-xs font-bold border transition-all mb-3 ${
            animating
              ? 'bg-[#da3633]/20 border-[#da3633] text-[#f85149]'
              : 'bg-[#238636]/20 border-[#238636] text-[#3fb950]'
          }`}
        >
          {animating ? '⏸ Stop' : '▶ Animuj'}
        </button>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#484f58] text-xs">Prędkość</span>
          <span className="text-xs text-[#58a6ff] font-bold font-mono">×{SPEED_STEPS[speedIdx]}</span>
        </div>
        <input
          type="range" min={0} max={SPEED_STEPS.length - 1} step={1}
          value={speedIdx}
          onChange={e => setAnimSpeed(SPEED_STEPS[parseInt(e.target.value)])}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-[9px] text-[#484f58] mt-1">
          <span>×1</span><span>×60</span><span>×600</span><span>×3600</span>
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

    </div>
  );
}
