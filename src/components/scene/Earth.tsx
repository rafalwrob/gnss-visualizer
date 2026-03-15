import { useMemo } from 'react';
import * as THREE from 'three';
import { CONTINENTS } from '../../constants/continents';

/** Skala: 1 jednostka R3F = R_E (6 378 137 m) */
export const SCENE_SCALE = 1 / 6378137;

function createGlobeTexture(): THREE.CanvasTexture {
  const W = 2048, H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Ocean — gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#04101e');
  grad.addColorStop(0.5, '#0a1a2e');
  grad.addColorStop(1, '#04101e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Siatka (graticule)
  ctx.strokeStyle = '#0d2035';
  ctx.lineWidth = 0.8;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Równik
  ctx.strokeStyle = '#173050';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  // Kontynenty
  ctx.fillStyle = '#1e3d2a';
  ctx.strokeStyle = '#2d5a3d';
  ctx.lineWidth = 1.2;
  for (const poly of CONTINENTS) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Delikatne podświetlenie kontynentów (specular feel)
  ctx.fillStyle = 'rgba(60,90,60,0.10)';
  for (const poly of CONTINENTS) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Earth() {
  const texture = useMemo(() => createGlobeTexture(), []);

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshPhongMaterial
        map={texture}
        specular={new THREE.Color(0x112233)}
        shininess={6}
      />
    </mesh>
  );
}
