import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { anim } from './animState';

const SEGS = 90;

interface GroundTrackProps {
  eph: KeplerianEphemeris;
  color: string;
  harmonics: boolean;
}

/**
 * Ślad naziemny — zawsze ECEF, punkty w lokalnej przestrzeni EarthAligned.
 * Imperatywna aktualizacja geometrii co 8 klatek — zero React re-renderów od czasu.
 */
export function GroundTrack({ eph, color, harmonics }: GroundTrackProps) {
  const frame = useRef(0);

  const posArr = useMemo(() => new Float32Array((SEGS + 1) * 3), []);

  const lineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mat = new THREE.LineBasicMaterial({ color, opacity: 0.55, transparent: true });
    return new THREE.Line(geo, mat);
  }, [color]);

  useEffect(() => {
    return () => {
      lineObj.geometry.dispose();
      (lineObj.material as THREE.Material).dispose();
    };
  }, [lineObj]);

  // Inicjalne wypełnienie bufora (t=0) by linia istniała przed pierwszą animacją
  useMemo(() => {
    for (let k = 0; k <= SEGS; k++) {
      const pos = computeGPSPosition(eph, 0, true, harmonics);
      const len = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
      const r = 1.003 / len;
      posArr[k * 3]     = pos.x * r;
      posArr[k * 3 + 1] = pos.z * r;
      posArr[k * 3 + 2] = -pos.y * r;
    }
  }, [eph, harmonics]);

  // Aktualizacja co 8 klatek
  useFrame(() => {
    frame.current++;
    if (frame.current % 8 !== 0) return;

    // W trybie live czytamy czas bezpośrednio z Date.now()
    const timeSec = anim.realtimeClock
      ? (Date.now() - anim.realtimeOriginMs) / 1000
      : anim.timeSec;
    const traceSec = anim.traceHours * 3600;
    for (let k = 0; k <= SEGS; k++) {
      const t = timeSec - traceSec + (k / SEGS) * traceSec;
      const pos = computeGPSPosition(eph, t, true, anim.showHarmonics);
      const len = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
      const r = 1.003 / len;
      posArr[k * 3]     = pos.x * r;
      posArr[k * 3 + 1] = pos.z * r;
      posArr[k * 3 + 2] = -pos.y * r;
    }
    lineObj.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={lineObj} />;
}
