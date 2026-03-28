import { useState } from 'react';
import { Visualizer } from './routes/Visualizer';
import { CelestialSphereView } from './routes/CelestialSphereView';

export default function App() {
  const [mode, setMode] = useState<'gnss' | 'celestial'>('gnss');
  if (mode === 'celestial') {
    return <CelestialSphereView onBack={() => setMode('gnss')} />;
  }
  return <Visualizer onEnterCelestial={() => setMode('celestial')} />;
}
