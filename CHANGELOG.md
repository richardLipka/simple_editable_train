# Changelog

All notable changes to **Trains Fluent** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/richardLipka/simple_editable_train/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/richardLipka/simple_editable_train/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/richardLipka/simple_editable_train/releases/tag/v0.1.0