import { useEffect, useRef } from 'react';
import { useTimeStore } from '../../store/timeStore';

export function TimeControl() {
  const { timeHours, traceHours, animating, animSpeed, setTimeHours, setTraceHours, setAnimating, setAnimSpeed, tick } = useTimeStore();
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (animating) {
      const loop = () => {
        tick();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [animating, tick]);

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs font-mono">
      <div className="flex items-center justify-between mb-2">
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
          onClick={() => setTimeHours(0)}
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
        type="range" min={0.1} max={10} step={0.1} value={animSpeed}
        onChange={e => setAnimSpeed(parseFloat(e.target.value))}
        className="w-full accent-green-500 mb-2"
      />

      <div className="flex items-center justify-between mb-1">
        <span className="text-[#8b949e]">Ślad orbity</span>
        <span className="text-[#a371f7]">{traceHours.toFixed(1)}h</span>
      </div>
      <input
        type="range" min={0.5} max={24} step={0.5} value={traceHours}
        onChange={e => setTraceHours(parseFloat(e.target.value))}
        className="w-full accent-purple-500"
      />
    </div>
  );
}
