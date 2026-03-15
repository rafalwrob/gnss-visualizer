import { useSatelliteStore } from '../../store/satelliteStore';
import { SAT_DB } from '../../constants/satDatabase';

const R2D = 180 / Math.PI;

export function SatelliteDetailPanel() {
  const { satellites, selectedIndex, mode, selectSatellite } = useSatelliteStore();

  if (mode !== 'constellation' || selectedIndex < 0 || !satellites[selectedIndex]) return null;

  const sat = satellites[selectedIndex];
  const db = SAT_DB[sat.prn];
  const e = sat.eph;
  const periodH = (2 * Math.PI * Math.sqrt(e.a ** 3 / 3.986005e14)) / 3600;

  const orbital: [string, string][] = [
    ['a',   `${(e.a / 1000).toFixed(1)} km`],
    ['e',   e.e.toFixed(6)],
    ['i',   `${(e.i0 * R2D).toFixed(3)}°`],
    ['Ω₀', `${((e.Omega0 * R2D + 360) % 360).toFixed(2)}°`],
    ['ω',   `${(e.omega * R2D).toFixed(2)}°`],
    ['M₀', `${((e.M0 * R2D + 360) % 360).toFixed(2)}°`],
    ['T',   `${periodH.toFixed(2)} h`],
  ];

  return (
    <div className="absolute right-0 top-0 h-full w-52 bg-[#0a0e17]/95 border-l border-[#21262d] flex flex-col overflow-y-auto">

      {/* Nagłówek */}
      <div className="p-3 border-b border-[#21262d] flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sat.color }} />
          <span className="text-[#e6edf3] font-bold text-sm font-mono">{sat.prn}</span>
        </div>
        {db && <div className="text-[#8b949e] text-[9px] font-mono">{db.name}</div>}
        <div className="flex gap-1 mt-1.5">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono"
            style={{ backgroundColor: sat.color + '25', color: sat.color, border: `1px solid ${sat.color}50` }}>
            {sat.system.toUpperCase()}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#21262d] text-[#8b949e] border border-[#30363d]">
            P{sat.plane + 1}
          </span>
        </div>
      </div>

      {/* Nawigacja */}
      <div className="flex gap-1 p-2 border-b border-[#21262d] flex-shrink-0">
        <button
          onClick={() => selectedIndex > 0 && selectSatellite(selectedIndex - 1)}
          disabled={selectedIndex === 0}
          className="flex-1 py-1 rounded text-[10px] bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30 border border-[#30363d]"
        >
          ← Poprz.
        </button>
        <span className="text-[#484f58] text-[10px] self-center px-1">{selectedIndex + 1}/{satellites.length}</span>
        <button
          onClick={() => selectedIndex < satellites.length - 1 && selectSatellite(selectedIndex + 1)}
          disabled={selectedIndex >= satellites.length - 1}
          className="flex-1 py-1 rounded text-[10px] bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30 border border-[#30363d]"
        >
          Nast. →
        </button>
      </div>

      {/* Elementy orbitalne */}
      <div className="p-3 flex-1">
        <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2 font-mono">Elementy orbitalne</div>
        <table className="w-full font-mono">
          <tbody>
            {orbital.map(([sym, val]) => (
              <tr key={sym}>
                <td className="text-[10px] font-bold text-[#58a6ff] pr-3 py-0.5">{sym}</td>
                <td className="text-[10px] text-[#e6edf3] py-0.5">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {db && (
          <div className="mt-3 pt-3 border-t border-[#21262d]">
            <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-1.5">Info</div>
            <div className="space-y-0.5 text-[9px] font-mono">
              <div className="flex justify-between"><span className="text-[#8b949e]">NORAD</span><span className="text-[#e6edf3]">{db.norad}</span></div>
              <div className="flex justify-between"><span className="text-[#8b949e]">Blok</span><span className="text-[#e6edf3]">{db.block}</span></div>
              <div className="flex justify-between"><span className="text-[#8b949e]">Launch</span><span className="text-[#e6edf3]">{db.launched}</span></div>
              <div className="flex justify-between"><span className="text-[#8b949e]">Sygnały</span><span className="text-[#e6edf3]">{db.freqs.join(', ')}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
