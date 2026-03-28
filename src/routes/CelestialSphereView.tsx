import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CelestialSphereScene } from '../components/scene/CelestialSphereScene';
import { CelestialInfoPanel } from '../components/panels/CelestialInfoPanel';
import { useCelestialStore, getDayInfo } from '../store/celestialStore';
import { celestialAnim } from '../components/scene/celestialAnim';
import type { CelestialVisibility } from '../store/celestialStore';

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between cursor-pointer" onClick={onChange}>
      <span className="text-[#c9d1d9] text-xs font-mono">{label}</span>
      <div className={`w-9 h-4 rounded-full relative transition-colors flex-shrink-0 ml-2 ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle groups
// ─────────────────────────────────────────────────────────────────────────────

const TOGGLE_GROUPS: {
  label: string;
  items: { key: keyof CelestialVisibility; label: string }[];
}[] = [
  {
    label: 'Sfera i siatka',
    items: [
      { key: 'sphere',      label: 'Sfera niebieska' },
      { key: 'equator',     label: 'Równik niebieski' },
      { key: 'ecliptic',    label: 'Ekliptyka' },
      { key: 'raCircles',   label: 'Siatka RA (co 2h)' },
      { key: 'decParallels',label: 'Siatka Dec (±30°, ±60°)' },
    ],
  },
  {
    label: 'Punkty i osie',
    items: [
      { key: 'equinoxPoints',  label: 'Równonoce (γ i jesienna)' },
      { key: 'solsticePoints', label: 'Przesilenia (±23,44°)' },
      { key: 'poles',          label: 'Bieguny niebieskie' },
      { key: 'icrsAxes',       label: 'Osie ICRS / J2000' },
      { key: 'sunMarker',      label: 'Słońce' },
    ],
  },
];

const COLOR_LEGEND = [
  { color: '#00e5ff', label: 'Równik niebieski' },
  { color: '#ffd700', label: 'Ekliptyka' },
  { color: '#22c55e', label: 'Równonoc wiosenna γ' },
  { color: '#ef4444', label: 'Równonoc jesienna' },
  { color: '#f97316', label: 'Przesilenie letnie' },
  { color: '#3b82f6', label: 'Przesilenie zimowe' },
  { color: '#fbbf24', label: 'Słońce' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Główny widok
// ─────────────────────────────────────────────────────────────────────────────

export function CelestialSphereView({ onBack }: { onBack: () => void }) {
  const {
    vis, toggle, activeInfo,
    dayOfYear, animating, animSpeed, viewMode,
    setDayOfYear, setAnimating, setAnimSpeed, setViewMode,
  } = useCelestialStore();

  const info = getDayInfo(dayOfYear);

  return (
    <div className="flex h-screen bg-[#0a0e17] text-[#e6edf3] overflow-hidden">

      {/* ── Lewy sidebar ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-[#21262d] bg-[#0d1117] overflow-y-auto">

        {/* Nagłówek */}
        <div className="px-4 py-3 border-b border-[#21262d] flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#a371f7] font-bold text-sm tracking-wide font-mono">Sfera niebieska</span>
            <button
              onClick={onBack}
              className="text-xs font-mono px-2 py-0.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#a371f7]/60 hover:text-[#a371f7] transition-all"
            >
              ← Wstecz
            </button>
          </div>
          <div className="text-[#6e7681] text-[10px] font-mono">ICRS / J2000 — epoka 2000.0</div>
        </div>

        {/* ── Tryb widoku ── */}
        <div className="px-3 py-2 border-b border-[#21262d] flex-shrink-0">
          <div className="text-[#6e7681] text-[9px] uppercase tracking-widest font-mono mb-1.5">Perspektywa</div>
          <div className="grid grid-cols-2 gap-1">
            {(['geocentric', 'heliocentric'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`py-1.5 rounded text-[11px] font-mono font-medium border transition-all ${
                  viewMode === m
                    ? 'bg-[#a371f7]/20 border-[#a371f7] text-[#a371f7]'
                    : 'bg-[#161b22] border-[#30363d] text-[#6e7681] hover:border-[#a371f7]/40 hover:text-[#c9d1d9]'
                }`}
              >
                {m === 'geocentric' ? 'Geocentryczny' : 'Heliocentryczny'}
              </button>
            ))}
          </div>
          <div className="text-[#484f58] text-[9px] font-mono mt-1 leading-tight">
            {viewMode === 'geocentric'
              ? 'Ziemia w centrum, Słońce krąży po ekliptyce'
              : 'Słońce w centrum, Ziemia na orbicie'}
          </div>
        </div>

        {/* ── Animacja ── */}
        <div className="px-3 py-2 border-b border-[#21262d] flex-shrink-0">
          <div className="text-[#6e7681] text-[9px] uppercase tracking-widest font-mono mb-1.5">Animacja roczna</div>

          {/* Bieżąca data / pora roku */}
          <div className="bg-[#161b22] rounded-lg px-3 py-2 mb-2">
            <div className="text-[10px] font-mono" style={{ color: info.color }}>
              {info.season || 'brak pory roku'}
            </div>
            <div className="text-[#e6edf3] text-sm font-mono font-bold">{info.dateLabel}</div>
            <div className="text-[#484f58] text-[9px] font-mono">
              dzień roku: {Math.round(dayOfYear)}
            </div>
          </div>

          {/* Play/pause + reset */}
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => {
                const next = !animating;
                setAnimating(next);
                celestialAnim.animating = next;
              }}
              className={`flex-1 py-1.5 rounded text-xs font-mono font-bold border transition-all ${
                animating
                  ? 'bg-[#238636]/20 border-[#238636] text-[#3fb950]'
                  : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]/50'
              }`}
            >
              {animating ? '⏸ Pauza' : '▶ Start'}
            </button>
            <button
              onClick={() => {
                const d = 87; // ~28 marca
                setDayOfYear(d);
                celestialAnim.dayOfYear = d;
              }}
              className="px-2 py-1.5 rounded text-xs font-mono border border-[#30363d] text-[#6e7681] hover:border-[#58a6ff]/50 hover:text-[#c9d1d9] transition-all"
              title="Wróć do bieżącej daty"
            >
              ↺
            </button>
          </div>

          {/* Suwak dnia roku */}
          <div className="mb-1.5">
            <div className="flex justify-between text-[9px] font-mono text-[#484f58] mb-0.5">
              <span>1 sty</span><span>1 lip</span><span>31 gru</span>
            </div>
            <input
              type="range" min={0} max={364} step={1}
              value={Math.round(dayOfYear)}
              onChange={e => {
                const d = Number(e.target.value);
                setDayOfYear(d);
                celestialAnim.dayOfYear = d;
              }}
              className="w-full h-1 accent-[#a371f7] cursor-pointer"
            />
          </div>

          {/* Prędkość */}
          <div>
            <div className="flex justify-between items-center text-[9px] font-mono text-[#484f58] mb-0.5">
              <span>Prędkość</span>
              <span className="text-[#8b949e]">{animSpeed} dni/s</span>
            </div>
            <input
              type="range" min={1} max={120} step={1}
              value={animSpeed}
              onChange={e => {
                const s = Number(e.target.value);
                setAnimSpeed(s);
                celestialAnim.animSpeed = s;
              }}
              className="w-full h-1 accent-[#58a6ff] cursor-pointer"
            />
          </div>
        </div>

        {/* ── Togglei elementów ── */}
        <div className="flex-1 px-3 py-2 space-y-2">
          {TOGGLE_GROUPS.map(group => (
            <div key={group.label} className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 space-y-2">
              <div className="text-[#6e7681] text-[9px] uppercase tracking-widest font-mono">{group.label}</div>
              {group.items.map(item => (
                <Toggle key={item.key} label={item.label} value={vis[item.key]} onChange={() => toggle(item.key)} />
              ))}
            </div>
          ))}

          {/* Legenda */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3">
            <div className="text-[#6e7681] text-[9px] uppercase tracking-widest font-mono mb-2">Legenda</div>
            <div className="space-y-1">
              {COLOR_LEGEND.map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[#8b949e] text-[10px] font-mono">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[#484f58] text-[9px] font-mono leading-relaxed px-0.5 pb-2">
            Kliknij etykietę w scenie → opis elementu.
            Przeciągnij scenę by obrócić widok.
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
          <OrbitControls enablePan={false} minDistance={2} maxDistance={28} />
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
