import { Chart } from 'chart.js';
import { cssVar } from '../chart-theme';
import { FIB_LEVELS, fibPrice } from './drawing-geometry';
import { DrawingController, textWidth } from './drawing-controller';

const dashOf = (style?: string): number[] => (style === 'dash' ? [6, 4] : style === 'dot' ? [2, 3] : []);

/**
 * Drawing renderer: every drawing type, drafts, the measure readout and the
 * selection handles, from the DrawingController's view. Clipped to the price
 * pane (vertical lines span the whole chart). Anchors are (time, price), so
 * drawings follow zoom/pan/LOD/interval/scale changes. Colours: theme tokens.
 */
export const drawingsPlugin = {
  id: 'drawings',
  afterDatasetsDraw(chart: any): void {
    const ctl: DrawingController | undefined = chart.$drawings;
    const { ctx, chartArea } = chart;
    const ys = chart.scales?.y;
    if (!ctl || !ctx || !chartArea || !ys) return;
    const v = ctl.view();
    const hidden = ctl.hidden();
    if ((hidden || !v.drawings.length) && !v.draft && !v.measure) return;

    const base = cssVar('--c-drawing');
    const surface = cssVar('--c-chart-bg');
    const text = cssVar('--c-text');
    const up = cssVar('--c-up');
    const down = cssVar('--c-down');
    const { left, right, top, bottom } = chartArea;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, ys.top, right - left, ys.bottom - ys.top);
    ctx.clip();
    ctx.font = '12px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const line = (x1: number, y1: number, x2: number, y2: number) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    const tint = (color: string, alpha: number, path: () => void) => { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); path(); ctx.fill(); ctx.restore(); };

    const draw = (d: any, selected: boolean, draft: boolean) => {
      const a = ctl.pixel(d.a);
      if (!a) return;
      const color = d.style?.color ?? base;
      ctx.lineWidth = d.style?.width ?? 1.5;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.setLineDash(draft ? [5, 4] : dashOf(d.style?.dash));
      const b = d.b ? ctl.pixel(d.b) : null;
      let handles: { x: number; y: number }[] = b ? [a, b] : [a];

      switch (d.type) {
        case 'ray': line(a.x, a.y, right, a.y); break;
        case 'hline': line(left, a.y, right, a.y); break;
        case 'vline':
          ctx.save();
          ctx.beginPath(); ctx.rect(left, top, right - left, bottom - top); ctx.clip();
          line(a.x, top, a.x, bottom);
          ctx.restore();
          break;
        case 'trend': if (b) line(a.x, a.y, b.x, b.y); break;
        case 'arrow':
          if (b) {
            line(a.x, a.y, b.x, b.y);
            const ang = Math.atan2(b.y - a.y, b.x - a.x);
            const h = 10 + (d.style?.width ?? 1.5);
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(b.x - h * Math.cos(ang - 0.4), b.y - h * Math.sin(ang - 0.4));
            ctx.lineTo(b.x - h * Math.cos(ang + 0.4), b.y - h * Math.sin(ang + 0.4));
            ctx.closePath();
            ctx.fill();
          }
          break;
        case 'rect':
          if (b) {
            tint(color, 0.12, () => ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)));
            ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
          }
          break;
        case 'ellipse':
          if (b) {
            const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
            tint(color, 0.12, () => ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2));
            ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2); ctx.stroke();
          }
          break;
        case 'fib':
          if (b) {
            const l = Math.min(a.x, b.x), r = Math.max(a.x, b.x);
            const ys2 = FIB_LEVELS.map((lv) => ctl.pixel({ t: d.a.t, p: fibPrice(d.a, d.b, lv) })!.y);
            FIB_LEVELS.forEach((lv, i) => {
              if (i > 0) tint(color, i % 2 ? 0.05 : 0.09, () => ctx.rect(l, Math.min(ys2[i - 1], ys2[i]), r - l, Math.abs(ys2[i] - ys2[i - 1])));
              ctx.lineWidth = (d.style?.width ?? 1.5) * 0.7;
              line(l, ys2[i], r, ys2[i]);
              ctx.save();
              ctx.setLineDash([]);
              ctx.fillStyle = text;
              ctx.textBaseline = 'bottom';
              ctx.fillText(`${lv} (${fibPrice(d.a, d.b, lv).toFixed(2)})`, l + 4, ys2[i] - 1);
              ctx.restore();
            });
            ctx.lineWidth = d.style?.width ?? 1.5;
            ctx.setLineDash([3, 3]);
            line(a.x, a.y, b.x, b.y); // trend line the levels were measured from
          }
          break;
        case 'brush': {
          const pts = ((d.pts ?? []) as any[]).map((p) => ctl.pixel(p)).filter(Boolean) as { x: number; y: number }[];
          if (pts.length > 1) {
            ctx.beginPath();
            pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.stroke();
          }
          handles = [];
          break;
        }
        case 'text': {
          const label = d.text ?? '';
          const w = textWidth(label);
          ctx.setLineDash([]);
          ctx.fillStyle = surface;
          ctx.fillRect(a.x, a.y - 9, w, 18);
          ctx.lineWidth = 1;
          ctx.strokeRect(a.x + 0.5, a.y - 8.5, w - 1, 17);
          ctx.fillStyle = color;
          ctx.fillText(label, a.x + 4, a.y);
          break;
        }
        case 'channel':
          if (b) {
            line(a.x, a.y, b.x, b.y);
            if (d.offset !== undefined) {
              const a2 = ctl.pixel({ t: d.a.t, p: d.a.p + d.offset })!;
              const b2 = ctl.pixel({ t: d.b.t, p: d.b.p + d.offset })!;
              line(a2.x, a2.y, b2.x, b2.y);
              tint(color, 0.12, () => { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(a2.x, a2.y); ctx.closePath(); });
            }
          }
          break;
        case 'measure':
        case 'zoom':
          if (b) {
            const rising = d.b.p >= d.a.p;
            const col = d.type === 'zoom' ? base : rising ? up : down;
            tint(col, 0.15, () => ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)));
            ctx.strokeStyle = col;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
          }
          handles = [];
          break;
      }

      if (selected) {
        ctx.setLineDash([]);
        ctx.fillStyle = surface;
        ctx.strokeStyle = color;
        for (const p of handles) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
    };

    if (!hidden) for (const d of v.drawings) draw(d, d.id === v.selectedId, false);
    if (v.draft) draw(v.draft, false, true);

    if (v.measure) {
      draw({ type: 'measure', a: v.measure.a, b: v.measure.b }, false, false);
      const pb = ctl.pixel(v.measure.b);
      if (pb) {
        const lines = ctl.measureLabel(v.measure);
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
        const bx = Math.min(Math.max(pb.x + 8, left), right - w);
        const by = Math.min(Math.max(pb.y - 20, ys.top), ys.bottom - 40);
        ctx.setLineDash([]);
        ctx.fillStyle = cssVar('--c-tooltip-bg');
        ctx.fillRect(bx, by, w, 38);
        ctx.fillStyle = cssVar('--c-tooltip-text');
        ctx.textBaseline = 'middle';
        lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 11 + i * 16));
      }
    }
    ctx.restore();
  },
};
Chart.register(drawingsPlugin);
