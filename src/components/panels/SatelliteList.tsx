import { useRef } from 'react';
import { useSatelliteStore } from '../../store/satelliteStore';
import { parseRinex } from '../../services/parsers/rinex';
import { SAT_DB } from '../../constants/satDatabase';

export function SatelliteList() {
  const { satellites, selectedIndex, mode, selectSatellite, setSatellites } = useSatelliteStore();
  const fileRef = useRef<HTMLInputElement>(null);

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

      <div className="overflow-y-auto max-h-64">
        {satellites.map((sat, i) => {
          const db = SAT_DB[sat.prn];
          const raan = (sat.eph.Omega0 * 180 / Math.PI).toFixed(0);
          return (
            <div
              key={sat.prn}
              onClick={() => selectSatellite(i)}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors ${
                i === selectedIndex ? 'bg-[#1c2b3a]' : 'hover:bg-[#161b22]'
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
    </div>
  );
}
