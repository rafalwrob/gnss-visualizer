import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeGPSPosition } from '../../services/orbital/keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { SCENE_SCALE } from './Earth';
import { anim } from './animState';

const SEGS = 90;

interface OrbitTrailProps {
  eph: KeplerianEphemeris;
  color: string;
  harmonics: boolean;
  useEcef: boolean;
  selected?: boolean;
  dimmed?: boolean;
  /** Ghost trail — zawsze bez korekcji harmonicznych, niski opacity, szary */
  ghost?: boolean;
}

/**
 * Ślad orbity — zero subskrypcji Zustand, zero React re-renderów od czasu.
 * Zawsze dynamiczny: pokazuje ostatnie traceHours wstecz od bieżącej pozycji.
 * ECI: łuk na elipsie orbitalnej (koniec łuku = aktualna pozycja → ruch widoczny).
 * ECEF: roseta śladów naziemnych.
 * Aktualizacja geometrii co 8 klatek (~7.5 Hz przy 60fps).
 * Ghost=true: czyste elipsy Keplera (bez harmonik), opacity=0.25 — pokazuje przesunięcie.
 */
export function OrbitTrail({ eph, color, harmonics, selected = false, dimmed = false, ghost = false }: OrbitTrailProps) {
  // start=7 → pierwsza klatka useFrame od razu wykonuje aktualizację (8%8=0)
  const frame = useRef(7);

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

  // Wstępne wypełnienie przy zmianie efemerydy — widoczne przed pierwszą klatką
  useMemo(() => {
    const traceSec = anim.traceHours * 3600;
    const t0 = anim.realtimeClock
      ? (Date.now() - anim.realtimeOriginMs) / 1000
      : anim.timeSec;
    for (let k = 0; k <= SEGS; k++) {
      const t = t0 - traceSec + (k / SEGS) * traceSec;
      const pos = computeGPSPosition(eph, t, anim.useEcef, ghost ? false : harmonics);
      posArr[k * 3]     = pos.x * SCENE_SCALE;
      posArr[k * 3 + 1] = pos.z * SCENE_SCALE;
      posArr[k * 3 + 2] = -pos.y * SCENE_SCALE;
    }
    if (lineObj.geometry.attributes.position) {
      lineObj.geometry.attributes.position.needsUpdate = true;
    }
  }, [eph, harmonics, ghost]); // celowo pomijamy stable refs

  // Aktualizacja co 8 klatek — ECI i ECEF obsługiwane jednakowo
  useFrame(() => {
    // Opacity: ghost zawsze 0.25, inaczej na podstawie zaznaczenia
    const mat = lineObj.material as THREE.LineBasicMaterial;
    const opacity = ghost ? 0.25 : (selected ? 1.0 : dimmed ? 0.18 : 0.6);
    if (mat.opacity !== opacity) mat.opacity = opacity;

    frame.current++;
    if (frame.current % 8 !== 0) return;

    // W trybie live czytamy czas bezpośrednio z Date.now() — niezależnie od SceneController
    const timeSec = anim.realtimeClock
      ? (Date.now() - anim.realtimeOriginMs) / 1000
      : anim.timeSec;
    const traceSec = anim.traceHours * 3600;

    for (let k = 0; k <= SEGS; k++) {
      const t = timeSec - traceSec + (k / SEGS) * traceSec;
      const pos = computeGPSPosition(eph, t, anim.useEcef, ghost ? false : anim.showHarmonics);
      posArr[k * 3]     = pos.x * SCENE_SCALE;
      posArr[k * 3 + 1] = pos.z * SCENE_SCALE;
      posArr[k * 3 + 2] = -pos.y * SCENE_SCALE;
    }
    lineObj.geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={lineObj} />;
}
