import { useState } from 'react';
import { GlobeScene } from '../components/scene/GlobeScene';
import { TimeControl } from '../components/panels/TimeControl';
import { SystemPanel } from '../components/panels/SystemPanel';
import { OrbitalElements } from '../components/panels/OrbitalElements';
import { SatelliteList } from '../components/panels/SatelliteList';
import { KeplerStepper } from '../components/education/KeplerStepper';
import { useUiStore } from '../store/uiStore';

type Tab = 'orbital' | 'satellites' | 'kepler' | 'settings';

export function Visualizer() {
  const [activeTab, setActiveTab] = useState<Tab>('orbital');
  const { showHarmonics, useEcef, showGroundTrack, setShowHarmonics, setUseEcef, setShowGroundTrack } = useUiStore();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'orbital', label: 'Orbita' },
    { id: 'satellites', label: 'Satelity' },
    { id: 'kepler', label: 'Kepler' },
    { id: 'settings', label: 'Opcje' },
  ];

  return (
    <div className="flex h-screen bg-[#0a0e17] text-[#e6edf3] overflow-hidden">
      {/* Lewa kolumna — kontrolki */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2 p-2 overflow-y-auto border-r border-[#21262d]">
        {/* Nagłówek */}
        <div className="pb-2 border-b border-[#21262d]">
          <div className="text-[#58a6ff] font-bold text-sm tracking-wider">GNSS Visualizer</div>
          <div className="text-[#6e7681] text-[9px]">3D Satellite Navigator</div>
        </div>

        <SystemPanel />
        <TimeControl />

        {/* Zakładki */}
        <div className="flex gap-0.5 bg-[#161b22] rounded p-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-1 rounded text-[10px] transition-colors ${
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
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs font-mono space-y-2">
            <div className="text-[#8b949e] text-[10px] uppercase tracking-wider mb-2">Ustawienia</div>
            {[
              { label: 'Perturbacje harmoniczne', value: showHarmonics, setter: setShowHarmonics },
              { label: 'Układ ECEF', value: useEcef, setter: setUseEcef },
              { label: 'Ślad naziemny', value: showGroundTrack, setter: setShowGroundTrack },
            ].map(({ label, value, setter }) => (
              <label key={label} className="flex items-center justify-between cursor-pointer">
                <span className="text-[#8b949e] text-[10px]">{label}</span>
                <div
                  onClick={() => setter(!value)}
                  className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${value ? 'bg-[#238636]' : 'bg-[#21262d]'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Główny widok 3D */}
      <div className="flex-1 relative">
        <GlobeScene />

        {/* Watermark */}
        <div className="absolute bottom-2 right-2 text-[9px] text-[#30363d] font-mono pointer-events-none">
          GNSS Visualizer α · Faza 1
        </div>
      </div>
    </div>
  );
}
