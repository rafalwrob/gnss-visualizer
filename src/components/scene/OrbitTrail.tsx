import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { computeGPSPosition, orbitalPeriod } from '../../services/orbital/keplerMath';
import { MU } from '../../constants/gnss';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { SCENE_SCALE } from './Earth';
import { anim } from './animState';

interface OrbitTrailProps {
  eph: KeplerianEphemeris;
  color: string;
  harmonics: boolean;
}

/** Liczba segmentów pełnej orbity — 2× dla obsługi zawijania indeksów */
const SEGMENTS = 360;

export function OrbitTrail({ eph, color, harmonics }: OrbitTrailProps) {
  const lineRef = useRef<THREE.Line>(null!);

  /**
   * Prekomputacja pełnej orbity w ECI — wykonywana TYLKO gdy eph / harmonics zmienią się.
   * NIE zależy od czasu bieżącego (tSec) → geometria nie jest przebudowywana przy każdej klatce.
   *
   * Bufor zdwojony (2×SEGMENTS): ułatwia drawRange bez zawijania.
   */
  const { geometry, period, n0 } = useMemo(() => {
    const period = orbitalPeriod(eph.a);
    const dt = period / SEGMENTS;
    const n0 = Math.sqrt(MU / Math.pow(eph.a, 3));

    // 2 kopie orbity w buforze → drawRange może zawierać do SEGMENTS ciągłych punktów
    const positions = new Float32Array(SEGMENTS * 2 * 3);
    for (let copy = 0; copy < 2; copy++) {
      for (let k = 0; k < SEGMENTS; k++) {
        const t = k * dt;
        const pos = computeGPSPosition(eph, t, false, harmonics); // zawsze ECI
        const i = (copy * SEGMENTS + k) * 3;
        positions[i + 0] = pos.x * SCENE_SCALE;
        positions[i + 1] = pos.z * SCENE_SCALE;
        positions[i + 2] = -pos.y * SCENE_SCALE;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setDrawRange(0, SEGMENTS);
    return { geometry: g, period, n0 };
  }, [eph, harmonics]); // ← brak tSec!

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }),
    [color],
  );

  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  /** Per-frame: TYLKO aktualizacja drawRange — O(1), zero obliczeń orbitalnych */
  useFrame(() => {
    if (!lineRef.current) return;
    const tSec = anim.timeSec;
    const traceSec = anim.traceHours * 3600;

    // Pozycja satelity na orbicie: M = M0 + n*t → faza [0, 2π)
    const M = eph.M0 + n0 * tSec;
    const phase = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const currentIdx = Math.floor((phase / (2 * Math.PI)) * SEGMENTS);

    // Ile segmentów = traceHours orbity
    const traceCount = Math.min(
      Math.ceil((traceSec / period) * SEGMENTS),
      SEGMENTS,
    );

    // startIdx + traceCount ≤ 2*SEGMENTS zawsze (zdwojony bufor)
    const startIdx = ((currentIdx - traceCount) % SEGMENTS + SEGMENTS) % SEGMENTS;
    lineRef.current.geometry.setDrawRange(startIdx, traceCount);
  });

  return <primitive ref={lineRef} object={lineObject} />;
}
