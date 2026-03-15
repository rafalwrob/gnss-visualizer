import * as THREE from 'three';

/** Skala: 1 jednostka R3F = R_E (6 378 137 m) */
export const SCENE_SCALE = 1 / 6378137;

/**
 * Kula Ziemi — renderuje jednolity kolor (fallback).
 * Aby włączyć tekstury NASA, umieść pliki w public/textures/:
 *   earth_daymap.jpg, earth_normal.jpg, earth_specular.jpg
 * i odkomentuj EarthTextured w pliku.
 */
export function Earth() {
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial
        color="#1a4a6e"
        emissive="#071420"
        emissiveIntensity={0.3}
        shininess={8}
        specular={new THREE.Color(0x222244)}
      />
    </mesh>
  );
}
