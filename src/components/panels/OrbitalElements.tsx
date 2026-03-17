import { useMemo, useState } from 'react';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useUiStore } from '../../store/uiStore';
import { useTimeStore } from '../../store/timeStore';
import { useObserverStore } from '../../store/observerStore';
import { useIonoStore } from '../../store/ionoStore';
import { computeGPSPosition, orbitalPeriod } from '../../services/orbital/keplerMath';
import { klobucherDelay } from '../../services/orbital/ionosphere';
import type { KeplerianEphemeris } from '../../types/ephemeris';

const DEG = Math.PI / 180;

// ── SliderRow ─────────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color?: string;
  description?: string;
  descOpen?: boolean;
  onToggleDesc?: () => void;
}

function SliderRow({
  label, value, displayValue, min, max, step, onChange,
  color = '#58a6ff', description, descOpen, onToggleDesc,
}: SliderRowProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className="text-[#8b949e] text-xs font-mono">{label}</span>
          {description && (
            <button
              onClick={onToggleDesc}
              className="w-3.5 h-3.5 rounded-full border text-[8px] font-bold flex items-center justify-center flex-shrink-0 leading-none"
              style={{
                borderColor: descOpen ? '#58a6ff' : '#30363d',
                color: descOpen ? '#58a6ff' : '#6e7681',
              }}
            >?</button>
          )}
        </div>
        <span className="text-xs font-bold font-mono" style={{ color }}>{displayValue}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5"
        style={{ accentColor: color }}
      />
      {description && (
        <div style={{ maxHeight: descOpen ? '96px' : '0', overflow: 'hidden', transition: 'max-height 0.2s ease-out' }}>
          <div className="text-xs text-[#6e7681] mt-1.5 leading-relaxed">{description}</div>
        </div>
      )}
    </div>
  );
}

function SmallToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
    >
      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </div>
  );
}

// ── AlmanachChart ─────────────────────────────────────────────────────────────

const PAD = { t: 14, r: 14, b: 32, l: 52 };
const CHART_W = 320;
const CHART_H = 140;
const INNER_W = CHART_W - PAD.l - PAD.r;
const INNER_H = CHART_H - PAD.t - PAD.b;
const SVG_W_A = CHART_W + 2;

function segColor(dr: number): string {
  if (dr < 100) return '#3fb950';
  if (dr < 500) return '#f0883e';
  return '#f85149';
}

function AlmanachChart({
  data,
  periodH,
  currentTH,
}: {
  data: { tH: number; dr: number }[];
  periodH: number;
  currentTH: number;
}) {
  const [hover, setHover] = useState<{ tH: number; dr: number } | null>(null);

  const maxDr = Math.max(...data.map(p => p.dr));
  const avgDr = data.reduce((s, p) => s + p.dr, 0) / data.length;
  const yMax = maxDr < 1 ? 10 : Math.ceil(maxDr / 50) * 50;

  function toXY(tH: number, dr: number): [number, number] {
    return [
      PAD.l + (tH / periodH) * INNER_W,
      PAD.t + INNER_H - Math.min(dr / yMax, 1) * INNER_H,
    ];
  }

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.closest('svg')!.getBoundingClientRect();
    const scaleX = rect.width / SVG_W_A;
    const x = (e.clientX - rect.left) / scaleX;
    const tH = Math.max(0, Math.min(((x - PAD.l) / INNER_W) * periodH, periodH));
    const nearest = data.reduce((best, p) => Math.abs(p.tH - tH) < Math.abs(best.tH - tH) ? p : best);
    setHover(nearest);
  }

  const nowX = PAD.l + ((currentTH % periodH) / periodH) * INNER_W;
  const hoverX = hover ? PAD.l + (hover.tH / periodH) * INNER_W : 0;
  const hoverY = hover ? toXY(hover.tH, hover.dr)[1] : 0;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
      <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-2">
        ΔR: Ephemeris vs Almanach
      </div>
      <p className="text-xs text-[#6e7681] leading-relaxed mb-2">
        ΔR = różnica pozycji: efemerys (z korekcjami J₂/harmonicznymi) vs almanach
        (tylko orbita Keplera). Większe ΔR = almanach jest mniej dokładny.
      </p>
      <svg
        viewBox={`0 0 ${SVG_W_A} ${CHART_H}`}
        className="w-full"
        style={{ height: CHART_H }}
        onMouseLeave={() => setHover(null)}
      >
        {/* tło */}
        <rect width={SVG_W_A} height={CHART_H} fill="#0d1117" rx="4" />

        {/* linie siatki y=100m, y=500m */}
        {[100, 500].map(mark => {
          if (mark > yMax) return null;
          const y = PAD.t + INNER_H - (mark / yMax) * INNER_H;
          const label = mark === 100 ? 'dokł. 100m' : 'nawigacja';
          return (
            <g key={mark}>
              <line x1={PAD.l} y1={y} x2={PAD.l + INNER_W} y2={y} stroke="#21262d" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PAD.l - 3} y={y + 3} textAnchor="end" fill="#484f58" fontSize="9" fontFamily="monospace">
                {mark}
              </text>
              <text x={PAD.l + INNER_W} y={y - 2} textAnchor="end" fill="#30363d" fontSize="8" fontFamily="monospace">
                {label}
              </text>
            </g>
          );
        })}

        {/* oś Y — max */}
        <text x={PAD.l - 3} y={PAD.t + 4} textAnchor="end" fill="#484f58" fontSize="9" fontFamily="monospace">
          {yMax}
        </text>

        {/* oś X — etykiety czasowe */}
        {[0, Math.round(periodH / 2), Math.round(periodH)].map(h => {
          const x = PAD.l + (h / periodH) * INNER_W;
          return (
            <text key={h} x={x} y={CHART_H - 4} textAnchor="middle" fill="#484f58" fontSize="9" fontFamily="monospace">
              {h}h
            </text>
          );
        })}

        {/* segmenty wykresu */}
        {data.slice(0, -1).map((p, i) => {
          const [x1, y1] = toXY(p.tH, p.dr);
          const [x2, y2] = toXY(data[i + 1].tH, data[i + 1].dr);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={segColor(p.dr)} strokeWidth="1.5" strokeLinecap="round" />
          );
        })}

        {/* linia bazowa */}
        <line x1={PAD.l} y1={PAD.t + INNER_H} x2={PAD.l + INNER_W} y2={PAD.t + INNER_H} stroke="#21262d" strokeWidth="0.5" />

        {/* Marker "teraz" */}
        <line x1={nowX} y1={PAD.t} x2={nowX} y2={PAD.t + INNER_H} stroke="#58a6ff" strokeWidth="1" strokeOpacity="0.7" />
        <text x={nowX + 2} y={PAD.t + 6} fill="#58a6ff" fontSize="8" fontFamily="monospace">now</text>

        {/* Hover: linia + punkt + tooltip */}
        {hover && (
          <g>
            <line x1={hoverX} y1={PAD.t} x2={hoverX} y2={PAD.t + INNER_H}
              stroke="#c9d1d9" strokeWidth="0.8" strokeDasharray="2,2" />
            <circle cx={hoverX} cy={hoverY} r="3" fill={segColor(hover.dr)} />
            <rect
              x={hoverX + 4} y={hoverY - 14}
              width={60} height={16}
              fill="#161b22" stroke="#30363d" strokeWidth="0.5" rx="2"
            />
            <text x={hoverX + 8} y={hoverY - 5} fill="#c9d1d9" fontSize="9" fontFamily="monospace">
              {`t=${hover.tH.toFixed(1)}h ΔR=${hover.dr.toFixed(0)}m`}
            </text>
          </g>
        )}

        {/* Overlay do śledzenia myszki */}
        <rect
          x={PAD.l} y={PAD.t}
          width={INNER_W} height={INNER_H}
          fill="transparent"
          onMouseMove={handleMouseMove}
        />
      </svg>

      {/* Statystyki */}
      <div className="flex justify-between mt-1.5 text-xs font-mono">
        <span>
          <span className="text-[#484f58]">max </span>
          <span style={{ color: segColor(maxDr) }} className="font-bold">{maxDr.toFixed(0)} m</span>
        </span>
        <span>
          <span className="text-[#484f58]">avg </span>
          <span style={{ color: segColor(avgDr) }} className="font-bold">{avgDr.toFixed(0)} m</span>
        </span>
        <span className="text-[#484f58]">T={periodH.toFixed(1)} h</span>
      </div>

      {/* Sekcja "Co to jest?" */}
      <details className="mt-2">
        <summary className="text-xs text-[#6e7681] cursor-pointer hover:text-[#8b949e] select-none">
          Co to jest?
        </summary>
        <div className="mt-1.5 text-xs text-[#6e7681] leading-relaxed space-y-1">
          <p><span className="text-[#8b949e]">Ephemeris:</span> nadawany co ~2h, ważny ~4h. Zawiera korekcje harmoniczne (J₂, rezonanse).</p>
          <p><span className="text-[#8b949e]">Almanach:</span> grubsza wersja, ważna ~tygodnie. Używana do pierwszego przybliżenia orbit.</p>
          <p><span className="text-[#3fb950]">150m:</span> typowy błąd GPS gdy używa się almanaczu zamiast efemerydy po ~kilku godzinach.</p>
        </div>
      </details>
    </div>
  );
}

// ── PerturbationImpactChart ───────────────────────────────────────────────────

const POLAR_SIZE = 260;
const POLAR_CX = 130, POLAR_CY = 130;
const POLAR_R = 80;
const POLAR_SCALE = 200; // ±200m → ±20px

interface PerturbProps {
  Crc: number; Crs: number;
  Cuc: number; Cus: number;
  Cic: number; Cis: number;
  a: number;   i0: number;
}

function PerturbationImpactChart({ Crc, Crs, Cuc, Cus, Cic, Cis, a, i0 }: PerturbProps) {
  const paths = useMemo(() => {
    const N = 72;
    const pts = Array.from({ length: N + 1 }, (_, idx) => {
      const phi = (idx / N) * 2 * Math.PI;
      const phi2 = 2 * phi;
      const dr   = Crs * Math.sin(phi2) + Crc * Math.cos(phi2);
      const du_m = a * (Cus * Math.sin(phi2) + Cuc * Math.cos(phi2));
      const di_m = a * i0 * (Cis * Math.sin(phi2) + Cic * Math.cos(phi2));
      return { phi, dr, du_m, di_m };
    });

    function toPath(vals: number[]): string {
      return vals.map((v, i) => {
        const r = POLAR_R + Math.max(-POLAR_R * 0.9, Math.min(POLAR_R * 0.9, (v / POLAR_SCALE) * 20));
        const x = POLAR_CX + r * Math.cos(pts[i].phi - Math.PI / 2);
        const y = POLAR_CY + r * Math.sin(pts[i].phi - Math.PI / 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ') + ' Z';
    }

    return {
      dr:   toPath(pts.map(p => p.dr)),
      du:   toPath(pts.map(p => p.du_m)),
      di:   toPath(pts.map(p => p.di_m)),
    };
  }, [Crc, Crs, Cuc, Cus, Cic, Cis, a, i0]);

  return (
    <div className="mt-3">
      <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-2">
        Wykres perturbacji [m vs φ]
      </div>
      <div className="flex items-start gap-3">
        <svg width={POLAR_SIZE} height={POLAR_SIZE} className="flex-shrink-0">
          <rect width={POLAR_SIZE} height={POLAR_SIZE} fill="#0d1117" rx="4" />
          {/* Koła referencyjne */}
          {[POLAR_R * 0.5, POLAR_R, POLAR_R * 1.3].map((r, i) => (
            <circle key={i} cx={POLAR_CX} cy={POLAR_CY} r={r} stroke="#21262d" fill="none" strokeDasharray={i === 1 ? '3,3' : '1,4'} />
          ))}
          {/* Osie */}
          <line x1={POLAR_CX} y1={POLAR_CY - POLAR_R - 12} x2={POLAR_CX} y2={POLAR_CY + POLAR_R + 12} stroke="#21262d" strokeWidth="0.5" />
          <line x1={POLAR_CX - POLAR_R - 12} y1={POLAR_CY} x2={POLAR_CX + POLAR_R + 12} y2={POLAR_CY} stroke="#21262d" strokeWidth="0.5" />
          {/* Etykieta φ=0° */}
          <text x={POLAR_CX + 3} y={POLAR_CY - POLAR_R - 4} fill="#484f58" fontSize="10" fontFamily="monospace">φ=0°</text>
          {/* Krzywe perturbacji */}
          <path d={paths.dr} stroke="#3fb950" fill="none" strokeWidth="1.5" />
          <path d={paths.du} stroke="#f0883e" fill="none" strokeWidth="1.5" />
          <path d={paths.di} stroke="#a371f7" fill="none" strokeWidth="1.5" />
        </svg>
        <div className="text-xs font-mono space-y-2">
          <div><span style={{ color: '#3fb950' }}>■</span> <span className="text-[#6e7681]">Δr (promień)</span></div>
          <div><span style={{ color: '#f0883e' }}>■</span> <span className="text-[#6e7681]">Δu (arg. szer.)</span></div>
          <div><span style={{ color: '#a371f7' }}>■</span> <span className="text-[#6e7681]">Δi (inklinacja)</span></div>
          <div className="text-xs text-[#484f58] leading-relaxed mt-2">
            Odchylenie od koła = amplituda perturbacji. Skala: ±200m→±{(20).toFixed(0)}px
          </div>
        </div>
      </div>
    </div>
  );
}

// ── OrbitalElements ───────────────────────────────────────────────────────────

const DESCRIPTIONS: Partial<Record<keyof KeplerianEphemeris, string>> = {
  OmegaDot: 'Precesja węzła wstępującego wywołana spłaszczeniem Ziemi (J₂). Dla GPS: ~−8.5 nrad/s → płaszczyzna orbity przesuwa się o ~−0.04°/dobę. Nieuwzględniona: błąd pozycji rośnie z tygodniami.',
  dn: 'Poprawka ruchu średniego względem wartości Keplera n₀=√(μ/a³). Wynika z rezerwacji orbitalnych i perturbacji. dn>0 → satelita "przyspiesza" względem czystej elipsy.',
  IDOT: 'Prędkość zmiany inklinacji płaszczyzny orbity [rad/s]. Wartości ~prad/s. Bez tej korekty błąd rośnie proporcjonalnie do czasu od epoki.',
  Crc: 'Amplitudy korekcji promienia orbity [m] proporcjonalne do cos(2φ). Δr = Crs·sin(2φ) + Crc·cos(2φ). Powodują lekkie "owalenie" orbity.',
  Crs: 'Amplitudy korekcji promienia orbity [m] proporcjonalne do sin(2φ). Δr = Crs·sin(2φ) + Crc·cos(2φ). Powodują lekkie "owalenie" orbity.',
  Cuc: 'Korekcja argumentu szerokości [μrad]. Δu = Cus·sin(2φ) + Cuc·cos(2φ). Przesuwa satelitę "wzdłuż" toru.',
  Cus: 'Korekcja argumentu szerokości [μrad]. Δu = Cus·sin(2φ) + Cuc·cos(2φ). Przesuwa satelitę "wzdłuż" toru.',
  Cic: 'Korekcja inklinacji [μrad]. Δi = Cis·sin(2φ) + Cic·cos(2φ). Lekkie "kiwnięcie" płaszczyzny orbity — najtrudniejsze do zauważenia.',
  Cis: 'Korekcja inklinacji [μrad]. Δi = Cis·sin(2φ) + Cic·cos(2φ). Lekkie "kiwnięcie" płaszczyzny orbity — najtrudniejsze do zauważenia.',
};

export function OrbitalElements() {
  const { singleEph, setSingleEph } = useSatelliteStore();
  const { showHarmonics, setShowHarmonics } = useUiStore();
  const { timeHours } = useTimeStore();
  const { lat: obsLat, lon: obsLon } = useObserverStore();
  const { enabled, alpha, beta, setEnabled, setAlpha, setBeta } = useIonoStore();

  const [openDesc, setOpenDesc] = useState<string | null>(null);

  const timeSec = timeHours * 3600;

  function update(key: keyof KeplerianEphemeris, raw: number) {
    setSingleEph({ ...singleEph, [key]: raw });
  }

  function toggleDesc(key: string) {
    setOpenDesc(prev => prev === key ? null : key);
  }

  // ΔR(t) — błąd almanach vs efemerys przez jeden okres orbitalny
  const almanachError = useMemo(() => {
    const T = orbitalPeriod(singleEph.a);
    const steps = 48;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = (i / steps) * T;
      const posH = computeGPSPosition(singleEph, t, false, true);
      const posN = computeGPSPosition(singleEph, t, false, false);
      const dr = Math.sqrt(
        (posH.x - posN.x) ** 2 + (posH.y - posN.y) ** 2 + (posH.z - posN.z) ** 2,
      );
      return { tH: t / 3600, dr };
    });
  }, [singleEph]);

  // ΔR — różnica pozycji z/bez korekcji harmonicznych
  const deltaM = useMemo(() => {
    const posH = computeGPSPosition(singleEph, timeSec, false, true);
    const posN = computeGPSPosition(singleEph, timeSec, false, false);
    return Math.sqrt(
      (posH.x - posN.x) ** 2 +
      (posH.y - posN.y) ** 2 +
      (posH.z - posN.z) ** 2
    );
  }, [singleEph, timeSec]);

  // Parametry Klobuchar z ionoStore
  const params = useMemo(() => ({
    a0: alpha[0], a1: alpha[1], a2: alpha[2], a3: alpha[3],
    b0: beta[0],  b1: beta[1],  b2: beta[2],  b3: beta[3],
  }), [alpha, beta]);

  const gpsSec = timeSec % 604800;

  const zenithDelay = useMemo(
    () => klobucherDelay(90, obsLat, obsLon, 0, gpsSec, params),
    [obsLat, obsLon, gpsSec, params],
  );

  const delayAtEl = (el: number) => klobucherDelay(el, obsLat, obsLon, 0, gpsSec, params);

  const periodH = orbitalPeriod(singleEph.a) / 3600;
  const currentTH = timeHours % periodH;

  return (
    <div className="space-y-4 font-mono">

      {/* ── Tryb efemerydy ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-3">Tryb efemerydy</div>
        <div className="flex gap-2 mb-3">
          {([false, true] as const).map(isEph => (
            <button
              key={String(isEph)}
              onClick={() => setShowHarmonics(isEph)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                showHarmonics === isEph
                  ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                  : 'border-[#30363d] text-[#6e7681] hover:border-[#58a6ff] hover:text-[#58a6ff]'
              }`}
            >
              {isEph ? 'Efemeryda' : 'Almanach'}
            </button>
          ))}
        </div>
        <div className={`text-xs rounded-lg px-3 py-2 ${
          showHarmonics
            ? 'bg-[#0d2a1a] text-[#3fb950]'
            : 'bg-[#2d1f02] text-[#f0883e]'
        }`}>
          {showHarmonics
            ? 'Efemeryda — pełna korekcja harmoniczna (IS-GPS-200)'
            : 'Almanach — tylko orbita Keplera, brak korekcji'}
        </div>

        {/* ΔR wskaźnik */}
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#6e7681]">Korekcja J₂: ΔR</span>
            <span className="text-[#58a6ff] font-bold font-mono">{deltaM.toFixed(0)} m</span>
          </div>
          <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1f6feb] rounded-full transition-all"
              style={{ width: `${Math.min(deltaM / 200 * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Elementy orbitalne ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-3">
          Elementy orbitalne
        </div>
        <SliderRow
          label="Półoś wielka  a"
          value={singleEph.a / 1e6}
          displayValue={`${(singleEph.a / 1e6).toFixed(2)} Mm`}
          min={10} max={45} step={0.01}
          onChange={v => update('a', v * 1e6)}
          color="#58a6ff"
        />
        <SliderRow
          label="Mimośród  e"
          value={singleEph.e}
          displayValue={singleEph.e.toFixed(4)}
          min={0} max={0.3} step={0.0001}
          onChange={v => update('e', v)}
          color="#58a6ff"
        />
        <SliderRow
          label="Inklinacja  i₀"
          value={singleEph.i0 / DEG}
          displayValue={`${(singleEph.i0 / DEG).toFixed(1)}°`}
          min={0} max={90} step={0.1}
          onChange={v => update('i0', v * DEG)}
          color="#58a6ff"
        />
        <SliderRow
          label="RAAN  Ω₀"
          value={singleEph.Omega0 / DEG}
          displayValue={`${(singleEph.Omega0 / DEG).toFixed(1)}°`}
          min={-180} max={180} step={1}
          onChange={v => update('Omega0', v * DEG)}
          color="#58a6ff"
        />
        <SliderRow
          label="Arg. perygeum  ω"
          value={singleEph.omega / DEG}
          displayValue={`${(singleEph.omega / DEG).toFixed(1)}°`}
          min={-180} max={180} step={1}
          onChange={v => update('omega', v * DEG)}
          color="#58a6ff"
        />
        <SliderRow
          label="Anomalia średnia  M₀"
          value={singleEph.M0 / DEG}
          displayValue={`${(singleEph.M0 / DEG).toFixed(1)}°`}
          min={-180} max={180} step={1}
          onChange={v => update('M0', v * DEG)}
          color="#58a6ff"
        />

        {showHarmonics && (
          <>
            <div className="border-t border-[#21262d] my-3" />
            <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-3">Dryft orbitalny</div>
            <SliderRow
              label="Dryft RAAN  dΩ/dt"
              value={singleEph.OmegaDot * 1e9}
              displayValue={`${(singleEph.OmegaDot * 1e9).toFixed(2)} nrad/s`}
              min={-20} max={0} step={0.01}
              onChange={v => update('OmegaDot', v * 1e-9)}
              color="#58a6ff"
              description={DESCRIPTIONS.OmegaDot}
              descOpen={openDesc === 'OmegaDot'}
              onToggleDesc={() => toggleDesc('OmegaDot')}
            />
            <SliderRow
              label="Korekcja n  dn"
              value={singleEph.dn * 1e9}
              displayValue={`${(singleEph.dn * 1e9).toFixed(2)} nrad/s`}
              min={-20} max={20} step={0.01}
              onChange={v => update('dn', v * 1e-9)}
              color="#58a6ff"
              description={DESCRIPTIONS.dn}
              descOpen={openDesc === 'dn'}
              onToggleDesc={() => toggleDesc('dn')}
            />
            <SliderRow
              label="Dryft inkl.  IDOT"
              value={singleEph.IDOT * 1e12}
              displayValue={`${(singleEph.IDOT * 1e12).toFixed(1)} prad/s`}
              min={-500} max={500} step={0.1}
              onChange={v => update('IDOT', v * 1e-12)}
              color="#58a6ff"
              description={DESCRIPTIONS.IDOT}
              descOpen={openDesc === 'IDOT'}
              onToggleDesc={() => toggleDesc('IDOT')}
            />

            <div className="border-t border-[#21262d] my-3" />
            <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-3">Perturbacje sferyczne</div>
            <SliderRow
              label="Crc (promień cos)"
              value={singleEph.Crc}
              displayValue={`${singleEph.Crc.toFixed(1)} m`}
              min={-200} max={200} step={0.1}
              onChange={v => update('Crc', v)}
              color="#58a6ff"
              description={DESCRIPTIONS.Crc}
              descOpen={openDesc === 'Crc'}
              onToggleDesc={() => toggleDesc('Crc')}
            />
            <SliderRow
              label="Crs (promień sin)"
              value={singleEph.Crs}
              displayValue={`${singleEph.Crs.toFixed(1)} m`}
              min={-200} max={200} step={0.1}
              onChange={v => update('Crs', v)}
              color="#58a6ff"
              description={DESCRIPTIONS.Crs}
              descOpen={openDesc === 'Crs'}
              onToggleDesc={() => toggleDesc('Crs')}
            />
            <SliderRow
              label="Cuc (arg. szer. cos)"
              value={singleEph.Cuc * 1e6}
              displayValue={`${(singleEph.Cuc * 1e6).toFixed(3)} μrad`}
              min={-10} max={10} step={0.001}
              onChange={v => update('Cuc', v * 1e-6)}
              color="#58a6ff"
              description={DESCRIPTIONS.Cuc}
              descOpen={openDesc === 'Cuc'}
              onToggleDesc={() => toggleDesc('Cuc')}
            />
            <SliderRow
              label="Cus (arg. szer. sin)"
              value={singleEph.Cus * 1e6}
              displayValue={`${(singleEph.Cus * 1e6).toFixed(3)} μrad`}
              min={-10} max={10} step={0.001}
              onChange={v => update('Cus', v * 1e-6)}
              color="#58a6ff"
              description={DESCRIPTIONS.Cus}
              descOpen={openDesc === 'Cus'}
              onToggleDesc={() => toggleDesc('Cus')}
            />
            <SliderRow
              label="Cic (inkl. cos)"
              value={singleEph.Cic * 1e6}
              displayValue={`${(singleEph.Cic * 1e6).toFixed(3)} μrad`}
              min={-1} max={1} step={0.0001}
              onChange={v => update('Cic', v * 1e-6)}
              color="#58a6ff"
              description={DESCRIPTIONS.Cic}
              descOpen={openDesc === 'Cic'}
              onToggleDesc={() => toggleDesc('Cic')}
            />
            <SliderRow
              label="Cis (inkl. sin)"
              value={singleEph.Cis * 1e6}
              displayValue={`${(singleEph.Cis * 1e6).toFixed(3)} μrad`}
              min={-1} max={1} step={0.0001}
              onChange={v => update('Cis', v * 1e-6)}
              color="#58a6ff"
              description={DESCRIPTIONS.Cis}
              descOpen={openDesc === 'Cis'}
              onToggleDesc={() => toggleDesc('Cis')}
            />

            <PerturbationImpactChart
              Crc={singleEph.Crc} Crs={singleEph.Crs}
              Cuc={singleEph.Cuc} Cus={singleEph.Cus}
              Cic={singleEph.Cic} Cis={singleEph.Cis}
              a={singleEph.a}     i0={singleEph.i0}
            />

            <div className="border-t border-[#21262d] my-3" />
            <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-3">Epoka</div>
            <SliderRow
              label="t₀e (epoka efemerydy)"
              value={singleEph.toe / 3600}
              displayValue={`${(singleEph.toe / 3600).toFixed(1)} h`}
              min={0} max={168} step={0.5}
              onChange={v => update('toe', v * 3600)}
              color="#484f58"
            />
          </>
        )}
      </div>

      {/* ── ΔR: efemerys vs almanach ── */}
      <AlmanachChart
        data={almanachError}
        periodH={periodH}
        currentTH={currentTH}
      />

      {/* ── Jonosfera Klobuchar ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[#6e7681] text-xs uppercase tracking-widest">Jonosfera Klobuchar</div>
          <SmallToggle value={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <>
            {/* Wskaźnik opóźnienia */}
            <div className="bg-[#0d1117] rounded-lg p-3 mb-3 text-center">
              <div className="text-[#6e7681] text-[10px] mb-1">Opóźnienie L1 (zenit)</div>
              <div className="text-[#a371f7] text-lg font-bold font-mono">{zenithDelay.toFixed(1)} m</div>
              <div className="grid grid-cols-5 gap-1 mt-2 text-xs">
                {[5, 15, 30, 60, 90].map(el => (
                  <div key={el}>
                    <div className="text-[#484f58]">{el}°</div>
                    <div className="text-[#c9d1d9] font-mono">{delayAtEl(el).toFixed(1)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parametry α */}
            <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-2">α (amplituda)</div>
            {([0, 1, 2, 3] as const).map(i => (
              <SliderRow
                key={`a${i}`}
                label={`α${i}`}
                value={alpha[i]}
                min={-1.2e-7} max={1.2e-7} step={1e-9}
                displayValue={`${(alpha[i] * 1e9).toFixed(1)} ns`}
                onChange={v => setAlpha(i, v)}
                color="#58a6ff"
              />
            ))}

            {/* Parametry β */}
            <div className="text-[#6e7681] text-xs uppercase tracking-widest mb-2 mt-3">β (okres)</div>
            {([0, 1, 2, 3] as const).map(i => (
              <SliderRow
                key={`b${i}`}
                label={`β${i}`}
                value={beta[i]}
                min={0} max={3e5} step={1e3}
                displayValue={`${(beta[i] / 1000).toFixed(0)} ks`}
                onChange={v => setBeta(i, v)}
                color="#58a6ff"
              />
            ))}
          </>
        )}
      </div>

    </div>
  );
}
