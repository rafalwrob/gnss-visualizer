import { useState, useEffect, useRef } from 'react';
import { useObserverStore } from '../../store/observerStore';
import { propagateSGP4 } from '../../services/api/celestrak';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { satElevAz, computeDOP, latLonAltToEcef } from '../../services/coordinates/ecefEnu';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import { SkyPlot } from './SkyPlot';
import { anim } from '../scene/animState';
import type { GnssSystem } from '../../types/satellite';

const SYSTEMS: GnssSystem[] = ['gps', 'galileo', 'glonass', 'beidou', 'qzss', 'navic'];

const SYS_SHORT: Record<GnssSystem, string> = {
  gps: 'GPS', galileo: 'GAL', glonass: 'GLO', beidou: 'BDS',
  qzss: 'QZS', navic: 'NAV', sbas: 'SBAS',
};

// GPS L1 carrier frequency for Doppler calculation
const F0_GPS_L1 = 1575.42e6; // Hz
const C = 299792458; // m/s

interface VisibleSat {
  prn: string;
  system: GnssSystem;
  color: string;
  el: number;
  az: number;
  rho: number;     // pseudorange [km]
  doppler: number; // Doppler shift [Hz]
}

function dopColor(pdop: number): string {
  if (pdop < 2) return '#3fb950';
  if (pdop < 4) return '#d29922';
  if (pdop < 6) return '#f0883e';
  return '#f85149';
}

export function VisibilityPanel() {
  const {
    enabled, lat, lon, alt, minElevation, allSats, systemStatus, fetchError,
    enabledSystems, toggleSystem,
  } = useObserverStore();

  const [visibleList, setVisibleList] = useState<VisibleSat[]>([]);
  const [useSGP4, setUseSGP4] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Przelicz listę widocznych satelitów co 2 s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!enabled || allSats.length === 0) { setVisibleList([]); return; }

    function computeList() {
      const timeSec = anim.realtimeClock
        ? (Date.now() - anim.realtimeOriginMs) / 1000
        : anim.timeSec;
      const date = anim.realtimeClock
        ? new Date(anim.realtimeOriginMs + timeSec * 1000)
        : new Date(anim.simulationOriginMs + timeSec * 1000);

      const obsEcef = latLonAltToEcef(lat, lon, alt);

      const list: VisibleSat[] = [];
      for (const sat of allSats) {
        if (!enabledSystems[sat.system]) continue;
        let x: number, y: number, z: number;
        if (useSGP4 && sat.satrec) {
          const pos = propagateSGP4(sat.satrec, date);
          if (!pos) continue;
          ({ x, y, z } = pos);
        } else {
          ({ x, y, z } = computeGPSPosition(sat.eph, timeSec, true, false));
        }
        const { el, az } = satElevAz(x, y, z, lat, lon, alt);
        if (el < minElevation) continue;

        // Pseudorange
        const dx = x - obsEcef.x, dy = y - obsEcef.y, dz = z - obsEcef.z;
        const rho1 = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const rho = rho1 / 1000; // km

        // Doppler via numerical differentiation (1 s step)
        let x2: number, y2: number, z2: number;
        if (useSGP4 && sat.satrec) {
          const pos2 = propagateSGP4(sat.satrec, new Date(date.getTime() + 1000));
          if (!pos2) { list.push({ prn: sat.prn, system: sat.system, color: sat.color, el, az, rho, doppler: 0 }); continue; }
          ({ x: x2, y: y2, z: z2 } = pos2);
        } else {
          ({ x: x2, y: y2, z: z2 } = computeGPSPosition(sat.eph, timeSec + 1, true, false));
        }
        const dx2 = x2 - obsEcef.x, dy2 = y2 - obsEcef.y, dz2 = z2 - obsEcef.z;
        const rho2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
        const dRdt = rho2 - rho1; // m/s (positive = receding)
        const doppler = -(F0_GPS_L1 / C) * dRdt; // Hz

        list.push({ prn: sat.prn, system: sat.system, color: sat.color, el, az, rho, doppler });
      }
      list.sort((a, b) => b.el - a.el);
      setVisibleList(list);
    }

    computeList();
    intervalRef.current = setInterval(computeList, 250);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [enabled, allSats, lat, lon, alt, minElevation, enabledSystems, useSGP4]);

  const dop = computeDOP(visibleList.map(s => ({ el: s.el, az: s.az })));
  const hasSGP4 = allSats.some(s => Boolean(s.satrec));

  return (
    <div className="space-y-4 font-mono">

      {/* Status pobierania */}
      {Object.keys(systemStatus).length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Status pobierania</div>
          <div className="grid grid-cols-3 gap-1.5">
            {SYSTEMS.map(sys => {
              const info = systemStatus[sys];
              if (!info) return null;
              const color = info.status === 'ok' ? '#3fb950'
                : info.status === 'error' ? '#f85149'
                : '#58a6ff';
              return (
                <div key={sys} className="flex items-center gap-1.5">
                  <span style={{ color }} className="text-xs">
                    {info.status === 'ok' ? '✓' : info.status === 'error' ? '✗' : '…'}
                  </span>
                  <span className="text-xs text-[#8b949e]">{SYS_SHORT[sys]}</span>
                  {info.status === 'ok' && (
                    <span className="text-xs text-[#484f58]">{info.count}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fetchError && (
        <div className="text-xs text-[#f85149] px-1">✗ {fetchError}</div>
      )}

      {/* Filtr konstelacji */}
      {enabled && allSats.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Konstelacje</div>
          <div className="flex flex-wrap gap-1.5">
            {SYSTEMS.map(sys => {
              const info = GNSS_SYSTEMS[sys];
              const active = enabledSystems[sys];
              const total = allSats.filter(s => s.system === sys).length;
              if (total === 0) return null;
              return (
                <button
                  key={sys}
                  onClick={() => toggleSystem(sys)}
                  className="px-2 py-1 rounded-lg text-xs font-bold border transition-all"
                  style={active
                    ? { backgroundColor: info.color + '33', borderColor: info.color, color: info.color }
                    : { backgroundColor: 'transparent', borderColor: '#30363d', color: '#484f58' }
                  }
                >
                  {SYS_SHORT[sys]} {total}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista widocznych satelitów */}
      {enabled && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#6e7681] text-[10px] uppercase tracking-widest">Widoczne satelity</div>
            <span className="text-xs text-[#3fb950] font-bold">{visibleList.length}</span>
          </div>

          {/* DOP */}
          {dop && (
            <div className="mb-3 p-2 bg-[#0d1117] rounded-lg border border-[#21262d]">
              <div className="text-[9px] text-[#484f58] uppercase tracking-widest mb-1.5">DOP</div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <div className="text-[9px] text-[#484f58]">PDOP</div>
                  <div className="text-[11px] font-bold font-mono" style={{ color: dopColor(dop.pdop) }}>{dop.pdop.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#484f58]">HDOP</div>
                  <div className="text-[11px] font-mono text-[#8b949e]">{dop.hdop.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#484f58]">VDOP</div>
                  <div className="text-[11px] font-mono text-[#8b949e]">{dop.vdop.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#484f58]">GDOP</div>
                  <div className="text-[11px] font-mono text-[#8b949e]">{dop.gdop.toFixed(1)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Propagator toggle */}
          {hasSGP4 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] text-[#484f58]">Propagator:</span>
              <button
                onClick={() => setUseSGP4(false)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${!useSGP4 ? 'bg-[#1f6feb] border-[#388bfd] text-white' : 'bg-transparent border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}
              >Kepler</button>
              <button
                onClick={() => setUseSGP4(true)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-colors ${useSGP4 ? 'bg-[#1f6feb] border-[#388bfd] text-white' : 'bg-transparent border-[#30363d] text-[#484f58] hover:text-[#8b949e]'}`}
              >SGP4</button>
            </div>
          )}

          {visibleList.length === 0 ? (
            <div className="text-xs text-[#484f58]">Brak widocznych powyżej {minElevation}°</div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {/* Nagłówek */}
              <div className="grid text-[9px] text-[#484f58] pb-1 border-b border-[#21262d]"
                style={{ gridTemplateColumns: '2.8rem 1fr 2.8rem 2.8rem' }}>
                <span>PRN</span>
                <span>Sys</span>
                <span className="text-right">El°</span>
                <span className="text-right">Az°</span>
              </div>
              {visibleList.map(s => (
                <div key={s.prn} className="py-0.5 border-b border-[#21262d]">
                  <div className="grid items-center text-xs"
                    style={{ gridTemplateColumns: '2.8rem 1fr 2.8rem 2.8rem' }}>
                    <span className="font-bold font-mono" style={{ color: s.color }}>{s.prn}</span>
                    <span className="text-[10px] text-[#484f58]">{GNSS_SYSTEMS[s.system]?.name}</span>
                    <span className="text-right text-[#e6edf3]">{s.el.toFixed(1)}°</span>
                    <span className="text-right text-[#8b949e]">{s.az.toFixed(0)}°</span>
                  </div>
                  <div className="flex gap-4 pl-1 text-[9px] mt-0.5">
                    <span className="text-[#484f58]">
                      ρ <span className="text-[#58a6ff]">{s.rho.toFixed(0)} km</span>
                    </span>
                    <span className="text-[#484f58]">
                      Δf <span className={s.doppler >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {s.doppler >= 0 ? '+' : ''}{s.doppler.toFixed(0)} Hz
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-[#484f58] mt-3">
            {lat.toFixed(4)}°N · {lon.toFixed(4)}°E · {alt.toFixed(0)} m n.p.m.
          </div>
        </div>
      )}

      {/* Sky Plot */}
      {enabled && visibleList.length > 0 && (
        <SkyPlot
          observations={visibleList.map(s => ({
            prn: s.prn,
            system: s.system,
            azimuth: s.az,
            elevation: s.el,
          }))}
          size={230}
        />
      )}
    </div>
  );
}
