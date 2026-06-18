// Shared image sizing/encoding for all custom assets.
//
// Every asset (uploaded photo, camera capture, or hand-drawn sketch) is stored
// as a base64 data URL inside the config, which lives in localStorage. PNG is
// lossless and huge for photographic content, so a handful of full-resolution
// images can blow past the ~5 MB localStorage quota. We fix that at the source:
// downscale to a small square and re-encode as WebP (alpha-capable, ~10-15x
// smaller than PNG for these icons), falling back to PNG only where WebP isn't
// supported.

// Stored resolution for all asset images. Small enough that a full set of
// custom assets fits comfortably in localStorage, large enough to stay crisp
// on the game grid (and on hi-DPI screens).
export const ASSET_SIZE = 128;

// Sketch pad geometry: the drawing surface is shown at 4x so each stored pixel
// reads as a chunky 4x4 block on screen, and the brush snaps to a 2x2-pixel
// unit so strokes survive at this resolution.
export const SKETCH_LOGICAL_SIZE = ASSET_SIZE; // 128
export const SKETCH_DISPLAY_SIZE = ASSET_SIZE * 4; // 512
export const SKETCH_PIXEL_UNIT = 2;

let webpSupported: boolean | null = null;

// Feature-detect lossy WebP encoding once. Some old browsers ignore the
// requested type and hand back a PNG; we detect that and keep PNG (still small
// at 128px, and it preserves the alpha channel the magic-wand tool relies on).
function supportsWebp(): boolean {
  if (webpSupported !== null) return webpSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupported = false;
  }
  return webpSupported;
}

// Encode a canvas as a compact data URL: WebP when available, otherwise PNG.
export function encodeCanvas(canvas: HTMLCanvasElement, quality = 0.85): string {
  if (supportsWebp()) {
    const url = canvas.toDataURL('image/webp', quality);
    if (url.startsWith('data:image/webp')) return url;
  }
  return canvas.toDataURL('image/png');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Downscale an arbitrary image to a square ASSET_SIZE canvas and re-encode as a
// compact data URL. `cover` center-crops to fill the square (default, since the
// asset slots are square); `contain` letterboxes with transparent padding.
export async function normalizeAssetImage(
  src: string,
  opts: { size?: number; quality?: number; fit?: 'cover' | 'contain' } = {}
): Promise<string> {
  const { size = ASSET_SIZE, quality = 0.85, fit = 'cover' } = opts;
  const img = await loadImage(src);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return src;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const scale = fit === 'cover' ? Math.max(size / iw, size / ih) : Math.min(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return encodeCanvas(canvas, quality);
}
