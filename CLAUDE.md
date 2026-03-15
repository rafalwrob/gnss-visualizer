# GNSS Visualizer — CLAUDE.md

## Co to jest

Interaktywna aplikacja 3D do wizualizacji satelitów nawigacyjnych (GPS, Galileo, GLONASS, BeiDou, QZSS, NavIC).
Cel: narzędzie edukacyjne + profesjonalne (dla studentów geodezji/inżynierii, startupów GNSS).

Przepisanie od zera starej wersji Canvas 2D (`/home/raf/dev/Strona/gnss/`) na nowoczesny stack 3D.

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| State | Zustand |
| CSS | Tailwind CSS v4 |
| Testy | Vitest |
| SGP4/TLE | satellite.js |

## Struktura katalogów

```
src/
├── routes/            Strony aplikacji (Visualizer, Education, Settings)
├── components/
│   ├── scene/         Komponenty 3D: Earth, SatelliteMarker, OrbitTrail, GlobeScene
│   ├── panels/        Panele UI: TimeControl, SystemPanel, OrbitalElements, SatelliteList
│   ├── education/     Edukacja: KeplerStepper (9-krokowy kalkulator)
│   └── ui/            Atomowe: SliderControl, Toggle, Badge itp.
├── store/             Zustand stores: satelliteStore, timeStore, uiStore
├── services/
│   ├── orbital/       Matematyka: keplerMath.ts, ionosphere.ts, glonassMath.ts
│   ├── parsers/       Parsery: rinex.ts, ubx.ts, sp3.ts
│   ├── coordinates/   Konwersje: eciEcef.ts, ecefEnu.ts, skyplot.ts
│   └── api/           API: celestrak.ts (TLE + cache 1h)
├── types/             Typy TS: ephemeris.ts, satellite.ts, coordinates.ts, ionosphere.ts
├── constants/         Stałe: gnss.ts, satDatabase.ts, frequencies.ts
└── workers/           Web Workers: rinexWorker.ts, orbitWorker.ts
```

## Skala sceny 3D

`SCENE_SCALE = 1 / 6378137` — 1 jednostka Three.js = promień Ziemi (R_E).
Konwersja ECEF→Three.js: `(x*scale, z*scale, -y*scale)` (oś Y w górę, Z w kierunku widza).

## Kluczowe pliki serwisowe

### `services/orbital/keplerMath.ts`
- `solveKepler(M, e)` — równanie Keplera (Newton-Raphson)
- `computeGPSPosition(eph, tSec, ecef, harmonics)` — propagator GPS/Galileo, zwraca `OrbitalStepData` (wszystkie kroki pośrednie)
- `ecefToLatLon(x, y, z)` — geodezja Bowring (WGS-84)
- `orbitalPeriod(a)` — okres orbitalny [s]

### `services/orbital/ionosphere.ts`
- `klobucherDelay(elevDeg, latUser, lonUser, azDeg, gpsSec, params)` — model IS-GPS-200 [m]
- `buildIonoGrid(nLat, nLon)` — siatka opóźnień do wizualizacji

### `services/parsers/rinex.ts`
- `parseRinex(text)` — RINEX v2/v3 nawigacyjny, GPS+Galileo, zwraca `SatelliteRecord[]` + Klobuchar

## Stałe fizyczne (constants/gnss.ts)

```
MU = 3.986005e14 m³/s²
OMEGA_E = 7.2921151467e-5 rad/s
R_E = 6378137 m (WGS-84)
```

## Zustand stores

| Store | Co trzyma |
|---|---|
| `satelliteStore` | konstelacja, wybrany satelita, singleEph, activeSystem |
| `timeStore` | timeHours, traceHours, animating, animSpeed, tick() |
| `uiStore` | openPanel, showGroundTrack, showHarmonics, showIonoLayer, useEcef |

## Tekstury Ziemi (opcjonalne)

Umieść w `public/textures/`:
- `earth_daymap.jpg` — powierzchnia (NASA Blue Marble)
- `earth_normal.jpg` — normal map
- `earth_specular.jpg` — specular map

Bez tekstur: fallback = jednolity granat (#1a4a6e). Działa poprawnie.

## Testy

```bash
npx vitest run
```

Testy dla: `keplerMath.ts` (solveKepler, computeGPSPosition, ecefToLatLon, orbitalPeriod) i `ionosphere.ts`.
Weryfikacja: wyniki vs stara wersja alfa + dane referencyjne IGS.

## Plik testowy RINEX

`/home/raf/dev/Strona/sugl0010.22n` — RINEX v2, prawdziwe dane z odbiornika.

## Plan wdrożenia

| Faza | Status | Co |
|---|---|---|
| 0 — Fundament | ✅ DONE | Typy, stałe, keplerMath, ionosphere, parsery, stores |
| 1 — MVP 3D | 🔄 W toku | Globe, satelity, OrbitTrail, panele, KeplerStepper |
| 2 — Rozszerzone | ⏳ | Terminator, IonoLayer 3D, GLONASS RK4, CelesTrak TLE, SkyPlot |
| 3 — Pełna wersja | ⏳ | BeiDou/QZSS/NavIC, SP3, UBX, NeQuick, CSV/KML export, PWA |
| 4 — Mobile | ⏳ | Capacitor iOS/Android, Fastify+Supabase backend |

## Zewnętrzne API

**CelesTrak (darmowe, CORS OK):**
```
GET https://celestrak.org/gp.php?GROUP=gps-ops&FORMAT=json
GET https://celestrak.org/gp.php?GROUP=galileo&FORMAT=json
```
Cache localStorage TTL 1h. Propagacja przez `satellite.js` (SGP4).

## Uruchomienie lokalne

```bash
cd /home/raf/dev/Strona/gnss-visualizer
npm run dev        # dev server http://localhost:5173
npx vitest run     # testy
npm run build      # produkcja → dist/
```

## GitHub

Repozytorium: https://github.com/rafalwrob/gnss-visualizer
