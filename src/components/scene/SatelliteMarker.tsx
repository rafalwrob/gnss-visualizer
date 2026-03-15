import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { SCENE_SCALE } from './Earth';
import { anim } from './animState';

interface SatelliteMarkerProps {
  eph: KeplerianEphemeris;
  color: string;
  selected?: boolean;
  onClick?: () => void;
}

export function SatelliteMarker({ eph, color, selected = false, onClick }: SatelliteMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);

  const size = selected ? 0.026 : 0.018;

  /** Per-frame: bezpośrednia mutacja mesh.position — zero React re-renderów */
  useFrame(() => {
    const pos = computeGPSPosition(eph, anim.timeSec, anim.useEcef, anim.showHarmonics);
    const x = pos.x * SCENE_SCALE;
    const y = pos.z * SCENE_SCALE;
    const z = -pos.y * SCENE_SCALE;
    meshRef.current?.position.set(x, y, z);
    glowRef.current?.position.set(x, y, z);
  });

  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color }),
    [color],
  );

  const glowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, wireframe: true }),
    [color],
  );

  return (
    <group onClick={onClick}>
      <mesh ref={meshRef} material={mat}>
        <sphereGeometry args={[size, 8, 8]} />
      </mesh>
      {selected && (
        <mesh ref={glowRef} material={glowMat}>
          <sphereGeometry args={[size * 2.2, 8, 8]} />
        </mesh>
      )}
    </group>
  );
}
