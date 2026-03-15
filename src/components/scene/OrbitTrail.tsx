import { useMemo } from 'react';
import * as THREE from 'three';
import { computeGPSPosition, orbitalPeriod } from '../../services/orbital/keplerMath';
import type { KeplerianEphemeris } from '../../types/ephemeris';
import { SCENE_SCALE } from './Earth';

interface OrbitTrailProps {
  eph: KeplerianEphemeris;
  color: string;
  tSec: number;
  traceHours: number;
  useEcef: boolean;
  harmonics: boolean;
  segments?: number;
}

export function OrbitTrail({
  eph, color, tSec, traceHours, useEcef, harmonics, segments = 120,
}: OrbitTrailProps) {
  const geometry = useMemo(() => {
    const period = orbitalPeriod(eph.a);
    const traceSec = Math.min(traceHours * 3600, period);
    const dt = traceSec / segments;
    const positions = new Float32Array((segments + 1) * 3);

    for (let k = 0; k <= segments; k++) {
      const t = tSec - traceSec + k * dt;
      const pos = computeGPSPosition(eph, t, useEcef, harmonics);
      positions[k * 3 + 0] = pos.x * SCENE_SCALE;
      positions[k * 3 + 1] = pos.z * SCENE_SCALE;
      positions[k * 3 + 2] = -pos.y * SCENE_SCALE;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [eph, tSec, traceHours, useEcef, harmonics, segments]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }),
    [color],
  );

  // Kluczowe: memoizuj sam obiekt Line — bez tego nowy obiekt THREE przy każdym renderze
  const lineObject = useMemo(
    () => new THREE.Line(geometry, material),
    [geometry, material],
  );

  return <primitive object={lineObject} />;
}
