import { useReceiverStore } from '../../store/receiverStore';
import { GNSS_SYSTEMS } from '../../constants/gnss';

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 110;

export function SkyPlot() {
  const observations = useReceiverStore(s => s.recentObservations);

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3">
      <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-2 font-mono">Sky Plot</div>
      <svg width={SIZE} height={SIZE} className="block mx-auto">
        {/* Siatka */}
        {[0, 30, 60].map(el => {
          const r = R * (1 - el / 90);
          return (
            <circle
              key={el}
              cx={CX} cy={CY} r={r}
              fill="none"
              stroke="#21262d"
              strokeWidth={el === 0 ? 1.5 : 1}
            />
          );
        })}
        {/* Linie N/E/S/W */}
        {[0, 90, 180, 270].map(az => {
          const rad = (az - 90) * Math.PI / 180;
          return (
            <line
              key={az}
              x1={CX} y1={CY}
              x2={CX + R * Math.cos(rad)}
              y2={CY + R * Math.sin(rad)}
              stroke="#21262d"
              strokeWidth={1}
            />
          );
        })}
        {/* Etykiety stron świata */}
        {[
          { az: 0, label: 'N', dx: -4, dy: -R - 6 },
          { az: 90, label: 'E', dx: R + 4, dy: 4 },
          { az: 180, label: 'S', dx: -4, dy: R + 12 },
          { az: 270, label: 'W', dx: -R - 14, dy: 4 },
        ].map(({ label, dx, dy }) => (
          <text
            key={label}
            x={CX + dx}
            y={CY + dy}
            fill="#6e7681"
            fontSize={9}
            fontFamily="monospace"
          >
            {label}
          </text>
        ))}
        {/* Satelity */}
        {observations.map(obs => {
          const r = R * (1 - obs.elevation / 90);
          const rad = (obs.azimuth - 90) * Math.PI / 180;
          const x = CX + r * Math.cos(rad);
          const y = CY + r * Math.sin(rad);
          const color = GNSS_SYSTEMS[obs.system]?.color ?? '#8b949e';
          const opacity = 0.4 + 0.6 * Math.min(1, obs.snr / 50);
          return (
            <g key={obs.prn}>
              <circle
                cx={x} cy={y} r={5}
                fill={color}
                opacity={opacity}
              />
              <text
                x={x + 7} y={y + 4}
                fill={color}
                fontSize={6}
                fontFamily="monospace"
                opacity={opacity}
              >
                {obs.prn}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="text-[#484f58] text-[9px] font-mono text-center mt-1">
        {observations.length === 0
          ? 'Brak obserwacji — wczytaj dane NMEA'
          : `${observations.length} sat.`}
      </div>
    </div>
  );
}
