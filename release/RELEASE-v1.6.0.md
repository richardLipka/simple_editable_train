# Trains Fluent v1.6.0

Smaller, storage-friendly custom assets and a pixel-grid sketch pad.

## Download

- **`trains-fluent-1.6.0.zip`** — static web build, ready to upload to any HTTP server

## Highlights

- **Compact asset images** — every custom image (upload, camera, or drawing) is downscaled to 128×128 and stored as **WebP** (PNG fallback), ~10–15× smaller than before, so custom assets no longer overflow the browser storage quota. Transparency is preserved.
- **Pixel-grid sketch pad** — the drawing surface stays large but works at the 128px asset resolution, shown 4× zoomed with crisp pixels and a 2×2-pixel brush unit.
- **Import shrinks legacy data** — importing a config (or loading a preset) re-compresses any oversized images, so older configs shrink automatically. Migration path for pre-1.6.0 setups: **export and re-import**.
- **Bundled sample regenerated** — `data/defaultData.json` dropped from ~1.5 MB to ~110 KB.

## Deploy to your website

1. Download `trains-fluent-1.6.0.zip`
2. Unzip and upload **all files** (`index.html`, `assets/`, `data/`) to your server
3. Open via HTTPS/HTTP — e.g. `https://your-site.example/trains/`

See `DEPLOY.txt` inside the ZIP for details.

## Changes since v1.5.0

- Asset images downscaled to 128px and re-encoded as WebP at the source (crop editor, camera, sketch pad)
- Sketch pad reworked into a coarse pixel grid (4× display, 2×2-pixel unit)
- Import/preset loading re-compresses embedded images (`compressConfigImages`)
- Bundled `data/defaultData.json` regenerated with WebP images

Full notes in [CHANGELOG.md](../CHANGELOG.md).
