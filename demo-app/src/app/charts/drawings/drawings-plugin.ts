import { Chart } from 'chart.js';
import { cssVar } from '../chart-theme';
import { Drawing } from './drawing-geometry';
import { DrawingController } from './drawing-controller';
import { Env, Role, Shape, handlePoints, shapesFor, textBox } from './drawing-shapes';

const dashOf = (style?: string): number[] => (style === 'dash' ? [6, 4] : style === 'dot' ? [2, 3] : []);

/**
 * Drawing renderer: every drawing type (through the shape generator, so what is
 * painted is exactly what is hit-tested), drafts, the measure/zoom rectangles
 * and the selection handles, from the DrawingController's view. Clipped to the
 * price pane; shapes flagged `chart` (vertical lines, time zones) span the whole
 * chart. Anchors are (time, price), so drawings follow zoom/pan/LOD/interval
 * changes. Colours: theme tokens only.
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
    const draft = ctl.draftDrawing();
    if ((hidden || !v.drawings.length) && !draft && !v.measure) return;
    const env = ctl.env();
    if (!env) return;

    const base = cssVar('--c-drawing');
    const surface = cssVar('--c-chart-bg');
    const text = cssVar('--c-text');
    const roles: Record<Role, string> = { up: cssVar('--c-up'), down: cssVar('--c-down'), muted: cssVar('--c-text-muted'), text };
    const { left, right, top, bottom } = chartArea;

    const paint = (d: Drawing, shapes: Shape[], pass: 'pane' | 'chart', draftMode: boolean) => {
      const own = d.style?.color ?? base;
      const width = d.style?.width ?? 1.5;
      const dash = draftMode ? [5, 4] : dashOf(d.style?.dash);
      const colorOf = (s: Shape) => (s.role ? roles[s.role] : own);
      for (const s of shapes) {
        const chartLevel = (s.k === 'line' || s.k === 'text') && !!s.chart;
        if ((pass === 'chart') !== chartLevel) continue;
        ctx.save();
        const color = colorOf(s);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width * (s.wm ?? 1);
        ctx.setLineDash(s.dash ?? dash);
        const fillOf = (a: number) => { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = color; ctx.fill(); ctx.restore(); };
        const stroke = () => { if ((s.alpha ?? 1) > 0) { ctx.globalAlpha = s.alpha ?? 1; ctx.stroke(); } };
        switch (s.k) {
          case 'line': {
            const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy);
            const k = s.ext && len > 1e-9 ? 1e5 / len : 0;
            ctx.beginPath();
            ctx.moveTo(s.ext === 'both' ? s.x1 - dx * k : s.x1, s.ext === 'both' ? s.y1 - dy * k : s.y1);
            ctx.lineTo(k ? s.x1 + dx * k : s.x2, k ? s.y1 + dy * k : s.y2);
            stroke();
            break;
          }
          case 'arrow': {
            ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
            const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
            const h = 10 + width;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(s.x2, s.y2);
            ctx.lineTo(s.x2 - h * Math.cos(ang - 0.4), s.y2 - h * Math.sin(ang - 0.4));
            ctx.lineTo(s.x2 - h * Math.cos(ang + 0.4), s.y2 - h * Math.sin(ang + 0.4));
            ctx.closePath(); ctx.fill();
            break;
          }
          case 'poly':
            ctx.beginPath();
            s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            if (s.closed) ctx.closePath();
            if (s.fill) fillOf(s.fill);
            stroke();
            break;
          case 'rect':
            ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h);
            if (s.fill) fillOf(s.fill);
            if (s.stroke !== false && (s.alpha ?? 1) > 0) ctx.stroke();
            break;
          case 'ellipse':
            ctx.beginPath(); ctx.ellipse(s.cx, s.cy, Math.max(s.rx, 0.5), Math.max(s.ry, 0.5), 0, 0, Math.PI * 2);
            if (s.fill) fillOf(s.fill);
            stroke();
            break;
          case 'curve':
            ctx.beginPath(); ctx.moveTo(s.pts[0].x, s.pts[0].y); ctx.quadraticCurveTo(s.pts[1].x, s.pts[1].y, s.pts[2].x, s.pts[2].y);
            stroke();
            break;
          case 'text': {
            const size = s.size ?? 12;
            ctx.font = `${size}px sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = s.align === 'center' ? 'center' : 'left';
            ctx.setLineDash([]);
            let textColor = color;
            if (s.box) {
              const b = textBox(s);
              ctx.fillStyle = s.box === 'note' ? cssVar('--c-tooltip-bg') : surface;
              ctx.fillRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
              ctx.lineWidth = 1;
              ctx.strokeRect(b.left + 0.5, b.top + 0.5, b.right - b.left - 1, b.bottom - b.top - 1);
              if (s.box === 'note') textColor = cssVar('--c-tooltip-text');
            }
            ctx.fillStyle = textColor;
            ctx.fillText(s.text, s.box && s.align !== 'center' ? s.x + 4 : s.x, s.y);
            break;
          }
        }
        ctx.restore();
      }
    };

    const drawTransient = (d: { type: string; a: any; b: any }) => {
      const a = ctl.pixel(d.a), b = ctl.pixel(d.b);
      if (!a || !b) return;
      const col = d.type === 'zoom' ? base : d.b.p >= d.a.p ? roles.up : roles.down;
      ctx.save();
      ctx.globalAlpha = 0.15; ctx.fillStyle = col;
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = col; ctx.setLineDash([4, 3]);
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.restore();
    };

    const items: { d: Drawing; shapes: Shape[]; draft: boolean }[] = [];
    if (!hidden) for (const d of v.drawings) items.push({ d, shapes: shapesFor(d, env), draft: false });
    const transientDraft = v.draft && (v.draft.type === 'measure' || v.draft.type === 'zoom') ? v.draft : null;
    if (draft && !transientDraft) items.push({ d: draft, shapes: shapesFor(draft, env), draft: true });

    for (const pass of ['pane', 'chart'] as const) {
      ctx.save();
      ctx.beginPath();
      if (pass === 'pane') ctx.rect(left, ys.top, right - left, ys.bottom - ys.top); else ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const it of items) paint(it.d, it.shapes, pass, it.draft);
      if (pass === 'pane') {
        if (transientDraft) drawTransient(transientDraft);
        if (v.measure) drawTransient({ type: 'measure', a: v.measure.a, b: v.measure.b });
        // selection handles + the anchors already placed by a draft
        const sel = v.drawings.find((d) => d.id === v.selectedId);
        const handleSets: { pts: { x: number; y: number }[]; color: string }[] = [];
        if (sel && !hidden) handleSets.push({ pts: handlePoints(sel, env), color: sel.style?.color ?? base });
        if (draft && !transientDraft) handleSets.push({ pts: (draft.pts ?? [draft.a]).slice(0, -1).map((a) => env.px(a)), color: base });
        for (const hs of handleSets) {
          ctx.setLineDash([]);
          ctx.fillStyle = surface;
          ctx.strokeStyle = hs.color;
          for (const p of hs.pts) { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        }
        if (v.measure) {
          const pb = ctl.pixel(v.measure.b);
          if (pb) {
            const lines = ctl.measureLabel(v.measure);
            ctx.font = '12px sans-serif';
            const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
            const bx = Math.min(Math.max(pb.x + 8, left), right - w);
            const by = Math.min(Math.max(pb.y - 20, ys.top), ys.bottom - 40);
            ctx.setLineDash([]);
            ctx.fillStyle = cssVar('--c-tooltip-bg');
            ctx.fillRect(bx, by, w, 38);
            ctx.fillStyle = cssVar('--c-tooltip-text');
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 11 + i * 16));
          }
        }
      }
      ctx.restore();
    }
  },
};
Chart.register(drawingsPlugin);
