import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeGPSPosition, orbitalPeriod } from '../../services/orbital/keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { SCENE_SCALE } from './Earth';
import { anim } from './animState';

const SEGS = 90;

interface OrbitTrailProps {
  eph: KeplerianEphemeris;
  color: string;
  harmonics: boolean;
  useEcef: boolean;
}

/**
 * Ślad orbity — zero subskrypcji Zustand, zero React re-renderów od czasu.
 * ECI: statyczna pełna elipsa obliczona raz (z useMemo).
 * ECEF: imperatywna aktualizacja geometrii w useFrame co 8 klatek.
 */
export function OrbitTrail({ eph, color, harmonics }: OrbitTrailProps) {
  const frame = useRef(0);

  // Wstępnie alokowany bufor pozycji — nigdy nie tworzony od nowa
  const posArr = useMemo(() => new Float32Array((SEGS + 1) * 3), []);

  // Natywny Three.js line — wielokrotnie tańszy od drei Line2 (fat line mesh)
  const lineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mat = new THREE.LineBasicMaterial({ color, opacity: 0.75, transparent: true });
    return new THREE.Line(geo, mat);
  }, [color]); // przebuduj tylko gdy zmienia się kolor

  // Zwolnij GPU przy odmontowaniu / zmianie koloru
  useEffect(() => {
    return () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    };
  }, [lineObj]);

  // ECI: policz pełną elipsę raz gdy zmienia się efemerida lub harmoniki
  useMemo(() => {
    const period = orbitalPeriod(eph.a);
    for (let k = 0; k <= SEGS; k++) {
      const t = (k / SEGS) * period;
      const pos = computeGPSPosition(eph, t, false, harmonics);
      posArr[k * 3]     = pos.x * SCENE_SCALE;
      posArr[k * 3 + 1] = pos.z * SCENE_SCALE;
      posArr[k * 3 + 2] = -pos.y * SCENE_SCALE;
    }
    if (lineObj.geometry.attributes.position) {
      lineObj.geometry.attributes.position.needsUpdate = true;
    }
  }, [eph, harmonics]); // celowo pomijamy posArr/lineObj (stable refs)

  // ECEF: aktualizacja co 8 klatek (~7.5 Hz przy 60fps)
  useFrame(() => {
    if (!anim.useEcef) return;
    frame.current++;
    if (frame.current % 8 !== 0) return;

    const timeSec = anim.timeSec;
    const traceSec = anim.traceHours * 3600;
    for (let k = 0; k <= SEGS; k++) {
      const t = timeSec - traceSec + (k / SEGS) * traceSec;
      const pos = computeGPSPosition(eph, t, true, anim.showHarmonics);
      posArr[k * 3]     = pos.x * SCENE_SCALE;
      posArr[k * 3 + 1] = pos.z * SCENE_SCALE;
      posArr[k * 3 + 2] = -pos.y * SCENE_SCALE;
    }
    lineObj.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={lineObj} />;
}
