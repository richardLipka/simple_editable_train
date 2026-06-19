# Kreslený vláček v1.7.2

Bug-fix and feature patch on top of v1.7.1.

## Download

- **`trains-fluent-1.7.2.zip`** — static web build, ready to upload to any HTTP server

## Highlights

- **URL preset parameter** — share a direct link that opens a specific preset campaign:
  ```
  https://your-site.example/vlak/?preset=klatovy
  ```
  The app loads the matching preset on startup, then strips `?preset=` from the URL so reloads don't overwrite the user's edits. The preset ID must match an `id` in `data/presets.json`.

## Deploy to your website

1. Download `trains-fluent-1.7.2.zip`
2. Unzip and upload **all files** (`index.html`, `assets/`, `data/`) to your server
3. Open via HTTPS/HTTP — e.g. `https://your-site.example/trains/`

See `DEPLOY.txt` inside the ZIP for details.

## Changes since v1.7.1

Full details in [CHANGELOG.md](../CHANGELOG.md).

### Added
- `?preset=<id>` URL parameter auto-loads a preset on startup without any server configuration
