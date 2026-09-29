import { Chart } from 'chart.js';
import { cssVar } from './chart-theme';

export interface LastPriceInfo { y: number; text: string; up: boolean; clamped: boolean; }

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
  return { y, text: base ? `${pct > 0.005 ? '+' : ''}${pct.toFixed(2)}%` : last.toFixed(2), up: last >= prev, clamped: y !== raw };
}

export const lastPricePlugin = {
  id: 'lastPrice',
  afterDatasetsDraw(chart: any): void {
    if (chart.$lastPriceOn === false) return;
    const info = lastPriceInfo(chart);
    const { ctx, chartArea } = chart;
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
    ctx.restore();
  },
};
Chart.register(lastPricePlugin);
