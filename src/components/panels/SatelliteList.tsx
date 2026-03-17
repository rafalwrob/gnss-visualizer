import { useRef, useEffect, useState } from 'react';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useObserverStore } from '../../store/observerStore';
import { parseRinex } from '../../services/parsers/rinex';
import { SAT_DB } from '../../constants/satDatabase';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { satElevAz, latLonAltToEcef } from '../../services/coordinates/ecefEnu';
import { anim } from '../scene/animState';
import { R_E } from '../../constants/gnss';

const R2D = 180 / Math.PI;

interface LiveData { el: number; az: number; altKm: number; rangeKm: number; }

function SatelliteDetails({ idx }: { idx: number }) {
  const { satellites, selectedIndex, selectSatellite } = useSatelliteStore();
  const { enabled: obsEnabled, lat: obsLat, lon: obsLon, alt: obsAlt } = useObserverStore();
  const [liveDat, setLiveDat] = useState<LiveData | null>(null);

  const sat = satellites[idx];
  if (!sat) return null;

  const db = SAT_DB[sat.prn];
  const e = sat.eph;
  const periodH = (2 * Math.PI * Math.sqrt(e.a ** 3 / 3.986005e14)) / 3600;

  // Live update co 500ms
  useEffect(() => {
    if (!obsEnabled) { setLiveDat(null); return; }
    function compute() {
      const timeSec = anim.realtimeClock
        ? (Date.now() - anim.realtimeOriginMs) / 1000
        : anim.timeSec;
      const { x, y, z } = computeGPSPosition(sat.eph, timeSec, true, false);
      const { el, az } = satElevAz(x, y, z, obsLat, obsLon, obsAlt);
      const r = Math.sqrt(x * x + y * y + z * z);
      const altKm = (r - R_E) / 1000;
      const obs = latLonAltToEcef(obsLat, obsLon, obsAlt);
      const dx = x - obs.x, dy = y - obs.y, dz = z - obs.z;
      const rangeKm = Math.sqrt(dx * dx + dy * dy + dz * dz) / 1000;
      setLiveDat({ el, az, altKm, rangeKm });
    }
    compute();
    const id = setInterval(compute, 500);
    return () => clearInterval(id);
  }, [sat, obsEnabled, obsLat, obsLon, obsAlt]);

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
    <div className="border-t border-[#30363d] px-3 py-3 space-y-3">

      {/* Nagłówek satelity */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sat.color }} />
        <span className="text-sm text-[#e6edf3] font-bold font-mono">{sat.prn}</span>
        {db && <span className="text-xs text-[#8b949e] font-mono">{db.name}</span>}
        <div className="ml-auto flex gap-1">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold font-mono"
            style={{ backgroundColor: sat.color + '25', color: sat.color, border: `1px solid ${sat.color}50` }}>
            {sat.system.toUpperCase()}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#21262d] text-[#8b949e] border border-[#30363d]">
            P{sat.plane + 1}
          </span>
        </div>
      </div>

      {/* Nawigacja ← → */}
      <div className="flex gap-1">
        <button
          onClick={() => selectedIndex > 0 && selectSatellite(selectedIndex - 1)}
          disabled={selectedIndex === 0}
          className="flex-1 py-1 rounded text-xs bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30 border border-[#30363d] font-mono"
        >
          ← Poprz.
        </button>
        <span className="text-[#484f58] text-xs self-center px-2 font-mono">
          {selectedIndex + 1}/{satellites.length}
        </span>
        <button
          onClick={() => selectedIndex < satellites.length - 1 && selectSatellite(selectedIndex + 1)}
          disabled={selectedIndex >= satellites.length - 1}
          className="flex-1 py-1 rounded text-xs bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-30 border border-[#30363d] font-mono"
        >
          Nast. →
        </button>
      </div>

      {/* Elementy orbitalne */}
      <div>
        <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-1.5 font-mono">Elementy orbitalne</div>
        <table className="w-full font-mono">
          <tbody>
            {orbital.map(([sym, val]) => (
              <tr key={sym}>
                <td className="text-xs font-bold text-[#58a6ff] pr-3 py-0.5 w-8">{sym}</td>
                <td className="text-xs text-[#e6edf3] py-0.5">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info z bazy danych */}
      {db && (
        <div className="border-t border-[#21262d] pt-2">
          <div className="text-[#8b949e] text-xs uppercase tracking-wider mb-1.5 font-mono">Info</div>
          <div className="space-y-0.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#8b949e]">NORAD</span>
              <span className="text-[#e6edf3]">{db.norad}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b949e]">Blok</span>
              <span className="text-[#e6edf3]">{db.block}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b949e]">Launch</span>
              <span className="text-[#e6edf3]">{db.launched}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8b949e]">Sygnały</span>
              <span className="text-[#e6edf3]">{db.freqs.join(', ')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sekcja Live */}
      {obsEnabled && (
        <div className="border-t border-[#21262d] pt-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
            <span className="text-[#3fb950] text-xs uppercase tracking-wider font-mono">Live</span>
          </div>
          {liveDat ? (
            <div className="space-y-0.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Elewacja</span>
                <span className={liveDat.el >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                  {liveDat.el.toFixed(1)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Azymut</span>
                <span className="text-[#e6edf3]">{liveDat.az.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Alt. sat.</span>
                <span className="text-[#e6edf3]">{liveDat.altKm.toFixed(0)} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8b949e]">Dystans</span>
                <span className="text-[#e6edf3]">{liveDat.rangeKm.toFixed(0)} km</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#484f58] font-mono">Obliczanie…</div>
          )}
        </div>
      )}
    </div>
  );
}

export function SatelliteList() {
  const { satellites, selectedIndex, mode, selectSatellite, setSatellites } = useSatelliteStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRowRef = useRef<HTMLDivElement>(null);

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
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 font-mono">
        <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-3">
          RINEX / Plik nawigacyjny
        </div>
        <input ref={fileRef} type="file" accept=".n,.rnx,.nav,.22n,.23n,.21n,.20n" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-3 border-2 border-dashed border-[#30363d] rounded text-[#8b949e] hover:border-[#58a6ff] hover:text-[#58a6ff] transition-colors text-xs"
        >
          Upuść plik RINEX lub kliknij
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl font-mono">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#30363d]">
        <span className="text-[#6e7681] text-xs uppercase tracking-widest">
          Satelity ({satellites.length})
        </span>
        <div className="flex gap-1">
          <input ref={fileRef} type="file" accept=".n,.rnx,.nav,.22n,.23n,.21n,.20n" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] text-xs"
          >
            + RINEX
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-56">
        {satellites.map((sat, i) => {
          const db = SAT_DB[sat.prn];
          const raan = (sat.eph.Omega0 * 180 / Math.PI).toFixed(0);
          const isSelected = i === selectedIndex;
          return (
            <div
              key={sat.prn}
              ref={isSelected ? selectedRowRef : null}
              onClick={() => selectSatellite(i)}
              className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                isSelected ? 'bg-[#1c2b3a]' : 'hover:bg-[#161b22]'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sat.color }} />
              <span className="flex-1 truncate text-xs text-[#e6edf3]">
                {db ? `${sat.prn} · ${db.name}` : sat.prn}
              </span>
              <span className="text-xs text-[#6e7681] flex-shrink-0">Ω={raan}°</span>
            </div>
          );
        })}
      </div>

      {selectedIndex >= 0 && <SatelliteDetails idx={selectedIndex} />}
    </div>
  );
}
