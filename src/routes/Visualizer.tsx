import { GlobeScene } from '../components/scene/GlobeScene';
import { TimeControl } from '../components/panels/TimeControl';
import { SystemPanel } from '../components/panels/SystemPanel';
import { OrbitalElements } from '../components/panels/OrbitalElements';
import { SatelliteList } from '../components/panels/SatelliteList';
import { SatelliteDetailPanel } from '../components/panels/SatelliteDetailPanel';
import { KeplerStepper } from '../components/education/KeplerStepper';
import { VisibilityPanel } from '../components/panels/VisibilityPanel';
import { ReceiverPanel } from '../components/panels/ReceiverPanel';
import { useUiStore } from '../store/uiStore';
import type { LeftTab } from '../store/uiStore';

// ── Ustawienia (inline, bez osobnego komponentu żeby nie importować za dużo) ──

function Toggle({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="block cursor-pointer">
      <div className="flex items-center justify-between">
        <span className="text-[#c9d1d9] text-sm font-mono">{label}</span>
        <div
          onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ml-3 ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </div>
      {hint && <div className="text-xs text-[#484f58] mt-1 font-mono leading-relaxed">{hint}</div>}
    </label>
  );
}

function SettingsPanel() {
  const { showHarmonics, useEcef, showGroundTrack, setShowHarmonics, setUseEcef, setShowGroundTrack } = useUiStore();
  return (
    <div className="space-y-5 font-mono">
      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-5">
        <div className="text-[#8b949e] text-xs uppercase tracking-widest mb-4">Układ współrzędnych</div>
        <div className="flex gap-2 mb-3">
          {(['ECI', 'ECEF'] as const).map(sys => {
            const active = sys === 'ECEF' ? useEcef : !useEcef;
            return (
              <button key={sys} onClick={() => setUseEcef(sys === 'ECEF')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                  active ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                         : 'border-[#30363d] text-[#6e7681] hover:border-[#58a6ff] hover:text-[#58a6ff]'
                }`}
              >
                {sys}
              </button>
            );
          })}
        </div>
        <div className="text-sm text-[#484f58]">
          {useEcef ? 'ECEF — ślad w ukł. stałym z Ziemią (roseta)' : 'ECI — inercjalny, czyste elipsy orbit'}
        </div>
      </div>

      <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-5 space-y-5">
        <div className="text-[#8b949e] text-xs uppercase tracking-widest">Wizualizacja</div>
        <Toggle label="Ślad naziemny" value={showGroundTrack} onChange={setShowGroundTrack} />
        <Toggle
          label="Perturbacje harmoniczne (J₂)"
          hint="Poprawki Crc, Crs, Cuc, Cus, Cic, Cis + dn, IDOT. Różnica ~5–200 m vs orbita Keplera."
          value={showHarmonics}
          onChange={setShowHarmonics}
        />
      </div>
    </div>
  );
}

// ── Konfiguracja zakładek ──────────────────────────────────────────────────────

const TABS: { id: LeftTab; label: string; title: string }[] = [
  { id: 'orbital',    label: 'Orbita',      title: 'Elementy orbitalne' },
  { id: 'satellites', label: 'Satelity',    title: 'Lista satelitów' },
  { id: 'kepler',     label: 'Kepler',      title: 'Kalkulator Keplera' },
  { id: 'visibility', label: 'Widoczność',  title: 'Widoczność satelitów' },
  { id: 'receiver',   label: 'Odbiornik',   title: 'Odbiornik GNSS' },
  { id: 'settings',   label: 'Ustawienia',  title: 'Ustawienia' },
];

// ── Główny komponent ──────────────────────────────────────────────────────────

export function Visualizer() {
  const { onlineMode, activeTab, setActiveTab } = useUiStore();

  function toggleTab(id: LeftTab) {
    setActiveTab(activeTab === id ? null : id);
  }

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex h-screen bg-[#0a0e17] text-[#e6edf3] overflow-hidden">

      {/* ═══ LEWA KOLUMNA — kontrolki + nawigacja ═══ */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-[#21262d] bg-[#0d1117]">

        {/* Nagłówek */}
        <div className="px-4 py-3.5 border-b border-[#21262d] flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[#58a6ff] font-bold text-base tracking-wide font-mono">GNSS Visualizer</span>
            {onlineMode && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d2a1a] border border-[#238636] text-[#3fb950] text-xs font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <div className="text-[#6e7681] text-[11px] font-mono mt-0.5">3D Satellite Navigator</div>
        </div>

        {/* Zawsze widoczne kontrolki */}
        <div className="flex-shrink-0 overflow-y-auto px-3 py-3 space-y-3 border-b border-[#21262d]">
          <SystemPanel />
          <TimeControl />
        </div>

        {/* Siatka nawigacyjna 2×3 */}
        <div className="flex-shrink-0 px-3 py-3">
          <div className="text-[#484f58] text-[10px] uppercase tracking-widest font-mono mb-2 px-0.5">Widoki</div>
          <div className="grid grid-cols-2 gap-1.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => toggleTab(t.id)}
                className={`py-3 rounded-lg text-[13px] font-mono font-medium border transition-all ${
                  activeTab === t.id
                    ? 'bg-[#1f6feb]/20 border-[#1f6feb] text-[#58a6ff]'
                    : 'bg-[#161b22] border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]/50 hover:text-[#c9d1d9]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ═══ CENTRUM — scena 3D ═══ */}
      <div className="flex-1 relative min-w-0">
        <GlobeScene />
        <div className="absolute bottom-2 right-3 text-[10px] text-[#21262d] font-mono pointer-events-none select-none">
          GNSS Visualizer · α
        </div>
        <SatelliteDetailPanel />
      </div>

      {/* ═══ PRAWA SZUFLADA — zawartość zakładki ═══ */}
      {activeTab && currentTab && (
        <div className="w-[400px] flex-shrink-0 flex flex-col border-l border-[#21262d] bg-[#0d1117]">

          {/* Nagłówek panelu */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d] flex-shrink-0">
            <div>
              <div className="text-[#e6edf3] font-bold text-base font-mono">{currentTab.title}</div>
            </div>
            <button
              onClick={() => setActiveTab(null)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Zawartość — przewijalna */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === 'orbital'    && <OrbitalElements />}
            {activeTab === 'satellites' && <SatelliteList />}
            {activeTab === 'kepler'     && <KeplerStepper />}
            {activeTab === 'visibility' && <VisibilityPanel />}
            {activeTab === 'receiver'   && <ReceiverPanel />}
            {activeTab === 'settings'   && <SettingsPanel />}
          </div>

        </div>
      )}

    </div>
  );
}
