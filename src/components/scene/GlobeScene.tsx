import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Earth, SCENE_SCALE } from './Earth';
import { IonoLayer } from './IonoLayer';
import { SatelliteMarker } from './SatelliteMarker';
import { OrbitTrail } from './OrbitTrail';
import { GroundTrack } from './GroundTrack';
import { anim } from './animState';
import { useSatelliteStore } from '../../store/satelliteStore';
import { useTimeStore } from '../../store/timeStore';
import { useUiStore } from '../../store/uiStore';
import { useObserverStore } from '../../store/observerStore';
import { useIonoStore } from '../../store/ionoStore';
import { OMEGA_E } from '../../constants/gnss';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { satElevAz, latLonAltToEcef } from '../../services/coordinates/ecefEnu';
import type { KeplerianEphemeris } from '../../types/ephemeris';

/** Synchronizuje mutable anim{} z Zustand stores oraz obsługuje pętlę animacji */
function SceneController() {
  const { animating, animSpeed, timeHours, traceHours, setTimeHours } = useTimeStore();
  const { showHarmonics, useEcef } = useUiStore();
  const { enabled: obsEnabled, lat: obsLat, lon: obsLon, alt: obsAlt, minElevation } = useObserverStore();

  const frameCount = useRef(0);

  // Synchronizacja Zustand → anim{}
  useEffect(() => { anim.animating = animating; }, [animating]);
  useEffect(() => { anim.animSpeed = animSpeed; }, [animSpeed]);
  useEffect(() => { anim.showHarmonics = showHarmonics; }, [showHarmonics]);
  useEffect(() => { anim.useEcef = useEcef; }, [useEcef]);
  useEffect(() => { anim.traceHours = traceHours; }, [traceHours]);
  useEffect(() => { anim.visibilityMode = obsEnabled; }, [obsEnabled]);
  useEffect(() => {
    anim.obsLat = obsLat;
    anim.obsLon = obsLon;
    anim.obsAlt = obsAlt;
  }, [obsLat, obsLon, obsAlt]);
  useEffect(() => { anim.obsMinElevation = minElevation; }, [minElevation]);

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
    anim.timeSec = (anim.timeSec + delta * anim.animSpeed) % (48 * 3600);
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

/**
 * Ukrywa grupę gdy satelita jest poniżej horyzontu obserwatora.
 * Czysto imperatywne — zero React re-renderów od widoczności.
 */
function SatVisibilityGate({ eph, children }: { eph: KeplerianEphemeris; children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    const timeSec = anim.realtimeClock
      ? (Date.now() - anim.realtimeOriginMs) / 1000
      : anim.timeSec;
    const { x, y, z } = computeGPSPosition(eph, timeSec, true, false);
    const { el } = satElevAz(x, y, z, anim.obsLat, anim.obsLon, anim.obsAlt);
    const vis = el >= anim.obsMinElevation;
    if (groupRef.current.visible !== vis) groupRef.current.visible = vis;
  });

  return <group ref={groupRef}>{children}</group>;
}

/** Czerwona kropka na powierzchni Ziemi w pozycji obserwatora */
function ObserverMarker() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const { x, y, z } = latLonAltToEcef(anim.obsLat, anim.obsLon, anim.obsAlt);
    meshRef.current.position.set(x * SCENE_SCALE, z * SCENE_SCALE, -y * SCENE_SCALE);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.015, 10, 10]} />
      <meshBasicMaterial color="#ff4444" />
    </mesh>
  );
}

/** Zawartość sceny 3D */
function SceneContent() {
  const { satellites, selectedIndex, mode, singleEph, selectSatellite } = useSatelliteStore();
  const { showHarmonics, showGroundTrack, useEcef, showEciAxes, setActiveTab } = useUiStore();
  const { enabled: obsEnabled, allSats, enabledSystems } = useObserverStore();
  const { enabled: ionoEnabled } = useIonoStore();

  const visibilityActive = obsEnabled && allSats.length > 0;
  const filteredObsSats = allSats.filter(s => enabledSystems[s.system]);
  const sats = mode === 'constellation' ? satellites : [];

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <directionalLight position={[-3, -2, -3]} intensity={0.15} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />

      <Earth />
      {ionoEnabled && <IonoLayer />}

      {/* === TRYB WIDOCZNOŚCI — wszystkie konstelacje, tylko nad horyzontem === */}
      {visibilityActive && (
        <>
          {filteredObsSats.map((sat) => (
            <SatVisibilityGate key={sat.prn} eph={sat.eph}>
              <OrbitTrail eph={sat.eph} color={sat.color} harmonics={showHarmonics} useEcef={useEcef} />
              {showGroundTrack && (
                <EarthAligned>
                  <GroundTrack eph={sat.eph} color={sat.color} harmonics={showHarmonics} />
                </EarthAligned>
              )}
              <SatelliteMarker
                eph={sat.eph}
                color={sat.color}
                selected={false}
                onClick={() => {
                  const store = useSatelliteStore.getState();
                  const existingIdx = store.satellites.findIndex(s => s.prn === sat.prn);
                  if (existingIdx >= 0) {
                    store.selectSatellite(existingIdx);
                  } else {
                    const newSats = [...store.satellites, sat];
                    store.setSatellites(newSats);
                    store.selectSatellite(newSats.length - 1);
                  }
                  setActiveTab('satellites');
                }}
              />
            </SatVisibilityGate>
          ))}
          <EarthAligned>
            <ObserverMarker />
          </EarthAligned>
        </>
      )}

      {/* === TRYB NORMALNY — pojedynczy satelita lub konstelacja === */}
      {!visibilityActive && mode === 'constellation' && sats.map((sat, i) => (
        <group key={sat.prn}>
          {showHarmonics && (
            <OrbitTrail
              eph={sat.eph}
              color="#484f58"
              harmonics={false}
              useEcef={useEcef}
              ghost
            />
          )}
          <OrbitTrail
            eph={sat.eph}
            color={sat.color}
            harmonics={showHarmonics}
            useEcef={useEcef}
            selected={i === selectedIndex}
            dimmed={selectedIndex >= 0 && i !== selectedIndex}
          />
          {showGroundTrack && (
            <EarthAligned>
              <GroundTrack
                eph={sat.eph}
                color={sat.color}
                harmonics={showHarmonics}
                selected={i === selectedIndex}
                dimmed={selectedIndex >= 0 && i !== selectedIndex}
              />
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

      {!visibilityActive && mode === 'single' && (
        <group>
          {showHarmonics && (
            <OrbitTrail eph={singleEph} color="#484f58" harmonics={false} useEcef={useEcef} ghost />
          )}
          <OrbitTrail eph={singleEph} color="#1f6feb" harmonics={showHarmonics} useEcef={useEcef} />
          {showGroundTrack && (
            <EarthAligned>
              <GroundTrack eph={singleEph} color="#ffcc00" harmonics={showHarmonics} />
            </EarthAligned>
          )}
          <SatelliteMarker eph={singleEph} color="#ffcc00" selected />
        </group>
      )}

      {/* === OSIE UKŁADU ODNIESIENIA (ECI lub ECEF) === */}
      {showEciAxes && (
        <group>
          <axesHelper args={[2.5]} />
          <Html position={[2.6, 0, 0]} style={{ color: '#ff4444', fontSize: 11, fontFamily: 'monospace', pointerEvents: 'none' }}>
            {useEcef ? 'X (ECEF)' : 'X (ECI)'}
          </Html>
          <Html position={[0, 2.6, 0]} style={{ color: '#44ff44', fontSize: 11, fontFamily: 'monospace', pointerEvents: 'none' }}>
            Z (N)
          </Html>
          <Html position={[0, 0, 2.6]} style={{ color: '#4488ff', fontSize: 11, fontFamily: 'monospace', pointerEvents: 'none' }}>
            {useEcef ? '-Y (ECEF)' : '-Y (ECI)'}
          </Html>
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
