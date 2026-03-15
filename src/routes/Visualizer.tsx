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

function Toggle({
  label, hint, value, onChange,
}: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-[#c9d1d9] text-xs font-mono">{label}</span>
        <div
          onClick={() => onChange(!value)}
          className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer flex-shrink-0 ml-2 ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </label>
      {hint && <div className="text-[10px] text-[#484f58] mt-0.5 font-mono">{hint}</div>}
    </div>
  );
}

function SettingsPanel() {
  const {
    showHarmonics, useEcef, showGroundTrack,
    setShowHarmonics, setUseEcef, setShowGroundTrack,
  } = useUiStore();

  return (
    <div className="space-y-4 font-mono">

      {/* Układ współrzędnych */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4">
        <div className="text-[#8b949e] text-[11px] uppercase tracking-wider mb-3">
          Układ współrzędnych
        </div>
        <div className="flex gap-2 mb-2">
          {(['ECI', 'ECEF'] as const).map(sys => {
            const active = sys === 'ECEF' ? useEcef : !useEcef;
            return (
              <button
                key={sys}
                onClick={() => setUseEcef(sys === 'ECEF')}
                className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${
                  active
                    ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                    : 'bg-transparent border-[#30363d] text-[#6e7681] hover:border-[#58a6ff] hover:text-[#58a6ff]'
                }`}
              >
                {sys}
              </button>
            );
          })}
        </div>
        <div className="text-[11px] text-[#484f58]">
          {useEcef
            ? 'ECEF — ślad w ukł. stałym z Ziemią (roseta)'
            : 'ECI — inercjalny, czyste elipsy orbit'}
        </div>
      </div>

      {/* Wizualizacja */}
      <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4 space-y-4">
        <div className="text-[#8b949e] text-[11px] uppercase tracking-wider">Wizualizacja</div>
        <Toggle
          label="Ślad naziemny"
          value={showGroundTrack}
          onChange={setShowGroundTrack}
        />
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

const TABS: { id: LeftTab; label: string }[] = [
  { id: 'orbital',    label: 'Orbita' },
  { id: 'satellites', label: 'Satelity' },
  { id: 'kepler',     label: 'Kepler' },
  { id: 'visibility', label: 'Widoczność' },
  { id: 'receiver',   label: 'Odbiornik' },
  { id: 'settings',   label: 'Ustawienia' },
];

export function Visualizer() {
  const { onlineMode, activeTab, setActiveTab } = useUiStore();

  return (
    <div className="flex h-screen bg-[#0a0e17] text-[#e6edf3] overflow-hidden">

      {/* ── Lewa kolumna ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-[#21262d]">

        {/* Nagłówek */}
        <div className="px-4 py-3 border-b border-[#21262d] flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[#58a6ff] font-bold text-[15px] tracking-wide font-mono">
              GNSS Visualizer
            </span>
            {onlineMode && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d2a1a] border border-[#238636] text-[#3fb950] text-[11px] font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <div className="text-[#6e7681] text-[11px] font-mono mt-0.5">3D Satellite Navigator</div>
        </div>

        {/* Zawsze widoczne: SystemPanel + TimeControl */}
        <div className="px-4 py-3 border-b border-[#21262d] flex-shrink-0 space-y-3">
          <SystemPanel />
          <TimeControl />
        </div>

        {/* Siatka nawigacyjna 2×3 */}
        <div className="px-4 pt-3 pb-1 flex-shrink-0">
          <div className="grid grid-cols-2 gap-1.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-2.5 rounded-lg text-[13px] font-mono font-medium border transition-all ${
                  activeTab === t.id
                    ? 'bg-[#1f6feb]/15 border-[#1f6feb] text-[#58a6ff]'
                    : 'bg-[#0d1117] border-[#30363d] text-[#8b949e] hover:border-[#58a6ff]/60 hover:text-[#c9d1d9]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Zawartość zakładki — przewijalna */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activeTab === 'orbital'    && <OrbitalElements />}
          {activeTab === 'satellites' && <SatelliteList />}
          {activeTab === 'kepler'     && <KeplerStepper />}
          {activeTab === 'visibility' && <VisibilityPanel />}
          {activeTab === 'receiver'   && <ReceiverPanel />}
          {activeTab === 'settings'   && <SettingsPanel />}
        </div>

      </div>

      {/* ── Scena 3D ── */}
      <div className="flex-1 relative">
        <GlobeScene />
        <div className="absolute bottom-2 right-3 text-[10px] text-[#21262d] font-mono pointer-events-none select-none">
          GNSS Visualizer · α
        </div>
        <SatelliteDetailPanel />
      </div>
    </div>
  );
}
