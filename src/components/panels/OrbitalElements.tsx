import { useSatelliteStore } from '../../store/satelliteStore';
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

export function OrbitalElements() {
  const { singleEph, setSingleEph } = useSatelliteStore();

  function update(key: keyof KeplerianEphemeris, raw: number) {
    setSingleEph({ ...singleEph, [key]: raw });
  }

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 font-mono">
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
  );
}
