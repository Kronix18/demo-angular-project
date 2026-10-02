import { FILLED_ICONS, iconPath } from './icons';

/** Paints an icon on a canvas (centred on x, y) with the same path data the toolbar uses. */
export function drawIcon(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, size: number, color: string, lineWidth = 1.7): void {
  if (typeof Path2D === 'undefined') return;
  const d = iconPath(name);
  if (!d) return;
  const path = new Path2D(d);
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = (lineWidth * 24) / size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (FILLED_ICONS.has(name)) ctx.fill(path);
  ctx.stroke(path);
  ctx.restore();
}
