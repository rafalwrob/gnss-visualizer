import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useObserverStore } from '../../store/observerStore';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import { satElevAz, latLonAltToEcef } from '../../services/coordinates/ecefEnu';
import { anim } from './animState';
import { SCENE_SCALE } from './Earth';
import { OMEGA_E } from '../../constants/gnss';

// Pre-allocated buffer for up to 200 simultaneous lines
const MAX_LINES = 200;

/**
 * Rysuje linie od obserwatora do widocznych satelitów.
 * Całkowicie imperatywne — zero React re-renderów per-klatkę.
 */
export function SignalLines() {
  const { allSats, enabledSystems } = useObserverStore();

  const geomRef = useRef<THREE.BufferGeometry>(null!);
  const matRef = useRef<THREE.LineBasicMaterial>(null!);
  const posRef = useRef(new Float32Array(MAX_LINES * 2 * 3));

  // Inicjalizacja geometrii przy montowaniu
  useEffect(() => {
    if (!geomRef.current) return;
    const attr = new THREE.BufferAttribute(posRef.current, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    geomRef.current.setAttribute('position', attr);
    geomRef.current.setDrawRange(0, 0);
  }, []);

  useFrame(() => {
    if (!geomRef.current || !matRef.current) return;

    if (!anim.visibilityMode || !anim.showSignalLines) {
      geomRef.current.setDrawRange(0, 0);
      return;
    }

    const timeSec = anim.realtimeClock
      ? (Date.now() - anim.realtimeOriginMs) / 1000
      : anim.timeSec;

    // Pozycja obserwatora w Three.js world space
    const obs = latLonAltToEcef(anim.obsLat, anim.obsLon, anim.obsAlt);
    let ox = obs.x * SCENE_SCALE;
    const oy = obs.z * SCENE_SCALE;
    let oz = -obs.y * SCENE_SCALE;

    if (!anim.useEcef) {
      // W trybie ECI Ziemia obraca się — obracamy też pozycję obserwatora
      const theta = OMEGA_E * timeSec;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const newOx = ox * c + oz * s;
      oz = -ox * s + oz * c;
      ox = newOx;
    }

    const buf = posRef.current;
    let count = 0;

    for (const sat of allSats) {
      if (count >= MAX_LINES) break;
      if (!enabledSystems[sat.system]) continue;

      // Elewacja z ECEF (zawsze)
      const ecef = computeGPSPosition(sat.eph, timeSec, true, false);
      const { el } = satElevAz(ecef.x, ecef.y, ecef.z, anim.obsLat, anim.obsLon, anim.obsAlt);
      if (el < anim.obsMinElevation) continue;

      // Wizualna pozycja satelity dopasowana do SatelliteMarker
      let sx: number, sy: number, sz: number;
      if (anim.useEcef) {
        sx = ecef.x * SCENE_SCALE; sy = ecef.z * SCENE_SCALE; sz = -ecef.y * SCENE_SCALE;
      } else {
        const eci = computeGPSPosition(sat.eph, timeSec, false, false);
        sx = eci.x * SCENE_SCALE; sy = eci.z * SCENE_SCALE; sz = -eci.y * SCENE_SCALE;
      }

      const i = count * 6;
      buf[i]   = ox; buf[i+1] = oy; buf[i+2] = oz;
      buf[i+3] = sx; buf[i+4] = sy; buf[i+5] = sz;
      count++;
    }

    const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
    geomRef.current.setDrawRange(0, count * 2);

    // Pulsowanie
    matRef.current.opacity = 0.2 + 0.35 * Math.abs(Math.sin(timeSec * 1.5));
  });

  return (
    <lineSegments>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial ref={matRef} color="#00d4ff" transparent opacity={0.3} />
    </lineSegments>
  );
}
