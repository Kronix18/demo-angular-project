import { Chart } from 'chart.js';
import { cssVar } from './chart-theme';
import { drawIcon } from '../shared/icons/canvas-icon';

export interface LastPriceInfo { y: number; text: string; up: boolean; clamped: boolean; countdown?: string; }

/**
 * Geometry of the last-price line: at the last close (clamped to the price pane when
 * the bar is off the scale), coloured by the change from the previous close, labelled
 * with the price or — on the percentage scale — the % change from the base.
 */
export function lastPriceInfo(chart: any): LastPriceInfo | null {
  const bars: { close: number }[] = chart?.$lastBars?.() ?? [];
  const ys = chart?.scales?.y;
  if (!chart?.chartArea || !ys || !bars.length) return null;
  const last = bars[bars.length - 1].close;
  const prev = bars.length > 1 ? bars[bars.length - 2].close : last;
  const raw = ys.getPixelForValue(last);
  if (!Number.isFinite(raw)) return null;
  const lo = Math.min(ys.top, ys.bottom), hi = Math.max(ys.top, ys.bottom);
  const y = Math.min(hi, Math.max(lo, raw));
  const base = chart.$percentOn && typeof chart.$percentBase === 'function' ? chart.$percentBase() : null;
  const pct = base ? (last / base - 1) * 100 : 0;
  const countdown: string | undefined = chart.$countdown?.() || undefined;
  return { y, ...(countdown ? { countdown } : {}), text: base ? `${pct > 0.005 ? '+' : ''}${pct.toFixed(2)}%` : last.toFixed(2), up: last >= prev, clamped: y !== raw };
}

export interface AlertLine { y: number; text: string; triggered: boolean; }

/** Horizontal lines for the price alerts that fall inside the price pane. */
export function alertLines(chart: any): AlertLine[] {
  const list: { price: number; triggered: boolean }[] = chart?.$alerts?.() ?? [];
  const ys = chart?.scales?.y;
  if (!ys || !list.length) return [];
  const lo = Math.min(ys.top, ys.bottom), hi = Math.max(ys.top, ys.bottom);
  return list
    .map((a) => ({ y: ys.getPixelForValue(a.price), text: a.price.toFixed(2), triggered: a.triggered }))
    .filter((l) => Number.isFinite(l.y) && l.y >= lo && l.y <= hi);
}

export const lastPricePlugin = {
  id: 'lastPrice',
  afterDatasetsDraw(chart: any): void {
    const { ctx, chartArea } = chart;
    if (ctx && chartArea) {
      for (const l of alertLines(chart)) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = cssVar(l.triggered ? '--c-text-muted' : '--c-primary');
        ctx.moveTo(chartArea.left, l.y);
        ctx.lineTo(chartArea.right, l.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = cssVar('--c-surface');
        ctx.fillRect(chartArea.right, l.y - 9, 62, 18);
        ctx.strokeStyle = cssVar(l.triggered ? '--c-text-muted' : '--c-primary');
        ctx.strokeRect(chartArea.right + 0.5, l.y - 8.5, 61, 17);
        ctx.fillStyle = cssVar('--c-text');
        ctx.font = '11px sans-serif';
        ctx.textBaseline = 'middle';
        drawIcon(ctx, 'iconbell', chartArea.right + 11, l.y, 11, cssVar(l.triggered ? '--c-text-muted' : '--c-primary'), 1.4);
        ctx.fillText(l.text, chartArea.right + 20, l.y);
        ctx.restore();
      }
    }
    if (chart.$lastPriceOn === false) return;
    const info = lastPriceInfo(chart);
    if (!info || !ctx) return;
    const color = cssVar(info.up ? '--c-up' : '--c-down');
    ctx.save();
    if (!info.clamped) {
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      ctx.moveTo(chartArea.left, info.y);
      ctx.lineTo(chartArea.right, info.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.fillRect(chartArea.right, info.y - 9, 62, 18);
    ctx.fillStyle = cssVar('--c-on-primary');
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.text, chartArea.right + 6, info.y);
    if (info.countdown) {
      ctx.fillStyle = color;
      ctx.fillRect(chartArea.right, info.y + 9, 62, 16);
      ctx.fillStyle = cssVar('--c-on-primary');
      ctx.fillText(info.countdown, chartArea.right + 4, info.y + 17);
    }
    ctx.restore();
  },
};
Chart.register(lastPricePlugin);
