import { FREQ_BANDS } from '../../constants/frequencies';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { GnssSystem } from '../../types/satellite';

// ── Stałe wykresu ──────────────────────────────────────────────────────────────

const SYSTEMS: { id: GnssSystem; label: string }[] = [
  { id: 'gps',     label: 'GPS' },
  { id: 'galileo', label: 'GAL' },
  { id: 'glonass', label: 'GLO' },
  { id: 'beidou',  label: 'BDS' },
];

const FREQ_MIN = 1150;   // MHz
const FREQ_MAX = 1660;   // MHz
const FREQ_RANGE = FREQ_MAX - FREQ_MIN;

const CHART_W  = 290;   // px — szerokość obszaru wykresu
const LABEL_W  = 42;    // px — kolumna etykiet systemów
const ROW_H    = 48;    // px — wysokość wiersza na system
const BAR_H    = 24;    // px — wysokość paska pasma
const BAR_Y    = (ROW_H - BAR_H) / 2; // px — offset paska w wierszu

const TICK_FREQS = [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650];

function fx(freq: number) {
  return LABEL_W + ((freq - FREQ_MIN) / FREQ_RANGE) * CHART_W;
}
function fw(widthMHz: number) {
  return Math.max((widthMHz / FREQ_RANGE) * CHART_W, 3);
}

const SVG_W = LABEL_W + CHART_W + 2;
const CHART_H = SYSTEMS.length * ROW_H;

// ── Komponent ──────────────────────────────────────────────────────────────────

export function FrequencyPanel() {
  return (
    <div className="space-y-4 font-mono">

      {/* Spektrum GNSS */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-4">
          Spektrum sygnałów GNSS
        </div>

        <svg width={SVG_W} height={CHART_H + 30} className="block overflow-visible">

          {/* Pionowe linie siatki */}
          {TICK_FREQS.map(f => (
            <line
              key={f}
              x1={fx(f)} y1={0}
              x2={fx(f)} y2={CHART_H}
              stroke="#1c2333" strokeWidth={1}
            />
          ))}

          {/* Wiersze systemów */}
          {SYSTEMS.map(({ id, label }, rowIdx) => {
            const y       = rowIdx * ROW_H;
            const sysColor = GNSS_SYSTEMS[id]?.color ?? '#8b949e';
            const sysBands = FREQ_BANDS.filter(b => b.systems.includes(id));

            return (
              <g key={id}>
                {/* Tło wiersza */}
                <rect
                  x={0} y={y}
                  width={SVG_W} height={ROW_H}
                  fill={rowIdx % 2 === 0 ? '#0d1117' : '#111720'}
                />

                {/* Etykieta systemu */}
                <text
                  x={LABEL_W / 2} y={y + ROW_H / 2 + 4}
                  textAnchor="middle"
                  fill={sysColor}
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {label}
                </text>

                {/* Paski pasm */}
                {sysBands.map(band => {
                  const cx  = fx(band.freq);
                  const bw  = fw(band.width);
                  const bx  = cx - bw / 2;
                  const showLabel = bw >= 20;

                  return (
                    <g key={band.name}>
                      <rect
                        x={bx} y={y + BAR_Y}
                        width={bw} height={BAR_H}
                        fill={band.color}
                        fillOpacity={0.80}
                        rx={2}
                      />
                      {showLabel && (
                        <text
                          x={cx} y={y + BAR_Y + BAR_H / 2 + 4}
                          textAnchor="middle"
                          fill="#fff"
                          fontSize={9}
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {band.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Oś X (linia) */}
          <line
            x1={LABEL_W} y1={CHART_H}
            x2={SVG_W}   y2={CHART_H}
            stroke="#30363d" strokeWidth={1}
          />

          {/* Znaczniki i etykiety osi X */}
          {TICK_FREQS.map(f => (
            <g key={f}>
              <line
                x1={fx(f)} y1={CHART_H}
                x2={fx(f)} y2={CHART_H + 5}
                stroke="#484f58" strokeWidth={1}
              />
              <text
                x={fx(f)} y={CHART_H + 16}
                textAnchor="middle"
                fill="#484f58"
                fontSize={8}
                fontFamily="monospace"
              >
                {f}
              </text>
            </g>
          ))}

          {/* Podpis osi X */}
          <text
            x={LABEL_W + CHART_W / 2} y={CHART_H + 28}
            textAnchor="middle"
            fill="#6e7681"
            fontSize={9}
            fontFamily="monospace"
          >
            Częstotliwość [MHz]
          </text>

        </svg>
      </div>

      {/* Tabela szczegółów pasm */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">
          Szczegóły pasm
        </div>

        <div
          className="grid text-[10px] text-[#484f58] mb-2 pb-1 border-b border-[#21262d]"
          style={{ gridTemplateColumns: '4rem 5.5rem 3.5rem 1fr' }}
        >
          <span>Pasmo</span>
          <span>Freq [MHz]</span>
          <span>BW [MHz]</span>
          <span>Sygnały</span>
        </div>

        {FREQ_BANDS.map(band => (
          <div
            key={band.name}
            className="grid items-start text-xs py-1 border-b border-[#1c2333] last:border-0"
            style={{ gridTemplateColumns: '4rem 5.5rem 3.5rem 1fr' }}
          >
            <span className="font-bold" style={{ color: band.color }}>{band.name}</span>
            <span className="text-[#8b949e]">{band.freq.toFixed(2)}</span>
            <span className="text-[#484f58]">{band.width}</span>
            <span className="text-[#6e7681] leading-relaxed">
              {band.signals.join(', ')}
            </span>
          </div>
        ))}
      </div>

      {/* Legenda systemów */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">
          Systemy nawigacyjne
        </div>
        <div className="space-y-2 text-xs">
          {SYSTEMS.map(({ id, label }) => {
            const sys   = GNSS_SYSTEMS[id];
            const bands = FREQ_BANDS.filter(b => b.systems.includes(id));
            return (
              <div key={id} className="flex items-start gap-2">
                <span
                  className="font-bold w-8 flex-shrink-0"
                  style={{ color: sys?.color }}
                >
                  {label}
                </span>
                <span className="text-[#484f58]">
                  {bands.map(b => b.name).join(' · ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
