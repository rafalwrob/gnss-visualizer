import { useEffect, useState } from 'react';
import { useTimeStore } from '../../store/timeStore';
import { useUiStore } from '../../store/uiStore';

function UtcClock() {
  const [utc, setUtc] = useState(() => new Date().toUTCString().slice(17, 25));
  useEffect(() => {
    const id = setInterval(() => setUtc(new Date().toUTCString().slice(17, 25)), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-[#3fb950]">{utc} UTC</span>;
}

export function TimeControl() {
  const { timeHours, traceHours, animating, animSpeed, setTimeHours, setTraceHours, setAnimating, setAnimSpeed } = useTimeStore();
  const { onlineMode } = useUiStore();

  return (
    <div className={`bg-[#0d1117] border rounded-lg p-3 text-xs font-mono relative transition-all ${
      onlineMode ? 'border-[#238636]' : 'border-[#30363d]'
    }`}>

      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-1">
        {onlineMode ? (
          <>
            <span className="flex items-center gap-1.5 text-[#3fb950] font-bold text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse inline-block" />
              LIVE
            </span>
            <UtcClock />
          </>
        ) : (
          <>
            <span className="text-[#8b949e]">Czas symulacji</span>
            <span className="text-[#58a6ff] font-bold">{timeHours.toFixed(2)}h</span>
          </>
        )}
      </div>

      {/* Kontrolki symulacji — wyszarzone w trybie online */}
      <div className={onlineMode ? 'opacity-30 pointer-events-none select-none' : ''}>
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
          <span className="text-[#7ee787]">{animSpeed.toFixed(1)}×</span>
        </div>
        <input
          type="range" min={0.1} max={20} step={0.1} value={animSpeed}
          onChange={e => setAnimSpeed(parseFloat(e.target.value))}
          className="w-full accent-green-500 mb-2"
        />
      </div>

      {/* Ślad orbity — dostępny zawsze */}
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
        <span>0.5h</span>
        <span>12h</span>
        <span>24h</span>
        <span>48h</span>
      </div>

      {onlineMode && (
        <div className="mt-2 text-[9px] text-[#8b949e] border-t border-[#30363d] pt-2">
          Symulacja wyłączona — dane na żywo
        </div>
      )}
    </div>
  );
}
