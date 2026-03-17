import { useEffect, useState } from 'react';
import { GlobeScene } from '../components/scene/GlobeScene';
import { TimeControl } from '../components/panels/TimeControl';
import { SystemPanel } from '../components/panels/SystemPanel';
import { OrbitalElements } from '../components/panels/OrbitalElements';
import { SatelliteList } from '../components/panels/SatelliteList';
import { KeplerStepper } from '../components/education/KeplerStepper';
import { VisibilityPanel } from '../components/panels/VisibilityPanel';
import { VisibilityControls } from '../components/panels/VisibilityControls';
import { ReceiverPanel } from '../components/panels/ReceiverPanel';
import { FrequencyPanel } from '../components/panels/FrequencyPanel';
import { useUiStore } from '../store/uiStore';
import type { LeftTab } from '../store/uiStore';
import { useObserverStore } from '../store/observerStore';

// ── Toggle komponent ──────────────────────────────────────────────────────────

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
  const {
    showGroundTrack, setShowGroundTrack,
    showEciAxes, setShowEciAxes,
    showSignalLines, setShowSignalLines,
    showEnuAxes, setShowEnuAxes,
  } = useUiStore();
  return (
    <div className="space-y-4 font-mono">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest">Wizualizacja</div>
        <Toggle label="Ślad naziemny" value={showGroundTrack} onChange={setShowGroundTrack} />
        <Toggle
          label="Osie układu (ECI/ECEF)"
          hint="Czerwona=X, Zielona=Z (N), Niebieska=-Y"
          value={showEciAxes}
          onChange={setShowEciAxes}
        />
      </div>
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-4">
        <div className="text-[#6e7681] text-[10px] uppercase tracking-widest">Tryb widoczności</div>
        <Toggle
          label="Linie sygnałowe"
          hint="Linie obserwator↔satelity (pulsujące)"
          value={showSignalLines}
          onChange={setShowSignalLines}
        />
        <Toggle
          label="Osie ENU"
          hint="E (wsch.) · N (płn.) · U (góra) przy obserwatorze"
          value={showEnuAxes}
          onChange={setShowEnuAxes}
        />
      </div>
    </div>
  );
}

// ── Konfiguracja nawigacji (bez Widoczność — jest w SystemPanel) ──────────────

const NAV_TABS: { id: LeftTab; label: string }[] = [
  { id: 'orbital',    label: 'Parametry' },
  { id: 'satellites', label: 'Satelity' },
  { id: 'kepler',     label: 'Kalkulator' },
  { id: 'receiver',   label: 'Odbiornik' },
  { id: 'signals',    label: 'Sygnały' },
  { id: 'settings',   label: 'Ustawienia' },
];

const TAB_TITLES: Partial<Record<LeftTab, string>> = {
  orbital:    'Parametry orbity',
  satellites: 'Lista satelitów',
  kepler:     'Kalkulator Keplera',
  visibility: 'Widoczność satelitów',
  receiver:   'Odbiornik GNSS',
  signals:    'Pasma sygnałów GNSS',
  settings:   'Ustawienia sceny',
};

// ── Główny komponent ──────────────────────────────────────────────────────────

export function Visualizer() {
  const { onlineMode, activeTab, setActiveTab, useEcef, setUseEcef } = useUiStore();
  const [panelWide, setPanelWide] = useState(false);
  const { enabled: obsEnabled, isFetching } = useObserverStore();

  // Gdy tryb widoczności włączony → auto-otwórz prawy panel z wynikami
  useEffect(() => {
    if (obsEnabled) {
      setActiveTab('visibility');
    } else if (activeTab === 'visibility' && !isFetching) {
      setActiveTab(null);
    }
  }, [obsEnabled, isFetching]);

  const currentTitle = activeTab ? TAB_TITLES[activeTab] : null;

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

        {/* ECI / ECEF — zawsze widoczne */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-[#21262d]">
          <div className="flex gap-1.5">
            {(['ECI', 'ECEF'] as const).map(sys => {
              const active = sys === 'ECEF' ? useEcef : !useEcef;
              return (
                <button
                  key={sys}
                  onClick={() => setUseEcef(sys === 'ECEF')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    active
                      ? 'bg-[#1f6feb] border-[#1f6feb] text-white'
                      : 'border-[#30363d] text-[#6e7681] hover:border-[#58a6ff] hover:text-[#58a6ff]'
                  }`}
                >
                  {sys}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] text-[#484f58] font-mono mt-1 text-center">
            {useEcef ? 'ECEF — stały z Ziemią' : 'ECI — inercjalny, czyste elipsy'}
          </div>
        </div>

        {/* SystemPanel — zawsze widoczny */}
        <div className="flex-shrink-0 px-3 pt-3 pb-0">
          <SystemPanel />
        </div>

        {/* Kontrolki zależne od trybu — przewijalne */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 border-b border-[#21262d]">
          {obsEnabled ? <VisibilityControls /> : <TimeControl />}
        </div>

        {/* Siatka nawigacyjna 2×3 (bez Widoczność) */}
        <div className="flex-shrink-0 px-3 py-3">
          <div className="text-[#484f58] text-[10px] uppercase tracking-widest font-mono mb-2 px-0.5">Widoki</div>
          <div className="grid grid-cols-2 gap-1.5">
            {NAV_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(activeTab === t.id ? null : t.id)}
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
      </div>

      {/* ═══ PRAWA SZUFLADA — zawartość zakładki ═══ */}
      {activeTab && currentTitle && (
        <div
          className="flex-shrink-0 flex flex-col border-l border-[#21262d] bg-[#0d1117] transition-[width] duration-200"
          style={{ width: panelWide ? 680 : 400 }}
        >

          {/* Nagłówek panelu */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#21262d] flex-shrink-0">
            <div className="text-[#e6edf3] font-bold text-base font-mono">{currentTitle}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPanelWide(w => !w)}
                title={panelWide ? 'Zwęź panel' : 'Rozszerz panel'}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors text-sm"
              >
                {panelWide ? '⟩' : '⟨'}
              </button>
              <button
                onClick={() => setActiveTab(null)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Zawartość — przewijalna */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {activeTab === 'orbital'    && <OrbitalElements />}
            {activeTab === 'satellites' && <SatelliteList />}
            {activeTab === 'kepler'     && <KeplerStepper />}
            {activeTab === 'visibility' && <VisibilityPanel />}
            {activeTab === 'receiver'   && <ReceiverPanel />}
            {activeTab === 'signals'    && <FrequencyPanel />}
            {activeTab === 'settings'   && <SettingsPanel />}
          </div>

        </div>
      )}

    </div>
  );
}
