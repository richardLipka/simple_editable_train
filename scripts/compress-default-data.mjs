// Recompress the embedded images in data/defaultData.json down to the same
// compact format the running app now uses for every asset: a 128x128 square,
// "contain" fit (whole image preserved, transparent padding), encoded as WebP.
// This mirrors src/utils/imageEncoding.ts (ASSET_SIZE / normalizeAssetImage)
// but runs in Node via sharp, so the bundled sample stays small instead of
// shipping multi-hundred-KB PNGs.
//
// Maintenance tool only — NOT a runtime/build dependency. Run with sharp
// installed transiently:
//   npm i sharp --no-save && node scripts/compress-default-data.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const SIZE = 128;
const QUALITY = 85; // matches the 0.85 quality used by canvas toDataURL in-app

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(rootDir, 'data', 'defaultData.json');

const config = JSON.parse(fs.readFileSync(target, 'utf8'));

let count = 0;
let beforeChars = 0;
let afterChars = 0;

async function recompress(dataUrl) {
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(dataUrl);
  if (!m) return dataUrl;
  const out = await sharp(Buffer.from(m[1], 'base64'))
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: QUALITY })
    .toBuffer();
  const result = `data:image/webp;base64,${out.toString('base64')}`;
  count += 1;
  beforeChars += dataUrl.length;
  afterChars += result.length;
  return result;
}

// Walk every value; recompress any base64 image data URL wherever it appears.
async function walk(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const v = node[i];
      if (typeof v === 'string' && v.startsWith('data:image')) node[i] = await recompress(v);
      else if (v && typeof v === 'object') await walk(v);
    }
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (typeof v === 'string' && v.startsWith('data:image')) node[k] = await recompress(v);
      else if (v && typeof v === 'object') await walk(v);
    }
  }
}

await walk(config);
fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

const kb = (n) => (n / 1024).toFixed(1);
console.log(`Recompressed ${count} images.`);
console.log(`Embedded image payload: ${kb(beforeChars)} KB -> ${kb(afterChars)} KB base64 chars`);
console.log(`File size now: ${kb(fs.statSync(target).size)} KB`);
