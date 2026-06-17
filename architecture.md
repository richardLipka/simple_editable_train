# Architecture — Trains Fluent (Vláčková logika)

A client-side logic game where the player steers a train on a grid, collects cargo to grow the train, and must gather all cargo before exiting through the gate. The app also includes a full map editor and asset customization system.

## Overview

| Aspect | Detail |
|--------|--------|
| **App name** | Internal: `trains-fluent` (`package.json`) / "Trains fluent" (`metadata.json`). Displayed title: **"Kreslený vláček"** (from locale `app.title`) |
| **Type** | Single-page React application (SPA) |
| **Runtime** | Browser only — no server-side logic in `src/` |
| **Persistence** | `localStorage` + JSON import/export |
| **Default language** | Czech (`cs`), with English (`en`) fallback |
| **Build tool** | Vite 6 + TypeScript |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                              │
│                              │                                  │
│                         main.tsx                                │
│                              │                                  │
│                           App.tsx                               │
│         (root state, mode router, localStorage I/O)             │
│                              │                                  │
│     ┌────────────┬───────────┼───────────┬──────────────┐       │
│     ▼            ▼           ▼           ▼              ▼       │
│   MENU        Play       Editor   SettingsManager   (shared)    │
│  (inline)   (game loop) (map edit) (assets/config)  types,      │
│                                                      constants, │
│                                                      i18n       │
└─────────────────────────────────────────────────────────────────┘

Supporting UI (modal overlays):
  SketchPad ──► custom asset drawing (base64 PNG)
  CargoImageEditor ──► image upload crop (react-easy-crop)
```

The application uses **mode-based view switching** inside `App.tsx` rather than a routing library. Five modes exist: `MENU`, `PLAY`, `EDITOR`, `CARGO_CONFIG`, and `SETTINGS`.

## Directory Structure

```
Vlak/
├── index.html              # HTML shell, mounts React root
├── metadata.json           # App metadata (name, description)
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite + React + Tailwind config
├── tsconfig.json
├── data/
│   └── defaultData.json    # Full AppConfig snapshot (maps + assets with base64 images)
└── src/
    ├── main.tsx            # React entry point
    ├── App.tsx             # Root component, global state, mode switching
    ├── types.ts            # Domain type definitions
    ├── constants.ts        # Defaults, grid constants, emoji picker data
    ├── i18n.ts             # i18next setup (cs/en)
    ├── index.css           # Tailwind + sketch-style design tokens
    ├── assets/
    │   └── fav_logo.png    # FAV ZČU faculty logo (bundled via Vite import, shown in About dialog)
    ├── locales/
    │   ├── cs.json         # Czech translations (primary)
    │   └── en.json         # English translations
    ├── components/
    │   ├── Play.tsx        # Gameplay view + canvas renderer
    │   ├── Editor.tsx      # Map editor + procedural generation
    │   ├── SettingsManager.tsx  # Engines, walls, cargo, system assets
    │   ├── SketchPad.tsx   # In-app drawing tool for custom images
    │   └── CargoImageEditor.tsx # Image crop modal
    ├── game/
    │   ├── trainMovement.ts # Train movement, collision detection, state transitions
    │   └── scoring.ts       # Combo multipliers, star rating, cargo/bonus point resolution
    └── utils/
        ├── assetMaps.ts     # createIdMap, collectGameAssetUrls
        ├── canvasBackground.ts # Cached grid background canvas
        ├── configDefaults.ts   # Normalise/merge imported AppConfig
        ├── directionInput.ts   # 180° reversal guard for direction changes
        └── imagePreload.ts     # Global image cache + preload helper
```

## Core Domain Model (`src/types.ts`)

### Grid & map

- **`CellType`**: `EMPTY` | `WALL` | `GATE` | `CARGO` | `BONUS` | `START`
- **`Direction`**: `UP` | `DOWN` | `LEFT` | `RIGHT`
- **`GameMap`**: A level definition
  - `grid`: 2D array of cell types (`height × width`)
  - `cargoConfigs`: keyed by `"x,y"` — `SPECIFIC` (fixed cargo type) or `RANDOM`
  - `bonusConfigs`: keyed by `"x,y"` — references a `BonusType.id`
  - `wallConfigs`: keyed by `"x,y"` — references a `WallType.id`
  - `carObstacles`: optional list of `CarObstacleDef` (moving car hazards — start/end cell defining a straight road)
  - `startPos`, `startDir`: train spawn
  - `selectedEngineId`: engine visual for this level
  - `generatedPath`, `pathAnchors`: optional editor hints (shown during play)

- **`CarObstacleDef` / `CarObstacleState`**: A moving car hazard. The def stores `startPos`/`endPos` (same row or column); the runtime state tracks `pathIndex`, `prevPathIndex`, `direction`, and a `phase` flag that makes the car advance every other tick (half the train's speed). The car bounces between the two ends and ends the game on contact with any train segment.

### Asset types

| Type | Purpose |
|------|---------|
| `EngineType` | Train locomotive (emoji or custom image) |
| `WallType` | Wall tile appearance |
| `CargoType` | Cargo pickup + carriage visuals (emoji, color, images, point value) |
| `BonusType` | Optional bonus pickup (coin/star/gem, emoji or image, point value) |
| `SystemAssets` | Start tile, gate open/closed, random cargo fallback icons, and the moving-car / road (middle + auto-rotated edge) visuals — each as emoji and/or custom image |

### Runtime & config

- **`GameState`**: Live play session (train segments, direction, score, collected cargo/bonus keys, combo streak, stars, animation progress)
- **`AppConfig`**: Serializable bundle (`version`, `maps`, `engines`, `walls`, `cargoTypes`, `bonusTypes`, `systemAssets`) used for import/export

## Application State & Persistence

`App.tsx` holds all global state in React `useState` hooks:

| State | Default source | localStorage key |
|-------|----------------|------------------|
| Maps (level sequence) | `INITIAL_MAP` from `constants.ts` | `train_logic_maps` |
| Cargo types | `DEFAULT_CARGO_TYPES` | `train_logic_cargo` |
| Bonus types | `DEFAULT_BONUS_TYPES` | `train_logic_bonus` |
| Engines | `DEFAULT_ENGINES` | `train_logic_engines` |
| Walls | `DEFAULT_WALLS` | `train_logic_walls` |
| System assets | `DEFAULT_SYSTEM_ASSETS` | `train_logic_system` |
| Kids mode | `false` | `train_logic_kids_mode` |

On first launch, if no saved maps exist, the app seeds a single level from `INITIAL_MAP` (a 20×15 bordered map with sample cargo and a gate).

**Import/export**: `SettingsManager` triggers JSON download/upload of a full `AppConfig`. This is the same schema as `data/defaultData.json`.

> **Note:** `data/defaultData.json` is not imported by the application at runtime. It serves as a bundled configuration snapshot (3 levels, all default assets with embedded base64 images). Use Settings → Import to load it, or reference it as a seed/template.

## View Layer

### Menu (`App.tsx`, mode `MENU`)

- Lists all maps in campaign order (reorderable via up/down)
- Actions per level: play, edit, delete
- Global actions: settings, cargo types, create new map, start campaign from level 1
- **About dialog** — an info button opens a modal overlay with the author (linked to the author's homepage), a link to the GitHub source repository, and the bundled FAV ZČU faculty logo linking to `kiv.zcu.cz`

### Play (`src/components/Play.tsx`)

**Game loop architecture:**

1. **Initialization** — counts total `CARGO` cells, spawns train at `map.startPos`
2. **Input** — keyboard arrows set `nextDirection` (no 180° reversal); space/P pauses; M/N adjust tick rate
3. **Tick** — `requestAnimationFrame` drives smooth interpolation (`moveProgress` 0→1)
4. **Logic** — when `moveProgress >= 1`, `moveTrainLogic()` advances one grid cell

**Movement rules (snake-like):**

- Hitting bounds, `WALL`, own body, or a moving car → game over
- Hitting `GATE` before all cargo collected → game over
- Hitting `GATE` with all cargo collected → level complete
- Hitting `CARGO` → add carriage (random or specific type), increment score, train grows
- Moving on non-cargo cells → tail removed (train length unchanged)

**Kids mode** softens wall/wagon bumps (the train stops instead of crashing) but applies a score penalty per bump. A **deadlock check** ends the game even in kids mode if the locomotive is stopped with no free neighbouring cell in any direction.

**Rendering:** HTML5 Canvas at `GRID_SIZE` (60px) per cell. Supports emoji fallbacks and cached custom images. Train segments rotate by movement direction. Optional `generatedPath` overlay for hints.

**Performance design of the canvas effect:**

- `cargoById` / `bonusById` lookup maps (`resolveCargoTypes` / `resolveBonusTypes`) are built **once** when the effect runs and passed into `moveTrain` via options — not rebuilt on every tick.
- `Object.entries(map.cargoConfigs)` and `Object.entries(map.bonusConfigs)` are cached as local constants — not re-allocated on every animation frame.
- Collected-key membership is tracked via `collectedCargoSetRef` / `collectedBonusSetRef` (`useRef<Set<string>>`), updated only when a tick actually fires — `drawFrame` (60 fps) reads the ref without any allocation.
- A cached offscreen canvas (`staticLayer`) holds the grid background + walls + gate and is only rebuilt when the gate open/closed state flips (twice per level).

### Editor (`src/components/Editor.tsx`)

**Manual tools:**

| Tool | Behavior |
|------|----------|
| `WALL` | Place walls with selected wall style |
| `CARGO` | Place cargo (specific type or random) |
| `GATE` | Single exit cell (replaces any existing gate) |
| `START` | Single spawn cell, updates `startPos` |
| `EMPTY` | Eraser (also removes any car obstacle passing through the cell) |
| `PATH` | Draw/edit orthogonal solution path |
| `CAR` | Two-click placement of a moving car obstacle (start cell, then end cell on the same row or column) |

**Drawing modes:** point (freehand), rectangle, triangle, circle — applied as shape outlines.

**Procedural generation (two-step workflow):**

1. **Generate Path** — randomized DFS from start to gate on inner grid (avoids edges). Parameters: `pathComplexity` (0–1). Places `START` and `GATE` cells.
2. **Fill Map** — uses path + distance heuristics to scatter walls and cargo. Parameters: `maneuverSpace`, `cargoDensity`.

**Path editing:** Drag nodes with automatic orthogonal elbow insertion; double-click to add/remove nodes; self-crossing paths are rejected.

### Settings (`src/components/SettingsManager.tsx`)

Tabbed asset manager:

| Tab | CRUD for | Features |
|-----|----------|----------|
| ENGINES | Locomotives | Select active engine per current map |
| WALLS | Wall styles | |
| CARGO | Cargo + carriage pairs | Swap cargo/carriage images |
| BONUSES | Optional bonus pickups | Kind (coin/star/gem), point value |
| SYSTEM | Start, gate, random cargo, car, road (middle + edge) icons | Edits persist immediately to `localStorage` |

Asset input methods:

- Emoji picker (`EMOJI_LIST` categories in `constants.ts`)
- Image upload → crop (`CargoImageEditor`)
- Hand-draw (`SketchPad`) → saved as base64 PNG

Built-in defaults (coal, wood, gold, food, oil, etc.) cannot be deleted; custom entries can.

## Internationalization

- **Library:** i18next + react-i18next + browser language detector
- **Config:** `src/i18n.ts` — default `cs`, fallback `cs`, detection via `localStorage` then `navigator`
- **Namespaces:** Single `translation` namespace per locale file
- **Coverage:** App shell (incl. About dialog), play UI, editor, settings, sketch pad, cargo editor

## Styling & UX

- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Sketch aesthetic:** hand-drawn borders (`sketch-border`, `sketch-button`, `sketch-card`), Patrick Hand / Architects Daughter fonts
- **Motion:** `motion/react` for page transitions and modals
- **Icons:** `lucide-react`

## Data Layer (`data/defaultData.json`)

Full `AppConfig` export at version `1.0`:

| Section | Contents |
|---------|----------|
| `maps` | 3 levels (20×15 grids) with wall/cargo configs; one includes `generatedPath` |
| `engines` | steam, diesel, electric — all with base64 images |
| `walls` | brick, stone, metal — all with base64 images |
| `cargoTypes` | 5 default types — cargo + carriage images |
| `systemAssets` | Emoji/image fallbacks for start, gates, random cargo, car, and road (middle + edge) |

The file is large (~1.3 MB) due to embedded base64 image data. It mirrors the runtime `AppConfig` schema exactly.

## Build & Development

```bash
npm install
npm run dev      # Vite dev server on port 3000
npm run build    # Production bundle → dist/
npm run preview  # Preview production build
npm run lint     # TypeScript check (tsc --noEmit)
```

**Vite config highlights:**

- `@/` path alias to project root
- HMR can be disabled via `DISABLE_HMR=true`

## Key Constants (`src/constants.ts`)

| Constant | Value | Usage |
|----------|-------|-------|
| `GRID_SIZE` | 60 px | Canvas cell size |
| `TICK_RATE` | 150 ms | Default movement interval |
| `INITIAL_MAP` | 20×15 bordered level | First-run default |
| `DEFAULT_*` | Engines, walls, cargo, system assets | Fallback when localStorage empty |
| `EMOJI_LIST` | Categorized emoji arrays | Settings emoji picker |

## Data Flow Summary

```
User action
    │
    ▼
Component event handler
    │
    ▼
App.tsx state update (+ localStorage save)
    │
    ├──► Play: GameState derived from map + input
    ├──► Editor: local map draft → onSave → maps[]
    └──► Settings: asset arrays → save* handlers
```

## Extension Points

Likely places for future work:

1. **Load `defaultData.json` on first run** — replace hardcoded `INITIAL_MAP` seed
2. **Backend / API** — none exists today; would need a server framework and a database added as dependencies
3. **React Router** — if URL-based navigation is needed beyond mode switching
4. **Shared canvas utilities** — Play and Editor duplicate grid rendering logic
5. **Game logic tests** — expand coverage in `src/game/trainMovement.ts`