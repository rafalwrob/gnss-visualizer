import { Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';

/** Skala: 1 jednostka R3F = R_E (6 378 137 m) */
export const SCENE_SCALE = 1 / 6378137;

function EarthTextured() {
  const [colorMap, normalMap, specularMap] = useLoader(TextureLoader, [
    '/textures/earth_daymap.jpg',
    '/textures/earth_normal.jpg',
    '/textures/earth_specular.jpg',
  ]);

  return (
    <mesh>
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
  return (
    <mesh>
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
