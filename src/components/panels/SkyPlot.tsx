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

export function SkyPlot({ observations: propObs, arcs = [], size = 320 }: Props) {
  const storeObs = useReceiverStore(s => s.recentObservations);
  const observations: SkyPlotObs[] = propObs ?? storeObs;
  const [hovered, setHovered] = useState<string | null>(null);

  const CX = size / 2;
  const CY = size / 2;
  const R  = size / 2 - 12;

  const emptyMsg = propObs !== undefined && propObs.length === 0
    ? 'Brak widocznych satelitów'
    : propObs === undefined && storeObs.length === 0
      ? 'Brak obserwacji — wczytaj NMEA'
      : null;

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
          return (
            <g
              key={obs.prn}
              onMouseEnter={() => setHovered(obs.prn)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default' }}
            >
              <circle cx={x} cy={y} r={isHov ? 8 : 6} fill={color} opacity={opacity} />
              <text x={x + 9} y={y + 4} fill={color} fontSize={9} fontFamily="monospace" opacity={opacity}>
                {obs.prn}
              </text>
              {/* Tooltip przy hoverze */}
              {isHov && (
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
        {emptyMsg ?? `${observations.length} satelitów`}
      </div>
    </div>
  );
}
