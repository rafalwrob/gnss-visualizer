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

interface Props {
  /** Dane obserwacji — jeśli pominięte, czytane z receiverStore */
  observations?: SkyPlotObs[];
  /** Rozmiar SVG w pikselach (domyślnie 320) */
  size?: number;
}

export function SkyPlot({ observations: propObs, size = 320 }: Props) {
  const storeObs = useReceiverStore(s => s.recentObservations);
  const observations: SkyPlotObs[] = propObs ?? storeObs;

  const CX = size / 2;
  const CY = size / 2;
  const R  = size / 2 - 12;

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
      <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-3 font-mono">Sky Plot</div>
      <svg width={size} height={size} className="block mx-auto">

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

        {/* Satelity */}
        {observations.map(obs => {
          const r       = R * (1 - obs.elevation / 90);
          const rad     = (obs.azimuth - 90) * Math.PI / 180;
          const x       = CX + r * Math.cos(rad);
          const y       = CY + r * Math.sin(rad);
          const color   = GNSS_SYSTEMS[obs.system]?.color ?? '#8b949e';
          const opacity = 0.45 + 0.55 * Math.min(1, (obs.snr ?? 45) / 50);
          return (
            <g key={obs.prn}>
              <circle cx={x} cy={y} r={6} fill={color} opacity={opacity} />
              <text x={x + 9} y={y + 4} fill={color} fontSize={9} fontFamily="monospace" opacity={opacity}>
                {obs.prn}
              </text>
            </g>
          );
        })}

      </svg>

      <div className="text-[#484f58] text-xs font-mono text-center mt-2">
        {observations.length === 0
          ? 'Brak obserwacji — wczytaj NMEA lub podłącz odbiornik'
          : `${observations.length} satelitów`}
      </div>
    </div>
  );
}
