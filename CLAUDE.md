# GNSS Visualizer — CLAUDE.md

## Co to jest

Interaktywna aplikacja 3D do wizualizacji satelitów nawigacyjnych (GPS, Galileo, GLONASS, BeiDou, QZSS, NavIC).
Cel: narzędzie edukacyjne + profesjonalne (dla studentów geodezji/inżynierii, startupów GNSS).

Przepisanie od zera starej wersji Canvas 2D (`/home/raf/dev/Strona/gnss/`) na nowoczesny stack 3D.

---

## KRYTYCZNA ZASADA ARCHITEKTONICZNA — przeczytaj przed dotyknięciem czegokolwiek w `components/scene/`

**React/Zustand = wyłącznie UI. Animacja = wyłącznie `anim` + `useFrame`.**

```
ŹRÓDŁO PRAWDY DLA ANIMACJI:
  src/components/scene/animState.ts → obiekt anim { timeSec, traceHours, useEcef, ... }

JEDYNA DROGA AKTUALIZACJI PER-KLATKĘ:
  useFrame(() => { czytaj z anim.*, pisz do geometry/mesh bezpośrednio })

ZABRONIONE W KOMPONENTACH 3D:
  - useTimeStore() / useUiStore() jako źródło danych per-klatkę
  - useMemo z timeHours/traceHours w deps (powoduje re-render ×N satelitów co 16 klatek)
  - setState / setTimeHours wewnątrz useFrame częściej niż co ~16 klatek
```

**Dlaczego:** React re-renderuje wszystkie subskrybujące komponenty gdy Zustand się zmienia.
Przy 24 satelitach × OrbitTrail + GroundTrack = 48 re-renderów co 16 klatek → zacięcia.
Imperatywne `geometry.attributes.position.needsUpdate = true` jest darmowe — zero React overhead.

### Jak poprawnie zsynchronizować stan UI → animację

Tylko `SceneController` (w `GlobeScene.tsx`) synchronizuje Zustand → `anim`:
```ts
useEffect(() => { anim.traceHours = traceHours; }, [traceHours]);
useEffect(() => { anim.useEcef = useEcef; }, [useEcef]);
// itd.
```
Jeśli dodajesz nowy parametr który ma wpływać na animację: dodaj go do `animState.ts` i zsynchronizuj w `SceneController`.

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| State (UI) | Zustand |
| CSS | Tailwind CSS v4 |
| Testy | Vitest |
| SGP4/TLE | satellite.js |

Stack jest odpowiedni — problemy wydajnościowe nie są wadą stacku, lecz konsekwencją mieszania React state z animacją per-klatkę. Zasada powyżej to rozwiązuje.

---

## Struktura katalogów

```
src/
├── routes/            Strony: Visualizer
├── components/
│   ├── scene/         3D: Earth, SatelliteMarker, OrbitTrail, GroundTrack, GlobeScene
│   │                  animState.ts — mutable object dla useFrame (NIE React state)
│   ├── panels/        UI: TimeControl, SystemPanel, OrbitalElements, SatelliteList
│   ├── education/     KeplerStepper (9-krokowy kalkulator Keplera)
│   └── ui/            Atomowe komponenty
├── store/             Zustand: satelliteStore, timeStore, uiStore
├── services/
│   ├── orbital/       keplerMath.ts, ionosphere.ts
│   ├── parsers/       rinex.ts (RINEX v2/v3 GPS+Galileo)
│   ├── coordinates/   (planowane: eciEcef, ecefEnu, skyplot)
│   └── api/           (planowane: celestrak.ts TLE + cache)
├── types/             ephemeris.ts, satellite.ts, coordinates.ts, ionosphere.ts
├── constants/         gnss.ts (MU, OMEGA_E, R_E), satDatabase.ts, frequencies.ts
└── workers/           (planowane: rinexWorker, orbitWorker)
```

---

## Układ współrzędnych

`SCENE_SCALE = 1 / 6378137` — 1 jednostka Three.js = R_E (promień Ziemi).

Mapowanie ECEF → Three.js:
```
Three.js X = ECEF X
Three.js Y = ECEF Z  (góra)
Three.js Z = -ECEF Y
```

**ECI vs ECEF:**
- **ECI** (`useEcef=false`): satelity na statycznych elipsach, Ziemia obraca się (`rotation.y = OMEGA_E * timeSec`)
- **ECEF** (`useEcef=true`): Ziemia stoi (`rotation.y=0`), satelity tworzą rozetę, ślad naziemny leży na powierzchni

**GroundTrack alignment:** Punkty śladu są w ECEF. Żeby pokrywały się z Ziemią w ECI, są owrapowane w `<EarthAligned>` — group z identyczną rotacją co siatka Ziemi. Matematycznie: `R_y(OMEGA_E·t) · P_ecef_three = P_eci_three`.

---

## Kluczowe pliki serwisowe

### `services/orbital/keplerMath.ts`
- `solveKepler(M, e)` — Newton-Raphson
- `computeGPSPosition(eph, tSec, ecef, harmonics)` — propagator GPS/Galileo (IS-GPS-200)
- `ecefToLatLon(x, y, z)` — Bowring WGS-84
- `orbitalPeriod(a)` — okres orbitalny [s]

### `services/orbital/ionosphere.ts`
- `klobucherDelay(...)` — model Klobuchar IS-GPS-200 [m]

### `services/parsers/rinex.ts`
- `parseRinex(text)` — RINEX v2/v3, GPS+Galileo, zwraca `SatelliteRecord[]` + Klobuchar

---

## Zustand stores

| Store | Co trzyma |
|---|---|
| `satelliteStore` | satellites[], selectedIndex, mode, singleEph, activeSystem |
| `timeStore` | timeHours, traceHours, animating, animSpeed |
| `uiStore` | showGroundTrack, showHarmonics, showIonoLayer, useEcef, openPanel |

---

## Stałe fizyczne (`constants/gnss.ts`)

```
MU     = 3.986005e14 m³/s²
OMEGA_E = 7.2921151467e-5 rad/s
R_E    = 6378137 m (WGS-84)
```

---

## Tekstury Ziemi

`public/textures/`:
- `earth_daymap.jpg` — NASA Blue Marble
- `earth_normal.jpg` — normal map
- `earth_specular.jpg` — specular map

Bez tekstur: fallback = jednolity granat. Pobrano z `raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/`.

---

## Testy

```bash
npx vitest run
```

20 testów: `keplerMath.ts` + `ionosphere.ts`. Weryfikacja vs stara wersja alfa + IGS.
Plik testowy RINEX: `/home/raf/dev/Strona/sugl0010.22n`

---

## Plan wdrożenia

| Faza | Status | Co |
|---|---|---|
| 0 — Fundament | ✅ | Typy, stałe, keplerMath, ionosphere, parsery, stores |
| 1 — MVP 3D | 🔄 W toku | Globe z teksturą, satelity, OrbitTrail, GroundTrack, ECI/ECEF, panele, KeplerStepper |
| 2 — Rozszerzone | ⏳ | Terminator dzień/noc, IonoLayer 3D, GLONASS RK4, CelesTrak TLE, SkyPlot ENU |
| 3 — Pełna wersja | ⏳ | BeiDou/QZSS/NavIC, SP3, UBX, NeQuick, CSV/KML, PWA |
| 4 — Mobile | ⏳ | Capacitor iOS/Android, Fastify+Supabase |

---

## Uruchomienie

```bash
npm run dev        # http://localhost:5173
npx vitest run     # testy
npm run build      # dist/
```

## GitHub i commity

Repozytorium: https://github.com/rafalwrob/gnss-visualizer

**Po każdej zakończonej zmianie rób commit automatycznie** — nie czekaj na polecenie.
Używaj prefiksów: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`.
