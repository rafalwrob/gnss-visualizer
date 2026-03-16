import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useIonoStore } from '../../store/ionoStore';
import { buildIonoGrid } from '../../services/orbital/ionosphere';
import type { KlobucharParams } from '../../types/ionosphere';
import { OMEGA_E } from '../../constants/gnss';
import { anim } from './animState';

/** Promień powłoki jonosferycznej (~350 km) w jednostkach sceny (1 = R_E) */
const IONO_R = 1.055;
const TEX_W = 90;
const TEX_H = 45;

function heatRGBA(t: number): [number, number, number, number] {
  // Blue → Cyan → Green → Yellow → Red
  const t4 = t * 4;
  const seg = Math.min(3, Math.floor(t4));
  const f = t4 - seg;
  const pairs: [number, number, number][] = [
    [0, 0, 255], [0, 255, 255], [0, 255, 0], [255, 255, 0], [255, 0, 0],
  ];
  const c0 = pairs[seg];
  const c1 = pairs[seg + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
    165,
  ];
}

function buildTexture(params: KlobucharParams, gpsSec: number): THREE.CanvasTexture {
  const { grid, minV, maxV } = buildIonoGrid(TEX_H, TEX_W, params, gpsSec);
  const range = maxV - minV || 1;

  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(TEX_W, TEX_H);

  for (let row = 0; row < TEX_H; row++) {
    for (let col = 0; col < TEX_W; col++) {
      const delay = grid[row * TEX_W + col];
      const t = Math.max(0, Math.min(1, (delay - minV) / range));
      const [r, g, b, a] = heatRGBA(t);
      const idx = (row * TEX_W + col) * 4;
      img.data[idx]   = r;
      img.data[idx+1] = g;
      img.data[idx+2] = b;
      img.data[idx+3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Powłoka jonosferyczna Klobuchar w 3D.
 * Obraca się razem z Ziemią (ECEF-aligned).
 * Odświeża teksturę gdy zmieniają się parametry α/β lub co ~5s dla efektu czasu.
 */
export function IonoLayer() {
  const { alpha, beta } = useIonoStore();
  const meshRef = useRef<THREE.Mesh>(null!);
  const frameRef = useRef(0);
  const lastGpsSec = useRef(-9999);

  const params = useMemo<KlobucharParams>(() => ({
    a0: alpha[0], a1: alpha[1], a2: alpha[2], a3: alpha[3],
    b0: beta[0],  b1: beta[1],  b2: beta[2],  b3: beta[3],
  }), [alpha, beta]);

  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const geo = useMemo(() => new THREE.SphereGeometry(IONO_R, 72, 36), []);

  // Materiał tworzony raz, tekstura podmieniana imperatywnie
  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    map: buildTexture(params, 0),
    transparent: true,
    opacity: 0.65,
    side: THREE.FrontSide,
    depthWrite: false,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { geo.dispose(); mat.map?.dispose(); mat.dispose(); };
  }, [geo, mat]);

  // Przebuduj teksturę gdy parametry Klobuchar się zmieniają
  useEffect(() => {
    const gpsSec = Math.round(anim.timeSec % 604800);
    const oldTex = mat.map;
    mat.map = buildTexture(params, gpsSec);
    mat.needsUpdate = true;
    oldTex?.dispose();
  }, [params, mat]);

  useFrame(() => {
    if (!meshRef.current) return;
    // Ko-rotacja z Ziemią
    meshRef.current.rotation.y = anim.useEcef ? 0 : OMEGA_E * anim.timeSec;

    // Co 300 klatek (~5s) odśwież dla zmieniającego się czasu dnia
    frameRef.current++;
    if (frameRef.current % 300 !== 0) return;
    const gpsSec = Math.round(anim.timeSec % 604800);
    if (Math.abs(gpsSec - lastGpsSec.current) < 60) return;
    lastGpsSec.current = gpsSec;
    const oldTex = mat.map;
    mat.map = buildTexture(paramsRef.current, gpsSec);
    mat.needsUpdate = true;
    oldTex?.dispose();
  });

  return <mesh ref={meshRef} geometry={geo} material={mat} />;
}
