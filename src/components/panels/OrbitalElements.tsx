import { useMemo } from 'react';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useUiStore } from '../../store/uiStore';
import { useTimeStore } from '../../store/timeStore';
import { useObserverStore } from '../../store/observerStore';
import { useIonoStore } from '../../store/ionoStore';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { klobucherDelay } from '../../services/orbital/ionosphere';
import type { KeplerianEphemeris } from '../../types/ephemeris';

const DEG = Math.PI / 180;

interface SliderRowProps {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color?: string;
}

function SliderRow({ label, value, displayValue, min, max, step, onChange, color = '#58a6ff' }: SliderRowProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-[#8b949e] text-[11px] font-mono">{label}</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{displayValue}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5"
        style={{ accentColor: color }}
      />
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

export function OrbitalElements() {
  const { singleEph, setSingleEph } = useSatelliteStore();
  const { showHarmonics, setShowHarmonics } = useUiStore();
  const { timeHours } = useTimeStore();
  const { lat: obsLat, lon: obsLon } = useObserverStore();
  const { enabled, alpha, beta, setEnabled, setAlpha, setBeta } = useIonoStore();

  const timeSec = timeHours * 3600;

  function update(key: keyof KeplerianEphemeris, raw: number) {
    setSingleEph({ ...singleEph, [key]: raw });
  }

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

  return (
    <div className="space-y-4 font-mono">

      {/* ── Tryb efemerydy ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">Tryb efemerydy</div>
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
          <div className="flex justify-between text-[11px] mb-1">
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
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-3">
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
          color="#7ee787"
        />
        <SliderRow
          label="Inklinacja  i₀"
          value={singleEph.i0 / DEG}
          displayValue={`${(singleEph.i0 / DEG).toFixed(1)}°`}
          min={0} max={90} step={0.1}
          onChange={v => update('i0', v * DEG)}
          color="#f0883e"
        />
        <SliderRow
          label="RAAN  Ω₀"
          value={singleEph.Omega0 / DEG}
          displayValue={`${(singleEph.Omega0 / DEG).toFixed(1)}°`}
          min={-180} max={180} step={1}
          onChange={v => update('Omega0', v * DEG)}
          color="#a371f7"
        />
        <SliderRow
          label="Arg. perygeum  ω"
          value={singleEph.omega / DEG}
          displayValue={`${(singleEph.omega / DEG).toFixed(1)}°`}
          min={-180} max={180} step={1}
          onChange={v => update('omega', v * DEG)}
          color="#ffa657"
        />
        <SliderRow
          label="Anomalia średnia  M₀"
          value={singleEph.M0 / DEG}
          displayValue={`${(singleEph.M0 / DEG).toFixed(1)}°`}
          min={-180} max={180} step={1}
          onChange={v => update('M0', v * DEG)}
          color="#ff7b72"
        />
      </div>

      {/* ── Jonosfera Klobuchar ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[#6e7681] text-[10px] uppercase tracking-widest">Jonosfera Klobuchar</div>
          <SmallToggle value={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <>
            {/* Wskaźnik opóźnienia */}
            <div className="bg-[#0d1117] rounded-lg p-3 mb-3 text-center">
              <div className="text-[#6e7681] text-[10px] mb-1">Opóźnienie L1 (zenit)</div>
              <div className="text-[#a371f7] text-lg font-bold font-mono">{zenithDelay.toFixed(1)} m</div>
              <div className="grid grid-cols-5 gap-1 mt-2 text-[10px]">
                {[5, 15, 30, 60, 90].map(el => (
                  <div key={el}>
                    <div className="text-[#484f58]">{el}°</div>
                    <div className="text-[#c9d1d9] font-mono">{delayAtEl(el).toFixed(1)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parametry α */}
            <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-2">α (amplituda)</div>
            {([0, 1, 2, 3] as const).map(i => (
              <SliderRow
                key={`a${i}`}
                label={`α${i}`}
                value={alpha[i]}
                min={-1.2e-7} max={1.2e-7} step={1e-9}
                displayValue={`${(alpha[i] * 1e9).toFixed(1)} ns`}
                onChange={v => setAlpha(i, v)}
                color="#a371f7"
              />
            ))}

            {/* Parametry β */}
            <div className="text-[#6e7681] text-[10px] uppercase tracking-widest mb-2 mt-3">β (okres)</div>
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
