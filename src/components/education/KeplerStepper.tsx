import { useState, useRef, useEffect } from 'react';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useTimeStore } from '../../store/timeStore';

const DEG = Math.PI / 180;

const SLIDE_STYLE = `
@keyframes stepSlideR { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:translateX(0); } }
@keyframes stepSlideL { from { opacity:0; transform:translateX(-14px); } to { opacity:1; transform:translateX(0); } }
`;

// ── SVG Diagramy ────────────────────────────────────────────────────────────

const D = { bg: '#0d1117', grid: '#21262d', axis: '#30363d', dim: '#484f58', blue: '#58a6ff', purple: '#a371f7', green: '#3fb950', orange: '#f0883e', yellow: '#f7c948' };

function DiagramStep1() {
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <line x1="20" y1="76" x2="180" y2="76" stroke={D.axis} strokeWidth="1.5" />
      <line x1="20" y1="66" x2="20" y2="86" stroke={D.dim} strokeWidth="1" />
      <text x="20" y="56" textAnchor="middle" fill={D.dim} fontSize="8" fontFamily="monospace">0</text>
      <line x1="80" y1="60" x2="80" y2="92" stroke={D.orange} strokeWidth="1.5" />
      <text x="80" y="44" textAnchor="middle" fill={D.orange} fontSize="8.5" fontFamily="monospace" fontWeight="bold">toe</text>
      <line x1="155" y1="60" x2="155" y2="92" stroke={D.blue} strokeWidth="1.5" />
      <text x="155" y="44" textAnchor="middle" fill={D.blue} fontSize="8.5" fontFamily="monospace" fontWeight="bold">t</text>
      <path d="M80,104 L155,104" stroke={D.green} strokeWidth="1.5" fill="none" />
      <path d="M80,98 L80,110 M155,98 L155,110" stroke={D.green} strokeWidth="1" fill="none" />
      <text x="117" y="132" textAnchor="middle" fill={D.green} fontSize="9" fontFamily="monospace" fontWeight="bold">tk = t − toe</text>
    </svg>
  );
}

function DiagramStep2() {
  const cx = 80, cy = 80, r = 28;
  const mDeg = 55;
  const px = cx + r * Math.cos(-mDeg * DEG);
  const py = cy + r * Math.sin(-mDeg * DEG);
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <circle cx={cx} cy={cy} r={r} stroke={D.grid} fill="none" />
      <circle cx={cx} cy={cy} r="2" fill={D.dim} />
      <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke={D.dim} strokeWidth="0.5" strokeDasharray="2,2" />
      <path d={`M${cx + r},${cy} A${r},${r} 0 0,0 ${px.toFixed(1)},${py.toFixed(1)}`} stroke={D.purple} strokeWidth="1.5" fill="none" />
      <text x={cx + r + 8} y={cy - 12} fill={D.purple} fontSize="9" fontFamily="monospace" fontWeight="bold">M</text>
      <circle cx={px} cy={py} r="4" fill={D.yellow} />
      <line x1={cx} y1={cy} x2={px} y2={py} stroke={D.yellow} strokeWidth="1" strokeOpacity="0.6" />
      <text x="135" y="40" fill={D.blue} fontSize="8" fontFamily="monospace">M = M₀ + n·tk</text>
      <text x="135" y="64" fill={D.dim} fontSize="8" fontFamily="monospace">n = √(μ/a³)</text>
      <text x="135" y="100" fill={D.orange} fontSize="8" fontFamily="monospace">ruch jednostajny</text>
      <text x="135" y="124" fill={D.orange} fontSize="8" fontFamily="monospace">(przybliżenie)</text>
    </svg>
  );
}

function DiagramStep3() {
  const cx = 75, cy = 84, rx = 55, ry = 60, ryOrig = 30;
  const foci = cx + Math.sqrt(rx * rx - ryOrig * ryOrig) * 0.5;
  const eDeg = 50;
  const px = cx + rx * Math.cos(-eDeg * DEG);
  const py = cy + ry * Math.sin(-eDeg * DEG);
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={D.grid} fill="none" />
      <circle cx={foci} cy={cy} r="2.5" fill={D.orange} />
      <line x1={cx} y1={cy} x2={px} y2={py} stroke={D.purple} strokeWidth="1.2" />
      <text x={cx + 8} y={cy - 12} fill={D.purple} fontSize="8" fontFamily="monospace">E</text>
      <circle cx={px} cy={py} r="4" fill={D.yellow} />
      <text x="148" y="44" fill={D.blue} fontSize="8" fontFamily="monospace">E − e·sinE = M</text>
      <text x="148" y="76" fill={D.green} fontSize="8" fontFamily="monospace">iteracja:</text>
      <text x="148" y="100" fill={D.green} fontSize="8" fontFamily="monospace">Eₙ₊₁ = Eₙ +</text>
      <text x="148" y="124" fill={D.green} fontSize="8" fontFamily="monospace">(M−Eₙ+e·sinEₙ)</text>
      <text x="148" y="148" fill={D.green} fontSize="8" fontFamily="monospace">/(1−e·cosEₙ)</text>
    </svg>
  );
}

function DiagramStep4() {
  const cx = 75, cy = 84, rx = 52, ry = 60, ryOrig = 30;
  const foci = cx + Math.sqrt(rx * rx - ryOrig * ryOrig) * 0.5;
  const eDeg = 50;
  const px = cx + rx * Math.cos(-eDeg * DEG);
  const py = cy + ry * Math.sin(-eDeg * DEG);
  const nuDeg = 68;
  const pnx = foci + 44 * Math.cos(-nuDeg * DEG);
  const pny = cy + 88 * Math.sin(-nuDeg * DEG);
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={D.grid} fill="none" />
      <circle cx={foci} cy={cy} r="2.5" fill={D.orange} />
      <line x1={cx} y1={cy} x2={px} y2={py} stroke={D.purple} strokeWidth="1.2" strokeDasharray="3,2" />
      <text x={cx + 8} y={cy - 8} fill={D.purple} fontSize="8" fontFamily="monospace">E</text>
      <line x1={foci} y1={cy} x2={pnx} y2={pny} stroke={D.blue} strokeWidth="1.5" />
      <text x={foci + 8} y={cy - 20} fill={D.blue} fontSize="8" fontFamily="monospace">ν</text>
      <circle cx={px} cy={py} r="4" fill={D.yellow} />
      <text x="148" y="40" fill={D.dim} fontSize="8" fontFamily="monospace">M ≠ ν</text>
      <text x="148" y="70" fill={D.blue} fontSize="8" fontFamily="monospace">ν = atan2(</text>
      <text x="148" y="94" fill={D.blue} fontSize="8" fontFamily="monospace">√(1−e²)sinE,</text>
      <text x="148" y="118" fill={D.blue} fontSize="8" fontFamily="monospace">cosE − e)</text>
      <text x="148" y="148" fill={D.orange} fontSize="8" fontFamily="monospace">ognisko F</text>
    </svg>
  );
}

function DiagramStep5() {
  const cx = 75, cy = 84, rx = 52, ry = 60, ryOrig = 30;
  const foci = cx + Math.sqrt(rx * rx - ryOrig * ryOrig) * 0.5;
  const omegaDeg = 30;
  const nuDeg = 65;
  const phiDeg = omegaDeg + nuDeg;
  const asc = { x: cx - rx, y: cy };
  const omegaP = { x: foci + 46 * Math.cos(-omegaDeg * DEG), y: cy + 92 * Math.sin(-omegaDeg * DEG) };
  const phiP = { x: foci + 42 * Math.cos(-phiDeg * DEG), y: cy + 84 * Math.sin(-phiDeg * DEG) };
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={D.grid} fill="none" />
      <circle cx={foci} cy={cy} r="2.5" fill={D.orange} />
      <line x1={foci} y1={cy} x2={asc.x} y2={asc.y} stroke={D.dim} strokeWidth="1" strokeDasharray="3,2" />
      <text x={asc.x - 12} y={asc.y + 8} fill={D.dim} fontSize="7" fontFamily="monospace">węzeł</text>
      <line x1={foci} y1={cy} x2={omegaP.x} y2={omegaP.y} stroke={D.orange} strokeWidth="1.2" />
      <text x={omegaP.x + 3} y={omegaP.y - 6} fill={D.orange} fontSize="8" fontFamily="monospace">ω</text>
      <line x1={foci} y1={cy} x2={phiP.x} y2={phiP.y} stroke={D.blue} strokeWidth="1.5" />
      <circle cx={phiP.x} cy={phiP.y} r="4" fill={D.yellow} />
      <text x="148" y="44" fill={D.blue} fontSize="8" fontFamily="monospace">φ = ν + ω</text>
      <text x="148" y="76" fill={D.orange} fontSize="8" fontFamily="monospace">ω: perygeum</text>
      <text x="148" y="100" fill={D.orange} fontSize="8" fontFamily="monospace">od węzła wst.</text>
      <text x="148" y="132" fill={D.green} fontSize="8" fontFamily="monospace">φ: pozycja</text>
      <text x="148" y="156" fill={D.green} fontSize="8" fontFamily="monospace">od węzła</text>
    </svg>
  );
}

function DiagramStep6() {
  const cx = 75, cy = 84, rx = 52, ry = 60, ryOrig = 30;
  const foci = cx + Math.sqrt(rx * rx - ryOrig * ryOrig) * 0.5;
  const uDeg = 60;
  const px = cx + rx * Math.cos(-uDeg * DEG) * 0.98;
  const py = cy + ry * Math.sin(-uDeg * DEG) * 0.98;
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={D.grid} fill="none" />
      <circle cx={foci} cy={cy} r="2.5" fill={D.orange} />
      <line x1={foci} y1={cy} x2={px} y2={py} stroke={D.green} strokeWidth="1.8" />
      <text x={(foci + px) / 2 + 4} y={(cy + py) / 2 - 8} fill={D.green} fontSize="9" fontFamily="monospace" fontWeight="bold">r</text>
      <circle cx={cx - rx} cy={cy} r="4" fill={D.blue} />
      <text x={cx - rx - 3} y={cy - 16} fill={D.blue} fontSize="7" fontFamily="monospace">perygeum</text>
      <circle cx={cx + rx} cy={cy} r="4" fill={D.dim} />
      <text x={cx + rx - 10} y={cy + 28} fill={D.dim} fontSize="7" fontFamily="monospace">apogeum</text>
      <circle cx={px} cy={py} r="4" fill={D.yellow} />
      <text x="148" y="44" fill={D.green} fontSize="8" fontFamily="monospace">r = a(1−e·cosE)</text>
      <text x="148" y="72" fill={D.dim} fontSize="8" fontFamily="monospace">+ Δr (J₂)</text>
      <text x="148" y="112" fill={D.blue} fontSize="8" fontFamily="monospace">r_min = a(1−e)</text>
      <text x="148" y="140" fill={D.dim} fontSize="8" fontFamily="monospace">r_max = a(1+e)</text>
    </svg>
  );
}

function DiagramStep7() {
  const cx = 75, cy = 84, rx = 52, ry = 64;
  const uDeg = 55;
  const px = cx + rx * Math.cos(-uDeg * DEG);
  const py = cy + ry * Math.sin(-uDeg * DEG);
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={D.grid} fill="none" />
      <line x1={cx - rx - 5} y1={cy} x2={cx + rx + 10} y2={cy} stroke={D.orange} strokeWidth="1" />
      <text x={cx + rx + 12} y={cy + 8} fill={D.orange} fontSize="8" fontFamily="monospace">x'</text>
      <line x1={cx} y1={cy + ry + 5} x2={cx} y2={cy - ry - 5} stroke={D.green} strokeWidth="1" />
      <text x={cx + 4} y={cy - ry - 14} fill={D.green} fontSize="8" fontFamily="monospace">y'</text>
      <circle cx={cx} cy={cy} r="2" fill={D.dim} />
      <line x1={cx} y1={cy} x2={px} y2={py} stroke={D.dim} strokeWidth="0.8" strokeDasharray="2,2" />
      <line x1={px} y1={cy} x2={px} y2={py} stroke={D.orange} strokeWidth="1" strokeDasharray="2,2" />
      <line x1={cx} y1={py} x2={px} y2={py} stroke={D.green} strokeWidth="1" strokeDasharray="2,2" />
      <circle cx={px} cy={py} r="4" fill={D.yellow} />
      <text x="148" y="44" fill={D.orange} fontSize="8" fontFamily="monospace">x' = r·cos(u)</text>
      <text x="148" y="72" fill={D.green} fontSize="8" fontFamily="monospace">y' = r·sin(u)</text>
      <text x="148" y="112" fill={D.dim} fontSize="8" fontFamily="monospace">u = φ + Δu</text>
      <text x="148" y="140" fill={D.dim} fontSize="7" fontFamily="monospace">płaszcz. orbity</text>
    </svg>
  );
}

function DiagramStep8() {
  const cx = 90, cy = 88;
  const r = 34;
  const omegaDeg = 40;
  const ox = cx + r * Math.cos(omegaDeg * DEG);
  const oy = cy - r * Math.sin(omegaDeg * DEG);
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.7} stroke={D.dim} fill="none" strokeDasharray="4,2" />
      <circle cx={cx} cy={cy} r={r} stroke={D.grid} fill="none" />
      <line x1={cx - r - 5} y1={cy} x2={cx + r + 10} y2={cy} stroke={D.dim} strokeWidth="1" />
      <text x={cx + r + 12} y={cy + 8} fill={D.dim} fontSize="7" fontFamily="monospace">X_ECEF</text>
      <line x1={cx} y1={cy + r + 5} x2={cx} y2={cy - r - 5} stroke={D.dim} strokeWidth="1" />
      <text x={cx + 3} y={cy - r - 14} fill={D.dim} fontSize="7" fontFamily="monospace">Y_ECEF</text>
      <path d={`M${cx + r},${cy} A${r},${r * 2} 0 0,0 ${ox.toFixed(1)},${oy.toFixed(1)}`} stroke={D.purple} strokeWidth="1.5" fill="none" />
      <text x={cx + r + 4} y={cy - 24} fill={D.purple} fontSize="9" fontFamily="monospace" fontWeight="bold">Ω</text>
      <line x1={cx} y1={cy} x2={ox} y2={oy} stroke={D.blue} strokeWidth="1.5" />
      <circle cx={ox} cy={oy} r="3.5" fill={D.blue} />
      <text x={ox + 5} y={oy - 4} fill={D.blue} fontSize="7" fontFamily="monospace">węzeł ↑</text>
      <text x="150" y="50" fill={D.purple} fontSize="7" fontFamily="monospace">Ω=Ω₀+(Ω̇−ωₑ)tk</text>
      <text x="150" y="74" fill={D.orange} fontSize="7" fontFamily="monospace">− ωₑ·toe</text>
    </svg>
  );
}

function DiagramStep9() {
  const cx = 75, cy = 90;
  return (
    <svg viewBox="0 0 200 160" className="w-full" style={{ height: 160 }}>
      <rect width="200" height="160" fill={D.bg} rx="4" />
      <line x1={cx} y1={cy} x2={cx + 52} y2={cy} stroke={D.orange} strokeWidth="1.5" />
      <text x={cx + 55} y={cy + 8} fill={D.orange} fontSize="8" fontFamily="monospace" fontWeight="bold">X</text>
      <line x1={cx} y1={cy} x2={cx - 28} y2={cy + 44} stroke={D.green} strokeWidth="1.5" />
      <text x={cx - 35} y={cy + 64} fill={D.green} fontSize="8" fontFamily="monospace" fontWeight="bold">Y</text>
      <line x1={cx} y1={cy} x2={cx} y2={cy - 76} stroke={D.blue} strokeWidth="1.5" />
      <text x={cx + 4} y={cy - 80} fill={D.blue} fontSize="8" fontFamily="monospace" fontWeight="bold">Z</text>
      <ellipse cx={cx + 5} cy={cy - 16} rx={44} ry={48} stroke={D.purple} fill="none" strokeDasharray="3,2"
        transform={`rotate(-18,${cx + 5},${cy - 16})`} />
      <circle cx={cx + 36} cy={cy - 56} r="5" fill={D.yellow} />
      <text x="140" y="44" fill={D.yellow} fontSize="8" fontFamily="monospace">satelita</text>
      <text x="140" y="76" fill={D.purple} fontSize="8" fontFamily="monospace">płaszcz.</text>
      <text x="140" y="100" fill={D.purple} fontSize="8" fontFamily="monospace">orbity</text>
      <text x="140" y="132" fill={D.dim} fontSize="8" fontFamily="monospace">ECEF 3D</text>
    </svg>
  );
}

const DIAGRAMS = [
  <DiagramStep1 key={1} />,
  <DiagramStep2 key={2} />,
  <DiagramStep3 key={3} />,
  <DiagramStep4 key={4} />,
  <DiagramStep5 key={5} />,
  <DiagramStep6 key={6} />,
  <DiagramStep7 key={7} />,
  <DiagramStep8 key={8} />,
  <DiagramStep9 key={9} />,
];

// ── Definicje kroków ─────────────────────────────────────────────────────────

interface Step {
  title: string;
  formula: string;
  explanation: string;
}

const STEP_DEFS: Step[] = [
  {
    title: 'KROK 1: Czas od efemerydy',
    formula: 'tk = t − toe',
    explanation: 'Ile sekund minęło od wyemitowania efemerydy. To nasz "zegar".',
  },
  {
    title: 'KROK 2: Anomalia średnia',
    formula: 'M = M₀ + n · tk',
    explanation: 'M to pozycja kątowa gdyby satelita poruszał się jednostajnie. n = ruch średni.',
  },
  {
    title: 'KROK 3: Równanie Keplera',
    formula: 'E − e·sin(E) = M',
    explanation: 'Serce mechaniki orbitalnej! Rozwiązujemy iteracyjnie. E = anomalia ekscentryczna.',
  },
  {
    title: 'KROK 4: Anomalia prawdziwa',
    formula: 'ν = atan2(√(1−e²)·sinE, cosE−e)',
    explanation: 'ν to PRAWDZIWY kąt od perygeum. Różni się od M bo satelita przyspiesza bliżej Ziemi.',
  },
  {
    title: 'KROK 5: Argument szerokości',
    formula: 'φ = ν + ω',
    explanation: 'Dodajemy argument perygeum. φ = pozycja względem węzła wstępującego.',
  },
  {
    title: 'KROK 6: Promień r',
    formula: 'r = a·(1 − e·cos E) + Δr',
    explanation: 'Odległość od środka Ziemi. Najmniejsza w perygeum, największa w apogeum.',
  },
  {
    title: 'KROK 7: Pozycja 2D (orbita)',
    formula: "x' = r·cos(u)\ny' = r·sin(u)",
    explanation: "Pozycja w płaszczyźnie orbity. u = φ + Δu. To jeszcze NIE jest wynik końcowy!",
  },
  {
    title: 'KROK 8: RAAN (Ω)',
    formula: 'Ω = Ω₀ + (Ω̇−ωₑ)·tk − ωₑ·toe',
    explanation: 'Kąt węzła wstępującego. W ECEF odejmujemy obrót Ziemi (ωₑ). Człon −ωₑ·toe zakotwicza w epoce.',
  },
  {
    title: 'KROK 9: XYZ końcowe!',
    formula: "X = x'cosΩ − y'cosI·sinΩ\nY = x'sinΩ + y'cosI·cosΩ\nZ = y'·sinI",
    explanation: 'Obracamy z płaszczyzny orbity do 3D używając inklinacji (i) i RAAN (Ω). TO JEST WYNIK!',
  },
];

// ── Komponent ────────────────────────────────────────────────────────────────

export function KeplerStepper() {
  const [step, setStep] = useState(1);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [displayVals, setDisplayVals] = useState<Record<string, string>>({});

  const prevStep = useRef(1);
  const slideDir = useRef<1 | -1>(1);

  const { singleEph } = useSatelliteStore();
  const { timeHours } = useTimeStore();

  const tSec = timeHours * 3600;
  const data = computeGPSPosition(singleEph, tSec, true, true);

  const stepValues: Record<number, Record<string, string>> = {
    1: { t: `${tSec.toFixed(0)}s`, toe: '0s', tk: `${data.tk.toFixed(1)}s` },
    2: { 'M₀': `${(singleEph.M0 / DEG).toFixed(1)}°`, n: `${(data.n * 1e6).toFixed(3)}×10⁻⁶`, M: `${(data.M / DEG).toFixed(2)}°` },
    3: { M: `${(data.M / DEG).toFixed(2)}°`, e: singleEph.e.toFixed(4), E: `${(data.E / DEG).toFixed(2)}°` },
    4: { E: `${(data.E / DEG).toFixed(2)}°`, 'ν': `${(data.nu / DEG).toFixed(2)}°`, 'M−ν': `${((data.M - data.nu) / DEG).toFixed(2)}°` },
    5: { 'ν': `${(data.nu / DEG).toFixed(2)}°`, 'ω': `${(singleEph.omega / DEG).toFixed(1)}°`, 'φ': `${(data.phi / DEG).toFixed(2)}°` },
    6: { a: `${(singleEph.a / 1e6).toFixed(2)}Mm`, 'e·cosE': (singleEph.e * Math.cos(data.E)).toFixed(4), r: `${(data.r / 1000).toFixed(0)}km` },
    7: { u: `${(data.u / DEG).toFixed(2)}°`, "x'": `${(data.x_op / 1000).toFixed(0)}km`, "y'": `${(data.y_op / 1000).toFixed(0)}km` },
    8: { 'Ω₀': `${(singleEph.Omega0 / DEG).toFixed(1)}°`, 'Ω': `${(data.Omega / DEG).toFixed(2)}°` },
    9: { X: `${(data.x / 1000).toFixed(0)}km`, Y: `${(data.y / 1000).toFixed(0)}km`, Z: `${(data.z / 1000).toFixed(0)}km` },
  };

  // Animacja count-up wartości liczbowych przy zmianie kroku
  useEffect(() => {
    const targets = stepValues[step] ?? {};
    const start = performance.now();

    let rafId: number;
    function frame(ts: number) {
      const p = Math.min((ts - start) / 500, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(targets)) {
        const num = parseFloat(v);
        if (isNaN(num)) { next[k] = v; continue; }
        const suffix = v.replace(/[-\d.e+×⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '').trim();
        const parts = v.split('.');
        const decimals = parts.length > 1 ? parts[1].replace(/[^\d]/g, '').length : 0;
        next[k] = `${(num * ease).toFixed(decimals)}${suffix}`;
      }
      setDisplayVals(next);
      if (p < 1) rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tSec]);

  function goToStep(n: number) {
    slideDir.current = n > prevStep.current ? 1 : -1;
    prevStep.current = n;
    setStep(n);
  }

  function startAuto() {
    if (autoRunning) {
      if (autoTimer) clearInterval(autoTimer);
      setAutoTimer(null);
      setAutoRunning(false);
      return;
    }
    setAutoRunning(true);
    goToStep(1);
    let cur = 1;
    const timer = setInterval(() => {
      cur++;
      if (cur > 9) {
        clearInterval(timer);
        setAutoRunning(false);
        setAutoTimer(null);
        goToStep(9);
      } else {
        goToStep(cur);
      }
    }, 2500);
    setAutoTimer(timer);
  }

  const s = STEP_DEFS[step - 1];
  const animName = slideDir.current > 0 ? 'stepSlideR' : 'stepSlideL';

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 font-mono text-xs">
      <style>{SLIDE_STYLE}</style>
      <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Kalkulator orbitalny</div>

      {/* Track */}
      <div className="flex items-center mb-4 overflow-x-auto pb-1">
        {STEP_DEFS.map((_, i) => {
          const n = i + 1;
          const isActive = n === step;
          const isDone = n < step;
          return (
            <div key={n} className="flex items-center">
              <button
                onClick={() => goToStep(n)}
                className={`w-6 h-6 rounded-full text-[10px] font-bold flex-shrink-0 border transition-colors ${
                  isActive ? 'bg-[#1f6feb] border-[#58a6ff] text-white' :
                  isDone   ? 'bg-[#238636] border-[#2ea043] text-white' :
                             'bg-[#21262d] border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]'
                }`}
              >
                {n}
              </button>
              {n < 9 && (
                <div className={`w-4 h-0.5 flex-shrink-0 ${isDone ? 'bg-[#238636]' : 'bg-[#30363d]'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Pasek postępu */}
      <div className="h-0.5 bg-[#21262d] rounded mb-3">
        <div
          className="h-full bg-[#1f6feb] rounded transition-all duration-300"
          style={{ width: `${((step - 1) / 8) * 100}%` }}
        />
      </div>

      {/* Treść + diagram z animacją przejścia */}
      <div
        key={step}
        style={{ animation: `${animName} 0.3s ease-out` }}
      >
        {/* Diagram */}
        <div className="mb-3 rounded-lg overflow-hidden">
          {DIAGRAMS[step - 1]}
        </div>

        {/* Tekst */}
        <div className="mb-3">
          <div className="text-[#f0f6fc] font-bold text-xs mb-1">{s.title}</div>
          <pre className="text-[#a371f7] text-xs bg-[#0d1117] px-2.5 py-2 rounded-lg mb-1.5 whitespace-pre-wrap">{s.formula}</pre>
          <div className="text-[#8b949e] text-xs leading-relaxed">{s.explanation}</div>
        </div>

        {/* Wartości */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {Object.entries(displayVals).map(([k, v]) => (
            <div key={k} className="bg-[#0d1117] rounded-lg px-2 py-2 text-center">
              <div className="text-[#6e7681] text-[10px] mb-0.5">{k}</div>
              <div className="text-[#58a6ff] text-xs font-bold truncate">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nawigacja */}
      <div className="flex gap-1.5">
        <button
          onClick={() => goToStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-40 text-xs"
        >
          ← Wstecz
        </button>
        <button
          onClick={startAuto}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            autoRunning ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff]'
          }`}
        >
          {autoRunning ? '⏸ Stop' : '▶ Auto'}
        </button>
        <button
          onClick={() => goToStep(Math.min(9, step + 1))}
          disabled={step === 9}
          className="px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-40 text-xs"
        >
          Dalej →
        </button>
      </div>
    </div>
  );
}
