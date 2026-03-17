import { useMemo, useState } from 'react';
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

const FREQ_MIN = 1150;
const FREQ_MAX = 1660;
const FREQ_RANGE = FREQ_MAX - FREQ_MIN;

const CHART_W  = 290;
const LABEL_W  = 42;
const ROW_H    = 48;
const BAR_H    = 24;
const BAR_Y    = (ROW_H - BAR_H) / 2;

const TICK_FREQS = [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1650];

function fx(freq: number) {
  return LABEL_W + ((freq - FREQ_MIN) / FREQ_RANGE) * CHART_W;
}
function fw(widthMHz: number) {
  return Math.max((widthMHz / FREQ_RANGE) * CHART_W, 3);
}

const SVG_W = LABEL_W + CHART_W + 2;
const CHART_H_SVG = SYSTEMS.length * ROW_H;

// ── Sinusoida nośna ────────────────────────────────────────────────────────────

/** Zwraca punkty polyline sinusoidy o podwójnej szerokości (dla płynnej pętli) */
function makeCarrierPoints(bx: number, by: number, bw: number, bh: number, N = 80): string {
  const pts: string[] = [];
  const amplitude = bh * 0.28;
  const my = by + bh / 2;
  for (let i = 0; i <= N * 2; i++) {
    const t = i / N;
    const x = bx + t * bw;
    const y = my + amplitude * Math.sin(t * 2 * Math.PI * 3);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

// ── Komponent ──────────────────────────────────────────────────────────────────

interface BandInfo {
  name: string;
  freq: number;
  width: number;
  color: string;
  signals: string[];
}

export function FrequencyPanel() {
  const [hoveredBand, setHoveredBand] = useState<string | null>(null);

  // Pre-kalkulacja sinusoid dla pasm ≥15px
  const carrierData = useMemo(() => {
    return FREQ_BANDS.map(band => {
      const bw = fw(band.width);
      if (bw < 15) return null;
      const bx = fx(band.freq) - bw / 2;
      return { bw, bx, points: makeCarrierPoints(bx, 0, bw, BAR_H) };
    });
  }, []);

  const hoveredInfo: BandInfo | null = hoveredBand
    ? (FREQ_BANDS.find(b => b.name === hoveredBand) ?? null)
    : null;

  return (
    <div className="space-y-4 font-mono">

      {/* Spektrum GNSS */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-4">
          Spektrum sygnałów GNSS
        </div>

        <svg
          width={SVG_W}
          height={CHART_H_SVG + 30}
          className="block overflow-visible"
          onMouseLeave={() => setHoveredBand(null)}
        >
          <defs>
            {/* Clip-paths dla sinusoid nośnych */}
            {FREQ_BANDS.map((band, bi) => {
              const bw = fw(band.width);
              if (bw < 15) return null;
              const bx = fx(band.freq) - bw / 2;
              return SYSTEMS.map((_, rowIdx) => (
                <clipPath key={`cp-${bi}-${rowIdx}`} id={`cp-${bi}-${rowIdx}`}>
                  <rect x={bx} y={rowIdx * ROW_H + BAR_Y} width={bw} height={BAR_H} rx="2" />
                </clipPath>
              ));
            })}
          </defs>

          {/* Pionowe linie siatki */}
          {TICK_FREQS.map(f => (
            <line key={f} x1={fx(f)} y1={0} x2={fx(f)} y2={CHART_H_SVG}
              stroke="#1c2333" strokeWidth={1} />
          ))}

          {/* Wiersze systemów */}
          {SYSTEMS.map(({ id, label }, rowIdx) => {
            const y = rowIdx * ROW_H;
            const sysColor = GNSS_SYSTEMS[id]?.color ?? '#8b949e';
            const sysBands = FREQ_BANDS.filter(b => b.systems.includes(id));

            return (
              <g key={id}>
                {/* Tło wiersza */}
                <rect x={0} y={y} width={SVG_W} height={ROW_H}
                  fill={rowIdx % 2 === 0 ? '#0d1117' : '#111720'} />

                {/* Etykieta systemu */}
                <text x={LABEL_W / 2} y={y + ROW_H / 2 + 4}
                  textAnchor="middle" fill={sysColor}
                  fontSize={10} fontFamily="monospace" fontWeight="bold">
                  {label}
                </text>

                {/* Paski pasm */}
                {sysBands.map((band, bandLocalIdx) => {
                  const bandGlobalIdx = FREQ_BANDS.indexOf(band);
                  const cx  = fx(band.freq);
                  const bw  = fw(band.width);
                  const bx  = cx - bw / 2;
                  const showLabel = bw >= 20;
                  const isHovered = hoveredBand === band.name;
                  const carrier = carrierData[bandGlobalIdx];

                  // Offset pulsowania — rozłożone w czasie
                  const pulseDelay = (rowIdx * sysBands.length + bandLocalIdx) * 0.5;

                  return (
                    <g
                      key={band.name}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredBand(band.name)}
                    >
                      {/* Pasek z pulsowaniem */}
                      <rect
                        x={bx} y={y + BAR_Y}
                        width={bw} height={BAR_H}
                        fill={band.color}
                        fillOpacity={isHovered ? 0.95 : 0.80}
                        rx={2}
                        stroke={isHovered ? 'white' : 'none'}
                        strokeWidth={isHovered ? 1 : 0}
                      >
                        {!isHovered && (
                          <animate
                            attributeName="fillOpacity"
                            values="0.55;0.92;0.55"
                            dur="2.5s"
                            begin={`${pulseDelay}s`}
                            repeatCount="indefinite"
                          />
                        )}
                      </rect>

                      {/* Fala nośna */}
                      {carrier && (
                        <g clipPath={`url(#cp-${bandGlobalIdx}-${rowIdx})`}>
                          <polyline
                            points={carrier.points}
                            fill="none"
                            stroke="white"
                            strokeWidth="0.8"
                            strokeOpacity="0.25"
                            transform={`translate(0,${y + BAR_Y})`}
                          >
                            <animateTransform
                              attributeName="transform"
                              type="translate"
                              from={`0 ${y + BAR_Y}`}
                              to={`${-carrier.bw} ${y + BAR_Y}`}
                              dur="1.2s"
                              repeatCount="indefinite"
                            />
                          </polyline>
                        </g>
                      )}

                      {/* Etykieta */}
                      {showLabel && (
                        <text
                          x={cx} y={y + BAR_Y + BAR_H / 2 + 4}
                          textAnchor="middle" fill="#fff"
                          fontSize={9} fontFamily="monospace" fontWeight="bold"
                          style={{ pointerEvents: 'none' }}
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

          {/* Linia skanująca */}
          <line y1={0} y2={CHART_H_SVG} stroke="#58a6ff" strokeOpacity="0.22" strokeWidth="1.5">
            <animate attributeName="x1" from={LABEL_W} to={SVG_W} dur="5s" repeatCount="indefinite" />
            <animate attributeName="x2" from={LABEL_W} to={SVG_W} dur="5s" repeatCount="indefinite" />
          </line>

          {/* Oś X */}
          <line x1={LABEL_W} y1={CHART_H_SVG} x2={SVG_W} y2={CHART_H_SVG}
            stroke="#30363d" strokeWidth={1} />

          {/* Znaczniki i etykiety osi X */}
          {TICK_FREQS.map(f => (
            <g key={f}>
              <line x1={fx(f)} y1={CHART_H_SVG} x2={fx(f)} y2={CHART_H_SVG + 5}
                stroke="#484f58" strokeWidth={1} />
              <text x={fx(f)} y={CHART_H_SVG + 16}
                textAnchor="middle" fill="#484f58"
                fontSize={8} fontFamily="monospace">
                {f}
              </text>
            </g>
          ))}

          {/* Podpis osi X */}
          <text x={LABEL_W + CHART_W / 2} y={CHART_H_SVG + 28}
            textAnchor="middle" fill="#6e7681"
            fontSize={9} fontFamily="monospace">
            Częstotliwość [MHz]
          </text>
        </svg>

        {/* Tooltip hovered pasma */}
        {hoveredInfo && (
          <div className="mt-2 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs">
            <div className="font-bold mb-0.5" style={{ color: hoveredInfo.color }}>
              {hoveredInfo.name}
            </div>
            <div className="text-[#8b949e]">
              <span className="text-[#484f58]">f: </span>{hoveredInfo.freq.toFixed(2)} MHz
              <span className="text-[#484f58] ml-2">BW: </span>{hoveredInfo.width} MHz
            </div>
            <div className="text-[#6e7681] mt-0.5 leading-relaxed">
              {hoveredInfo.signals.join(' · ')}
            </div>
          </div>
        )}
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
                <span className="font-bold w-8 flex-shrink-0" style={{ color: sys?.color }}>
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
