import { useEffect, useRef, useMemo, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { Earth } from './Earth';
import earthDaymap from '../../assets/textures/earth_daymap.jpg';
import { anim } from './animState';
import { celestialAnim } from './celestialAnim';
import { useCelestialStore } from '../../store/celestialStore';
import type { CelestialVisibility } from '../../store/celestialStore';

// ─────────────────────────────────────────────────────────────────────────────
// Stałe
// ─────────────────────────────────────────────────────────────────────────────

const R      = 5.0;          // promień sfery niebieskiej
const R_ORB  = 2.6;          // promień orbity Ziemi (heliocentryczny)
const EPS    = 23.4392911 * (Math.PI / 180);   // nachylenie ekliptyki J2000
const DEG    = Math.PI / 180;

/**
 * Długość ekliptyczna Słońca (geocentryczna) dla danego dnia roku.
 * Ruch średni od równonocy (~20 mar, dzień 79) + równanie środka
 * (poprawka eliptyczności orbity, peryhelium ~3 sty, e=0.0167).
 * Dokładność ~0,03° — wystarczająca dla wizualizacji.
 */
function sunLambda(dayOfYear: number): number {
  const L = ((dayOfYear - 79) / 365.25) * 2 * Math.PI;           // średnia długość od γ
  const g = ((dayOfYear - 2) / 365.25) * 2 * Math.PI;            // anomalia średnia (peryhelium ~3 sty)
  return L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
}

/**
 * Pozycja Słońca w geocentrycznym układzie (ICRS→Three.js).
 * r = promień (zazwyczaj R sfery niebieskiej).
 */
function sunPosGeo(lambda: number, r: number): THREE.Vector3 {
  return new THREE.Vector3(
    r * Math.cos(lambda),
    r * Math.sin(lambda) * Math.sin(EPS),
    -r * Math.sin(lambda) * Math.cos(EPS)
  );
}

/**
 * Pozycja Ziemi w heliocentrycznym układzie ICRS→Three.js.
 * Ziemia jest zawsze naprzeciw Słońca (λ_earth = λ_sun + π).
 */
function earthPosHelio(lambda: number, r: number): THREE.Vector3 {
  const le = lambda + Math.PI;
  return new THREE.Vector3(
    r * Math.cos(le),
    r * Math.sin(le) * Math.sin(EPS),
    -r * Math.sin(le) * Math.cos(EPS)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometria
// ─────────────────────────────────────────────────────────────────────────────

function buildCircleBuffer(
  segments: number,
  fn: (t: number) => [number, number, number]
): THREE.BufferGeometry {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 * Math.PI;
    const [x, y, z] = fn(t);
    pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  return g;
}

function buildHalfCircle(alpha: number, r: number, segs = 64): THREE.BufferGeometry {
  const pts = new Float32Array((segs + 1) * 3);
  for (let i = 0; i <= segs; i++) {
    const d = -Math.PI / 2 + (i / segs) * Math.PI;
    pts[i * 3]     = r * Math.cos(d) * Math.cos(alpha);
    pts[i * 3 + 1] = r * Math.sin(d);
    pts[i * 3 + 2] = -r * Math.cos(d) * Math.sin(alpha);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// Kontroler animacji
// ─────────────────────────────────────────────────────────────────────────────

function CelestialSceneController() {
  const { animating, animSpeed, setDayOfYear } = useCelestialStore();
  const frameRef = useRef(0);

  // Sync Zustand → mutable
  useEffect(() => { celestialAnim.animating = animating; }, [animating]);
  useEffect(() => { celestialAnim.animSpeed = animSpeed; }, [animSpeed]);

  useFrame((_, delta) => {
    // Podtrzymuj obrót Ziemi w tle (ECI)
    anim.timeSec = (Date.now() - anim.simulationOriginMs) / 1000;
    anim.useEcef = false;

    // Animacja dnia roku
    if (celestialAnim.animating) {
      celestialAnim.dayOfYear =
        ((celestialAnim.dayOfYear + delta * celestialAnim.animSpeed) % 365 + 365) % 365;
    }

    // Sync do Zustand co 15 klatek (dla UI)
    if (++frameRef.current % 15 === 0) {
      setDayOfYear(celestialAnim.dayOfYear);
    }
  });

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wspólne elementy sfery (geocentryczny + heliocentryczny)
// ─────────────────────────────────────────────────────────────────────────────

function CelestialSphereShell() {
  const geo = useMemo(() => new THREE.SphereGeometry(R, 36, 18), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.05 }),
    []
  );
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  return <mesh geometry={geo} material={mat} />;
}

function GLine({ geo, color, opacity = 1 }: { geo: THREE.BufferGeometry; color: string; opacity?: number }) {
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    [color, opacity]
  );
  const line = useMemo(() => new THREE.Line(geo, mat), [geo, mat]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <primitive object={line} />;
}

function EquinoxPoints() {
  const { setActiveInfo } = useCelestialStore();
  const pts = [
    { key: 'vernalEquinox',    pos: new THREE.Vector3(R, 0, 0),  color: '#22c55e', label: 'γ Równonoc wiosenna' },
    { key: 'autumnalEquinox',  pos: new THREE.Vector3(-R, 0, 0), color: '#ef4444', label: 'Równonoc jesienna' },
  ];
  return (
    <>
      {pts.map(({ key, pos, color, label }) => (
        <group key={key} position={pos}>
          <mesh><sphereGeometry args={[0.08, 12, 12]} /><meshBasicMaterial color={color} /></mesh>
          <Html distanceFactor={10} position={[0.7, 0, 0]}
            style={{ fontSize: 11, fontFamily: 'monospace', color, pointerEvents: 'auto', whiteSpace: 'nowrap', cursor: 'pointer' }}
            onClick={() => setActiveInfo(key)}>
            {label}
          </Html>
        </group>
      ))}
    </>
  );
}

function SolsticePoints() {
  const { setActiveInfo } = useCelestialStore();
  const pts = [
    { key: 'summerSolstice', pos: new THREE.Vector3(0, R * Math.sin(EPS), -R * Math.cos(EPS)),  color: '#f97316', label: `Przesilenie letnie +${(EPS/DEG).toFixed(2)}°` },
    { key: 'winterSolstice', pos: new THREE.Vector3(0, -R * Math.sin(EPS), R * Math.cos(EPS)), color: '#3b82f6', label: `Przesilenie zimowe \u2212${(EPS/DEG).toFixed(2)}°` },
  ];
  return (
    <>
      {pts.map(({ key, pos, color, label }) => (
        <group key={key} position={pos}>
          <mesh><sphereGeometry args={[0.08, 12, 12]} /><meshBasicMaterial color={color} /></mesh>
          <Html distanceFactor={10} position={[0.7, 0, 0]}
            style={{ fontSize: 11, fontFamily: 'monospace', color, pointerEvents: 'auto', whiteSpace: 'nowrap', cursor: 'pointer' }}
            onClick={() => setActiveInfo(key)}>
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
    const pts = new Float32Array([0, -R * 1.15, 0, 0, R * 1.15, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);
  const axisMat = useMemo(
    () => new THREE.LineDashedMaterial({ color: '#4a5568', dashSize: 0.2, gapSize: 0.15 }),
    []
  );
  const axisLine = useMemo(() => {
    const l = new THREE.LineSegments(axisGeo, axisMat);
    l.computeLineDistances();
    return l;
  }, [axisGeo, axisMat]);
  useEffect(() => () => { axisGeo.dispose(); axisMat.dispose(); }, [axisGeo, axisMat]);

  return (
    <>
      <primitive object={axisLine} />
      <group position={[0, R, 0]}>
        <mesh><sphereGeometry args={[0.1, 12, 12]} /><meshBasicMaterial color="#e6edf3" /></mesh>
        <Html distanceFactor={10} position={[0.7, 0, 0]}
          style={{ fontSize: 11, fontFamily: 'monospace', color: '#e6edf3', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => setActiveInfo('ncp')}>
          BPN (δ=+90°)
        </Html>
      </group>
      <group position={[0, -R, 0]}>
        <mesh><sphereGeometry args={[0.1, 12, 12]} /><meshBasicMaterial color="#8b949e" /></mesh>
        <Html distanceFactor={10} position={[0.7, 0, 0]}
          style={{ fontSize: 11, fontFamily: 'monospace', color: '#8b949e', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => setActiveInfo('scp')}>
          BPD (δ=−90°)
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
    const defs = [
      { dir: new THREE.Vector3(1, 0, 0),  color: 0xff4444 },
      { dir: new THREE.Vector3(0, 0, -1), color: 0x22c55e },
      { dir: new THREE.Vector3(0, 1, 0),  color: 0x3b82f6 },
    ];
    const added: THREE.ArrowHelper[] = [];
    for (const { dir, color } of defs) {
      const a = new THREE.ArrowHelper(dir, new THREE.Vector3(), len, color, 0.18, 0.1);
      groupRef.current.add(a);
      added.push(a);
    }
    return () => { added.forEach(a => groupRef.current?.remove(a)); };
  }, [len]);

  return (
    <group ref={groupRef}>
      <Html distanceFactor={10} position={[len * 1.05, 0, 0]}
        style={{ fontSize: 11, fontFamily: 'monospace', color: '#ff4444', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
        onClick={() => setActiveInfo('icrsAxes')}>
        X — punkt γ (RA=0h)
      </Html>
      <Html distanceFactor={10} position={[0, 0, -len * 1.05]}
        style={{ fontSize: 11, fontFamily: 'monospace', color: '#22c55e', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        Y — RA=6h
      </Html>
      <Html distanceFactor={10} position={[0, len * 1.05, 0]}
        style={{ fontSize: 11, fontFamily: 'monospace', color: '#3b82f6', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
        Z — BPN (Dec=+90°)
      </Html>
    </group>
  );
}

function RaHourCircles() {
  const { setActiveInfo } = useCelestialStore();
  const geos = useMemo(
    () => Array.from({ length: 12 }, (_, i) => buildHalfCircle(i * 30 * DEG, R, 64)),
    []
  );
  const mats = useMemo(
    () => Array.from({ length: 12 }, (_, i) =>
      new THREE.LineBasicMaterial({ color: '#1e4a7a', transparent: true, opacity: i % 3 === 0 ? 0.55 : 0.35 })
    ),
    []
  );
  useEffect(() => () => { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); }, [geos, mats]);
  return (
    <>
      {geos.map((geo, i) => <primitive key={i} object={new THREE.Line(geo, mats[i])} />)}
      {[0, 6, 12, 18].map(h => {
        const a = h * 15 * DEG;
        return (
          <Html key={h} distanceFactor={10} position={[R * 1.08 * Math.cos(a), 0.3, -R * 1.08 * Math.sin(a)]}
            style={{ fontSize: 10, fontFamily: 'monospace', color: '#4a7ab5', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => setActiveInfo('raCircles')}>
            {h}h
          </Html>
        );
      })}
    </>
  );
}

function DecParallels() {
  const { setActiveInfo } = useCelestialStore();
  const decVals = [-60, -30, 30, 60];
  const geos = useMemo(
    () => decVals.map(deg => {
      const d = deg * DEG;
      return buildCircleBuffer(128, t => [R * Math.cos(d) * Math.cos(t), R * Math.sin(d), -R * Math.cos(d) * Math.sin(t)]);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#1a3a2a', transparent: true, opacity: 0.45 }),
    []
  );
  useEffect(() => () => { geos.forEach(g => g.dispose()); mat.dispose(); }, [geos, mat]);
  return (
    <>
      {geos.map((geo, i) => <primitive key={i} object={new THREE.Line(geo, mat.clone())} />)}
      {decVals.map(deg => {
        const d = deg * DEG;
        return (
          <Html key={deg} distanceFactor={10} position={[R * Math.cos(d) * 1.05, R * Math.sin(d), 0]}
            style={{ fontSize: 10, fontFamily: 'monospace', color: '#2d6a4f', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => setActiveInfo('decParallels')}>
            {deg > 0 ? '+' : ''}{deg}°
          </Html>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Geocentryczny: animowane Słońce
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedSunMarker() {
  const { setActiveInfo } = useCelestialStore();
  const groupRef = useRef<THREE.Group>(null);

  // Linia centrum→Słońce
  const linePts = useMemo(() => new Float32Array(6), []);
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(linePts, 3));
    return g;
  }, [linePts]);
  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.4 }),
    []
  );
  const lineObj = useMemo(() => new THREE.Line(lineGeo, lineMat), [lineGeo, lineMat]);
  useEffect(() => () => { lineGeo.dispose(); lineMat.dispose(); }, [lineGeo, lineMat]);

  useFrame(() => {
    if (!groupRef.current) return;
    const lambda = sunLambda(celestialAnim.dayOfYear);
    const pos = sunPosGeo(lambda, R);
    groupRef.current.position.copy(pos);
    linePts[3] = pos.x; linePts[4] = pos.y; linePts[5] = pos.z;
    lineGeo.attributes.position.needsUpdate = true;
  });

  return (
    <>
      <primitive object={lineObj} />
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        <Html distanceFactor={10} position={[0.8, 0, 0]}
          style={{ fontSize: 11, fontFamily: 'monospace', color: '#fbbf24', pointerEvents: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => setActiveInfo('sun')}>
          ☀ Słońce
        </Html>
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Heliocentryczny: orbita Ziemi + animowana Ziemia
// ─────────────────────────────────────────────────────────────────────────────

// Pozycje pór roku w widoku heliocentrycznym (Earth orbital positions)
// λ_earth = λ_sun + π — Ziemia naprzeciw geocentrycznego Słońca
const HELIO_SEASONS = [
  {
    label: 'Równonoc wiosenna\n~20 mar · dzień = noc',
    pos: earthPosHelio(0, R_ORB * 1.42),             // λ_sun=0 → λ_earth=π → (-R,0,0)
    color: '#22c55e',
    dot: earthPosHelio(0, R_ORB),
  },
  {
    label: 'Przesilenie letnie\n~21 cze · lato półkuli N',
    pos: earthPosHelio(Math.PI / 2, R_ORB * 1.42),
    color: '#f97316',
    dot: earthPosHelio(Math.PI / 2, R_ORB),
  },
  {
    label: 'Równonoc jesienna\n~23 wrz · dzień = noc',
    pos: earthPosHelio(Math.PI, R_ORB * 1.42),
    color: '#ef4444',
    dot: earthPosHelio(Math.PI, R_ORB),
  },
  {
    label: 'Przesilenie zimowe\n~21 gru · zima półkuli N',
    pos: earthPosHelio((3 * Math.PI) / 2, R_ORB * 1.42),
    color: '#3b82f6',
    dot: earthPosHelio((3 * Math.PI) / 2, R_ORB),
  },
];

/** Normalna płaszczyzny ekliptyki (północny biegun ekliptyki) w Three.js */
const ECLIPTIC_NORMAL = new THREE.Vector3(0, Math.cos(EPS), Math.sin(EPS));

/** Kula Ziemi z teksturą, oświetlana punktowym światłem Słońca */
function HelioEarthBall() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const colorMap = useLoader(TextureLoader, earthDaymap);
  useFrame((_, delta) => {
    // Powolny obrót poglądowy wokół osi (oś Ziemi = +Y, ku BPN)
    meshRef.current.rotation.y += delta * 0.25;
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.14, 32, 32]} />
      <meshLambertMaterial map={colorMap} />
    </mesh>
  );
}

function HeliocentricScene({ vis }: { vis: CelestialVisibility }) {
  const earthRef = useRef<THREE.Group>(null);
  const axisRef  = useRef<THREE.Group>(null);

  // Geometrie linii od Słońca do pozycji sezonowych na orbicie
  const seasonLineGeos = useMemo(
    () =>
      HELIO_SEASONS.map(({ dot }) => {
        const pts = new Float32Array([0, 0, 0, dot.x, dot.y, dot.z]);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        return g;
      }),
    []
  );
  useEffect(() => () => seasonLineGeos.forEach(g => g.dispose()), [seasonLineGeos]);

  // Orbita Ziemi — okrąg w płaszczyźnie ekliptyki
  const orbitGeo = useMemo(
    () =>
      buildCircleBuffer(128, t => [
        R_ORB * Math.cos(t),
        R_ORB * Math.sin(t) * Math.sin(EPS),
        -R_ORB * Math.sin(t) * Math.cos(EPS),
      ]),
    []
  );
  const orbitMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ffd700', transparent: true, opacity: 0.6 }),
    []
  );
  const orbitLine = useMemo(() => new THREE.Line(orbitGeo, orbitMat), [orbitGeo, orbitMat]);
  useEffect(() => () => { orbitGeo.dispose(); orbitMat.dispose(); }, [orbitGeo, orbitMat]);

  // Oś Ziemi (zawsze w kierunku BPN = Three.js Y — kierunek stały w przestrzeni)
  // + normalna ekliptyki (przerywana) + łuk kąta ε między nimi
  useEffect(() => {
    const g = axisRef.current;
    if (!g) return;
    const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
    const objects: THREE.Object3D[] = [];

    // Oś rotacji Ziemi
    const axGeo = new THREE.BufferGeometry();
    axGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -0.35, 0, 0, 0.35, 0]), 3));
    const axMat = new THREE.LineBasicMaterial({ color: '#88aaff' });
    const axLine = new THREE.Line(axGeo, axMat);
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.35, 0), 0.18, 0x88aaff, 0.07, 0.045);
    disposables.push(axGeo, axMat);
    objects.push(axLine, arrow);

    // Normalna ekliptyki (przerywana, od środka Ziemi)
    const n = ECLIPTIC_NORMAL;
    const nGeo = new THREE.BufferGeometry();
    nGeo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, n.x * 0.5, n.y * 0.5, n.z * 0.5]), 3));
    const nMat = new THREE.LineDashedMaterial({ color: '#ffd700', dashSize: 0.04, gapSize: 0.03, transparent: true, opacity: 0.8 });
    const nLine = new THREE.Line(nGeo, nMat);
    nLine.computeLineDistances();
    disposables.push(nGeo, nMat);
    objects.push(nLine);

    // Łuk kąta ε: od osi Ziemi (t=0) do normalnej ekliptyki (t=ε), promień 0.28
    const arcSegs = 24;
    const arcPts = new Float32Array((arcSegs + 1) * 3);
    for (let i = 0; i <= arcSegs; i++) {
      const t = (i / arcSegs) * EPS;
      arcPts[i * 3]     = 0;
      arcPts[i * 3 + 1] = 0.28 * Math.cos(t);
      arcPts[i * 3 + 2] = 0.28 * Math.sin(t);
    }
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPts, 3));
    const arcMat = new THREE.LineBasicMaterial({ color: '#f7c948' });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    disposables.push(arcGeo, arcMat);
    objects.push(arcLine);

    objects.forEach(o => g.add(o));
    return () => {
      objects.forEach(o => g.remove(o));
      disposables.forEach(d => d.dispose());
    };
  }, []);

  useFrame(() => {
    if (!earthRef.current) return;
    const lambda = sunLambda(celestialAnim.dayOfYear);
    const p = earthPosHelio(lambda, R_ORB);
    earthRef.current.position.copy(p);
  });

  return (
    <>
      {/* Światło punktowe ze Słońca — jedyne źródło światła dla Ziemi */}
      <pointLight position={[0, 0, 0]} intensity={9} distance={30} decay={2} />
      <ambientLight intensity={0.12} />

      {/* Słońce w środku */}
      <mesh>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      <Html distanceFactor={10} position={[0.5, 0.3, 0]}
        style={{ fontSize: 12, fontFamily: 'monospace', color: '#fbbf24', pointerEvents: 'none', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
        ☀ Słońce
      </Html>

      {/* Orbita Ziemi (w płaszczyźnie ekliptyki) */}
      <primitive object={orbitLine} />

      {/* Dysk płaszczyzny ekliptyki — orbita Ziemi leży w tej płaszczyźnie */}
      <mesh rotation={[EPS - Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, R_ORB, 96]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.045} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Markery pór roku na orbicie — warunkowe */}
      {HELIO_SEASONS.map(({ label, pos, color, dot }, idx) => {
        const isEquinox = idx % 2 === 0;
        if (!(isEquinox ? vis.equinoxPoints : vis.solsticePoints)) return null;
        return (
          <group key={idx}>
            <mesh position={dot}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <GLine geo={seasonLineGeos[idx]} color={color} opacity={0.35} />
            <Html distanceFactor={10} position={pos}
              style={{ fontSize: 10, fontFamily: 'monospace', color, pointerEvents: 'none', whiteSpace: 'pre', textAlign: 'center', lineHeight: '1.4' }}>
              {label}
            </Html>
          </group>
        );
      })}

      {/* Animowana Ziemia */}
      <group ref={earthRef}>
        {/* Oś rotacji + normalna ekliptyki + łuk ε */}
        <group ref={axisRef} />
        <Html distanceFactor={10} position={[0, 0.38, 0.14]}
          style={{ fontSize: 9, fontFamily: 'monospace', color: '#f7c948', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          ε = 23,44°
        </Html>
        {/* Pierścień równika Ziemi — prostopadły do osi rotacji (+Y) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.008, 8, 32]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.7} />
        </mesh>
        {/* Kula Ziemi z teksturą, oświetlana przez Słońce */}
        <Suspense fallback={
          <mesh>
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshLambertMaterial color="#2563eb" />
          </mesh>
        }>
          <HelioEarthBall />
        </Suspense>
        <Html distanceFactor={10} position={[0.25, 0.15, 0]}
          style={{ fontSize: 11, fontFamily: 'monospace', color: '#60a5fa', pointerEvents: 'none', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
          🌍 Ziemia
        </Html>
      </group>

      {/* Północny biegun ekliptyki — strzałka z centrum (Słońca) */}
      {vis.poles && (
        <>
          <arrowHelper args={[
            ECLIPTIC_NORMAL.clone(),
            new THREE.Vector3(0, 0, 0),
            R * 0.75,
            0xffd700, 0.15, 0.09
          ]} />
          <Html distanceFactor={10} position={[0.35, ECLIPTIC_NORMAL.y * R * 0.78, ECLIPTIC_NORMAL.z * R * 0.78]}
            style={{ fontSize: 10, fontFamily: 'monospace', color: '#ffd700', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            biegun ekliptyki
          </Html>
          <arrowHelper args={[
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0),
            R * 0.9,
            0x3b82f6, 0.15, 0.09
          ]} />
          <Html distanceFactor={10} position={[0.35, R * 0.93, 0]}
            style={{ fontSize: 10, fontFamily: 'monospace', color: '#3b82f6', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            BPN (kierunek osi Ziemi)
          </Html>
        </>
      )}

      {/* Kierunek γ z centrum — Ziemia widzi Słońce w γ, gdy sama jest po przeciwnej stronie */}
      {vis.equinoxPoints && (
        <>
          <arrowHelper args={[
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 0, 0),
            R * 0.9,
            0x22c55e, 0.15, 0.09
          ]} />
          <Html distanceFactor={10} position={[R * 0.95, 0.3, 0]}
            style={{ fontSize: 10, fontFamily: 'monospace', color: '#22c55e', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            kierunek γ (RA=0h)
          </Html>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Główna scena
// ─────────────────────────────────────────────────────────────────────────────

export function CelestialSphereScene() {
  const { vis, viewMode } = useCelestialStore();

  const equatorGeo = useMemo(
    () => buildCircleBuffer(128, t => [R * Math.cos(t), 0, -R * Math.sin(t)]),
    []
  );
  const eclipticGeo = useMemo(
    () => buildCircleBuffer(128, t => [
      R * Math.cos(t),
      R * Math.sin(t) * Math.sin(EPS),
      -R * Math.sin(t) * Math.cos(EPS),
    ]),
    []
  );
  useEffect(() => () => { equatorGeo.dispose(); eclipticGeo.dispose(); }, [equatorGeo, eclipticGeo]);

  return (
    <>
      <CelestialSceneController />
      <Stars radius={200} depth={60} count={5000} factor={4} saturation={0} fade />

      {/* ── Elementy sfery wspólne dla obu trybów ── */}
      {vis.sphere    && <CelestialSphereShell />}
      {vis.equator   && <GLine geo={equatorGeo} color="#00e5ff" />}
      {vis.equator   && (
        <Html distanceFactor={10} position={[0, 0.25, R * 1.08]}
          style={{ fontSize: 10, fontFamily: 'monospace', color: '#00e5ff', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          Równik niebieski (δ=0°)
        </Html>
      )}
      {vis.ecliptic  && <GLine geo={eclipticGeo} color="#ffd700" />}
      {vis.ecliptic  && (
        <Html distanceFactor={10} position={[-R * 0.6, R * Math.sin(EPS) * 0.85, R * Math.cos(EPS) * 0.55]}
          style={{ fontSize: 10, fontFamily: 'monospace', color: '#ffd700', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          Ekliptyka (ε=23,44°)
        </Html>
      )}
      {vis.raCircles    && <RaHourCircles />}
      {vis.decParallels && <DecParallels />}
      {viewMode === 'geocentric' && vis.equinoxPoints  && <EquinoxPoints />}
      {viewMode === 'geocentric' && vis.solsticePoints && <SolsticePoints />}
      {viewMode === 'geocentric' && vis.poles && <CelestialPoles />}
      {vis.icrsAxes && <IcrsAxes />}

      {/* ── Tryb geocentryczny: Ziemia w centrum, Słońce na sferze ── */}
      {viewMode === 'geocentric' && (
        <>
          <ambientLight intensity={0.35} />
          <directionalLight position={[10, 8, 5]} intensity={0.7} />
          <Earth />
          {vis.sunMarker && <AnimatedSunMarker />}
        </>
      )}

      {/* ── Tryb heliocentryczny: Słońce w centrum, Ziemia na orbicie ── */}
      {viewMode === 'heliocentric' && <HeliocentricScene vis={vis} />}
    </>
  );
}
