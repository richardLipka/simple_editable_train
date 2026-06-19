# Kreslený vláček v1.7.0

Sketch-pad enhancements, gameplay polish, and memory-leak fixes.

## Download

- **`trains-fluent-1.7.0.zip`** — static web build, ready to upload to any HTTP server

## Highlights

- **Brightness tool** — lift shadows in photos with gamma correction while keeping colours vivid
- **Flip horizontal** — mirror your drawing with one click
- **Transparent drawing** — paint or fill with a transparent "colour" to erase to alpha
- **3-2-1-GO countdown** — gives you a moment to orient before each level starts
- **Campaign button** — the large play icon on the main menu now launches the campaign directly
- **Out-of-memory fixes** — image cache pruning, static-layer rebuild guard, precomputed car paths, tracked countdown timers

## Deploy to your website

1. Download `trains-fluent-1.7.0.zip`
2. Unzip and upload **all files** (`index.html`, `assets/`, `data/`) to your server
3. Open via HTTPS/HTTP — e.g. `https://your-site.example/trains/`

See `DEPLOY.txt` inside the ZIP for details.

## Changes since v1.6.0

Full details in [CHANGELOG.md](../CHANGELOG.md).

### Added
- Sketch-pad brightness enhancement (gamma correction, HSV-value channel, live preview, Apply/Reset)
- Sketch-pad flip horizontal (synchronous pixel-swap, undo-able)
- Sketch-pad transparent stroke/fill colour — erases to alpha for all drawing tools
- 3-2-1-GO countdown overlay before each level (first start and retry)
- Main-menu large play icon is now a clickable campaign-start button

### Changed
- System asset action buttons rearranged into a 2×2 grid (Camera/Upload · Draw/Emoji)

### Fixed
- Transparent images shown as white when reopened in sketch pad
- Out-of-memory during play: unbounded image cache, per-frame static layer rebuild, per-frame car-path allocation, untracked countdown timers
