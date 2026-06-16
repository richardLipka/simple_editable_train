import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version;
const distDir = path.join(rootDir, 'dist');
const releaseDir = path.join(rootDir, 'release');
const zipName = `trains-fluent-${version}.zip`;
const zipPath = path.join(releaseDir, zipName);

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found — run npm run build first.');
  process.exit(1);
}

const deployText = `Trains Fluent v${version}
====================

Upload everything in this ZIP to your web server and open index.html via HTTP.

Quick start
-----------
1. Unzip trains-fluent-${version}.zip on your computer.
2. Upload ALL files and folders to your website (FTP, hosting panel, etc.).
   Keep the folder structure intact:
     index.html
     assets/
     data/
3. Open the game in a browser, e.g. https://your-site.example/trains/

Important
---------
- The game must be served over HTTP or HTTPS (not opened as a local file:// link).
- Works from a domain root or any subdirectory — paths are relative.
- Progress is saved in the browser localStorage.
- Preset JSON files are in the data/ folder.

Author: Richard Lipka
`;

fs.mkdirSync(releaseDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'DEPLOY.txt'), deployText, 'utf8');

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

if (os.platform() === 'win32') {
  const distGlob = path.join(distDir, '*');
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${distGlob}' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' },
  );
} else {
  execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}

const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
console.log(`\nRelease package ready: release/${zipName} (${sizeMb} MB)`);
console.log('Upload the ZIP contents to your web server, or attach the ZIP to a GitHub release.');