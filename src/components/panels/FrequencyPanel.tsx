import { useMemo, useState } from 'react';
import { FREQ_BANDS } from '../../constants/frequencies';
import { GNSS_SYSTEMS } from '../../constants/gnss';
import type { GnssSystem } from '../../types/satellite';

// ── Stałe ─────────────────────────────────────────────────────────────────────

const SYSTEMS: { id: GnssSystem; label: string; color: string }[] = [
  { id: 'gps',     label: 'GPS',     color: '#1f6feb' },
  { id: 'galileo', label: 'Galileo', color: '#f0883e' },
  { id: 'glonass', label: 'GLONASS', color: '#da3633' },
  { id: 'beidou',  label: 'BeiDou',  color: '#f7c948' },
];

const F_MIN = 1155, F_MAX = 1660; // MHz
const F_RANGE = F_MAX - F_MIN;

// Chart SVG dimensions
const W = 360, H = 180;
const PAD = { t: 12, r: 8, b: 28, l: 8 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

function fx(f: number) { return PAD.l + ((f - F_MIN) / F_RANGE) * IW; }

const TICK_FREQS = [1200, 1250, 1300, 1350, 1400, 1450, 1500, 1550, 1575, 1600, 1650];

// ── PSD Generator ─────────────────────────────────────────────────────────────

/** Gaussian PSD path as a filled SVG area */
function makePSD(freqMHz: number, bwMHz: number): string {
  const sigma = (bwMHz / 2.355) * 2.2;
  const f0 = Math.max(F_MIN, freqMHz - sigma * 4.5);
  const f1 = Math.min(F_MAX, freqMHz + sigma * 4.5);
  const N = 120;
  const bottom = PAD.t + IH;

  let path = `M${fx(f0).toFixed(1)},${bottom}`;
  for (let i = 0; i <= N; i++) {
    const f = f0 + (i / N) * (f1 - f0);
    const p = Math.exp(-0.5 * ((f - freqMHz) / sigma) ** 2);
    const y = PAD.t + IH - p * IH * 0.88;
    path += ` L${fx(f).toFixed(1)},${y.toFixed(1)}`;
  }
  path += ` L${fx(f1).toFixed(1)},${bottom} Z`;
  return path;
}

// Pre-compute paths (static)
const BAND_PATHS = FREQ_BANDS.map(b => makePSD(b.freq, b.width));

// ── Komponent ──────────────────────────────────────────────────────────────────

export function FrequencyPanel() {
  const [activeSystems, setActiveSystems] = useState<Set<GnssSystem>>(
    new Set(['gps', 'galileo', 'glonass', 'beidou'])
  );
  const [hoveredBand, setHoveredBand] = useState<string | null>(null);

  function toggleSystem(sys: GnssSystem) {
    setActiveSystems(prev => {
      const next = new Set(prev);
      if (next.has(sys)) { next.delete(sys); } else { next.add(sys); }
      return next;
    });
  }

  const hoveredInfo = FREQ_BANDS.find(b => b.name === hoveredBand) ?? null;

  // Bands sorted: non-hovered first, hovered last (on top)
  const sortedBands = useMemo(() => {
    return FREQ_BANDS.map((b, i) => ({ band: b, idx: i }))
      .filter(({ band }) => band.systems.some(s => activeSystems.has(s)))
      .sort((a, b) => a.band.name === hoveredBand ? 1 : b.band.name === hoveredBand ? -1 : 0);
  }, [activeSystems, hoveredBand]);

  return (
    <div className="space-y-4 font-mono">

      {/* ── Filtr konstelacji ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Konstelacje</div>
        <div className="flex gap-2 flex-wrap">
          {SYSTEMS.map(({ id, label, color }) => {
            const active = activeSystems.has(id);
            return (
              <button
                key={id}
                onClick={() => toggleSystem(id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
                style={active
                  ? { backgroundColor: color + '22', borderColor: color, color }
                  : { backgroundColor: 'transparent', borderColor: '#30363d', color: '#484f58' }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Spectrum ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">
          Widmo PSD — sygnały GNSS
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full block"
          style={{ height: H }}
          onMouseLeave={() => setHoveredBand(null)}
        >
          <defs>
            {FREQ_BANDS.map((band, i) => (
              <linearGradient key={band.name} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={band.color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={band.color} stopOpacity="0.12" />
              </linearGradient>
            ))}
          </defs>

          {/* Tło */}
          <rect width={W} height={H} fill="#0d1117" rx="6" />

          {/* Linie poziome siatki */}
          {[0.25, 0.5, 0.75, 1].map(p => {
            const y = PAD.t + IH - p * IH * 0.88;
            return (
              <line key={p}
                x1={PAD.l} y1={y} x2={PAD.l + IW} y2={y}
                stroke="#1c2333" strokeWidth="0.5"
              />
            );
          })}

          {/* Pionowe linie siatki + etykiety */}
          {TICK_FREQS.map(f => {
            const x = fx(f);
            const isMajor = f % 100 === 0;
            return (
              <g key={f}>
                <line x1={x} y1={PAD.t} x2={x} y2={PAD.t + IH}
                  stroke={isMajor ? '#21262d' : '#161b22'} strokeWidth={isMajor ? 0.8 : 0.4} />
                <text x={x} y={H - 6}
                  textAnchor="middle" fill={isMajor ? '#484f58' : '#2d333b'}
                  fontSize={isMajor ? 7.5 : 6.5} fontFamily="monospace">
                  {f}
                </text>
              </g>
            );
          })}

          {/* PSD fills */}
          {sortedBands.map(({ band, idx }) => {
            const isHovered = band.name === hoveredBand;
            return (
              <path
                key={band.name}
                d={BAND_PATHS[idx]}
                fill={`url(#g${idx})`}
                stroke={band.color}
                strokeWidth={isHovered ? 1.5 : 0.5}
                strokeOpacity={isHovered ? 1 : 0.6}
                opacity={isHovered ? 1 : 0.75}
                style={{ cursor: 'pointer', transition: 'opacity 0.15s, stroke-width 0.15s' }}
                onMouseEnter={() => setHoveredBand(band.name)}
              />
            );
          })}

          {/* Etykiety pasm (przy szczycie) */}
          {sortedBands.map(({ band }) => {
            const bw = band.width;
            if (bw < 12) return null;
            const isHovered = band.name === hoveredBand;
            const peakY = PAD.t + IH - IH * 0.88 - 10;
            return (
              <text
                key={`lbl-${band.name}`}
                x={fx(band.freq)} y={peakY}
                textAnchor="middle"
                fill={band.color}
                fontSize={isHovered ? 9 : 8}
                fontFamily="monospace"
                fontWeight={isHovered ? 'bold' : 'normal'}
                opacity={isHovered ? 1 : 0.7}
                style={{ pointerEvents: 'none', transition: 'opacity 0.15s' }}
              >
                {band.name}
              </text>
            );
          })}

          {/* Oś X */}
          <line x1={PAD.l} y1={PAD.t + IH} x2={PAD.l + IW} y2={PAD.t + IH}
            stroke="#30363d" strokeWidth="1" />

          {/* Podpis osi */}
          <text x={W / 2} y={H - 1}
            textAnchor="middle" fill="#484f58"
            fontSize={7.5} fontFamily="monospace">
            MHz
          </text>
        </svg>

        {/* Tooltip pod wykresem */}
        <div style={{ minHeight: 56 }}>
          {hoveredInfo ? (
            <div className="mt-3 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 transition-all">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="text-sm font-bold" style={{ color: hoveredInfo.color }}>
                  {hoveredInfo.name}
                </span>
                <span className="text-[#484f58] text-xs">{hoveredInfo.freq.toFixed(2)} MHz</span>
                <span className="text-[#30363d] text-xs">BW {hoveredInfo.width} MHz</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hoveredInfo.systems.map(s => (
                  <span key={s}
                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{ backgroundColor: GNSS_SYSTEMS[s]?.color + '22', color: GNSS_SYSTEMS[s]?.color }}>
                    {s.toUpperCase()}
                  </span>
                ))}
                <span className="text-[#6e7681] text-[10px] self-center ml-1">
                  {hoveredInfo.signals.join(' · ')}
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-[10px] text-[#30363d] text-center py-2">
              Najedź na pasmo aby zobaczyć szczegóły
            </div>
          )}
        </div>
      </div>

      {/* ── Tabela pasm ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">
          Szczegóły pasm
        </div>
        <div className="space-y-0">
          {FREQ_BANDS
            .filter(b => b.systems.some(s => activeSystems.has(s)))
            .map(band => (
            <div
              key={band.name}
              className="py-2 border-b border-[#1c2333] last:border-0 flex items-start gap-3"
              onMouseEnter={() => setHoveredBand(band.name)}
              onMouseLeave={() => setHoveredBand(null)}
              style={{ cursor: 'default' }}
            >
              <div className="w-12 flex-shrink-0">
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: band.color + '20', color: band.color }}
                >
                  {band.name}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[#8b949e] text-[11px]">{band.freq.toFixed(2)}</span>
                  <span className="text-[#30363d] text-[10px]">±{(band.width / 2).toFixed(0)} MHz</span>
                </div>
                <div className="text-[10px] text-[#484f58] leading-relaxed truncate">
                  {band.signals.join(' · ')}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                {band.systems.filter(s => activeSystems.has(s)).map(s => (
                  <span key={s}
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: GNSS_SYSTEMS[s]?.color }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
