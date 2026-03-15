import { useEffect, useState } from 'react';
import { useTimeStore } from '../../store/timeStore';
import { useUiStore } from '../../store/uiStore';
import { useSatelliteStore } from '../../store/satelliteStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import { anim } from '../scene/animState';

function UtcClock() {
  const [utc, setUtc] = useState(() => new Date().toUTCString().slice(17, 25));
  useEffect(() => {
    const id = setInterval(() => setUtc(new Date().toUTCString().slice(17, 25)), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-[#3fb950] text-xs">{utc} UTC</span>;
}

function ElapsedTime() {
  const [elapsed, setElapsed] = useState('0s');
  useEffect(() => {
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - anim.realtimeOriginMs) / 1000);
      if (sec < 60) setElapsed(`${sec}s`);
      else if (sec < 3600) setElapsed(`${Math.floor(sec / 60)}m ${sec % 60}s`);
      else setElapsed(`${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-[#484f58] text-[9px] font-mono">od {elapsed}</span>;
}

export function TimeControl() {
  const { timeHours, traceHours, animating, animSpeed, setTimeHours, setTraceHours, setAnimating, setAnimSpeed } = useTimeStore();
  const { onlineMode } = useUiStore();
  const { activeSystem } = useSatelliteStore();
  const sysName = GNSS_SYSTEMS[activeSystem]?.name ?? activeSystem.toUpperCase();

  return (
    <div className={`bg-[#0d1117] border rounded-lg p-3 text-xs font-mono transition-all ${
      onlineMode ? 'border-[#238636]' : 'border-[#30363d]'
    }`}>

      {onlineMode ? (
        /* ===== LIVE MODE ===== */
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[#3fb950] font-bold text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse inline-block" />
              LIVE · {sysName}
            </span>
            <UtcClock />
          </div>
          <div className="mb-3">
            <ElapsedTime />
          </div>
        </>
      ) : (
        /* ===== SIMULATION MODE ===== */
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#8b949e]">Czas symulacji</span>
            <span className="text-[#58a6ff] font-bold">{timeHours.toFixed(2)}h</span>
          </div>
          <input
            type="range" min={0} max={48} step={0.01} value={timeHours}
            onChange={e => setTimeHours(parseFloat(e.target.value))}
            className="w-full accent-blue-500 mb-2"
          />
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setAnimating(!animating)}
              className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
                animating ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-[#238636] hover:bg-[#2ea043] text-white'
              }`}
            >
              {animating ? '⏸ STOP' : '▶ ANIMUJ'}
            </button>
            <button
              onClick={() => { setAnimating(false); setTimeHours(0); }}
              className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e]"
            >
              ↺
            </button>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#8b949e]">Prędkość</span>
            <span className="text-[#7ee787]">
              {animSpeed < 10 ? `${animSpeed.toFixed(1)}×`
                : animSpeed < 1000 ? `${Math.round(animSpeed)}×`
                : `${(animSpeed / 1000).toFixed(1)}k×`}
            </span>
          </div>
          <input
            type="range" min={0} max={4} step={0.02}
            value={Math.log10(Math.max(1, animSpeed))}
            onChange={e => setAnimSpeed(Math.round(Math.pow(10, parseFloat(e.target.value))))}
            className="w-full accent-green-500 mb-1"
          />
          <div className="flex justify-between text-[9px] text-[#484f58] mb-2">
            <span>1×</span><span>10×</span><span>100×</span><span>1k×</span><span>10k×</span>
          </div>
        </>
      )}

      {/* Ślad orbity — zawsze widoczny */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[#8b949e]">Ślad orbity</span>
        <span className="text-[#a371f7]">
          {traceHours >= 12 ? `${traceHours.toFixed(0)}h` : `${traceHours.toFixed(1)}h`}
        </span>
      </div>
      <input
        type="range" min={0.5} max={48} step={0.5} value={traceHours}
        onChange={e => setTraceHours(parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
      <div className="flex justify-between text-[9px] text-[#484f58] mt-0.5">
        <span>0.5h</span><span>12h</span><span>24h</span><span>48h</span>
      </div>
    </div>
  );
}
