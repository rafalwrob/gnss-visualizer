import { Suspense, useRef } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { anim } from './animState';
import { OMEGA_E } from '../../constants/gnss';

/** Skala: 1 jednostka R3F = R_E (6 378 137 m) */
export const SCENE_SCALE = 1 / 6378137;

/**
 * W ECI: Ziemia obraca się pod satelitami (rotation.y = OMEGA_E * timeSec).
 * W ECEF: Ziemia stoi nieruchomo (rotation.y = 0) — satelity orbitują w ukł. stałym.
 */
function useEarthRotation(meshRef: React.RefObject<THREE.Mesh>) {
  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = anim.useEcef ? 0 : OMEGA_E * anim.timeSec;
  });
}

function EarthTextured() {
  const meshRef = useRef<THREE.Mesh>(null!);
  useEarthRotation(meshRef);

  const [colorMap, normalMap, specularMap] = useLoader(TextureLoader, [
    '/textures/earth_daymap.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
  ]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial
        map={colorMap}
        normalMap={normalMap}
        specularMap={specularMap}
        specular={new THREE.Color(0x333355)}
        shininess={18}
      />
    </mesh>
  );
}

function EarthFallback() {
  const meshRef = useRef<THREE.Mesh>(null!);
  useEarthRotation(meshRef);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial color="#2a5a8c" emissive="#0a1830" shininess={10} />
    </mesh>
  );
}

export function Earth() {
  return (
    <Suspense fallback={<EarthFallback />}>
      <EarthTextured />
    </Suspense>
  );
}
