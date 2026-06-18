# Trains Fluent

Displayed in-app as **Kreslený vláček** ("Sketched Train") — a browser-based logic game where you steer a train on a grid, collect cargo to grow your wagons, and reach the exit gate. Includes a built-in map editor, custom assets, and a multi-level campaign — all running client-side in the browser.

Default UI language is Czech (`cs`); English (`en`) is also supported. An in-app **About** dialog (info button on the menu) credits the author and links to the source repository.

## Features

- **Campaign mode** — play through a sequence of custom levels, with a searchable, scrollable level list on the menu
- **Map editor** — draw walls, place cargo, set start/gate, add moving car obstacles, and auto-generate paths
- **Moving car obstacle** — a hazard that drives back and forth along a short road at half the train's speed and destroys the train on contact
- **Custom assets** — emoji fallbacks, image upload/crop, **camera capture**, or hand-drawn art for engines, walls, cargo, and system icons (including the car and road). All images are downscaled to 128×128 and stored as compact **WebP** so they stay small in browser storage
- **Sketch pad with magic wand** — a coarse **pixel-grid** drawing surface (shown large, 4× zoomed) with a 2×2-pixel brush unit; use the magic-wand tool to select similar colors and delete them to transparency
- **Configurable cargo types** — engines, walls, cargo, and system icons
- **Bilingual UI** — Czech / English, switchable any time via a small CS/EN toggle in the top-right corner (i18n)
- **Import / export** — back up or share full game configuration as JSON; import is resilient, salvaging valid data and skipping anything malformed

## Quick start

**Requirements:** Node.js 18+

```bash
git clone <repository-url>
cd Vlak
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other commands

```bash
npm run build    # production build → dist/
npm run preview  # preview production build
npm run lint     # TypeScript check
```

No API keys or backend are required. Progress is stored in `localStorage`.

## How to play

1. Use **arrow keys** to steer the train (180° turns are blocked).
2. Collect **cargo** to add wagons and increase your score.
3. Collect **all cargo** on the level to open the gate.
4. Enter the gate to complete the level.
5. Avoid **walls**, **your own wagons**, and any **moving car** crossing the track.

### Controls

| Input | Action |
|-------|--------|
| Arrow keys | Steer |
| Space / P | Pause |
| M | Slower |
| N | Faster |
| On-screen buttons | Mobile steering |

## Project structure

```
src/
  App.tsx              # App shell, routing between menu / play / editor / settings
  components/
    Play.tsx             # Game loop and canvas rendering
    Editor.tsx           # Map editor
    SettingsManager.tsx  # Engines, walls, cargo, system assets
    SketchPad.tsx        # In-app drawing tool
  game/
    trainMovement.ts     # Train movement and collision logic
  locales/               # cs.json, en.json
data/
  defaultData.json       # Sample full configuration (maps + assets)
```

See [architecture.md](architecture.md) for a detailed system overview.

## Tech stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- i18next
- HTML5 Canvas

## Data & persistence

Game state is saved in the browser under these `localStorage` keys:

- `train_logic_maps`
- `train_logic_cargo`
- `train_logic_bonus`
- `train_logic_engines`
- `train_logic_walls`
- `train_logic_system`
- `train_logic_kids_mode`

Use **Settings → Export** to download a portable JSON config (maps, all assets, and the kids-mode preference). Import it on another device or browser to restore your setup. Loading is resilient: corrupt or partial data is salvaged where possible, with invalid entries skipped and reported.

Asset images are kept small to stay within the browser storage quota: every custom image is downscaled to 128×128 and stored as **WebP** (PNG fallback). Import also re-compresses any oversized images it finds, so a config saved by an older version shrinks automatically — **export and re-import** to compact existing data.

`data/defaultData.json` is a bundled sample config (maps with custom images). Import it from Settings if you want a pre-built starting point.

## Copyright

Copyright © 2026 Richard Lipka  
Department of Computer Science and Engineering, University of West Bohemia  
[kiv.zcu.cz](https://kiv.zcu.cz) · [lipka@kiv.zcu.cz](mailto:lipka@kiv.zcu.cz)

All rights reserved unless otherwise stated.