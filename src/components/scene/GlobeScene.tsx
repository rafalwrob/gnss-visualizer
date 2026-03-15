import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Earth } from './Earth';
import { SatelliteMarker } from './SatelliteMarker';
import { OrbitTrail } from './OrbitTrail';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useTimeStore } from '../../store/timeStore';
import { useUiStore } from '../../store/uiStore';

export function GlobeScene() {
  const { satellites, selectedIndex, mode, singleEph, selectSatellite } = useSatelliteStore();
  const { timeHours, traceHours } = useTimeStore();
  const { showHarmonics, useEcef } = useUiStore();

  const tSec = timeHours * 3600;

  return (
    <Canvas
      camera={{ position: [0, 0, 3.5], fov: 45 }}
      style={{ background: '#050a14' }}
      gl={{ antialias: true }}
    >
      {/* Oświetlenie */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />

      {/* Gwiazdy tła */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />

      {/* Ziemia */}
      <Earth />

      {/* Konstelacja */}
      {mode === 'constellation' && satellites.map((sat, i) => (
        <group key={sat.prn}>
          <OrbitTrail
            eph={sat.eph}
            color={sat.color}
            tSec={tSec}
            traceHours={traceHours}
            useEcef={useEcef}
            harmonics={showHarmonics}
          />
          <SatelliteMarker
            eph={sat.eph}
            color={sat.color}
            tSec={tSec}
            useEcef={useEcef}
            harmonics={showHarmonics}
            selected={i === selectedIndex}
            onClick={() => selectSatellite(i)}
          />
        </group>
      ))}

      {/* Tryb pojedynczego satelity */}
      {mode === 'single' && (
        <group>
          <OrbitTrail
            eph={singleEph}
            color="#1f6feb"
            tSec={tSec}
            traceHours={traceHours}
            useEcef={useEcef}
            harmonics={showHarmonics}
          />
          <SatelliteMarker
            eph={singleEph}
            color="#ffcc00"
            tSec={tSec}
            useEcef={useEcef}
            harmonics={showHarmonics}
            selected
          />
        </group>
      )}

      {/* Kontrola kamery */}
      <OrbitControls enablePan={false} minDistance={1.2} maxDistance={20} />
    </Canvas>
  );
}
