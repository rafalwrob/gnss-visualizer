import { useState, useRef, useEffect } from 'react';
import { computeGPSPosition, orbitalPeriod } from '../../services/orbital/keplerMath';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useTimeStore } from '../../store/timeStore';
import { R_E } from '../../constants/gnss';
import type { OrbitalStepData } from '../../services/orbital/keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';

const DEG = Math.PI / 180;

const SLIDE_STYLE = `
@keyframes stepSlideR { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:translateX(0); } }
@keyframes stepSlideL { from { opacity:0; transform:translateX(-14px); } to { opacity:1; transform:translateX(0); } }
`;

// Paleta
const P = {
  bg: '#0d1117', grid: '#21262d', axis: '#30363d', dim: '#484f58',
  blue: '#58a6ff', purple: '#a371f7', green: '#3fb950',
  orange: '#f0883e', yellow: '#f7c948', cyan: '#00e5ff', text: '#8b949e',
};

// ─────────────────────────────────────────────────────────────────────────────
// Dynamiczne diagramy — rysowane z RZECZYWISTYCH wartości orbity.
// Dla orbit GNSS (e≈0,01) mimośród jest przerysowywany do czytelności —
// z uczciwą adnotacją na diagramie.
// ─────────────────────────────────────────────────────────────────────────────

interface DiagramProps {
  eph: KeplerianEphemeris;
  data: OrbitalStepData;
  /** Wizualny mimośród (prawdziwy, chyba że <0.15 — wtedy przerysowany) */
  eVis: number;
  exaggerated: boolean;
}

/** Geometria elipsy w viewBox 220×170: środek, półosie, ognisko */
function ellipseGeom(eVis: number) {
  const cx = 102, cy = 82, a = 74;
  const b = a * Math.sqrt(1 - eVis * eVis);
  const c = a * eVis;
  return { cx, cy, a, b, fx: cx + c, fy: cy };
}

/** Punkt na elipsie dla anomalii ekscentrycznej E (perygeum po prawej, ruch CCW) */
function ellipsePoint(E: number, g: ReturnType<typeof ellipseGeom>) {
  return { x: g.cx + g.a * Math.cos(E), y: g.cy - g.b * Math.sin(E) };
}

function Exaggerated({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <text x={110} y={164} textAnchor="middle" fill={P.dim} fontSize={7} fontFamily="monospace">
      mimośród przerysowany dla czytelności
    </text>
  );
}

function polarPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  // Łuk CCW od kąta a0 do a1 (rad, mierzone od +x, y w górę)
  let d = a1 - a0;
  d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const large = d > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large},0 ${x1.toFixed(1)},${y1.toFixed(1)}`;
}

/** Krok 1: oś czasu tk = t − toe */
function DiagTime({ eph, data }: DiagramProps) {
  const T = orbitalPeriod(eph.a);
  const frac = Math.min(Math.max(((data.tk % T) + T) % T / T, 0), 1);
  const x0 = 24, x1 = 196, xt = x0 + frac * (x1 - x0);
  return (
    <svg viewBox="0 0 220 170" className="w-full">
      <rect width="220" height="170" fill={P.bg} rx="4" />
      <line x1={x0} y1={85} x2={x1} y2={85} stroke={P.axis} strokeWidth="1.5" />
      <line x1={x0} y1={75} x2={x0} y2={95} stroke={P.orange} strokeWidth="1.5" />
      <text x={x0} y={65} textAnchor="middle" fill={P.orange} fontSize="9" fontFamily="monospace" fontWeight="bold">toe</text>
      <line x1={xt} y1={75} x2={xt} y2={95} stroke={P.blue} strokeWidth="1.5" />
      <text x={xt} y={65} textAnchor="middle" fill={P.blue} fontSize="9" fontFamily="monospace" fontWeight="bold">t</text>
      <path d={`M${x0},108 L${xt},108`} stroke={P.green} strokeWidth="1.5" />
      <path d={`M${x0},102 L${x0},114 M${xt},102 L${xt},114`} stroke={P.green} strokeWidth="1" />
      <text x={(x0 + xt) / 2} y={128} textAnchor="middle" fill={P.green} fontSize="9" fontFamily="monospace" fontWeight="bold">
        tk = {data.tk.toFixed(0)} s
      </text>
      <text x={110} y={150} textAnchor="middle" fill={P.dim} fontSize="8" fontFamily="monospace">
        okres orbity T = {(T / 3600).toFixed(2)} h
      </text>
    </svg>
  );
}

/** Kroki 2–4: elipsa + okrąg pomocniczy + anomalie M / E / ν */
function DiagAnomalies({ data, eVis, exaggerated, highlight }: DiagramProps & { highlight: 'M' | 'E' | 'nu' }) {
  const g = ellipseGeom(eVis);
  const M = data.M, E = data.E, nu = data.nu;
  const sat = ellipsePoint(E, g);
  const auxE = { x: g.cx + g.a * Math.cos(E), y: g.cy - g.a * Math.sin(E) };
  const auxM = { x: g.cx + g.a * Math.cos(M), y: g.cy - g.a * Math.sin(M) };

  return (
    <svg viewBox="0 0 220 170" className="w-full">
      <rect width="220" height="170" fill={P.bg} rx="4" />
      {/* Okrąg pomocniczy */}
      <circle cx={g.cx} cy={g.cy} r={g.a} stroke={P.grid} strokeDasharray="3,3" fill="none" />
      {/* Elipsa orbity */}
      <ellipse cx={g.cx} cy={g.cy} rx={g.a} ry={g.b} stroke={P.axis} fill="none" strokeWidth="1.2" />
      {/* Linia apsyd */}
      <line x1={g.cx - g.a} y1={g.cy} x2={g.cx + g.a} y2={g.cy} stroke={P.grid} strokeWidth="0.6" />
      {/* Środek i ognisko */}
      <circle cx={g.cx} cy={g.cy} r="1.6" fill={P.dim} />
      <circle cx={g.fx} cy={g.fy} r="3" fill={P.orange} />
      <text x={g.fx + 1} y={g.fy + 12} fill={P.orange} fontSize="7.5" fontFamily="monospace">Ziemia (F)</text>
      <text x={g.cx + g.a + 2} y={g.cy - 4} fill={P.dim} fontSize="7" fontFamily="monospace">per.</text>

      {/* M — średni satelita na okręgu pomocniczym */}
      {(highlight === 'M') && (
        <>
          <path d={polarPath(g.cx, g.cy, g.a * 0.4, 0, M)} stroke={P.purple} strokeWidth="1.5" fill="none" />
          <line x1={g.cx} y1={g.cy} x2={auxM.x} y2={auxM.y} stroke={P.purple} strokeWidth="1" strokeDasharray="3,2" />
          <circle cx={auxM.x} cy={auxM.y} r="4" fill={P.purple} />
          <text x={auxM.x + 6} y={auxM.y - 4} fill={P.purple} fontSize="9" fontFamily="monospace" fontWeight="bold">
            M = {(((M / DEG) % 360 + 360) % 360).toFixed(1)}°
          </text>
          <text x={110} y={155} textAnchor="middle" fill={P.dim} fontSize="7.5" fontFamily="monospace">
            fikcyjny satelita o ruchu jednostajnym
          </text>
        </>
      )}

      {/* E — anomalia ekscentryczna: punkt na okręgu, pion na elipsę */}
      {(highlight === 'E' || highlight === 'nu') && (
        <>
          <path d={polarPath(g.cx, g.cy, g.a * 0.34, 0, E)} stroke={P.blue} strokeWidth={highlight === 'E' ? 1.5 : 0.8} fill="none" opacity={highlight === 'E' ? 1 : 0.5} />
          <line x1={g.cx} y1={g.cy} x2={auxE.x} y2={auxE.y} stroke={P.blue} strokeWidth="1" strokeDasharray="3,2" opacity={highlight === 'E' ? 1 : 0.45} />
          <line x1={auxE.x} y1={auxE.y} x2={sat.x} y2={sat.y} stroke={P.blue} strokeWidth="0.8" strokeDasharray="2,2" opacity={highlight === 'E' ? 1 : 0.45} />
          {highlight === 'E' && (
            <>
              <circle cx={auxE.x} cy={auxE.y} r="3" fill="none" stroke={P.blue} strokeWidth="1.2" />
              <text x={g.cx + 12} y={g.cy - 18} fill={P.blue} fontSize="9" fontFamily="monospace" fontWeight="bold">
                E = {(((E / DEG) % 360 + 360) % 360).toFixed(1)}°
              </text>
            </>
          )}
        </>
      )}

      {/* ν — anomalia prawdziwa z ogniska */}
      {highlight === 'nu' && (
        <>
          <path d={polarPath(g.fx, g.fy, 22, 0, nu)} stroke={P.green} strokeWidth="1.5" fill="none" />
          <line x1={g.fx} y1={g.fy} x2={sat.x} y2={sat.y} stroke={P.green} strokeWidth="1.2" />
          <text x={g.fx + 10} y={g.fy - 26} fill={P.green} fontSize="9" fontFamily="monospace" fontWeight="bold">
            ν = {(((nu / DEG) % 360 + 360) % 360).toFixed(1)}°
          </text>
        </>
      )}

      {/* Satelita */}
      <circle cx={sat.x} cy={sat.y} r="4.5" fill={P.yellow} />
      <Exaggerated show={exaggerated} />
    </svg>
  );
}

/** Krok 5: argument szerokości φ = ν + ω (płaszczyzna orbity, węzeł jako odniesienie) */
function DiagArgLat({ eph, data, exaggerated }: DiagramProps) {
  const omega = eph.omega;
  // Rysujemy w układzie węzła: kierunek węzła wstępującego = +x.
  // Perygeum jest pod kątem ω od węzła, satelita pod φ = ν + ω.
  const cx = 110, cy = 85, R = 66;
  const phi = data.phi;
  const satA = { x: cx + R * Math.cos(phi), y: cy - R * Math.sin(phi) };
  const perA = { x: cx + R * Math.cos(omega), y: cy - R * Math.sin(omega) };
  return (
    <svg viewBox="0 0 220 170" className="w-full">
      <rect width="220" height="170" fill={P.bg} rx="4" />
      <circle cx={cx} cy={cy} r={R} stroke={P.grid} fill="none" />
      {/* Linia węzłów */}
      <line x1={cx - R - 6} y1={cy} x2={cx + R + 6} y2={cy} stroke={P.dim} strokeWidth="1" />
      <text x={cx + R - 20} y={cy + 12} fill={P.dim} fontSize="7.5" fontFamily="monospace">węzeł ☊</text>
      <circle cx={cx} cy={cy} r="3" fill={P.orange} />
      {/* ω: węzeł → perygeum */}
      <path d={polarPath(cx, cy, 26, 0, omega)} stroke={P.orange} strokeWidth="1.5" fill="none" />
      <line x1={cx} y1={cy} x2={perA.x} y2={perA.y} stroke={P.orange} strokeWidth="1" strokeDasharray="3,2" />
      <text x={perA.x + (perA.x > cx ? 4 : -40)} y={perA.y - 4} fill={P.orange} fontSize="8.5" fontFamily="monospace" fontWeight="bold">
        ω = {(((omega / DEG) % 360 + 360) % 360).toFixed(1)}°
      </text>
      {/* φ: węzeł → satelita */}
      <path d={polarPath(cx, cy, 40, 0, phi)} stroke={P.green} strokeWidth="1.5" fill="none" />
      <line x1={cx} y1={cy} x2={satA.x} y2={satA.y} stroke={P.green} strokeWidth="1.2" />
      <circle cx={satA.x} cy={satA.y} r="4.5" fill={P.yellow} />
      <text x={satA.x + (satA.x > cx ? 6 : -46)} y={satA.y + 3} fill={P.green} fontSize="8.5" fontFamily="monospace" fontWeight="bold">
        φ = {(((phi / DEG) % 360 + 360) % 360).toFixed(1)}°
      </text>
      <Exaggerated show={exaggerated} />
    </svg>
  );
}

/** Krok 6: promień wodzący r, perygeum i apogeum */
function DiagRadius({ eph, data, eVis, exaggerated }: DiagramProps) {
  const g = ellipseGeom(eVis);
  const sat = ellipsePoint(data.E, g);
  const rMin = eph.a * (1 - eph.e), rMax = eph.a * (1 + eph.e);
  return (
    <svg viewBox="0 0 220 170" className="w-full">
      <rect width="220" height="170" fill={P.bg} rx="4" />
      <ellipse cx={g.cx} cy={g.cy} rx={g.a} ry={g.b} stroke={P.axis} fill="none" strokeWidth="1.2" />
      <circle cx={g.fx} cy={g.fy} r="3" fill={P.orange} />
      {/* Perygeum / apogeum */}
      <circle cx={g.cx + g.a} cy={g.cy} r="3.5" fill={P.blue} />
      <text x={g.cx + g.a - 8} y={g.cy - 10} fill={P.blue} fontSize="7.5" fontFamily="monospace">perygeum</text>
      <text x={g.cx + g.a - 8} y={g.cy + 18} fill={P.blue} fontSize="7" fontFamily="monospace">{(rMin / 1e6).toFixed(2)} tys. km</text>
      <circle cx={g.cx - g.a} cy={g.cy} r="3.5" fill={P.dim} />
      <text x={g.cx - g.a - 2} y={g.cy - 10} fill={P.dim} fontSize="7.5" fontFamily="monospace">apogeum</text>
      <text x={g.cx - g.a - 2} y={g.cy + 18} fill={P.dim} fontSize="7" fontFamily="monospace">{(rMax / 1e6).toFixed(2)} tys. km</text>
      {/* r */}
      <line x1={g.fx} y1={g.fy} x2={sat.x} y2={sat.y} stroke={P.green} strokeWidth="1.8" />
      <circle cx={sat.x} cy={sat.y} r="4.5" fill={P.yellow} />
      <text x={(g.fx + sat.x) / 2 + 4} y={(g.fy + sat.y) / 2 - 6} fill={P.green} fontSize="9" fontFamily="monospace" fontWeight="bold">
        r = {(data.r / 1000).toFixed(0)} km
      </text>
      <Exaggerated show={exaggerated} />
    </svg>
  );
}

/** Krok 7: współrzędne w płaszczyźnie orbity x'y' */
function DiagPlaneXY({ data, exaggerated }: DiagramProps) {
  const cx = 110, cy = 85, R = 62;
  const u = data.u;
  const sat = { x: cx + R * Math.cos(u), y: cy - R * Math.sin(u) };
  return (
    <svg viewBox="0 0 220 170" className="w-full">
      <rect width="220" height="170" fill={P.bg} rx="4" />
      <circle cx={cx} cy={cy} r={R} stroke={P.grid} fill="none" strokeDasharray="3,3" />
      <line x1={cx - R - 8} y1={cy} x2={cx + R + 8} y2={cy} stroke={P.orange} strokeWidth="1" />
      <text x={cx + R + 10} y={cy + 3} fill={P.orange} fontSize="8" fontFamily="monospace">x'</text>
      <line x1={cx} y1={cy + R + 8} x2={cx} y2={cy - R - 8} stroke={P.green} strokeWidth="1" />
      <text x={cx + 4} y={cy - R - 10} fill={P.green} fontSize="8" fontFamily="monospace">y'</text>
      {/* Rzuty */}
      <line x1={sat.x} y1={cy} x2={sat.x} y2={sat.y} stroke={P.green} strokeWidth="0.8" strokeDasharray="2,2" />
      <line x1={cx} y1={sat.y} x2={sat.x} y2={sat.y} stroke={P.orange} strokeWidth="0.8" strokeDasharray="2,2" />
      <line x1={cx} y1={cy} x2={sat.x} y2={sat.y} stroke={P.dim} strokeWidth="0.8" />
      <circle cx={sat.x} cy={sat.y} r="4.5" fill={P.yellow} />
      <text x={sat.x + 7} y={sat.y - 6} fill={P.orange} fontSize="8" fontFamily="monospace">
        x' = {(data.x_op / 1000).toFixed(0)} km
      </text>
      <text x={sat.x + 7} y={sat.y + 6} fill={P.green} fontSize="8" fontFamily="monospace">
        y' = {(data.y_op / 1000).toFixed(0)} km
      </text>
      <path d={polarPath(cx, cy, 20, 0, u)} stroke={P.blue} strokeWidth="1.2" fill="none" />
      <text x={cx + 24} y={cy - 8} fill={P.blue} fontSize="8" fontFamily="monospace">u = {(((u / DEG) % 360 + 360) % 360).toFixed(1)}°</text>
      <Exaggerated show={exaggerated} />
    </svg>
  );
}

/** Krok 8: RAAN — widok znad bieguna północnego */
function DiagRaan({ data }: DiagramProps) {
  const cx = 110, cy = 88, R = 56;
  const Om = data.Omega;
  const node = { x: cx + R * Math.cos(Om), y: cy - R * Math.sin(Om) };
  return (
    <svg viewBox="0 0 220 170" className="w-full">
      <rect width="220" height="170" fill={P.bg} rx="4" />
      <text x={110} y={16} textAnchor="middle" fill={P.dim} fontSize="7.5" fontFamily="monospace">widok znad bieguna N</text>
      {/* Ziemia */}
      <circle cx={cx} cy={cy} r={20} fill="#0f2c4a" stroke={P.axis} />
      <circle cx={cx} cy={cy} r={R} stroke={P.grid} fill="none" strokeDasharray="3,3" />
      {/* Oś X ECEF (Greenwich) */}
      <line x1={cx} y1={cy} x2={cx + R + 14} y2={cy} stroke={P.dim} strokeWidth="1" />
      <text x={cx + R + 4} y={cy + 12} fill={P.dim} fontSize="7" fontFamily="monospace">X (Greenwich)</text>
      {/* Ω */}
      <path d={polarPath(cx, cy, 32, 0, Om)} stroke={P.purple} strokeWidth="1.5" fill="none" />
      <line x1={cx} y1={cy} x2={node.x} y2={node.y} stroke={P.blue} strokeWidth="1.5" />
      <circle cx={node.x} cy={node.y} r="3.5" fill={P.blue} />
      <text x={node.x + (node.x > cx ? 5 : -48)} y={node.y - 5} fill={P.blue} fontSize="7.5" fontFamily="monospace">węzeł ☊</text>
      <text x={cx + 8} y={cy - 36} fill={P.purple} fontSize="9" fontFamily="monospace" fontWeight="bold">
        Ω = {(((data.Omega / DEG) % 360 + 360) % 360).toFixed(1)}°
      </text>
      <text x={110} y={158} textAnchor="middle" fill={P.dim} fontSize="7" fontFamily="monospace">
        węzeł dryfuje na zachód z obrotem Ziemi (−ωₑ·t)
      </text>
    </svg>
  );
}

/** Krok 9: wynik XYZ */
function DiagResult({ data }: DiagramProps) {
  const r = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
  const alt = (r - R_E) / 1000;
  const rows = [
    { k: 'X', v: data.x, c: P.orange },
    { k: 'Y', v: data.y, c: P.green },
    { k: 'Z', v: data.z, c: P.blue },
  ];
  return (
    <svg viewBox="0 0 220 170" className="w-full">
      <rect width="220" height="170" fill={P.bg} rx="4" />
      <text x={110} y={24} textAnchor="middle" fill={P.yellow} fontSize="10" fontFamily="monospace" fontWeight="bold">
        Pozycja ECEF satelity
      </text>
      {rows.map((row, i) => (
        <g key={row.k}>
          <rect x={30} y={38 + i * 26} width={160} height={20} rx={4} fill="#161b22" />
          <text x={42} y={52 + i * 26} fill={row.c} fontSize="10" fontFamily="monospace" fontWeight="bold">{row.k}</text>
          <text x={178} y={52 + i * 26} textAnchor="end" fill="#e6edf3" fontSize="10" fontFamily="monospace">
            {(row.v / 1000).toFixed(1)} km
          </text>
        </g>
      ))}
      <text x={110} y={134} textAnchor="middle" fill={P.text} fontSize="8.5" fontFamily="monospace">
        |r| = {(r / 1000).toFixed(0)} km → wysokość {alt.toFixed(0)} km n.p.m.
      </text>
      <text x={110} y={150} textAnchor="middle" fill={P.dim} fontSize="7.5" fontFamily="monospace">
        (R⊕ = 6378 km; GPS MEO ≈ 20 200 km)
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Definicje kroków
// ─────────────────────────────────────────────────────────────────────────────

interface Step {
  title: string;
  formula: string;
  explanation: string;
}

const STEP_DEFS: Step[] = [
  {
    title: 'Krok 1 · Czas od efemerydy',
    formula: 'tk = t − toe',
    explanation: 'Ile sekund minęło od epoki efemerydy. Wszystkie kolejne kroki propagują orbitę o ten czas.',
  },
  {
    title: 'Krok 2 · Anomalia średnia',
    formula: 'M = M₀ + n·tk,   n = √(μ/a³)',
    explanation: 'M to kąt fikcyjnego satelity poruszającego się jednostajnie po okręgu. Rośnie liniowo z czasem — to nasz "zegar orbitalny".',
  },
  {
    title: 'Krok 3 · Równanie Keplera',
    formula: 'M = E − e·sin(E)',
    explanation: 'Serce mechaniki orbitalnej — równanie przestępne, rozwiązywane iteracyjnie (Newton–Raphson). E to kąt mierzony ze środka elipsy na okręgu opisanym.',
  },
  {
    title: 'Krok 4 · Anomalia prawdziwa',
    formula: 'ν = atan2(√(1−e²)·sinE, cosE−e)',
    explanation: 'ν to rzeczywisty kąt satelity widziany z ogniska (Ziemi). II prawo Keplera: satelita przyspiesza przy perygeum — dlatego ν ≠ M.',
  },
  {
    title: 'Krok 5 · Argument szerokości',
    formula: 'φ = ν + ω',
    explanation: 'Dodajemy argument perygeum ω, by mierzyć pozycję od węzła wstępującego (przecięcia orbity z równikiem) zamiast od perygeum.',
  },
  {
    title: 'Krok 6 · Promień wodzący',
    formula: 'r = a·(1 − e·cosE) + Δr',
    explanation: 'Odległość satelity od środka Ziemi: najmniejsza w perygeum a(1−e), największa w apogeum a(1+e). Δr — korekcje harmoniczne.',
  },
  {
    title: 'Krok 7 · Pozycja w płaszczyźnie orbity',
    formula: "x' = r·cos(u)\ny' = r·sin(u),   u = φ + Δu",
    explanation: 'Współrzędne 2D w płaszczyźnie orbity, z osią x\' skierowaną na węzeł wstępujący. To jeszcze nie jest wynik końcowy.',
  },
  {
    title: 'Krok 8 · Rektascensja węzła (Ω)',
    formula: 'Ω = Ω₀ + (Ω̇ − ωₑ)·tk − ωₑ·toe',
    explanation: 'Kąt węzła wstępującego. W układzie ECEF odejmujemy obrót Ziemi ωₑ — dlatego węzeł "wędruje" na zachód ~15°/h.',
  },
  {
    title: 'Krok 9 · Współrzędne ECEF',
    formula: "X = x'·cosΩ − y'·cosi·sinΩ\nY = x'·sinΩ + y'·cosi·cosΩ\nZ = y'·sini",
    explanation: 'Obrót z płaszczyzny orbity do przestrzeni 3D przez inklinację i oraz Ω. Wynik: pozycja satelity względem Ziemi — dokładnie to liczy odbiornik GPS.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Komponent
// ─────────────────────────────────────────────────────────────────────────────

export function KeplerStepper() {
  const [step, setStep] = useState(1);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prevStep = useRef(1);
  const slideDir = useRef<1 | -1>(1);

  const { singleEph } = useSatelliteStore();
  const { timeHours } = useTimeStore();

  const tSec = timeHours * 3600;
  const data = computeGPSPosition(singleEph, tSec, true, true);

  // Wizualny mimośród: prawdziwy, a dla niemal kołowych orbit GNSS przerysowany
  const exaggerated = singleEph.e < 0.15;
  const eVis = exaggerated ? 0.42 : singleEph.e;

  const norm = (rad: number) => (((rad / DEG) % 360 + 360) % 360).toFixed(2) + '°';

  const stepValues: Record<number, Record<string, string>> = {
    1: { t: `${tSec.toFixed(0)} s`, toe: `${singleEph.toe.toFixed(0)} s`, tk: `${data.tk.toFixed(1)} s` },
    2: { 'M₀': norm(singleEph.M0), 'n': `${(data.n * 1e6).toFixed(3)}·10⁻⁶ rad/s`, M: norm(data.M) },
    3: { M: norm(data.M), e: singleEph.e.toFixed(4), E: norm(data.E) },
    4: { E: norm(data.E), 'ν': norm(data.nu), 'ν−M': `${(((data.nu - data.M) / DEG + 540) % 360 - 180).toFixed(2)}°` },
    5: { 'ν': norm(data.nu), 'ω': norm(singleEph.omega), 'φ': norm(data.phi) },
    6: { 'a': `${(singleEph.a / 1e6).toFixed(3)} tys. km`, 'e·cosE': (singleEph.e * Math.cos(data.E)).toFixed(4), r: `${(data.r / 1000).toFixed(0)} km` },
    7: { u: norm(data.u), "x'": `${(data.x_op / 1000).toFixed(0)} km`, "y'": `${(data.y_op / 1000).toFixed(0)} km` },
    8: { 'Ω₀': norm(singleEph.Omega0), 'i': norm(singleEph.i0), 'Ω': norm(data.Omega) },
    9: { X: `${(data.x / 1000).toFixed(0)} km`, Y: `${(data.y / 1000).toFixed(0)} km`, Z: `${(data.z / 1000).toFixed(0)} km` },
  };

  function goToStep(n: number) {
    slideDir.current = n > prevStep.current ? 1 : -1;
    prevStep.current = n;
    setStep(n);
  }

  function stopAuto() {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    autoTimerRef.current = null;
    setAutoRunning(false);
  }

  function startAuto() {
    if (autoRunning) { stopAuto(); return; }
    setAutoRunning(true);
    goToStep(1);
    let cur = 1;
    autoTimerRef.current = setInterval(() => {
      cur++;
      if (cur > 9) { stopAuto(); goToStep(9); }
      else goToStep(cur);
    }, 3000);
  }

  useEffect(() => () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); }, []);

  const s = STEP_DEFS[step - 1];
  const animName = slideDir.current > 0 ? 'stepSlideR' : 'stepSlideL';

  const dprops: DiagramProps = { eph: singleEph, data, eVis, exaggerated };
  const diagram =
    step === 1 ? <DiagTime {...dprops} /> :
    step === 2 ? <DiagAnomalies {...dprops} highlight="M" /> :
    step === 3 ? <DiagAnomalies {...dprops} highlight="E" /> :
    step === 4 ? <DiagAnomalies {...dprops} highlight="nu" /> :
    step === 5 ? <DiagArgLat {...dprops} /> :
    step === 6 ? <DiagRadius {...dprops} /> :
    step === 7 ? <DiagPlaneXY {...dprops} /> :
    step === 8 ? <DiagRaan {...dprops} /> :
                 <DiagResult {...dprops} />;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 font-mono text-xs overflow-y-visible">
      <style>{SLIDE_STYLE}</style>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest">Kalkulator orbitalny · IS-GPS-200</div>
        <div className="text-[#484f58] text-[10px]">t = {timeHours.toFixed(2)} h</div>
      </div>

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

      {/* Treść + diagram z animacją przejścia */}
      <div
        key={step}
        style={{ animation: `${animName} 0.3s ease-out`, overflow: 'visible' }}
      >
        {/* Diagram — rysowany z rzeczywistych wartości orbity */}
        <div className="mb-3 rounded-lg overflow-hidden">
          {diagram}
        </div>

        {/* Tekst */}
        <div className="mb-3">
          <div className="text-[#f0f6fc] font-bold text-xs mb-1">{s.title}</div>
          <pre className="text-[#a371f7] text-xs bg-[#0d1117] px-2.5 py-2 rounded-lg mb-1.5 whitespace-pre-wrap">{s.formula}</pre>
          <div className="text-[#8b949e] text-xs leading-relaxed">{s.explanation}</div>
        </div>

        {/* Wartości — na żywo, bez animacji przekłamującej liczby */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {Object.entries(stepValues[step]).map(([k, v]) => (
            <div key={k} className="bg-[#0d1117] rounded-lg px-2 py-2 text-center">
              <div className="text-[#6e7681] text-[10px] mb-0.5">{k}</div>
              <div className="text-[#58a6ff] text-xs font-bold break-all">{v}</div>
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
