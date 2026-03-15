import { useRef, useEffect } from 'react';
import { useSatelliteStore } from '../../store/satelliteStore';
import { parseRinex } from '../../services/parsers/rinex';
import { SAT_DB } from '../../constants/satDatabase';

const R2D = 180 / Math.PI;

function SatelliteDetails({ idx }: { idx: number }) {
  const { satellites } = useSatelliteStore();
  const sat = satellites[idx];
  if (!sat) return null;

  const db = SAT_DB[sat.prn];
  const e = sat.eph;

  const rows: [string, string][] = [
    ['PRN',    sat.prn],
    ['System', sat.system.toUpperCase()],
    ...(db ? [['Nazwa', db.name] as [string, string]] : []),
    ['a',      `${(e.a / 1000).toFixed(1)} km`],
    ['e',      e.e.toFixed(6)],
    ['i',      `${(e.i0 * R2D).toFixed(2)}°`],
    ['Ω₀',    `${(e.Omega0 * R2D).toFixed(2)}°`],
    ['ω',      `${(e.omega * R2D).toFixed(2)}°`],
    ['M₀',    `${(e.M0 * R2D).toFixed(2)}°`],
    ['T',      `${((2 * Math.PI * Math.sqrt(e.a ** 3 / 3.986005e14)) / 3600).toFixed(2)} h`],
  ];

  return (
    <div className="border-t border-[#30363d] px-3 py-2">
      <div
        className="w-2 h-2 rounded-full mb-2 inline-block mr-1.5"
        style={{ backgroundColor: sat.color }}
      />
      <span className="text-[10px] text-[#e6edf3] font-bold">{sat.prn}</span>
      {db && <span className="text-[9px] text-[#8b949e] ml-1">· {db.name}</span>}
      <table className="w-full mt-1.5">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="text-[9px] text-[#8b949e] pr-2 py-0.5 w-8">{k}</td>
              <td className="text-[9px] text-[#e6edf3] font-mono">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SatelliteList() {
  const { satellites, selectedIndex, mode, selectSatellite, setSatellites } = useSatelliteStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRowRef = useRef<HTMLDivElement>(null);

  // Auto-scroll gdy zmienia się wybrany satelita
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const { satellites: sats } = parseRinex(ev.target!.result as string);
        if (!sats.length) {
          alert('Nie znaleziono satelitów GPS/Galileo w pliku RINEX.');
          return;
        }
        setSatellites(sats);
      } catch (err) {
        alert('Błąd parsowania RINEX: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  }

  if (mode === 'single') {
    return (
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs font-mono">
        <div className="text-[#8b949e] text-[10px] uppercase tracking-wider mb-2">RINEX / Plik nawigacyjny</div>
        <input ref={fileRef} type="file" accept=".n,.rnx,.nav,.22n,.23n,.21n,.20n" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-2 border-2 border-dashed border-[#30363d] rounded text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors text-[10px]"
        >
          Upuść plik RINEX lub kliknij
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-mono">
      <div className="flex items-center justify-between p-3 border-b border-[#30363d]">
        <span className="text-[#8b949e] text-[10px] uppercase tracking-wider">
          Satelity ({satellites.length})
        </span>
        <div className="flex gap-1">
          <input ref={fileRef} type="file" accept=".n,.rnx,.nav,.22n,.23n,.21n,.20n" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-[10px]"
          >
            + RINEX
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-52">
        {satellites.map((sat, i) => {
          const db = SAT_DB[sat.prn];
          const raan = (sat.eph.Omega0 * 180 / Math.PI).toFixed(0);
          const isSelected = i === selectedIndex;
          return (
            <div
              key={sat.prn}
              ref={isSelected ? selectedRowRef : null}
              onClick={() => selectSatellite(i)}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                isSelected ? 'bg-[#1c2b3a]' : 'hover:bg-[#161b22]'
              }`}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sat.color }} />
              <span className="flex-1 truncate text-[10px] text-[#e6edf3]">
                {db ? `${sat.prn} · ${db.name}` : sat.prn}
              </span>
              <span className="text-[9px] text-[#6e7681] flex-shrink-0">Ω={raan}°</span>
            </div>
          );
        })}
      </div>

      {selectedIndex >= 0 && <SatelliteDetails idx={selectedIndex} />}
    </div>
  );
}
