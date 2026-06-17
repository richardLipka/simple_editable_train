# Changelog

All notable changes to **Trains Fluent** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.4.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/richardLipka/simple_editable_train/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/richardLipka/simple_editable_train/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/richardLipka/simple_editable_train/releases/tag/v0.1.0