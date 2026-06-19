# Changelog

All notable changes to **Trains Fluent** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.1] - 2026-06-19

### Fixed

- **"Načíst přednastavení" (Load Preset) ignored on deployment** — preset JSON files were fetched with the browser's default cache policy. A browser or CDN that had cached a previous version served the stale copy on reload while the load appeared to succeed — resulting in the old/empty data being applied. `Import from file` was unaffected because it reads the chosen local file via `FileReader` and never touches the network. Fix: both `fetchPresetsManifest` and `fetchPresetConfig` now pass `cache: 'no-store'` and append a per-request `?t=<timestamp>` cache-busting query, so an updated server file is always picked up immediately.

## [1.7.0] - 2026-06-19

### Added

- **Brightness enhancement tool in the sketch pad** — a new **Sun** toolbar button opens a gamma-correction panel. A 0–100 % slider lifts shadows and midtones with a non-linear curve (gamma 1.0 → 0.35) while preserving colour saturation: the correction is applied to the HSV value channel so channel ratios (hue/saturation) stay constant. Preview is live off an immutable baseline snapshot; **Apply** commits to undo history; **Reset** reverts without touching history.
- **Flip horizontal in the sketch pad** — a new **FlipHorizontal** toolbar button instantly mirrors the drawing left↔right (by the vertical axis) and commits the result to undo history. Implemented with a synchronous pixel-swap on `ImageData` — no async round-trip through a data URL.
- **Transparent stroke and fill in the sketch pad** — a red-slash swatch in the stroke/fill palettes sets the active colour to transparent. Pencil and eraser tools `clearRect` with it (erase to transparency); shape tools switch to `destination-out` compositing so the outline subtracts alpha instead of painting. Flood fill floods to alpha 0.
- **3-2-1-GO countdown before each level** — a full-screen animated overlay counts down 3 → 2 → 1 → GO before gameplay begins, giving the player time to orient. Fires on first game start and on every retry/next level. All countdown timers are tracked via `useRef` and cleared on unmount to prevent state updates after the component is gone.
- **Campaign button on the main menu** — the decorative large play icon above "Spustit kampaň" is now a real `<button>` that launches the campaign directly.

### Changed

- **System asset action buttons are now a 2×2 grid** in the Settings panel: Camera / Upload on the first row, Draw / Emoji on the second. Previously the four buttons ran in a single horizontal row that was cramped on narrow screens.

### Fixed

- **Transparent images displayed as white when reopened in the sketch pad** — the mount effect no longer paints a white paper background before drawing an existing asset; it clears to transparent so alpha regions survive the round-trip.
- **Intermittent out-of-memory during play** — several leaks eliminated:
  - Image cache was unbounded; every asset edit produced a new data URL that accumulated in `globalCache` across edit→play cycles. `pruneImageCache` now evicts any URL not in the current asset set on each preload.
  - The static background layer was rebuilt on every frame during a countdown pause; rebuilds are now guarded to gate-flip or assets-ready transitions only.
  - Car-obstacle paths were recomputed every animation frame; they are now precomputed once into a `Map` at level init.
  - Countdown `setTimeout` handles were not tracked, leaking timers across retries; they are now stored in a `useRef` array and cleared before each new countdown.

## [1.6.0] - 2026-06-18

### Changed

- **Asset images are now compressed at the source.** Every custom asset (uploaded photo, camera capture, or hand-drawn sketch) is downscaled to a 128×128 square and re-encoded as **WebP** (with a PNG fallback where WebP isn't supported) before being stored. Previously images were saved as full-resolution lossless PNG — a single photo crop could be several MB and overflow the ~5 MB `localStorage` quota. Typical assets drop from 36–139 KB to ~3–8 KB each (≈10–15× smaller). WebP keeps an alpha channel, so magic-wand transparency is preserved. New shared module: `src/utils/imageEncoding.ts`.
- **Sketch pad is now a coarse pixel grid.** The drawing surface stays large (512px on screen) but works at the 128×128 asset resolution, displayed 4× larger with crisp (`pixelated`) rendering. All tools snap to a 2×2-pixel unit and the pencil/eraser stamp aligned blocks, so strokes stay clean at the stored resolution. Brush sizes are now multiples of the pixel unit (2/4/6/8).
- **Crop editor outputs the final 128px WebP directly**, so both image upload and camera capture (which routes through the crop editor) are capped at the small size.
- **The bundled sample config (`data/defaultData.json`) was regenerated** with 128px WebP images, shrinking it from ~1.5 MB to ~110 KB. Regeneration tool: `scripts/compress-default-data.mjs`.

### Added

- **Import shrinks oversized legacy data.** Importing a config (or loading the bundled sample / a preset) now re-encodes every embedded image down to the compact 128px/WebP format on the way in. Because maps reference assets by id (no embedded images), this is a flat pass over the asset arrays. This is the migration path for configs saved before 1.6.0: **export and re-import** to compact existing data.

## [1.5.0] - 2026-06-18

### Added

- **Camera capture for assets** — every image slot in Settings (cargo, carriage, bonus, engine, wall, and all system assets) now has a **Camera** button next to **Upload**. It opens a live webcam preview (`getUserMedia`), captures a centered square frame, and routes it through the same crop editor as an upload. Includes a front/back camera toggle, retake/use-photo flow, and graceful handling of denied permission or missing devices. New component: `src/components/CameraCapture.tsx`.
  - Requires a secure context (HTTPS or `localhost`) for camera access.
- **Magic wand tool in the sketch pad** — select a contiguous region of similarly-colored pixels (RGBA distance) with an adjustable **similarity slider**, then **delete it to full transparency**. The selection is shown as a live marquee on a dedicated overlay layer, and a checkerboard backdrop makes transparent areas visible. Delete/Backspace removes the selection; Escape deselects.
- **Kids mode is now included in import/export.** `AppConfig` gained an optional `kidsMode` field, so the kids-mode preference round-trips through config files and presets.
- **Language switcher** — a small CS/EN toggle pinned to the top-right corner on every screen, switching the UI language via i18n (the choice is cached in `localStorage`). New component: `src/components/LanguageSwitcher.tsx`.
- **Map search & scrollable list** — the menu's level list now has a name filter (search box with clear button) and is capped to about ten rows with an inner scrollbar, so large campaigns no longer stretch the page. Reorder arrows are hidden while a search filter is active.

### Changed

- **Exported config now records the real app version.** `handleExportConfig` writes the actual `package.json` version (injected at build time as `__APP_VERSION__` via Vite `define`) instead of a hardcoded `"1.0"`.
- **Resilient configuration loading.** `localStorage` and JSON import no longer fail on malformed data — a new sanitization layer (`src/utils/configDefaults.ts`) salvages every valid element, drops invalid or unknown ones, rebuilds map grids to exact dimensions, and reports a summary of anything skipped. A single corrupt `localStorage` key no longer blocks the others, and partially-valid imports/presets load instead of being rejected outright.

### Fixed

- **Sketch-pad undo no longer destroys transparency** — undo now clears the canvas before redrawing the snapshot (instead of filling it white), so transparent regions survive.
- **Saves are crash-safe** — `localStorage` writes are wrapped to catch `QuotaExceededError` (large base64 images can exceed the storage quota) and warn the user rather than throwing mid-edit.

## [1.4.0] - 2026-06-17

### Added

- **About dialog** — an info button in the menu header opens a dialog with the author, a link to the source repository on GitHub, and the Faculty of Applied Sciences (FAV ZČU) logo linking to [kiv.zcu.cz](https://kiv.zcu.cz). The author name links to the author's homepage.
- Bundled the FAV faculty logo as a local asset (`src/assets/fav_logo.png`), imported through Vite so it ships as a hashed build asset with no external hotlinking at runtime.

### Changed

- **Renamed the game** to **"Kreslený vláček"** with the subtitle "rychlá webová hra" (English: "Sketched Train" / "a fast web game"). The previous name was "Vláčková logika / Train Logic".

## [1.3.0] - 2026-06-17

### Added

- **Moving car obstacle** — a new hazard that drives back and forth along a short road and destroys the train on contact with the locomotive or any wagon
  - Two-click placement in the map editor (start point, then end point along the same row or column)
  - The car bounces between the two ends and travels at **half the train's speed**
  - Erasing a road cell removes the obstacle that passes through it
- **System asset editors for the car and road** — Settings → System now has cards for the car obstacle, road middle segment, and road edge/end cap (emoji, image upload/crop, or hand-drawn). Road edges are auto-rotated for vertical roads and start/end orientation.
- Bundled sample config (`data/defaultData.json`) updated with a car-obstacle example and the new car/road system assets.

### Changed

- **Kids mode penalty** for bumping a wall or wagon raised to **-500** points.
- Car, road, and other system assets now fall back to their configured **emoji** on the canvas (in both editor and game) when no custom image is set, instead of a plain placeholder shape.

### Fixed

- **System-asset edits are now saved immediately.** Drawn/uploaded/emoji edits to system assets (car, road, gates, start, random cargo) previously lived in local component state and were only persisted via the one "Save System" button — exiting via "Back" or switching tabs silently discarded them, so the game and editor kept showing old images. System assets are now sourced from a single source of truth and written to `localStorage` on every edit.
- **Deadlock detection** — if the locomotive is stopped with no free neighbouring cell in any direction, the game now ends even in kids mode (previously kids mode could leave the player permanently stuck).

## [1.2.0] - 2026-06-17

### Changed

- **Performance** — eliminated per-frame allocations in the game loop
  - `collectedCargoKeys` / `collectedBonusKeys` are now tracked as `Set` refs updated only on game ticks, instead of being rebuilt from arrays on every animation frame (60 fps)
  - `Object.entries(map.cargoConfigs)` and `Object.entries(map.bonusConfigs)` are cached once at canvas effect setup, not re-allocated on every frame
  - `resolveCargoTypes` / `resolveBonusTypes` (which build lookup `Map`s) are now called once per canvas effect run and passed into `moveTrain` via the new `cargoById` / `bonusById` options, instead of being called on every game tick
  - Replaced `new Set(s.collectedCargoKeys).has()` / `new Set(s.collectedBonusKeys).has()` in `moveTrain` with `Array.prototype.includes()`, avoiding two Set allocations per tick

## [1.1.0] - 2026-06-17

### Removed

- OpenSCAD 3D carriage export feature (`openscadService.ts`, export button on the Play screen, related locale strings)
- Unused dependencies: `express`, `better-sqlite3`, `dotenv`, `clsx`, `tailwind-merge`, `@types/express`, `@google/genai`

## [1.0.0] - 2026-06-16

### Added

- Static web distribution package (`release/trains-fluent-1.0.0.zip`) for direct upload to any HTTP server
- `npm run package:release` script to build and zip the production bundle
- Relative asset paths (`base: './'`) so the game runs from a domain root or subdirectory

### Changed

- First stable public release
- Preset data loads via `import.meta.env.BASE_URL` for portable deployment
- Play screen overlays use CSS animations instead of Framer Motion (fewer devtools conflicts)

### Fixed

- Console errors from Reactime / browser extension `backend.bundle.js` on the play screen

## [0.3.0] - 2026-06-16

### Added

- Scoring system with variable cargo point values, optional bonus pickups, combo multipliers, and per-level score multipliers
- Finish bonuses (all bonuses collected, no bumps) and 1–3 star ratings on level complete
- Bonus cell type in the map editor and editable bonus assets in Settings
- Floating score popups: 1 s linear rise-and-fade animation on every pickup
- `configDefaults.ts` for missing fields in imported JSON configs
- `scoring.ts` game module for combo window, multipliers, and star calculation
- Czech and English locale strings for bonus HUD, stars, and finish score

### Changed

- Play screen HUD shows bonus progress and star rating on level clear
- `trainMovement.ts` refactored to use shared `createInitialGameState` and scoring hooks
- Import/export and preset loading merge defaults for `bonusTypes` and cargo `pointValue`

## [0.2.0] - 2026-06-16

### Added

- JSON preset loading from `data/presets.json` (served by Vite)
- Generated levels preset (`data/generatedData.json`)
- Kids mode toggle on the main menu with soft wall bumps and gate hint
- Kids mode preference persisted in `localStorage`

## [0.1.1] - 2026-06-16

### Fixed

- Train tail collision detection so wagons no longer pass through the train body
- Wagon appearance stability across movement and redraw

### Changed

- Startup performance improvements and canvas rendering optimizations
- Architecture documentation and `.gitignore` updates

## [0.1.0] - 2026-06-16

### Added

- Initial release: grid-based train logic game with campaign mode
- Map editor with walls, cargo, start/gate placement, and path tools
- Custom assets: emoji fallbacks, image upload/crop, sketch pad drawing
- Settings manager for engines, walls, cargo types, and system icons
- JSON import/export of full game configuration
- OpenSCAD carriage export from the play screen
- Czech (default) and English UI via i18next

[1.7.1]: https://github.com/richardLipka/simple_editable_train/compare/v1.7.0...v1.7.1
[1.6.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/richardLipka/simple_editable_train/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/richardLipka/simple_editable_train/releases/tag/v0.1.0