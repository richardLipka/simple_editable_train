import { GRID_SIZE } from '../constants';

/** Cached grid fill + line pattern for a fixed map size. */
export function createGridBackground(
  pixelWidth: number,
  pixelHeight: number,
  gridWidth: number,
  gridHeight: number,
): HTMLCanvasElement {
  const layer = document.createElement('canvas');
  layer.width = pixelWidth;
  layer.height = pixelHeight;
  const ctx = layer.getContext('2d');
  if (!ctx) return layer;

  ctx.fillStyle = '#fdfaf6';
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  ctx.strokeStyle = '#17255411';
  ctx.lineWidth = 1;
  for (let x = 0; x <= gridWidth; x++) {
    ctx.beginPath();
    ctx.moveTo(x * GRID_SIZE, 0);
    ctx.lineTo(x * GRID_SIZE, pixelHeight);
    ctx.stroke();
  }
  for (let y = 0; y <= gridHeight; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * GRID_SIZE);
    ctx.lineTo(pixelWidth, y * GRID_SIZE);
    ctx.stroke();
  }

  return layer;
}