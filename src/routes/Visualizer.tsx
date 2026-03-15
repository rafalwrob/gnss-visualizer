import { GlobeScene } from '../components/scene/GlobeScene';
import { TimeControl } from '../components/panels/TimeControl';
import { SystemPanel } from '../components/panels/SystemPanel';
import { OrbitalElements } from '../components/panels/OrbitalElements';
import { SatelliteList } from '../components/panels/SatelliteList';
import { SatelliteDetailPanel } from '../components/panels/SatelliteDetailPanel';
import { KeplerStepper } from '../components/education/KeplerStepper';
import { useUiStore } from '../store/uiStore';
import type { LeftTab } from '../store/uiStore';

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-[#8b949e] text-[10px]">{label}</span>
      <div
        onClick={() => onChange(!value)}
        className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );
}

export function Visualizer() {
  const {
    showHarmonics, useEcef, showGroundTrack, onlineMode,
    setShowHarmonics, setUseEcef, setShowGroundTrack,
    activeTab, setActiveTab,
  } = useUiStore();

  const tabs: { id: LeftTab; label: string }[] = [
    { id: 'orbital',    label: 'Orbita' },
    { id: 'satellites', label: 'Satelity' },
    { id: 'kepler',     label: 'Kepler' },
    { id: 'settings',   label: 'Opcje' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0e17] text-[#e6edf3] overflow-hidden">

      {/* Lewa kolumna */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2 p-2 overflow-y-auto border-r border-[#21262d]">

        {/* Nagłówek */}
        <div className="pb-2 border-b border-[#21262d]">
          <div className="flex items-center justify-between">
            <div className="text-[#58a6ff] font-bold text-sm tracking-wider font-mono">GNSS Visualizer</div>
            {onlineMode && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0d2a1a] border border-[#238636] text-[#3fb950] text-[9px] font-bold font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <div className="text-[#6e7681] text-[9px] font-mono">3D Satellite Navigator · α</div>
        </div>

        {/* ECI / ECEF + Ślad naziemny */}
        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-2">
          <div className="text-[#8b949e] text-[9px] uppercase tracking-wider mb-1.5 font-mono">Układ współrzędnych</div>
          <div className="flex gap-1 mb-2">
            {(['ECI', 'ECEF'] as const).map(sys => {
              const active = sys === 'ECEF' ? useEcef : !useEcef;
              return (
                <button
                  key={sys}
                  onClick={() => setUseEcef(sys === 'ECEF')}
                  className={`flex-1 py-1.5 rounded text-[10px] font-mono font-bold border transition-all ${
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
          <div className="text-[9px] text-[#484f58] mb-2 font-mono">
            {useEcef
              ? 'ECEF — ślad w ukł. stałym z Ziemią (roseta)'
              : 'ECI — inercjalny, czyste elipsy orbit'}
          </div>

          <Toggle label="Ślad naziemny" value={showGroundTrack} onChange={setShowGroundTrack} />
        </div>

        <SystemPanel />
        <TimeControl />

        {/* Zakładki */}
        <div className="flex gap-0.5 bg-[#161b22] rounded p-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors ${
                activeTab === t.id
                  ? 'bg-[#21262d] text-[#58a6ff]'
                  : 'text-[#8b949e] hover:text-[#e6edf3]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'orbital' && <OrbitalElements />}
        {activeTab === 'satellites' && <SatelliteList />}
        {activeTab === 'kepler' && <KeplerStepper />}
        {activeTab === 'settings' && (
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 font-mono space-y-3">
            <div className="text-[#8b949e] text-[9px] uppercase tracking-wider">Ustawienia wizualizacji</div>

            <Toggle
              label="Perturbacje harmoniczne (J₂)"
              value={showHarmonics}
              onChange={setShowHarmonics}
            />
            <div className="text-[9px] text-[#484f58] -mt-1">
              Poprawki Crc, Crs, Cuc, Cus, Cic, Cis + dn, IDOT.
              Różnica ~5–200 m vs orbita Keplera.
            </div>
          </div>
        )}
      </div>

      {/* Główna scena 3D */}
      <div className="flex-1 relative">
        <GlobeScene />
        <div className="absolute bottom-2 right-2 text-[9px] text-[#21262d] font-mono pointer-events-none select-none">
          GNSS Visualizer α · Faza 1
        </div>
        {/* Prawy panel — szczegóły satelity (overlay nad sceną) */}
        <SatelliteDetailPanel />
      </div>
    </div>
  );
}
