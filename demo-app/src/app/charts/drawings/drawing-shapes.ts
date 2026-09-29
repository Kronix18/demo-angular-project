import { OHLCV } from '../../core/models/ohlcv.model';
import { Anchor, Drawing, FIB_LEVELS, distToEllipse, distToPolyline, distToSegment, fibPrice, indexForTime, measureInfo } from './drawing-geometry';
import { toolDef } from './drawing-tools';

export interface Pt { x: number; y: number; }
export interface Box { left: number; right: number; top: number; bottom: number; }

/** What shape generation needs from the chart: the price pane, the whole chart, anchor → pixel, bars and a price formatter. */
export interface Env {
  area: Box;
  full: Box;
  bars: OHLCV[];
  px: (a: Anchor) => Pt;
  fmt: (price: number) => string;
}

/** Colour roles resolve to theme tokens in the renderer; none = the drawing's own colour. */
export type Role = 'up' | 'down' | 'muted' | 'text';

interface Common { role?: Role; dash?: number[]; /** line-width multiplier */ wm?: number; alpha?: number; }
export type Shape =
  | (Common & { k: 'line'; x1: number; y1: number; x2: number; y2: number; ext?: 'right' | 'both'; /** span the whole chart, not just the price pane */ chart?: boolean })
  | (Common & { k: 'poly'; pts: Pt[]; closed?: boolean; fill?: number })
  | (Common & { k: 'rect'; x: number; y: number; w: number; h: number; fill?: number; stroke?: boolean; /** opaque chart-background fill (table cells) */ surface?: boolean })
  | (Common & { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill?: number })
  | (Common & { k: 'arrow'; x1: number; y1: number; x2: number; y2: number })
  | (Common & { k: 'curve'; pts: [Pt, Pt, Pt] })
  | (Common & { k: 'text'; x: number; y: number; text: string; align?: 'left' | 'center'; box?: 'surface' | 'note'; size?: number; chart?: boolean });

export const TEXT_H = 18;
export const textWidth = (text: string): number => Math.max(20, text.length * 7 + 8);

/** Hit / paint box of a text shape. */
export function textBox(s: Extract<Shape, { k: 'text' }>): Box {
  const size = s.size ?? 12;
  if (s.align === 'center') {
    const half = Math.max(size * 0.6, s.box ? textWidth(s.text) / 2 : 0);
    return { left: s.x - half, right: s.x + half, top: s.y - size * 0.7, bottom: s.y + size * 0.7 };
  }
  return { left: s.x, right: s.x + textWidth(s.text), top: s.y - TEXT_H / 2, bottom: s.y + TEXT_H / 2 };
}

/** Endpoints of a line after applying its extension (far enough to leave any canvas). */
export function extendLine(l: { x1: number; y1: number; x2: number; y2: number; ext?: 'right' | 'both' }): [Pt, Pt] {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  const len = Math.hypot(dx, dy);
  if (!l.ext || len < 1e-9) return [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }];
  const k = 1e5 / len;
  return [
    l.ext === 'both' ? { x: l.x1 - dx * k, y: l.y1 - dy * k } : { x: l.x1, y: l.y1 },
    { x: l.x1 + dx * k, y: l.y1 + dy * k },
  ];
}

const anchorsOf = (d: Drawing): Anchor[] => (d.pts && d.pts.length ? d.pts : [d.a, ...(d.b ? [d.b] : [])]);
const need = (id: string): number => {
  const p = toolDef(id)?.points;
  return typeof p === 'number' ? p : 2;
};

interface Ctx { d: Drawing; env: Env; A: Anchor[]; P: Pt[]; }
type Builder = (c: Ctx) => Shape[];

const seg = (p: Pt, q: Pt, over: Partial<Extract<Shape, { k: 'line' }>> = {}): Shape => ({ k: 'line', x1: p.x, y1: p.y, x2: q.x, y2: q.y, ...over });
const label = (p: Pt, text: string, over: Partial<Extract<Shape, { k: 'text' }>> = {}): Shape => ({ k: 'text', x: p.x, y: p.y, text, ...over });
const pctOf = (from: number, to: number) => (from ? ((to - from) / from) * 100 : 0);
const signed = (v: number, digits = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;
const DOT = [3, 3];

const H_LINE: Builder = ({ env, P }) => [seg({ x: env.area.left, y: P[0].y }, { x: env.area.right, y: P[0].y })];

/** Polyline through the pattern points with the given point labels (above peaks, below troughs). */
function labelled(P: Pt[], names: string[]): Shape[] {
  const out: Shape[] = [{ k: 'poly', pts: P }];
  P.forEach((p, i) => {
    const prev = P[i - 1], next = P[i + 1];
    const peak = (!prev || p.y <= prev.y) && (!next || p.y <= next.y);
    out.push(label({ x: p.x, y: p.y + (peak ? -12 : 12) }, names[i] ?? String(i), { align: 'center' }));
  });
  return out;
}

const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
const ratio = (a: number, b: number) => (b ? Math.abs(a / b).toFixed(3) : '–');

const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** Andrews pitchfork: median from `start` through the middle of b–c, parallels through b and c. */
function pitchfork(P: Pt[], start: Pt): Shape[] {
  const m = mid(P[1], P[2]);
  const v = { x: m.x - start.x, y: m.y - start.y };
  const par = (p: Pt) => seg(p, { x: p.x + v.x, y: p.y + v.y }, { ext: 'right' });
  return [seg(start, m, { ext: 'right' }), par(P[1]), par(P[2]), seg(P[1], P[2], { dash: DOT, role: 'muted' })];
}

const FIB_TIME = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
const GANN = [[8, '1x8'], [4, '1x4'], [3, '1x3'], [2, '1x2'], [1, '1x1'], [1 / 2, '2x1'], [1 / 3, '3x1'], [1 / 4, '4x1'], [1 / 8, '8x1']] as const;
const ICON: Record<string, [string, Role | undefined]> = {
  iconup: ['▲', 'up'], icondown: ['▼', 'down'], iconcheck: ['✔', 'up'], iconcross: ['✖', 'down'], iconstar: ['★', undefined], iconflag: ['⚑', undefined],
  iconheart: ['❤', 'down'], iconthumb: ['👍', undefined], iconfire: ['🔥', undefined], iconrocket: ['🚀', undefined],
  iconwarn: ['⚠', undefined], iconbulb: ['💡', undefined], iconbell: ['🔔', undefined], icondollar: ['$', 'up'],
};

/** Least-squares line through the closes between two anchors: fitted end prices and the residual σ. */
function regressionFit(bars: OHLCV[], a: Anchor, b: Anchor): { i0: number; i1: number; c0: number; c1: number; sigma: number } | null {
  if (!bars.length) return null;
  let i0 = Math.round(indexForTime(bars, a.t));
  let i1 = Math.round(indexForTime(bars, b.t));
  if (i0 > i1) [i0, i1] = [i1, i0];
  const n = i1 - i0 + 1;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let k = 0; k < n; k++) { const y = bars[i0 + k].close; sx += k; sy += y; sxy += k * y; sxx += k * k; }
  const den = n * sxx - sx * sx;
  const slope = den ? (n * sxy - sx * sy) / den : 0;
  const icpt = (sy - slope * sx) / n;
  let ss = 0;
  for (let k = 0; k < n; k++) ss += (bars[i0 + k].close - (icpt + slope * k)) ** 2;
  return { i0, i1, c0: icpt, c1: icpt + slope * (n - 1), sigma: Math.sqrt(ss / n) };
}

/** Bars i0..i1 copied to start at pixel x0, shifted so the first close lands on `price` (ghost feed / bars pattern). */
function pasteBars(env: Env, a: Anchor, b: Anchor, x0: number, price: number, alpha: number, _pad: number): Shape[] {
  const bars = env.bars;
  if (!bars.length) return [];
  let i0 = Math.round(indexForTime(bars, a.t)), i1 = Math.round(indexForTime(bars, b.t));
  if (i0 > i1) [i0, i1] = [i1, i0];
  i1 = Math.min(i1, i0 + 150);
  const dp = price - bars[i0].close;
  const xs0 = env.px({ t: bars[i0].timestamp, p: 0 }).x;
  const out: Shape[] = [];
  for (let i = i0; i <= i1; i++) {
    const bar = bars[i];
    const y = (p: number) => env.px({ t: bar.timestamp, p: p + dp }).y;
    const x = x0 + (env.px({ t: bar.timestamp, p: 0 }).x - xs0);
    const role: Role = bar.close >= bar.open ? 'up' : 'down';
    out.push(seg({ x, y: y(bar.high) }, { x, y: y(bar.low) }, { role, alpha }), seg({ x: x - 3, y: y(bar.open) }, { x, y: y(bar.open) }, { role, alpha }), seg({ x, y: y(bar.close) }, { x: x + 3, y: y(bar.close) }, { role, alpha }));
  }
  return out;
}

/** Volume-by-price histogram of bars i0..i1 between two prices (24 bins), growing right from `left`. */
function profileRects(env: Env, i0: number, i1: number, lo: number, hi: number, left: number, width: number): Shape[] {
  const bars = env.bars;
  const N = 24, step = (hi - lo) / N || 1;
  const vol = new Array<number>(N).fill(0);
  for (let i = i0; i <= i1 && i < bars.length; i++) {
    const tp = (bars[i].high + bars[i].low + bars[i].close) / 3;
    if (tp >= lo && tp <= hi) vol[Math.min(N - 1, Math.floor((tp - lo) / step))] += bars[i].volume;
  }
  const max = Math.max(...vol, 1);
  const out: Shape[] = [];
  vol.forEach((v, k) => {
    if (!v) return;
    const yTop = env.px({ t: bars[i0].timestamp, p: lo + step * (k + 1) }).y, yBot = env.px({ t: bars[i0].timestamp, p: lo + step * k }).y;
    out.push({ k: 'rect', x: left, y: Math.min(yTop, yBot) + 0.5, w: (v / max) * width, h: Math.max(1, Math.abs(yBot - yTop) - 1), fill: 0.45, stroke: false, alpha: 0 });
  });
  return out;
}

const BUILDERS: Record<string, Builder> = {
  trend: ({ P }) => [seg(P[0], P[1])],
  rayline: ({ P }) => [seg(P[0], P[1], { ext: 'right' })],
  extended: ({ P }) => [seg(P[0], P[1], { ext: 'both' })],
  info: ({ P, A, env }) => {
    const m = measureInfo(env.bars, A[0], A[1]);
    return [seg(P[0], P[1]), label({ x: P[1].x + 6, y: P[1].y - 12 }, `${signed(m.dPrice)} (${signed(m.pct)}%) · ${m.bars} bars`, { box: 'surface' })];
  },
  angle: ({ P }) => {
    const deg = (Math.atan2(P[0].y - P[1].y, P[1].x - P[0].x) * 180) / Math.PI;
    return [seg(P[0], P[1]), seg(P[0], { x: P[0].x + Math.max(60, Math.abs(P[1].x - P[0].x)), y: P[0].y }, { dash: DOT, role: 'muted' }), label({ x: P[0].x + 8, y: P[0].y - 12 }, `${deg.toFixed(1)}°`)];
  },
  hline: H_LINE,
  ray: ({ P, env }) => [seg(P[0], { x: env.area.right, y: P[0].y }, { ext: 'right' })],
  vline: ({ P, env }) => [seg({ x: P[0].x, y: env.full.top }, { x: P[0].x, y: env.full.bottom }, { chart: true })],
  cross: (c) => [...H_LINE(c), ...BUILDERS['vline'](c)],
  arrow: ({ P }) => [{ k: 'arrow', x1: P[0].x, y1: P[0].y, x2: P[1].x, y2: P[1].y }],
  channel: ({ d, env, P }) => {
    const out: Shape[] = [seg(P[0], P[1])];
    if (d.offset !== undefined && d.b) {
      const a2 = env.px({ t: d.a.t, p: d.a.p + d.offset });
      const b2 = env.px({ t: d.b.t, p: d.b.p + d.offset });
      out.push(seg(a2, b2), { k: 'poly', pts: [P[0], P[1], b2, a2], closed: true, fill: 0.12, alpha: 0 });
    }
    return out;
  },
  disjoint: ({ P }) => [seg(P[0], P[1]), seg(P[2], P[3]), { k: 'poly', pts: [P[0], P[1], P[3], P[2]], closed: true, fill: 0.1, alpha: 0 }],
  regression: ({ A, env }) => {
    const f = regressionFit(env.bars, A[0], A[1]);
    if (!f) return [];
    const x0 = env.px({ t: env.bars[f.i0].timestamp, p: 0 }).x;
    const x1 = env.px({ t: env.bars[f.i1].timestamp, p: 0 }).x;
    const y = (i: number, price: number) => env.px({ t: env.bars[i].timestamp, p: price }).y;
    const band = (k: number): Shape => seg({ x: x0, y: y(f.i0, f.c0 + k * f.sigma) }, { x: x1, y: y(f.i1, f.c1 + k * f.sigma) }, { role: 'muted', dash: [5, 4] });
    return [seg({ x: x0, y: y(f.i0, f.c0) }, { x: x1, y: y(f.i1, f.c1) }), band(2), band(-2)];
  },

  fib: ({ A, P, env }) => {
    const [a, b] = A;
    const l = Math.min(P[0].x, P[1].x), r = Math.max(P[0].x, P[1].x);
    const ys = FIB_LEVELS.map((lv) => env.px({ t: a.t, p: fibPrice(a, b, lv) }).y);
    const out: Shape[] = [];
    FIB_LEVELS.forEach((lv, i) => {
      if (i > 0) out.push({ k: 'rect', x: l, y: Math.min(ys[i - 1], ys[i]), w: r - l, h: Math.abs(ys[i] - ys[i - 1]), fill: i % 2 ? 0.05 : 0.09, alpha: 0 });
      out.push(seg({ x: l, y: ys[i] }, { x: r, y: ys[i] }, { wm: 0.7 }), label({ x: l + 4, y: ys[i] - 7 }, `${lv} (${env.fmt(fibPrice(a, b, lv))})`, { role: 'text' }));
    });
    out.push(seg(P[0], P[1], { dash: DOT }));
    return out;
  },
  fibext: ({ A, P, env }) => {
    const [a, b, c] = A;
    const l = Math.min(P[1].x, P[2].x);
    const r = Math.max(P[1].x, P[2].x, l + 140);
    const out: Shape[] = [seg(P[0], P[1], { dash: DOT }), seg(P[1], P[2], { dash: DOT })];
    for (const lv of [0, 0.618, 1, 1.272, 1.618, 2, 2.618]) {
      const price = c.p + (b.p - a.p) * lv;
      const y = env.px({ t: c.t, p: price }).y;
      out.push(seg({ x: l, y }, { x: r, y }, { wm: 0.7 }), label({ x: l + 4, y: y - 7 }, `${lv} (${env.fmt(price)})`, { role: 'text' }));
    }
    return out;
  },
  fibchannel: ({ A, P, env }) => {
    const [a, b, c] = A;
    const span = b.t - a.t || 1;
    const onBase = a.p + ((c.t - a.t) / span) * (b.p - a.p);
    const o = c.p - onBase;
    const out: Shape[] = [];
    for (const lv of [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618]) {
      const p0 = env.px({ t: a.t, p: a.p + o * lv });
      const p1 = env.px({ t: b.t, p: b.p + o * lv });
      out.push(seg(p0, p1, { ext: 'right', wm: 0.8 }), label({ x: p1.x + 4, y: p1.y }, String(lv), { role: 'text' }));
    }
    out.push(seg(P[2], env.px({ t: c.t, p: onBase }), { dash: DOT, role: 'muted' }));
    return out;
  },
  fibtime: ({ P, env }) => {
    const dx = P[1].x - P[0].x;
    if (Math.abs(dx) < 1e-6) return [];
    const out: Shape[] = [];
    for (const m of FIB_TIME) {
      const x = P[0].x + dx * m;
      if (x > env.area.right + 1 || x < env.area.left - 1) continue;
      out.push(seg({ x, y: env.full.top }, { x, y: env.full.bottom }, { chart: true, wm: 0.7 }), label({ x: x + 3, y: env.full.top + 10 }, String(m), { role: 'text', chart: true }));
    }
    return out;
  },
  fibfan: ({ P }) => {
    const dy = P[1].y - P[0].y;
    return [0.25, 0.382, 0.5, 0.618, 0.75, 1].map((lv) => seg(P[0], { x: P[1].x, y: P[0].y + dy * lv }, { ext: 'right', wm: 0.8 }));
  },
  fibcircles: ({ P }) => {
    const c = { x: (P[0].x + P[1].x) / 2, y: (P[0].y + P[1].y) / 2 };
    const r0 = dist(P[0], P[1]) / 2;
    return [seg(P[0], P[1], { dash: DOT }), ...[0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618].map((lv): Shape => ({ k: 'ellipse', cx: c.x, cy: c.y, rx: r0 * lv * 2, ry: r0 * lv * 2, wm: 0.8 }))];
  },
  gannbox: ({ P }) => {
    const l = Math.min(P[0].x, P[1].x), r = Math.max(P[0].x, P[1].x), t = Math.min(P[0].y, P[1].y), b = Math.max(P[0].y, P[1].y);
    const out: Shape[] = [{ k: 'rect', x: l, y: t, w: r - l, h: b - t, fill: 0.08 }];
    for (const f of [0.25, 0.382, 0.5, 0.618, 0.75]) {
      out.push(seg({ x: l, y: t + (b - t) * f }, { x: r, y: t + (b - t) * f }, { dash: DOT, wm: 0.6 }), seg({ x: l + (r - l) * f, y: t }, { x: l + (r - l) * f, y: b }, { dash: DOT, wm: 0.6 }));
    }
    out.push(seg({ x: l, y: t }, { x: r, y: b }), seg({ x: l, y: b }, { x: r, y: t }));
    return out;
  },
  gannfan: ({ P }) => {
    const dy = P[1].y - P[0].y;
    return GANN.flatMap(([s, name]): Shape[] => {
      const q = { x: P[1].x, y: P[0].y + dy * s };
      return [seg(P[0], q, { ext: 'right', wm: s === 1 ? 1.2 : 0.8 }), label({ x: q.x + 4, y: q.y }, name, { role: 'text' })];
    });
  },
  pitchfork: ({ P }) => pitchfork(P, P[0]),
  schiff: ({ P }) => pitchfork(P, { x: P[0].x, y: (P[0].y + P[1].y) / 2 }),
  modschiff: ({ P }) => pitchfork(P, { x: (P[0].x + P[1].x) / 2, y: (P[0].y + P[1].y) / 2 }),
  insidepitchfork: ({ P }) => {
    const m = mid(P[1], P[2]);
    const v = { x: m.x - P[0].x, y: m.y - P[0].y };
    const inner = (p: Pt) => seg(p, { x: p.x + v.x, y: p.y + v.y }, { ext: 'right', dash: DOT, wm: 0.8 });
    return [...pitchfork(P, P[0]), inner(mid(P[1], m)), inner(mid(m, P[2]))];
  },
  pitchfan: ({ P }) => [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1].map((f) =>
    seg(P[0], { x: P[1].x + (P[2].x - P[1].x) * f, y: P[1].y + (P[2].y - P[1].y) * f }, { ext: 'right', wm: f === 0.5 ? 1.2 : 0.8 })),
  fibarcs: ({ P }) => {
    const R = dist(P[0], P[1]);
    const dir = Math.atan2(P[0].y - P[1].y, P[0].x - P[1].x);
    return [seg(P[0], P[1], { dash: DOT }), ...[0.236, 0.382, 0.5, 0.618, 0.786, 1].flatMap((lv): Shape[] => {
      const pts = Array.from({ length: 33 }, (_, i) => { const a = dir - Math.PI / 2 + (Math.PI * i) / 32; return { x: P[1].x + R * lv * Math.cos(a), y: P[1].y + R * lv * Math.sin(a) }; });
      return [{ k: 'poly', pts, wm: 0.8 }, label({ x: pts[16].x + 4, y: pts[16].y }, String(lv), { role: 'text' })];
    })];
  },
  fibspiral: ({ P }) => {
    const phi = (1 + Math.sqrt(5)) / 2;
    const d = dist(P[0], P[1]);
    const a0 = Math.atan2(P[1].y - P[0].y, P[1].x - P[0].x);
    const pts = Array.from({ length: 97 }, (_, i) => { const th = (3 * Math.PI * i) / 96; const r = (d / phi ** 3) * phi ** (th / (Math.PI / 2)); return { x: P[0].x + r * Math.cos(a0 + th), y: P[0].y + r * Math.sin(a0 + th) }; });
    return [{ k: 'poly', pts }, seg(P[0], P[1], { dash: DOT, role: 'muted' })];
  },
  fibwedge: ({ P }) => {
    const R = dist(P[0], P[1]);
    const a1 = Math.atan2(P[1].y - P[0].y, P[1].x - P[0].x);
    let a2 = Math.atan2(P[2].y - P[0].y, P[2].x - P[0].x);
    while (a2 - a1 > Math.PI) a2 -= 2 * Math.PI;
    while (a2 - a1 < -Math.PI) a2 += 2 * Math.PI;
    return [seg(P[0], P[1], { ext: 'right' }), seg(P[0], P[2], { ext: 'right' }), ...[0.236, 0.382, 0.5, 0.618, 0.786, 1].map((lv): Shape => ({
      k: 'poly', wm: 0.7, pts: Array.from({ length: 25 }, (_, i) => { const a = a1 + ((a2 - a1) * i) / 24; return { x: P[0].x + R * lv * Math.cos(a), y: P[0].y + R * lv * Math.sin(a) }; }),
    }))];
  },
  fibtimetrend: ({ P, env }) => {
    const dx = P[1].x - P[0].x;
    if (Math.abs(dx) < 1e-6) return [];
    const out: Shape[] = [];
    for (const m of FIB_TIME) {
      const x = P[2].x + dx * m;
      if (x > env.area.right + 1 || x < env.area.left - 1) continue;
      out.push(seg({ x, y: env.full.top }, { x, y: env.full.bottom }, { chart: true, wm: 0.7 }), label({ x: x + 3, y: env.full.top + 10 }, String(m), { role: 'text', chart: true }));
    }
    return [...out, seg(P[0], P[1], { dash: DOT, role: 'muted' }), seg(P[1], P[2], { dash: DOT, role: 'muted' })];
  },
  gannsquare: ({ P }) => {
    const l = Math.min(P[0].x, P[1].x), r = Math.max(P[0].x, P[1].x), t = Math.min(P[0].y, P[1].y), b = Math.max(P[0].y, P[1].y);
    const out: Shape[] = [{ k: 'rect', x: l, y: t, w: r - l, h: b - t, fill: 0.06 }];
    for (let i = 1; i < 8; i++) out.push(seg({ x: l, y: t + ((b - t) * i) / 8 }, { x: r, y: t + ((b - t) * i) / 8 }, { dash: DOT, wm: 0.6 }), seg({ x: l + ((r - l) * i) / 8, y: t }, { x: l + ((r - l) * i) / 8, y: b }, { dash: DOT, wm: 0.6 }));
    out.push(seg({ x: l, y: t }, { x: r, y: b }), seg({ x: l, y: b }, { x: r, y: t }));
    return out;
  },
  flat: ({ P }) => [
    seg(P[0], P[1]), seg({ x: P[0].x, y: P[2].y }, { x: P[1].x, y: P[2].y }),
    { k: 'poly', pts: [P[0], P[1], { x: P[1].x, y: P[2].y }, { x: P[0].x, y: P[2].y }], closed: true, fill: 0.1, alpha: 0 },
  ],
  cyclic: ({ P, env }) => {
    const dx = P[1].x - P[0].x;
    if (Math.abs(dx) < 2) return [];
    const out: Shape[] = [];
    for (let k = 0, x = P[0].x; k < 300 && x <= env.area.right + 1 && x >= env.area.left - 1; k++, x += dx) out.push(seg({ x, y: env.full.top }, { x, y: env.full.bottom }, { chart: true, wm: 0.7 }));
    return out;
  },
  timecycles: ({ P, env }) => {
    const dx = P[1].x - P[0].x;
    if (Math.abs(dx) < 2) return [];
    const out: Shape[] = [];
    for (let k = 0, x = P[0].x; k < 60 && x <= env.area.right + 1 && x >= env.area.left - Math.abs(dx); k++, x += dx) {
      out.push({ k: 'poly', wm: 0.8, pts: Array.from({ length: 25 }, (_, i) => { const u = i / 24; return { x: x + dx * u, y: P[0].y - Math.sin(Math.PI * u) * (Math.abs(dx) / 2) }; }) });
    }
    return out;
  },
  sine: ({ P }) => {
    const m = (P[0].y + P[1].y) / 2, amp = P[0].y - m;
    return [{ k: 'poly', pts: Array.from({ length: 65 }, (_, i) => { const u = i / 64; return { x: P[0].x + (P[1].x - P[0].x) * u, y: m + amp * Math.cos(2 * Math.PI * u) }; }) }];
  },

  xabcd: ({ P }) => {
    const [X, A, B, C, D] = P;
    const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    return [
      { k: 'poly', pts: [X, A, B], closed: true, fill: 0.1, alpha: 0 } as Shape,
      { k: 'poly', pts: [B, C, D], closed: true, fill: 0.1, alpha: 0 } as Shape,
      ...labelled(P, ['X', 'A', 'B', 'C', 'D']),
      seg(X, B, { dash: DOT }), seg(B, D, { dash: DOT }), seg(A, D, { dash: DOT }),
      label(mid(X, B), ratio(B.y - A.y, A.y - X.y), { role: 'muted', align: 'center' }),
      label(mid(A, C), ratio(C.y - B.y, B.y - A.y), { role: 'muted', align: 'center' }),
      label(mid(B, D), ratio(D.y - C.y, C.y - B.y), { role: 'muted', align: 'center' }),
    ];
  },
  abcd: ({ P }) => {
    const [A, B, C, D] = P;
    const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    return [
      ...labelled(P, ['A', 'B', 'C', 'D']), seg(A, C, { dash: DOT }), seg(B, D, { dash: DOT }),
      label(mid(A, C), ratio(C.y - B.y, B.y - A.y), { role: 'muted', align: 'center' }),
      label(mid(B, D), ratio(D.y - C.y, C.y - B.y), { role: 'muted', align: 'center' }),
    ];
  },
  triangle: ({ P }) => [
    { k: 'poly', pts: [P[0], P[2], P[3], P[1]], closed: true, fill: 0.08, alpha: 0 },
    seg(P[0], P[2]), seg(P[1], P[3]), seg(P[0], P[1], { dash: DOT }), seg(P[2], P[3], { dash: DOT }),
  ],
  headshoulders: ({ P }) => [
    ...labelled(P, ['', '', '', '', '', '', '']).filter((s) => s.k !== 'text'),
    seg(P[2], P[4], { ext: 'right', dash: DOT }),
    label({ x: P[1].x, y: P[1].y - 12 }, 'Left shoulder', { align: 'center' }),
    label({ x: P[3].x, y: P[3].y - 12 }, 'Head', { align: 'center' }),
    label({ x: P[5].x, y: P[5].y - 12 }, 'Right shoulder', { align: 'center' }),
  ],
  threedrives: ({ P }) => labelled(P, ['0', '1', '2', '3', '4', '5', '6']),
  elliottimpulse: ({ P }) => labelled(P, ['0', '1', '2', '3', '4', '5']),
  elliottcorrection: ({ P }) => labelled(P, ['0', 'A', 'B', 'C']),
  elliotttriangle: ({ P }) => labelled(P, ['0', 'A', 'B', 'C', 'D', 'E']),

  longpos: (c) => position(c, 'Long'),
  shortpos: (c) => position(c, 'Short'),
  forecast: ({ P, A, env }) => [
    { k: 'arrow', x1: P[0].x, y1: P[0].y, x2: P[1].x, y2: P[1].y, dash: [6, 4] },
    label({ x: P[1].x + 6, y: P[1].y - 12 }, `${env.fmt(A[1].p)} (${signed(pctOf(A[0].p, A[1].p))}%)`, { box: 'surface' }),
  ],
  daterange: ({ P, A, env }) => {
    const m = measureInfo(env.bars, A[0], A[1]);
    const midY = (env.area.top + env.area.bottom) / 2;
    return [
      { k: 'rect', x: Math.min(P[0].x, P[1].x), y: env.full.top, w: Math.abs(P[1].x - P[0].x), h: env.full.bottom - env.full.top, fill: 0.08, alpha: 0 },
      seg({ x: P[0].x, y: env.full.top }, { x: P[0].x, y: env.full.bottom }, { chart: true }),
      seg({ x: P[1].x, y: env.full.top }, { x: P[1].x, y: env.full.bottom }, { chart: true }),
      { k: 'arrow', x1: P[0].x, y1: midY, x2: P[1].x, y2: midY },
      label({ x: (P[0].x + P[1].x) / 2, y: midY - 12 }, `${m.bars} bars, ${Math.round(m.days)}d`, { align: 'center', box: 'surface' }),
    ];
  },
  pricerange: ({ P, A, env }) => {
    const l = Math.min(P[0].x, P[1].x), r = Math.max(P[0].x, P[1].x, l + 60);
    const midX = (l + r) / 2;
    const dP = A[1].p - A[0].p;
    return [
      { k: 'rect', x: l, y: Math.min(P[0].y, P[1].y), w: r - l, h: Math.abs(P[1].y - P[0].y), fill: 0.08, alpha: 0 },
      seg({ x: l, y: P[0].y }, { x: r, y: P[0].y }), seg({ x: l, y: P[1].y }, { x: r, y: P[1].y }),
      { k: 'arrow', x1: midX, y1: P[0].y, x2: midX, y2: P[1].y },
      label({ x: midX + 6, y: (P[0].y + P[1].y) / 2 }, `${signed(dP)} (${signed(pctOf(A[0].p, A[1].p))}%)`, { box: 'surface' }),
    ];
  },
  daterangeprice: ({ P, A, env }) => {
    const m = measureInfo(env.bars, A[0], A[1]);
    return [
      { k: 'rect', x: Math.min(P[0].x, P[1].x), y: Math.min(P[0].y, P[1].y), w: Math.abs(P[1].x - P[0].x), h: Math.abs(P[1].y - P[0].y), fill: 0.12 },
      label({ x: Math.max(P[0].x, P[1].x) + 6, y: (P[0].y + P[1].y) / 2 }, `${signed(m.dPrice)} (${signed(m.pct)}%) · ${m.bars} bars`, { box: 'surface' }),
    ];
  },

  cypher: (c) => BUILDERS['xabcd'](c),
  elliottdouble: ({ P }) => labelled(P, ['0', 'W', 'X', 'Y']),
  elliotttriple: ({ P }) => labelled(P, ['0', 'W', 'X', 'Y', 'X', 'Z']),

  projection: ({ P }) => {
    const v = { x: P[1].x - P[0].x, y: P[1].y - P[0].y };
    return [{ k: 'arrow', x1: P[0].x, y1: P[0].y, x2: P[1].x, y2: P[1].y }, { k: 'arrow', x1: P[2].x, y1: P[2].y, x2: P[2].x + v.x, y2: P[2].y + v.y, dash: [6, 4] }];
  },
  barspattern: ({ A, P, env }) => pasteBars(env, A[0], A[1], P[2].x, A[2].p, 1, 0),
  ghostfeed: ({ A, P, env }) => pasteBars(env, A[0], A[1], P[1].x + 6, A[1].p, 0.55, 0),
  volprofile: ({ A, P, env }) => {
    const bars = env.bars;
    if (!bars.length) return [];
    let i0 = Math.round(indexForTime(bars, A[0].t)), i1 = Math.round(indexForTime(bars, A[1].t));
    if (i0 > i1) [i0, i1] = [i1, i0];
    const lo = Math.min(A[0].p, A[1].p), hi = Math.max(A[0].p, A[1].p);
    const left = Math.min(P[0].x, P[1].x), w = Math.abs(P[1].x - P[0].x);
    return [
      { k: 'rect', x: left, y: Math.min(P[0].y, P[1].y), w, h: Math.abs(P[1].y - P[0].y), fill: 0.05 },
      ...profileRects(env, i0, i1, lo, hi, left, w * 0.6),
    ];
  },
  avp: ({ A, P, env }) => {
    const bars = env.bars;
    if (!bars.length) return [];
    const i0 = Math.max(0, Math.round(indexForTime(bars, A[0].t)));
    const i1 = bars.length - 1;
    let lo = Infinity, hi = -Infinity;
    for (let i = i0; i <= i1; i++) { lo = Math.min(lo, bars[i].low); hi = Math.max(hi, bars[i].high); }
    if (!(hi > lo)) return [];
    const left = P[0].x;
    const w = Math.max(20, Math.min(160, env.area.right - left));
    const yLo = env.px({ t: A[0].t, p: lo }).y, yHi = env.px({ t: A[0].t, p: hi }).y;
    return [{ k: 'rect', x: left, y: Math.min(yLo, yHi), w, h: Math.abs(yLo - yHi), fill: 0.05 }, ...profileRects(env, i0, i1, lo, hi, left, w)];
  },
  avwap: ({ A, env }) => {
    const bars = env.bars;
    if (!bars.length) return [];
    const i0 = Math.max(0, Math.round(indexForTime(bars, A[0].t)));
    let pv = 0, v = 0;
    const pts: Pt[] = [];
    for (let i = i0; i < bars.length; i++) {
      const b = bars[i];
      pv += ((b.high + b.low + b.close) / 3) * b.volume;
      v += b.volume;
      if (v > 0) pts.push(env.px({ t: b.timestamp, p: pv / v }));
    }
    return pts.length > 1 ? [{ k: 'poly', pts }, label({ x: pts[pts.length - 1].x - 30, y: pts[pts.length - 1].y - 10 }, 'VWAP', { role: 'text' })] : [];
  },

  brush: ({ P }) => [{ k: 'poly', pts: P }],
  highlighter: ({ P }) => [{ k: 'poly', pts: P, wm: 8, alpha: 0.3 }],
  rect: ({ P }) => [{ k: 'rect', x: Math.min(P[0].x, P[1].x), y: Math.min(P[0].y, P[1].y), w: Math.abs(P[1].x - P[0].x), h: Math.abs(P[1].y - P[0].y), fill: 0.12 }],
  rotrect: ({ P }) => {
    const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y;
    const len = Math.hypot(dx, dy) || 1;
    const n = { x: -dy / len, y: dx / len };
    const w = (P[2].x - P[0].x) * n.x + (P[2].y - P[0].y) * n.y;
    const off = { x: n.x * w, y: n.y * w };
    return [{ k: 'poly', pts: [P[0], P[1], { x: P[1].x + off.x, y: P[1].y + off.y }, { x: P[0].x + off.x, y: P[0].y + off.y }], closed: true, fill: 0.12 }];
  },
  circle: ({ P }) => {
    const r = dist(P[0], P[1]);
    return [{ k: 'ellipse', cx: P[0].x, cy: P[0].y, rx: r, ry: r, fill: 0.12 }];
  },
  ellipse: ({ P }) => [{ k: 'ellipse', cx: (P[0].x + P[1].x) / 2, cy: (P[0].y + P[1].y) / 2, rx: Math.max(Math.abs(P[1].x - P[0].x) / 2, 0.5), ry: Math.max(Math.abs(P[1].y - P[0].y) / 2, 0.5), fill: 0.12 }],
  triangleshape: ({ P }) => [{ k: 'poly', pts: P.slice(0, 3), closed: true, fill: 0.12 }],
  polyline: ({ P }) => [{ k: 'poly', pts: P }],
  path: ({ P }) => [{ k: 'poly', pts: P.slice(0, -1).concat([]), }, { k: 'arrow', x1: P[P.length - 2].x, y1: P[P.length - 2].y, x2: P[P.length - 1].x, y2: P[P.length - 1].y }],
  curve: ({ P }) => [{ k: 'curve', pts: [P[0], P[1], P[2]] }],
  arc: ({ P }) => {
    const [p, q, r] = P;
    const D = 2 * (p.x * (q.y - r.y) + q.x * (r.y - p.y) + r.x * (p.y - q.y));
    if (Math.abs(D) < 1e-6) return [{ k: 'poly', pts: [p, q, r] }];
    const sq = (v: Pt) => v.x * v.x + v.y * v.y;
    const cx = (sq(p) * (q.y - r.y) + sq(q) * (r.y - p.y) + sq(r) * (p.y - q.y)) / D;
    const cy = (sq(p) * (r.x - q.x) + sq(q) * (p.x - r.x) + sq(r) * (q.x - p.x)) / D;
    const R = Math.hypot(p.x - cx, p.y - cy);
    const ang = (v: Pt) => Math.atan2(v.y - cy, v.x - cx);
    const a0 = ang(p), a1 = ang(q), a2 = ang(r);
    const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const ccw = norm(a1 - a0) < norm(a2 - a0);
    const sweep = ccw ? norm(a2 - a0) : -norm(a0 - a2);
    return [{ k: 'poly', pts: Array.from({ length: 49 }, (_, i) => { const a = a0 + (sweep * i) / 48; return i === 0 ? p : i === 48 ? r : { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; }) }];
  },
  doublecurve: ({ P }) => [{ k: 'poly', pts: Array.from({ length: 41 }, (_, i) => {
    const t = i / 40, u = 1 - t;
    return { x: u ** 3 * P[0].x + 3 * u * u * t * P[1].x + 3 * u * t * t * P[2].x + t ** 3 * P[3].x, y: u ** 3 * P[0].y + 3 * u * u * t * P[1].y + 3 * u * t * t * P[2].y + t ** 3 * P[3].y };
  }) }],

  text: ({ d, P }) => [label(P[0], d.text ?? '', { box: 'surface' })],
  note: ({ d, P }) => [label(P[0], d.text ?? '', { box: 'note', role: 'text' })],
  callout: ({ d, P }) => [seg(P[0], P[1], { dash: DOT }), label(P[1], d.text ?? '', { box: 'note', role: 'text' })],
  pricenote: ({ A, P, env }) => [seg(P[0], P[1], { dash: DOT }), label(P[1], env.fmt(A[0].p), { box: 'surface', align: 'center' })],
  pin: ({ d, P }) => [seg(P[0], { x: P[0].x, y: P[0].y - 14 }), { k: 'ellipse', cx: P[0].x, cy: P[0].y, rx: 3, ry: 3, fill: 1 }, label({ x: P[0].x, y: P[0].y - 26 }, d.text ?? '', { box: 'note', role: 'text', align: 'center' })],
  comment: ({ d, P }) => [{ k: 'poly', pts: [P[0], { x: P[0].x - 6, y: P[0].y - 12 }, { x: P[0].x + 6, y: P[0].y - 12 }], closed: true, fill: 0.5 }, label({ x: P[0].x, y: P[0].y - 22 }, d.text ?? '', { box: 'note', role: 'text', align: 'center' })],
  signpost: ({ d, P }) => [seg(P[0], { x: P[0].x, y: P[0].y - 40 }, { wm: 1.5 }), label({ x: P[0].x, y: P[0].y - 52 }, d.text ?? '', { box: 'note', role: 'text', align: 'center' })],
  anchoredtext: ({ d, env }) => {
    const v = d.view ?? { x: 0.5, y: 0.5 };
    return [label({ x: env.area.left + v.x * (env.area.right - env.area.left), y: env.area.top + v.y * (env.area.bottom - env.area.top) }, d.text ?? '', { box: 'surface' })];
  },
  table: ({ d, P }) => {
    const rows = (d.text || 'Label|Value').split(';').map((r) => r.split('|'));
    const cols = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: cols }, (_, c) => Math.max(40, ...rows.map((r) => textWidth(r[c] ?? '') + 8)));
    const H = 22;
    const out: Shape[] = [];
    let y = P[0].y;
    for (const r of rows) {
      let x = P[0].x;
      for (let c = 0; c < cols; c++) {
        out.push({ k: 'rect', x, y, w: colW[c], h: H, fill: 1, surface: true }, label({ x: x + 6, y: y + H / 2 }, r[c] ?? '', { role: 'text' }));
        x += colW[c];
      }
      y += H;
    }
    return out;
  },
  emoji: ({ d, P }) => [label(P[0], d.text || '⭐', { align: 'center', size: 24 })],
  pricelabel: ({ A, P, env }) => [label({ x: P[0].x + 4, y: P[0].y }, env.fmt(A[0].p), { box: 'surface' })],
};

/** Long / short position: profit zone (entry → target), loss zone (entry → stop) and the risk/reward readout. */
function position({ A, P, env }: Ctx, name: string): Shape[] {
  const [entry, stop, target] = P;
  const x0 = Math.min(entry.x, target.x);
  const w = Math.max(Math.abs(target.x - entry.x), 30);
  const reward = Math.abs(A[2].p - A[0].p);
  const risk = Math.abs(A[0].p - A[1].p);
  const rr = risk ? (reward / risk).toFixed(2) : '∞';
  return [
    { k: 'rect', x: x0, y: Math.min(entry.y, target.y), w, h: Math.abs(target.y - entry.y), fill: 0.2, role: 'up' },
    { k: 'rect', x: x0, y: Math.min(entry.y, stop.y), w, h: Math.abs(stop.y - entry.y), fill: 0.2, role: 'down' },
    seg({ x: x0, y: entry.y }, { x: x0 + w, y: entry.y }),
    label({ x: x0 + 4, y: Math.min(entry.y, target.y) - 9 }, `${name} · Target ${env.fmt(A[2].p)} (${signed(pctOf(A[0].p, A[2].p))}%)`, { role: 'text' }),
    label({ x: x0 + 4, y: Math.max(entry.y, stop.y) + 10 }, `Stop ${env.fmt(A[1].p)} (${signed(pctOf(A[0].p, A[1].p))}%) · Risk/Reward ${rr}`, { role: 'text' }),
  ];
}

const finite = (s: Shape[]) => JSON.stringify(s, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)).indexOf('null') < 0;

/** Pixel geometry of a drawing (also of a draft with fewer anchors than the tool needs). */
export function shapesFor(d: Drawing, env: Env): Shape[] {
  const A = anchorsOf(d);
  const P = A.map((a) => env.px(a));
  const id = d.type as string;
  if (ICON[id]) {
    if (!P.length) return [];
    const [glyph, role] = ICON[id];
    return [label(P[0], glyph, { align: 'center', size: 20, ...(role ? { role } : {}) })];
  }
  const builder = BUILDERS[id];
  if (!builder || !P.length) return [];
  const def = toolDef(id);
  const min = def?.points === 'poly' || def?.points === 'free' ? 2 : need(id);
  if (P.length < min) return P.length > 1 ? [{ k: 'poly', pts: P }] : [];
  const shapes = builder({ d, env, A, P });
  return finite(shapes) ? shapes : [];
}

/** Anchors that get a drag handle when the drawing is selected. */
export function handlePoints(d: Drawing, env: Env): Pt[] {
  const def = toolDef(d.type as string);
  if (def?.points === 'free') return [];
  if (d.type === 'anchoredtext') return [];
  if (d.type === 'channel' || def?.points === 'poly' || typeof def?.points === 'number') return anchorsOf(d).map((a) => env.px(a));
  return [];
}

function pointInPoly(x: number, y: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (pts[i].y > y !== pts[j].y > y && x < ((pts[j].x - pts[i].x) * (y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x) inside = !inside;
  }
  return inside;
}

/** Pixel distance from a point to the nearest part of the shapes; 0 inside filled areas and text boxes. */
export function distanceToShapes(shapes: Shape[], x: number, y: number, _env?: Env): number {
  let best = Infinity;
  for (const s of shapes) {
    let d = Infinity;
    switch (s.k) {
      case 'line': { const [p, q] = extendLine(s); d = distToSegment(x, y, p.x, p.y, q.x, q.y); break; }
      case 'arrow': d = distToSegment(x, y, s.x1, s.y1, s.x2, s.y2); break;
      case 'poly': {
        const pts = s.closed ? [...s.pts, s.pts[0]] : s.pts;
        d = s.fill && s.closed && pointInPoly(x, y, s.pts) ? 0 : distToPolyline(x, y, pts);
        break;
      }
      case 'rect': {
        const inside = x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
        d = s.fill && inside ? 0 : distToPolyline(x, y, [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }, { x: s.x, y: s.y }]);
        break;
      }
      case 'ellipse': {
        const inside = ((x - s.cx) / (s.rx || 1)) ** 2 + ((y - s.cy) / (s.ry || 1)) ** 2 <= 1;
        d = s.fill && inside ? 0 : distToEllipse(x, y, s.cx, s.cy, s.rx, s.ry);
        break;
      }
      case 'curve': {
        const [p0, c, p1] = s.pts;
        const pts = Array.from({ length: 25 }, (_, i) => { const t = i / 24; return { x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x, y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y }; });
        d = distToPolyline(x, y, pts);
        break;
      }
      case 'text': {
        const b = textBox(s);
        d = x >= b.left && x <= b.right && y >= b.top && y <= b.bottom ? 0 : Infinity;
        break;
      }
    }
    if (d < best) best = d;
  }
  return best;
}
