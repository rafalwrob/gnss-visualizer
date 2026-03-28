import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CelestialSphereScene } from '../components/scene/CelestialSphereScene';
import { CelestialInfoPanel } from '../components/panels/CelestialInfoPanel';
import { useCelestialStore } from '../store/celestialStore';
import type { CelestialVisibility } from '../store/celestialStore';

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <div className="flex items-center justify-between">
        <span className="text-[#c9d1d9] text-sm font-mono">{label}</span>
        <div
          onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ml-3 ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
          />
        </div>
      </div>
    </label>
  );
}

const TOGGLE_GROUPS: {
  label: string;
  items: { key: keyof CelestialVisibility; label: string }[];
}[] = [
  {
    label: 'Sfera i siatka',
    items: [
      { key: 'sphere', label: 'Sfera niebieska' },
      { key: 'equator', label: 'Rownik niebieski' },
      { key: 'ecliptic', label: 'Ekliptyka' },
      { key: 'raCircles', label: 'Siatka RA (co 2h)' },
      { key: 'decParallels', label: 'Siatka Dec (\xb130\xb0, \xb160\xb0)' },
    ],
  },
  {
    label: 'Punkty i osie',
    items: [
      { key: 'equinoxPoints', label: 'Rownononoce (\u03b3 i jesienna)' },
      { key: 'solsticePoints', label: 'Przesilenia (\xb123,44\xb0)' },
      { key: 'poles', label: 'Bieguny niebieskie' },
      { key: 'icrsAxes', label: 'Osie ICRS / J2000' },
      { key: 'sunMarker', label: 'Slonce (dzis)' },
    ],
  },
];

const COLOR_LEGEND = [
  { color: '#00e5ff', label: 'Rownik niebieski' },
  { color: '#ffd700', label: 'Ekliptyka' },
  { color: '#22c55e', label: 'Rownonoc wiosenna \u03b3' },
  { color: '#ef4444', label: 'Rownonoc jesienna' },
  { color: '#f97316', label: 'Przesilenie letnie' },
  { color: '#3b82f6', label: 'Przesilenie zimowe' },
  { color: '#fbbf24', label: 'Slonce' },
];

export function CelestialSphereView({ onBack }: { onBack: () => void }) {
  const { vis, toggle, activeInfo } = useCelestialStore();

  return (
    <div className="flex h-screen bg-[#0a0e17] text-[#e6edf3] overflow-hidden">
      {/* ── Lewy sidebar ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-[#21262d] bg-[#0d1117]">
        {/* Nagłówek */}
        <div className="px-4 py-3.5 border-b border-[#21262d] flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#a371f7] font-bold text-base tracking-wide font-mono">
              Sfera niebieska
            </span>
            <button
              onClick={onBack}
              className="text-xs font-mono px-2.5 py-1 rounded-lg border border-[#30363d] text-[#8b949e] hover:border-[#a371f7]/60 hover:text-[#a371f7] transition-all"
            >
              ← Wstecz
            </button>
          </div>
          <div className="text-[#6e7681] text-[11px] font-mono">
            Uklad ICRS / J2000 — epoka J2000.0
          </div>
        </div>

        {/* Togglei */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">
          {TOGGLE_GROUPS.map(group => (
            <div
              key={group.label}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3"
            >
              <div className="text-[#6e7681] text-[10px] uppercase tracking-widest font-mono">
                {group.label}
              </div>
              {group.items.map(item => (
                <Toggle
                  key={item.key}
                  label={item.label}
                  value={vis[item.key]}
                  onChange={() => toggle(item.key)}
                />
              ))}
            </div>
          ))}

          {/* Legenda kolorów */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
            <div className="text-[#6e7681] text-[10px] uppercase tracking-widest font-mono mb-3">
              Legenda
            </div>
            <div className="space-y-1.5">
              {COLOR_LEGEND.map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[#8b949e] text-[11px] font-mono">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Wskazówka */}
          <div className="text-[#484f58] text-[10px] font-mono leading-relaxed px-1">
            Kliknij punkt lub etykiete w scenie, aby zobaczyc opis elementu.
          </div>
        </div>
      </div>

      {/* ── Scena 3D ── */}
      <div className="flex-1 relative min-w-0">
        <Canvas
          camera={{ position: [0, 2, 12], fov: 50 }}
          style={{ background: '#050a14' }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
        >
          <OrbitControls
            enablePan={false}
            minDistance={2}
            maxDistance={25}
            autoRotate={false}
          />
          <CelestialSphereScene />
        </Canvas>
        <div className="absolute bottom-2 right-3 text-[10px] text-[#21262d] font-mono pointer-events-none select-none">
          ICRS/J2000 · epoka 2000.0
        </div>
      </div>

      {/* ── Prawy panel informacyjny ── */}
      {activeInfo && <CelestialInfoPanel />}
    </div>
  );
}
