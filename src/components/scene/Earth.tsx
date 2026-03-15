import { Component, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';

/** Skala: 1 jednostka R3F = R_E (6 378 137 m) */
export const SCENE_SCALE = 1 / 6378137;

// Error boundary — łapie błąd z useLoader gdy brak tekstur
class TextureErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

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
        specular={new THREE.Color(0x333333)}
        shininess={15}
      />
    </mesh>
  );
}

function EarthSolid() {
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial color="#1a4a6e" emissive="#071420" emissiveIntensity={0.3} shininess={8} />
    </mesh>
  );
}

export function Earth() {
  const fallback = <EarthSolid />;
  return (
    <TextureErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <EarthTextured />
      </Suspense>
    </TextureErrorBoundary>
  );
}
