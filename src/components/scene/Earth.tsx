import { Suspense, useRef, useMemo } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { TextureLoader } from 'three';
import * as THREE from 'three';
import { anim } from './animState';
import { OMEGA_E } from '../../constants/gnss';
import earthDaymap from '../../assets/textures/earth_daymap.jpg';

/** Skala: 1 jednostka R3F = R_E (6 378 137 m) */
export const SCENE_SCALE = 1 / 6378137;

/**
 * Oblicza kierunek Słońca w układzie ECEF (= lokalnym meshera Ziemi).
 * Wynik jest już w konwencji Three.js: X=ECEF_X, Y=ECEF_Z, Z=-ECEF_Y.
 *
 * Algorytm: uproszczone równania słoneczne Bowninga (dokładność ~1°).
 */
function computeSunDirECEF(unixMs: number): THREE.Vector3 {
  // Doby od J2000.0 (2000-01-01T12:00:00 UTC = 946728000000 ms)
  const D = (unixMs - 946728000000) / 86400000;

  // Średnia długość ekliptyczna i anomalia średnia [rad]
  const Lrad = ((280.460 + 0.9856474 * D) % 360) * (Math.PI / 180);
  const gRad = ((357.528 + 0.9856003 * D) % 360) * (Math.PI / 180);

  // Długość ekliptyczna [rad] z poprawką eliptyczności
  const lambda = Lrad + (1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) * (Math.PI / 180);

  // Ukośność ekliptyki [rad]
  const eps = 23.4393 * (Math.PI / 180);

  // Wersor Słońca w ECI (X = punkt Barana, Z = biegun północny)
  const eciX = Math.cos(lambda);
  const eciY = Math.sin(lambda) * Math.cos(eps);
  const eciZ = Math.sin(lambda) * Math.sin(eps);

  // GMST [rad] — kąt obrotu Ziemi od J2000.0
  const GMST = ((280.461 + 360.98564724 * D) % 360) * (Math.PI / 180);

  // ECI → ECEF: obrót wokół Z o GMST
  const ecefX =  eciX * Math.cos(GMST) + eciY * Math.sin(GMST);
  const ecefY = -eciX * Math.sin(GMST) + eciY * Math.cos(GMST);
  const ecefZ =  eciZ;

  // Three.js: X=ECEF_X, Y=ECEF_Z, Z=-ECEF_Y
  return new THREE.Vector3(ecefX, ecefZ, -ecefY).normalize();
}

// ── Shadery ────────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv     = uv;
  vNormal = normal; // w przestrzeni lokalnej meshera (ECEF) — sunDir jest w tym samym układzie
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Fragment shader dla wersji z teksturą */
const FRAG_TEXTURED = /* glsl */`
uniform sampler2D dayMap;
uniform vec3      sunDir; // wersor Słońca w przestrzeni ECEF / lokalnej meshera

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec4 day  = texture2D(dayMap, vUv);

  // Cosinus kąta między normalą powierzchni a kierunkiem Słońca
  float cosA = dot(normalize(vNormal), normalize(sunDir));

  // Łagodny terminator: przejście ±~7° szerokości geograficznej
  float light = smoothstep(-0.12, 0.12, cosA);

  // Strona nocna: bardzo ciemna niebiesko-granatowa
  vec4 night = vec4(day.rgb * 0.04 + vec3(0.0, 0.003, 0.012), 1.0);

  gl_FragColor = mix(night, day, light);
}
`;

/** Fragment shader dla fallbacku (bez tekstury) */
const FRAG_FALLBACK = /* glsl */`
uniform vec3 sunDir;

varying vec3 vNormal;

void main() {
  float cosA = dot(normalize(vNormal), normalize(sunDir));
  float light = smoothstep(-0.12, 0.12, cosA);

  vec3 day   = vec3(0.16, 0.35, 0.55);
  vec3 night = day * 0.06 + vec3(0.0, 0.002, 0.025);

  gl_FragColor = vec4(mix(night, day, light), 1.0);
}
`;

// ── Wspólny hook: obrót Ziemi + aktualizacja terminatora ──────────────────────

function useEarthUpdate(meshRef: React.RefObject<THREE.Mesh>) {
  useFrame(() => {
    if (!meshRef.current) return;

    // Obrót siatki Ziemi
    meshRef.current.rotation.y = anim.useEcef ? 0 : OMEGA_E * anim.timeSec;

    // Kierunek Słońca w ECEF (lokalnym układzie meshera)
    const simMs = anim.simulationOriginMs + anim.timeSec * 1000;
    const sunDir = computeSunDirECEF(simMs);
    (meshRef.current.material as THREE.ShaderMaterial).uniforms.sunDir.value.copy(sunDir);
  });
}

// ── Komponenty Ziemi ──────────────────────────────────────────────────────────

function EarthTextured() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const colorMap = useLoader(TextureLoader, earthDaymap);

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: colorMap },
        sunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader:   VERT,
      fragmentShader: FRAG_TEXTURED,
    }),
    [colorMap],
  );

  useEarthUpdate(meshRef);

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

function EarthFallback() {
  const meshRef = useRef<THREE.Mesh>(null!);

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader:   VERT,
      fragmentShader: FRAG_FALLBACK,
    }),
    [],
  );

  useEarthUpdate(meshRef);

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[1, 64, 64]} />
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
