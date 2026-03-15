import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { SCENE_SCALE } from './Earth';

interface SatelliteMarkerProps {
  eph: KeplerianEphemeris;
  color: string;
  tSec: number;
  useEcef: boolean;
  harmonics: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function SatelliteMarker({
  eph, color, tSec, useEcef, harmonics, selected = false, onClick,
}: SatelliteMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const position = useMemo(() => {
    const pos = computeGPSPosition(eph, tSec, useEcef, harmonics);
    // Three.js: Y = hight axis; konwersja z ECEF (X=right, Y=up, Z=toward)
    return new THREE.Vector3(pos.x * SCENE_SCALE, pos.z * SCENE_SCALE, -pos.y * SCENE_SCALE);
  }, [eph, tSec, useEcef, harmonics]);

  const size = selected ? 0.025 : 0.018;

  return (
    <group position={position} onClick={onClick}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {selected && (
        <mesh>
          <sphereGeometry args={[size * 1.8, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} wireframe />
        </mesh>
      )}
    </group>
  );
}
