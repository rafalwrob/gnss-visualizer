import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { anim } from './animState';
import { latLonAltToEcef } from '../../services/coordinates/ecefEnu';
import { SCENE_SCALE } from './Earth';

const ARROW_LEN = 0.12;
const LABEL_OFF = ARROW_LEN * 1.25;

/**
 * 3 strzałki ENU (East/North/Up) w pozycji obserwatora.
 * Musi być zamontowany wewnątrz <EarthAligned> — wrapper obsługuje rotację ECI.
 * Imperatywne ArrowHelpers — zero React re-renderów per-klatkę.
 */
export function EnuAxes() {
  const groupRef  = useRef<THREE.Group>(null!);
  const labelERef = useRef<THREE.Group>(null!);
  const labelNRef = useRef<THREE.Group>(null!);
  const labelURef = useRef<THREE.Group>(null!);
  const arrowsRef = useRef<THREE.ArrowHelper[]>([]);

  useEffect(() => {
    const origin = new THREE.Vector3(0, 0, 0);
    const e = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, ARROW_LEN, 0xf0883e, 0.025, 0.012);
    const n = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, ARROW_LEN, 0x3fb950, 0.025, 0.012);
    const u = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), origin, ARROW_LEN, 0x58a6ff, 0.025, 0.012);
    arrowsRef.current = [e, n, u];
    groupRef.current.add(e, n, u);
    return () => {
      if (groupRef.current) {
        groupRef.current.remove(e, n, u);
      }
    };
  }, []);

  useFrame(() => {
    if (!anim.visibilityMode || !anim.showEnuAxes) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const lat = anim.obsLat * Math.PI / 180;
    const lon = anim.obsLon * Math.PI / 180;
    const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
    const sinLon = Math.sin(lon), cosLon = Math.cos(lon);

    // ENU basis vectors mapped do Three.js (X=ECEF_X, Y=ECEF_Z, Z=-ECEF_Y):
    //   East  ECEF = (-sinLon,  cosLon,   0)     → Three.js: (-sinLon, 0, -cosLon)
    //   North ECEF = (-sinLat*cosLon, -sinLat*sinLon, cosLat) → Three.js: (-sinLat*cosLon, cosLat,  sinLat*sinLon)
    //   Up    ECEF = (cosLat*cosLon,   cosLat*sinLon, sinLat) → Three.js: (cosLat*cosLon, sinLat, -cosLat*sinLon)
    const eDir = new THREE.Vector3(-sinLon,           0,        -cosLon).normalize();
    const nDir = new THREE.Vector3(-sinLat * cosLon,  cosLat,   sinLat * sinLon).normalize();
    const uDir = new THREE.Vector3( cosLat * cosLon,  sinLat,  -cosLat * sinLon).normalize();

    const [eArrow, nArrow, uArrow] = arrowsRef.current;
    eArrow.setDirection(eDir);
    nArrow.setDirection(nDir);
    uArrow.setDirection(uDir);

    // Pozycja grupy w ECEF Three.js — EarthAligned wrapper obraca do ECI
    const obs = latLonAltToEcef(anim.obsLat, anim.obsLon, anim.obsAlt);
    groupRef.current.position.set(obs.x * SCENE_SCALE, obs.z * SCENE_SCALE, -obs.y * SCENE_SCALE);

    // Etykiety za końcami strzałek
    labelERef.current.position.copy(eDir).multiplyScalar(LABEL_OFF);
    labelNRef.current.position.copy(nDir).multiplyScalar(LABEL_OFF);
    labelURef.current.position.copy(uDir).multiplyScalar(LABEL_OFF);
  });

  const labelStyle = (color: string) => ({
    color,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
  });

  return (
    <group ref={groupRef}>
      <group ref={labelERef}><Html style={labelStyle('#f0883e')}>E</Html></group>
      <group ref={labelNRef}><Html style={labelStyle('#3fb950')}>N</Html></group>
      <group ref={labelURef}><Html style={labelStyle('#58a6ff')}>U</Html></group>
    </group>
  );
}
