import { useSatelliteStore } from '../../store/satelliteStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { GnssSystem } from '../../types/satellite';

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

export function SystemPanel() {
  const { mode, activeSystem, setMode, setActiveSystem, loadExample } = useSatelliteStore();

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

      <button
        onClick={loadExample}
        className="w-full py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-[10px] transition-colors"
      >
        Załaduj przykład
      </button>
    </div>
  );
}
