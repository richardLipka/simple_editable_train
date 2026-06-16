# Trains Fluent v1.0.0

First stable public release of the browser-based train logic game.

## Download

- **`trains-fluent-1.0.0.zip`** — static web build, ready to upload to any HTTP server

## What's included

- Campaign mode with scoring, bonuses, combos, and star ratings
- Kids mode with soft bumps
- Map editor and full settings/asset manager
- JSON import/export and built-in level presets
- Czech (default) and English UI

## Deploy to your website

1. Download `trains-fluent-1.0.0.zip`
2. Unzip and upload **all files** (`index.html`, `assets/`, `data/`) to your server
3. Open via HTTPS/HTTP — e.g. `https://your-site.example/trains/`

See `DEPLOY.txt` inside the ZIP for details.

## Changes since v0.3.0

- Portable static build with relative paths (works in subdirectories)
- CSS animations on play screen (no Framer Motion devtools conflicts)
- Distribution packaging script (`npm run package:release`)