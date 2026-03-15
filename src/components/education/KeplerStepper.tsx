import { useState } from 'react';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useTimeStore } from '../../store/timeStore';

const DEG = Math.PI / 180;

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
    formula: 'Ω = Ω₀ + (Ω̇−ωₑ)·tk',
    explanation: 'Kąt węzła wstępującego. W ECEF odejmujemy obrót Ziemi (ωₑ).',
  },
  {
    title: 'KROK 9: XYZ końcowe!',
    formula: "X = x'cosΩ − y'cosI·sinΩ\nY = x'sinΩ + y'cosI·cosΩ\nZ = y'·sinI",
    explanation: 'Obracamy z płaszczyzny orbity do 3D używając inklinacji (i) i RAAN (Ω). TO JEST WYNIK!',
  },
];

export function KeplerStepper() {
  const [step, setStep] = useState(1);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoTimer, setAutoTimer] = useState<ReturnType<typeof setInterval> | null>(null);
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

  function startAuto() {
    if (autoRunning) {
      if (autoTimer) clearInterval(autoTimer);
      setAutoTimer(null);
      setAutoRunning(false);
      return;
    }
    setAutoRunning(true);
    setStep(1);
    let cur = 1;
    const timer = setInterval(() => {
      cur++;
      if (cur > 9) {
        clearInterval(timer);
        setAutoRunning(false);
        setAutoTimer(null);
        setStep(9);
      } else {
        setStep(cur);
      }
    }, 2500);
    setAutoTimer(timer);
  }

  const s = STEP_DEFS[step - 1];
  const vals = stepValues[step] ?? {};

  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 font-mono text-xs">
      <div className="text-[#58a6ff] text-[10px] uppercase tracking-wider mb-3">Kalkulator orbitalny</div>

      {/* Track */}
      <div className="flex items-center mb-4 overflow-x-auto pb-1">
        {STEP_DEFS.map((_, i) => {
          const n = i + 1;
          const isActive = n === step;
          const isDone = n < step;
          return (
            <div key={n} className="flex items-center">
              <button
                onClick={() => setStep(n)}
                className={`w-6 h-6 rounded-full text-[9px] font-bold flex-shrink-0 border transition-colors ${
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
          className="h-full bg-[#1f6feb] rounded transition-all"
          style={{ width: `${((step - 1) / 8) * 100}%` }}
        />
      </div>

      {/* Treść */}
      <div className="mb-3">
        <div className="text-[#f0f6fc] font-bold text-[11px] mb-1">{s.title}</div>
        <pre className="text-[#a371f7] text-[10px] bg-[#161b22] px-2 py-1.5 rounded mb-1 whitespace-pre-wrap">{s.formula}</pre>
        <div className="text-[#8b949e] text-[10px] leading-relaxed">{s.explanation}</div>
      </div>

      {/* Wartości */}
      <div className="grid grid-cols-3 gap-1 mb-3">
        {Object.entries(vals).map(([k, v]) => (
          <div key={k} className="bg-[#161b22] rounded px-2 py-1.5 text-center">
            <div className="text-[#6e7681] text-[9px]">{k}</div>
            <div className="text-[#58a6ff] text-[10px] font-bold truncate">{v}</div>
          </div>
        ))}
      </div>

      {/* Nawigacja */}
      <div className="flex gap-1">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="px-3 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-40 text-[10px]"
        >
          ← Wstecz
        </button>
        <button
          onClick={startAuto}
          className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors ${
            autoRunning ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff]'
          }`}
        >
          {autoRunning ? '⏸ Stop' : '▶ Auto'}
        </button>
        <button
          onClick={() => setStep(s => Math.min(9, s + 1))}
          disabled={step === 9}
          className="px-3 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] disabled:opacity-40 text-[10px]"
        >
          Dalej →
        </button>
      </div>
    </div>
  );
}
