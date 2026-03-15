import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Earth } from './Earth';
import { SatelliteMarker } from './SatelliteMarker';
import { OrbitTrail } from './OrbitTrail';
import { GroundTrack } from './GroundTrack';
import { anim } from './animState';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useTimeStore } from '../../store/timeStore';
import { useUiStore } from '../../store/uiStore';
import { OMEGA_E } from '../../constants/gnss';

/** Synchronizuje mutable anim{} z Zustand stores oraz obsługuje pętlę animacji */
function SceneController() {
  const { animating, animSpeed, timeHours, traceHours, setTimeHours } = useTimeStore();
  const { showHarmonics, useEcef } = useUiStore();

  const frameCount = useRef(0);

  // Synchronizacja Zustand → anim{}
  useEffect(() => { anim.animating = animating; }, [animating]);
  useEffect(() => { anim.animSpeed = animSpeed; }, [animSpeed]);
  useEffect(() => { anim.showHarmonics = showHarmonics; }, [showHarmonics]);
  useEffect(() => { anim.useEcef = useEcef; }, [useEcef]);
  useEffect(() => { anim.traceHours = traceHours; }, [traceHours]);

  // Suwak UI → anim.timeSec (tylko gdy NIE animujemy i NIE live)
  useEffect(() => {
    if (!animating && !anim.realtimeClock) {
      anim.timeSec = timeHours * 3600;
    }
  }, [timeHours, animating]);

  useFrame((_, delta) => {
    // Live: zegar ścienny 1:1, bez mnożnika prędkości
    if (anim.realtimeClock) {
      anim.timeSec = (Date.now() - anim.realtimeOriginMs) / 1000;
      return;
    }
    // Symulacja: 4320× przy speed=1
    if (!anim.animating) return;
    anim.timeSec = (anim.timeSec + delta * anim.animSpeed * 4320) % (48 * 3600);
    frameCount.current++;
    if (frameCount.current % 16 === 0) {
      setTimeHours(anim.timeSec / 3600);
    }
  });

  return null;
}

/**
 * Wrapper który obraca dzieci dokładnie tak samo jak siatka Ziemi.
 * Punkty ECEF wewnątrz stają się ECI: R_y(OMEGA_E*t) * P_ecef = P_eci.
 * W ECEF: rotation=0 (Ziemia stoi, punkty ECEF = world space).
 */
function EarthAligned({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null!);
  useFrame(() => {
    groupRef.current.rotation.y = anim.useEcef ? 0 : OMEGA_E * anim.timeSec;
  });
  return <group ref={groupRef}>{children}</group>;
}

/** Zawartość sceny 3D */
function SceneContent() {
  const { satellites, selectedIndex, mode, singleEph, selectSatellite } = useSatelliteStore();
  const { showHarmonics, showGroundTrack, useEcef, setActiveTab } = useUiStore();

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
            useEcef={useEcef}
          />
          {showGroundTrack && (
            <EarthAligned>
              <GroundTrack eph={sat.eph} color={sat.color} harmonics={showHarmonics} />
            </EarthAligned>
          )}
          <SatelliteMarker
            eph={sat.eph}
            color={sat.color}
            selected={i === selectedIndex}
            onClick={() => { selectSatellite(i); setActiveTab('satellites'); }}
          />
        </group>
      ))}

      {mode === 'single' && (
        <group>
          <OrbitTrail eph={singleEph} color="#1f6feb" harmonics={showHarmonics} useEcef={useEcef} />
          {showGroundTrack && (
            <EarthAligned>
              <GroundTrack eph={singleEph} color="#ffcc00" harmonics={showHarmonics} />
            </EarthAligned>
          )}
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
