import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Earth } from './Earth';
import { anim } from './animState';
import { useCelestialStore } from '../../store/celestialStore';

const R = 5.0;
const EPS = 23.4392911 * (Math.PI / 180); // nachylenie ekliptyki J2000
const DEG = Math.PI / 180;
const J2000_MS = 946728000000; // 2000-01-01 12:00 TT w milisekundach Unix

// -----------------------------------------------------------------------
// Geometria
// -----------------------------------------------------------------------

function buildCircleBuffer(
  segments: number,
  pointFn: (t: number) => [number, number, number]
): THREE.BufferGeometry {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const [x, y, z] = pointFn(t);
    pts[i * 3] = x;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  return geo;
}

function buildHalfCircle(
  alpha: number,
  segments: number
): THREE.BufferGeometry {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const delta = -Math.PI / 2 + (i / segments) * Math.PI;
    pts[i * 3] = R * Math.cos(delta) * Math.cos(alpha);
    pts[i * 3 + 1] = R * Math.sin(delta);
    pts[i * 3 + 2] = -R * Math.cos(delta) * Math.sin(alpha);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  return geo;
}

function computeSunECI(): THREE.Vector3 {
  const D = (Date.now() - J2000_MS) / 86400000;
  const L = ((280.460 + 0.9856474 * D) % 360) * DEG;
  const g = ((357.528 + 0.9856003 * D) % 360) * DEG;
  const lambda = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
  return new THREE.Vector3(
    R * Math.cos(lambda),
    R * Math.sin(lambda) * Math.sin(EPS),
    -R * Math.sin(lambda) * Math.cos(EPS)
  );
}

// -----------------------------------------------------------------------
// Podkomponenty
// -----------------------------------------------------------------------

function CelestialSceneController() {
  useFrame(() => {
    anim.timeSec = (Date.now() - anim.simulationOriginMs) / 1000;
    anim.useEcef = false;
  });
  return null;
}

function CelestialSphereShell() {
  const geo = useMemo(() => new THREE.SphereGeometry(R, 36, 18), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        wireframe: true,
        transparent: true,
        opacity: 0.05,
      }),
    []
  );
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} />;
}

function GreatCircleLine({
  geo,
  color,
  opacity = 1,
}: {
  geo: THREE.BufferGeometry;
  color: string;
  opacity?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      }),
    [color, opacity]
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return <primitive object={new THREE.Line(geo, mat)} />;
}

function EquinoxPoints() {
  const { setActiveInfo } = useCelestialStore();
  const points = [
    {
      key: 'vernalEquinox',
      pos: new THREE.Vector3(R, 0, 0),
      color: '#22c55e',
      label: 'γ Równonoc wiosenna',
    },
    {
      key: 'autumnalEquinox',
      pos: new THREE.Vector3(-R, 0, 0),
      color: '#ef4444',
      label: 'Równonoc jesienna',
    },
  ];

  return (
    <>
      {points.map(({ key, pos, color, label }) => (
        <group key={key} position={pos}>
          <mesh>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Html
            distanceFactor={10}
            position={[pos.clone().normalize().x * 0.7, pos.clone().normalize().y * 0.7, pos.clone().normalize().z * 0.7]}
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color,
              pointerEvents: 'auto',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setActiveInfo(key)}
          >
            {label}
          </Html>
        </group>
      ))}
    </>
  );
}

function SolsticePoints() {
  const { setActiveInfo } = useCelestialStore();
  const points = [
    {
      key: 'summerSolstice',
      pos: new THREE.Vector3(0, R * Math.sin(EPS), -R * Math.cos(EPS)),
      color: '#f97316',
      label: `Przesilenie letnie +${(EPS / DEG).toFixed(2)}°`,
    },
    {
      key: 'winterSolstice',
      pos: new THREE.Vector3(0, -R * Math.sin(EPS), R * Math.cos(EPS)),
      color: '#3b82f6',
      label: `Przesilenie zimowe \u2212${(EPS / DEG).toFixed(2)}°`,
    },
  ];

  return (
    <>
      {points.map(({ key, pos, color, label }) => (
        <group key={key} position={pos}>
          <mesh>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Html
            distanceFactor={10}
            position={[0.7, 0, 0]}
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color,
              pointerEvents: 'auto',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setActiveInfo(key)}
          >
            {label}
          </Html>
        </group>
      ))}
    </>
  );
}

function CelestialPoles() {
  const { setActiveInfo } = useCelestialStore();
  const axisGeo = useMemo(() => {
    const pts = new Float32Array(6);
    pts[0] = 0; pts[1] = -R * 1.15; pts[2] = 0;
    pts[3] = 0; pts[4] =  R * 1.15; pts[5] = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);
  const axisMat = useMemo(
    () => new THREE.LineDashedMaterial({ color: '#4a5568', dashSize: 0.2, gapSize: 0.15 }),
    []
  );
  useEffect(() => {
    const line = new THREE.LineSegments(axisGeo, axisMat);
    line.computeLineDistances();
    return () => { axisGeo.dispose(); axisMat.dispose(); };
  }, [axisGeo, axisMat]);

  return (
    <>
      {/* oś obrotu (przerywana linia) */}
      <primitive
        object={(() => {
          const line = new THREE.LineSegments(axisGeo, axisMat);
          line.computeLineDistances();
          return line;
        })()}
      />

      {/* BPN */}
      <group position={[0, R, 0]}>
        <mesh>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color="#e6edf3" />
        </mesh>
        <Html
          distanceFactor={10}
          position={[0.7, 0, 0]}
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#e6edf3',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
          onClick={() => setActiveInfo('ncp')}
        >
          BPN (δ=+90°)
        </Html>
      </group>

      {/* BPD */}
      <group position={[0, -R, 0]}>
        <mesh>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color="#e6edf3" />
        </mesh>
        <Html
          distanceFactor={10}
          position={[0.7, 0, 0]}
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#8b949e',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
          onClick={() => setActiveInfo('scp')}
        >
          BPD (δ=\u221290°)
        </Html>
      </group>
    </>
  );
}

function IcrsAxes() {
  const { setActiveInfo } = useCelestialStore();
  const groupRef = useRef<THREE.Group>(null);
  const len = R * 1.25;

  useEffect(() => {
    if (!groupRef.current) return;
    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xff4444 },  // X → γ
      { dir: new THREE.Vector3(0, 0, -1), color: 0x22c55e }, // Y → RA=6h (ICRS Y = Three.js -Z)
      { dir: new THREE.Vector3(0, 1, 0), color: 0x3b82f6 },  // Z → BPN
    ];
    const added: THREE.ArrowHelper[] = [];
    for (const { dir, color } of axes) {
      const arrow = new THREE.ArrowHelper(
        dir,
        new THREE.Vector3(0, 0, 0),
        len,
        color,
        0.18,
        0.1
      );
      groupRef.current.add(arrow);
      added.push(arrow);
    }
    return () => {
      added.forEach(a => groupRef.current?.remove(a));
    };
  }, [len]);

  return (
    <group ref={groupRef}>
      {/* Labelki osi */}
      <Html
        distanceFactor={10}
        position={[len * 1.05, 0, 0]}
        style={{ fontSize: 11, fontFamily: 'monospace', color: '#ff4444', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
        onClick={() => setActiveInfo('icrsAxes')}
      >
        X — punkt γ (RA=0h)
      </Html>
      <Html
        distanceFactor={10}
        position={[0, 0, -len * 1.05]}
        style={{ fontSize: 11, fontFamily: 'monospace', color: '#22c55e', pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        Y — RA=6h
      </Html>
      <Html
        distanceFactor={10}
        position={[0, len * 1.05, 0]}
        style={{ fontSize: 11, fontFamily: 'monospace', color: '#3b82f6', pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        Z — BPN (Dec=+90°)
      </Html>
    </group>
  );
}

function SunMarker() {
  const { setActiveInfo } = useCelestialStore();
  const sunPos = useMemo(() => computeSunECI(), []);
  const lineGeo = useMemo(() => {
    const pts = new Float32Array(6);
    pts[0] = 0; pts[1] = 0; pts[2] = 0;
    pts[3] = sunPos.x; pts[4] = sunPos.y; pts[5] = sunPos.z;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, [sunPos]);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.4 }),
    []
  );
  useEffect(() => () => { lineGeo.dispose(); lineMat.dispose(); }, [lineGeo, lineMat]);

  return (
    <>
      <primitive object={new THREE.Line(lineGeo, lineMat)} />
      <group position={sunPos}>
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        <Html
          distanceFactor={10}
          position={[0.8, 0, 0]}
          style={{
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#fbbf24',
            pointerEvents: 'auto',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          onClick={() => setActiveInfo('sun')}
        >
          Slonce (dzis)
        </Html>
      </group>
    </>
  );
}

function RaHourCircles() {
  const { setActiveInfo } = useCelestialStore();
  const geos = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        buildHalfCircle((i * 30) * DEG, 64)
      ),
    []
  );
  const mats = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const isCardinal = i % 3 === 0; // 0h, 6h, 12h, 18h
        return new THREE.LineBasicMaterial({
          color: '#1e4a7a',
          transparent: true,
          opacity: isCardinal ? 0.55 : 0.35,
        });
      }),
    []
  );
  useEffect(
    () => () => {
      geos.forEach(g => g.dispose());
      mats.forEach(m => m.dispose());
    },
    [geos, mats]
  );

  return (
    <>
      {geos.map((geo, i) => (
        <primitive key={i} object={new THREE.Line(geo, mats[i])} />
      ))}
      {/* Labelki tylko dla kardynalnych (co 6h) */}
      {[0, 6, 12, 18].map(h => {
        const alpha = h * 15 * DEG;
        return (
          <Html
            key={h}
            distanceFactor={10}
            position={[R * 1.08 * Math.cos(alpha), 0.3, -R * 1.08 * Math.sin(alpha)]}
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#4a7ab5',
              pointerEvents: 'auto',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveInfo('raCircles')}
          >
            {h}h
          </Html>
        );
      })}
    </>
  );
}

function DecParallels() {
  const { setActiveInfo } = useCelestialStore();
  const decValues = [-60, -30, 30, 60]; // pomijamy 0° (jest równik)
  const geos = useMemo(
    () =>
      decValues.map(deg =>
        buildCircleBuffer(128, t => {
          const delta = deg * DEG;
          return [
            R * Math.cos(delta) * Math.cos(t),
            R * Math.sin(delta),
            -R * Math.cos(delta) * Math.sin(t),
          ];
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const mat = useMemo(
    () =>
      new THREE.LineBasicMaterial({ color: '#1a3a2a', transparent: true, opacity: 0.45 }),
    []
  );
  useEffect(() => () => { geos.forEach(g => g.dispose()); mat.dispose(); }, [geos, mat]);

  return (
    <>
      {geos.map((geo, i) => (
        <primitive key={i} object={new THREE.Line(geo, mat.clone())} />
      ))}
      {decValues.map(deg => {
        const delta = deg * DEG;
        const r = R * Math.cos(delta);
        const y = R * Math.sin(delta);
        return (
          <Html
            key={deg}
            distanceFactor={10}
            position={[r * 1.05, y, 0]}
            style={{
              fontSize: 10,
              fontFamily: 'monospace',
              color: '#2d6a4f',
              pointerEvents: 'auto',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onClick={() => setActiveInfo('decParallels')}
          >
            {deg > 0 ? '+' : ''}{deg}°
          </Html>
        );
      })}
    </>
  );
}

// -----------------------------------------------------------------------
// Główna scena
// -----------------------------------------------------------------------

export function CelestialSphereScene() {
  const { vis } = useCelestialStore();

  const equatorGeo = useMemo(
    () => buildCircleBuffer(128, t => [R * Math.cos(t), 0, -R * Math.sin(t)]),
    []
  );
  const eclipticGeo = useMemo(
    () =>
      buildCircleBuffer(128, t => [
        R * Math.cos(t),
        R * Math.sin(t) * Math.sin(EPS),
        -R * Math.sin(t) * Math.cos(EPS),
      ]),
    []
  );
  useEffect(
    () => () => { equatorGeo.dispose(); eclipticGeo.dispose(); },
    [equatorGeo, eclipticGeo]
  );

  return (
    <>
      <CelestialSceneController />
      <ambientLight intensity={0.35} />
      <directionalLight position={[10, 8, 5]} intensity={0.7} />
      <Stars radius={200} depth={60} count={5000} factor={4} saturation={0} fade />

      {/* Ziemia w centrum (zawsze widoczna — punkt odniesienia) */}
      <Earth />

      {vis.sphere && <CelestialSphereShell />}

      {vis.equator && (
        <GreatCircleLine geo={equatorGeo} color="#00e5ff" />
      )}
      {vis.equator && (
        <Html
          distanceFactor={10}
          position={[0, 0.25, R * 1.08]}
          style={{ fontSize: 10, fontFamily: 'monospace', color: '#00e5ff', pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          Równik niebieski (δ=0°)
        </Html>
      )}

      {vis.ecliptic && (
        <GreatCircleLine geo={eclipticGeo} color="#ffd700" />
      )}
      {vis.ecliptic && (
        <Html
          distanceFactor={10}
          position={[-R * 0.6, R * Math.sin(EPS) * 0.85, R * Math.cos(EPS) * 0.55]}
          style={{ fontSize: 10, fontFamily: 'monospace', color: '#ffd700', pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          Ekliptyka (ε=23,44°)
        </Html>
      )}

      {vis.raCircles && <RaHourCircles />}
      {vis.decParallels && <DecParallels />}
      {vis.equinoxPoints && <EquinoxPoints />}
      {vis.solsticePoints && <SolsticePoints />}
      {vis.poles && <CelestialPoles />}
      {vis.icrsAxes && <IcrsAxes />}
      {vis.sunMarker && <SunMarker />}
    </>
  );
}
