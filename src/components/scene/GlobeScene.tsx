import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Earth } from './Earth';
import { SatelliteMarker } from './SatelliteMarker';
import { OrbitTrail } from './OrbitTrail';
import { anim } from './animState';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useTimeStore } from '../../store/timeStore';
import { useUiStore } from '../../store/uiStore';

/** Synchronizuje mutable anim{} z Zustand stores oraz obsługuje pętlę animacji */
function SceneController() {
  const { animating, animSpeed, timeHours, setTimeHours } = useTimeStore();
  const { showHarmonics, useEcef, traceHours } = useUiStore();

  const frameCount = useRef(0);

  // Synchronizacja stan Zustand → anim{}
  useEffect(() => { anim.animating = animating; }, [animating]);
  useEffect(() => { anim.animSpeed = animSpeed; }, [animSpeed]);
  useEffect(() => { anim.showHarmonics = showHarmonics; }, [showHarmonics]);
  useEffect(() => { anim.useEcef = useEcef; }, [useEcef]);
  useEffect(() => { anim.traceHours = traceHours; }, [traceHours]);

  // Suwak UI → anim.timeSec (tylko gdy NIE animujemy)
  useEffect(() => {
    if (!animating) {
      anim.timeSec = timeHours * 3600;
    }
  }, [timeHours, animating]);

  // Główna pętla: 1.2h/s czasu symulacji przy speed=1 (jak stara wersja)
  useFrame((_, delta) => {
    if (!anim.animating) return;
    anim.timeSec = (anim.timeSec + delta * anim.animSpeed * 4320) % (48 * 3600);

    // Aktualizuj Zustand (i suwak UI) co 16 klatek (~4 Hz przy 60fps)
    frameCount.current++;
    if (frameCount.current % 16 === 0) {
      setTimeHours(anim.timeSec / 3600);
    }
  });

  return null;
}

/** Zawartość sceny 3D */
function SceneContent() {
  const { satellites, selectedIndex, mode, singleEph, selectSatellite } = useSatelliteStore();
  const { showHarmonics } = useUiStore();

  const sats = mode === 'constellation' ? satellites : [];

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <directionalLight position={[-3, -2, -3]} intensity={0.15} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />

      <Earth />

      {mode === 'constellation' && sats.map((sat, i) => (
        <group key={sat.prn}>
          <OrbitTrail
            eph={sat.eph}
            color={sat.color}
            harmonics={showHarmonics}
          />
          <SatelliteMarker
            eph={sat.eph}
            color={sat.color}
            selected={i === selectedIndex}
            onClick={() => selectSatellite(i)}
          />
        </group>
      ))}

      {mode === 'single' && (
        <group>
          <OrbitTrail eph={singleEph} color="#1f6feb" harmonics={showHarmonics} />
          <SatelliteMarker eph={singleEph} color="#ffcc00" selected />
        </group>
      )}

      <OrbitControls enablePan={false} minDistance={1.25} maxDistance={20} />
    </>
  );
}

export function GlobeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.6], fov: 45 }}
      style={{ background: '#050a14' }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
    >
      <SceneController />
      <SceneContent />
    </Canvas>
  );
}
