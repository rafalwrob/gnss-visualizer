import { useSatelliteStore } from '../../store/satelliteStore';
import { SAT_DB } from '../../constants/satDatabase';

const R2D = 180 / Math.PI;

export function SatelliteDetailPanel() {
  const { satellites, selectedIndex, mode, selectSatellite } = useSatelliteStore();

  if (mode !== 'constellation' || selectedIndex < 0) return null;
  const sat = satellites[selectedIndex];
  if (!sat) return null;

  const db = SAT_DB[sat.prn];
  const e = sat.eph;
  const periodH = (2 * Math.PI * Math.sqrt(e.a ** 3 / 3.986005e14)) / 3600;

  const orbital: [string, string, string][] = [
    ['a',   'Półoś wielka',      `${(e.a / 1000).toFixed(1)} km`],
    ['e',   'Mimośród',          e.e.toFixed(6)],
    ['i',   'Inklinacja',        `${(e.i0 * R2D).toFixed(3)}°`],
    ['Ω₀', 'RAAN',              `${((e.Omega0 * R2D + 360) % 360).toFixed(2)}°`],
    ['ω',   'Arg. perycentrum',  `${(e.omega * R2D).toFixed(2)}°`],
    ['M₀', 'Anomalia średnia',  `${((e.M0 * R2D + 360) % 360).toFixed(2)}°`],
    ['T',   'Okres orbitalny',   `${periodH.toFixed(3)} h`],
  ];

  const navButtons = (
    <div className="flex gap-1 mb-3">
      <button
        onClick={() => selectedIndex > 0 && selectSatellite(selectedIndex - 1)}
        disabled={selectedIndex === 0}
        className="flex-1 py-1 rounded text-[10px] bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30 border border-[#30363d] transition-colors"
      >
        ← Poprzedni
      </button>
      <button
        onClick={() => selectedIndex < satellites.length - 1 && selectSatellite(selectedIndex + 1)}
        disabled={selectedIndex >= satellites.length - 1}
        className="flex-1 py-1 rounded text-[10px] bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30 border border-[#30363d] transition-colors"
      >
        Następny →
      </button>
    </div>
  );

  return (
    <div className="w-56 flex-shrink-0 flex flex-col gap-2 p-2 overflow-y-auto border-l border-[#21262d] bg-[#0a0e17]">
      {/* Nagłówek */}
      <div className="pb-2 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sat.color }} />
          <div>
            <div className="text-[#e6edf3] font-bold text-sm font-mono">{sat.prn}</div>
            {db && <div className="text-[#8b949e] text-[9px] font-mono">{db.name}</div>}
          </div>
        </div>
        <div className="mt-1.5 flex gap-1">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono"
            style={{ backgroundColor: sat.color + '30', color: sat.color, border: `1px solid ${sat.color}60` }}>
            {sat.system.toUpperCase()}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#21262d] text-[#8b949e] border border-[#30363d]">
            Płaszczyźnia {sat.plane + 1}
          </span>
        </div>
      </div>

      {/* Nawigacja */}
      {navButtons}

      {/* Elementy orbitalne */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 font-mono">
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2">Elementy orbitalne</div>
        <table className="w-full">
          <tbody>
            {orbital.map(([sym, label, val]) => (
              <tr key={sym} className="group">
                <td className="text-[10px] font-bold text-[#58a6ff] pr-2 py-0.5 w-6">{sym}</td>
                <td className="text-[9px] text-[#8b949e] pr-2 py-0.5 hidden group-hover:table-cell">{label}</td>
                <td className="text-[10px] text-[#e6edf3] py-0.5 text-right">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Numery satelity */}
      {db && (
        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 font-mono text-[9px]">
          <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-1.5">Info</div>
          <div className="flex justify-between"><span className="text-[#8b949e]">NORAD</span><span className="text-[#e6edf3]">{db.norad}</span></div>
          <div className="flex justify-between mt-0.5"><span className="text-[#8b949e]">Blok</span><span className="text-[#e6edf3]">{db.block}</span></div>
          <div className="flex justify-between mt-0.5"><span className="text-[#8b949e]">Launch</span><span className="text-[#e6edf3]">{db.launched}</span></div>
          <div className="flex justify-between mt-0.5"><span className="text-[#8b949e]">Sygnały</span><span className="text-[#e6edf3]">{db.freqs.join(', ')}</span></div>
        </div>
      )}
    </div>
  );
}
