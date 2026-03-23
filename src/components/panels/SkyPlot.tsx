import { useState } from 'react';
import { useReceiverStore } from '../../store/receiverStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { GnssSystem } from '../../types/satellite';

export interface SkyPlotObs {
  prn: string;
  system: GnssSystem;
  azimuth: number;
  elevation: number;
  snr?: number;
}

export interface SkyPlotArc {
  prn: string;
  system: GnssSystem;
  points: { az: number; el: number }[];
}

interface Props {
  /** Dane obserwacji — jeśli pominięte, czytane z receiverStore */
  observations?: SkyPlotObs[];
  /** Tory orbit (3h do przodu co 5 min) */
  arcs?: SkyPlotArc[];
  /** Rozmiar SVG w pikselach (domyślnie 320) */
  size?: number;
}

function toXY(az: number, el: number, cx: number, cy: number, R: number): [number, number] {
  const r = R * (1 - el / 90);
  const rad = (az - 90) * Math.PI / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** Podziel punkty na segmenty widoczne (el >= 0), zwraca tablicę segmentów */
function splitSegments(points: { az: number; el: number }[]): { az: number; el: number }[][] {
  const segments: { az: number; el: number }[][] = [];
  let current: { az: number; el: number }[] = [];
  for (const p of points) {
    if (p.el >= 0) {
      current.push(p);
    } else {
      if (current.length > 1) segments.push(current);
      current = [];
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

function SatDetailCard({ prn, obs }: { prn: string; obs: SkyPlotObs }) {
  const measurements = useReceiverStore(s => s.recentMeasurements);
  const color = GNSS_SYSTEMS[obs.system]?.color ?? '#8b949e';
  const systemName = GNSS_SYSTEMS[obs.system]?.name ?? obs.system;

  // Filtruj pomiary dla wybranego PRN, jeden wiersz per pasmo
  const prefix: Record<GnssSystem, string> = {
    gps: 'G', galileo: 'E', glonass: 'R', beidou: 'C', qzss: 'J', navic: 'I', sbas: 'S',
  };
  const satMeas = measurements.filter(m =>
    `${prefix[m.system]}${String(m.prn).padStart(2, '0')}` === prn,
  );

  // Unikalne pasma z wartościami pseudodystansu i Dopplera
  const bands = new Map<string, { pseudo: number[]; doppler: number[]; snr: number[] }>();
  for (const m of satMeas) {
    const b = m.freqBand;
    if (!bands.has(b)) bands.set(b, { pseudo: [], doppler: [], snr: [] });
    const entry = bands.get(b)!;
    entry.pseudo.push(m.pseudorange);
    if (m.doppler != null) entry.doppler.push(m.doppler);
    entry.snr.push(m.snr);
  }

  const median = (arr: number[]) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const snr = obs.snr ?? median(satMeas.map(m => m.snr ?? 0)) ?? 0;
  const snrPct = Math.min(100, (snr / 60) * 100);
  const snrColor = snr >= 40 ? '#3fb950' : snr >= 25 ? '#f7c948' : '#f85149';

  const bandList = [...bands.entries()];

  return (
    <div
      className="mt-3 bg-[#0d1117] border rounded-xl p-3 text-xs font-mono"
      style={{ borderColor: color + '60' }}
    >
      {/* Nagłówek */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold" style={{ color }}>{prn}</span>
        <span className="text-[#6e7681]">{systemName}</span>
      </div>

      {/* El / Az */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-[#161b22] rounded-lg px-2 py-1.5 text-center">
          <div className="text-[#484f58] text-[10px] mb-0.5">Elewacja</div>
          <div className="text-[#e6edf3] font-bold">{obs.elevation.toFixed(1)}°</div>
        </div>
        <div className="bg-[#161b22] rounded-lg px-2 py-1.5 text-center">
          <div className="text-[#484f58] text-[10px] mb-0.5">Azymut</div>
          <div className="text-[#e6edf3] font-bold">{obs.azimuth.toFixed(0)}°</div>
        </div>
      </div>

      {/* C/N₀ */}
      <div className="mb-2">
        <div className="flex justify-between mb-0.5">
          <span className="text-[#484f58]">C/N₀</span>
          <span style={{ color: snrColor }} className="font-bold">{snr.toFixed(0)} dBHz</span>
        </div>
        <div className="h-1.5 bg-[#21262d] rounded overflow-hidden">
          <div className="h-full rounded transition-all" style={{ width: `${snrPct}%`, backgroundColor: snrColor }} />
        </div>
      </div>

      {/* Pomiary per pasmo */}
      {bandList.length > 0 && (
        <div className="space-y-1">
          {bandList.map(([band, data]) => {
            const pseudo = median(data.pseudo);
            const dop = median(data.doppler);
            return (
              <div key={band} className="bg-[#161b22] rounded-lg px-2 py-1">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold" style={{ color }}>{band}</span>
                  {dop != null && (
                    <span className={dop >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                      {dop >= 0 ? '+' : ''}{dop.toFixed(0)} Hz
                    </span>
                  )}
                </div>
                {pseudo != null && (
                  <div className="text-[#8b949e]">
                    ρ {(pseudo / 1000).toFixed(1)} km
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {bandList.length === 0 && (
        <div className="text-[#484f58] text-center py-1">brak pomiarów</div>
      )}
    </div>
  );
}

export function SkyPlot({ observations: propObs, arcs = [], size = 320 }: Props) {
  const storeObs = useReceiverStore(s => s.recentObservations);
  const observations: SkyPlotObs[] = propObs ?? storeObs;
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedPrn, setSelectedPrn] = useState<string | null>(null);

  const CX = size / 2;
  const CY = size / 2;
  const R  = size / 2 - 12;

  const emptyMsg = propObs !== undefined && propObs.length === 0
    ? 'Brak widocznych satelitów'
    : propObs === undefined && storeObs.length === 0
      ? 'Brak obserwacji — wczytaj NMEA'
      : null;

  const selectedObs = selectedPrn ? observations.find(o => o.prn === selectedPrn) : null;

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
      <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-3 font-mono">Sky Plot</div>
      <svg width={size} height={size} className="block mx-auto" style={{ overflow: 'visible' }}>

        {/* Okręgi elewacji 0° / 30° / 60° */}
        {([0, 30, 60] as const).map(el => {
          const r = R * (1 - el / 90);
          return (
            <g key={el}>
              <circle cx={CX} cy={CY} r={r} fill="none" stroke="#21262d" strokeWidth={el === 0 ? 1.5 : 1} />
              <text x={CX + 3} y={CY - r + 12} fill="#484f58" fontSize={10} fontFamily="monospace">{el}°</text>
            </g>
          );
        })}

        {/* Linie azymutów co 45° */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(az => {
          const rad = (az - 90) * Math.PI / 180;
          const isMajor = az % 90 === 0;
          return (
            <line
              key={az}
              x1={CX} y1={CY}
              x2={CX + R * Math.cos(rad)}
              y2={CY + R * Math.sin(rad)}
              stroke={isMajor ? '#2d333b' : '#1a2030'}
              strokeWidth={isMajor ? 1 : 0.5}
            />
          );
        })}

        {/* Etykiety N / E / S / W */}
        {[
          { label: 'N', x: CX - 5,     y: CY - R - 8 },
          { label: 'E', x: CX + R + 6, y: CY + 4 },
          { label: 'S', x: CX - 5,     y: CY + R + 16 },
          { label: 'W', x: CX - R - 16, y: CY + 4 },
        ].map(({ label, x, y }) => (
          <text key={label} x={x} y={y} fill="#6e7681" fontSize={12} fontFamily="monospace" fontWeight="bold">
            {label}
          </text>
        ))}

        {/* Orbit arcs — przerywane tory */}
        {arcs.map(arc => {
          const color = GNSS_SYSTEMS[arc.system]?.color ?? '#8b949e';
          const segments = splitSegments(arc.points);
          return segments.map((seg, si) => {
            const d = seg.map((p, i) => {
              const [x, y] = toXY(p.az, p.el, CX, CY, R);
              return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            return (
              <path
                key={`${arc.prn}-${si}`}
                d={d}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.35}
                fill="none"
                strokeLinecap="round"
              />
            );
          });
        })}

        {/* Satelity */}
        {observations.map(obs => {
          const r       = R * (1 - obs.elevation / 90);
          const rad     = (obs.azimuth - 90) * Math.PI / 180;
          const x       = CX + r * Math.cos(rad);
          const y       = CY + r * Math.sin(rad);
          const color   = GNSS_SYSTEMS[obs.system]?.color ?? '#8b949e';
          const opacity = 0.45 + 0.55 * Math.min(1, (obs.snr ?? 45) / 50);
          const isHov   = hovered === obs.prn;
          const isSel   = selectedPrn === obs.prn;
          return (
            <g
              key={obs.prn}
              onMouseEnter={() => setHovered(obs.prn)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setSelectedPrn(obs.prn === selectedPrn ? null : obs.prn)}
              style={{ cursor: 'pointer' }}
            >
              {/* Pierścień dla wybranego */}
              {isSel && (
                <circle cx={x} cy={y} r={11} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
              )}
              <circle cx={x} cy={y} r={isHov || isSel ? 8 : 6} fill={color} opacity={opacity} />
              <text x={x + 9} y={y + 4} fill={color} fontSize={9} fontFamily="monospace" opacity={opacity}>
                {obs.prn}
              </text>
              {/* Tooltip przy hoverze (gdy nie wybrany) */}
              {isHov && !isSel && (
                <g>
                  <rect
                    x={x + 12} y={y - 24}
                    width={72} height={40}
                    rx={4}
                    fill="#161b22"
                    stroke={color}
                    strokeWidth={0.8}
                    opacity={0.95}
                  />
                  <text x={x + 18} y={y - 10} fill={color} fontSize={10} fontFamily="monospace" fontWeight="bold">
                    {obs.prn}
                  </text>
                  <text x={x + 18} y={y + 2} fill="#8b949e" fontSize={9} fontFamily="monospace">
                    El {obs.elevation.toFixed(1)}°
                  </text>
                  <text x={x + 18} y={y + 13} fill="#8b949e" fontSize={9} fontFamily="monospace">
                    Az {obs.azimuth.toFixed(0)}°
                  </text>
                </g>
              )}
            </g>
          );
        })}

      </svg>

      <div className="text-[#484f58] text-xs font-mono text-center mt-2">
        {emptyMsg ?? `${observations.length} satelitów${selectedPrn ? ' — kliknij aby odznaczyć' : ' — kliknij satelitę'}`}
      </div>

      {selectedObs && (
        <SatDetailCard prn={selectedPrn!} obs={selectedObs} />
      )}
    </div>
  );
}
