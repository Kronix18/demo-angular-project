import type { Chart } from 'chart.js';
import { OHLCV } from '../../core/models/ohlcv.model';
import { Anchor, Drawing, DrawingStyle, indexForTime, measureInfo, snapToOhlc, timeForIndex } from './drawing-geometry';
import { DrawingStore } from './drawing-store.service';
import { DrawingType, isSelectTool, toolDef } from './drawing-tools';
import { Env, Pt, distanceToShapes, handlePoints, shapesFor, textWidth } from './drawing-shapes';
export { textWidth };

/** Interactive tools: the cursor, every persistent drawing type, and two transient ones. */
export type Tool = 'cursor' | 'dot' | 'pointer' | 'eraser' | DrawingType | 'measure' | 'zoom';

/** In-progress gesture (not persisted until committed). */
/** phase 1: dragging the first segment, 2: channel offset click, 3: placing the remaining anchors one click at a time */
export interface Draft { type: DrawingType | 'measure' | 'zoom'; a: Anchor; b: Anchor; offset?: number; phase: 1 | 2 | 3; pts?: Anchor[]; }
export interface MeasureView { a: Anchor; b: Anchor; }
export interface DrawingView { drawings: Drawing[]; draft: Draft | null; selectedId: string | null; measure: MeasureView | null; }
/** Zoom-to-region request: x in fractional bar indices, p in prices (ordered low → high). */
export interface ZoomRegion { x0: number; x1: number; p0: number; p1: number; }

interface Deps {
  chart: () => Chart | null;
  bars: () => OHLCV[];
  store: DrawingStore;
  symbol: () => string;
  tool: () => Tool;
  /** something visible changed: redraw */
  changed: () => void;
  /** snap new anchors to the bar's OHLC (drawing magnet) */
  magnet?: () => boolean;
  zoomTo?: (r: ZoomRegion) => void;
  /** a freshly created text label wants its text edited */
  editText?: (id: string) => void;
  committed?: (d: Drawing) => void;
}

type Drag =
  | { mode: 'handle'; id: string; index: number }
  | { mode: 'body'; id: string; idx0: number; p0: number; orig: Drawing }
  | null;

const HIT = 6;      // px: line pick tolerance
const HANDLE = 9;   // px: endpoint pick tolerance
const MIN_DRAG = 3; // px: below this a "drag" is just a click
const BRUSH_STEP = 3; // px between recorded brush points

/** A copy of the drawing with anchor `i` replaced (a/b stay in step with pts). */
function withAnchor(d: Drawing, i: number, pt: Anchor): Drawing {
  if (d.pts && d.pts.length > 1 && toolDef(d.type)?.points !== 'free') {
    const pts = d.pts.map((p, k) => (k === i ? pt : p));
    return { ...d, pts, a: pts[0], ...(pts[1] ? { b: pts[1] } : {}) };
  }
  return i === 0 ? { ...d, a: pt } : { ...d, b: pt };
}

const TRANSIENT: Tool[] = ['measure', 'zoom'];

/** How a tool collects its anchors. */
function kind(tool: Tool): 'one' | 'drag' | 'channel' | 'sequence' | 'free' | 'transient' | null {
  if (TRANSIENT.includes(tool)) return 'transient';
  if (isSelectTool(tool) || tool === 'eraser') return null;
  if (tool === 'channel') return 'channel';
  const def = toolDef(tool);
  if (!def) return null;
  if (def.points === 'free') return 'free';
  if (def.points === 'poly' || (typeof def.points === 'number' && def.points >= 3)) return 'sequence';
  return def.points === 1 ? 'one' : 'drag';
}

/**
 * Pointer/keyboard logic for the drawing tools, independent of the DOM: the
 * viewer forwards canvas-relative coordinates. Drawings live on the PRICE pane
 * (y-scale 'y'); anchors are stored as (time, price).
 */
export class DrawingController {
  private draft: Draft | null = null;
  private selectedId: string | null = null;
  private drag: Drag = null;
  private start: { x: number; y: number } | null = null;
  private lastBrush: { x: number; y: number } | null = null;
  private measure: MeasureView | null = null;

  constructor(private deps: Deps) {}

  view(): DrawingView {
    return { drawings: this.deps.store.list(this.deps.symbol()), draft: this.draft, selectedId: this.selectedId, measure: this.measure };
  }

  /** The zoom plugin's drag-pan would fight with drawing: only the cursor tool may pan. */
  syncPan(): void {
    const chart = this.deps.chart();
    const pan = (chart?.options?.plugins as any)?.zoom?.pan;
    if (!pan) return;
    const enabled = isSelectTool(this.deps.tool());
    if (pan.enabled === enabled) return;
    pan.enabled = enabled;
    // the zoom plugin caches its options per update cycle
    chart!.update('none');
  }

  /** True while a drawing (or one of its handles) is being dragged. */
  isDragging(): boolean {
    return this.drag !== null;
  }

  cancel(): void {
    this.draft = null;
    this.drag = null;
    this.start = null;
    this.selectedId = null;
    this.measure = null;
    this.deps.changed();
  }

  /** Hide-all flag (the plugin skips rendering). */
  hidden(): boolean {
    return this.deps.store.hidden();
  }

  /** Text lines of the measure tool's readout. */
  measureLabel(m: MeasureView): string[] {
    const i = measureInfo(this.deps.bars(), m.a, m.b);
    const sign = i.dPrice >= 0 ? '+' : '';
    return [`${sign}${i.dPrice.toFixed(2)} (${sign}${i.pct.toFixed(2)}%)`, `${i.bars} bars, ${Math.round(i.days)}d`];
  }

  /** Id of the text label under a point (for double-click editing). */
  textAt(x: number, y: number): string | null {
    for (const d of this.deps.store.list(this.deps.symbol())) if (toolDef(d.type)?.text && this.distance(d, x, y) === 0) return d.id;
    return null;
  }

  /** Ctrl+D: a copy of the selection, a few bars to the right; the copy becomes the selection. */
  clone(): string | null {
    const d = this.selectedId ? this.find(this.selectedId) : undefined;
    if (!d || this.deps.store.locked()) return null;
    const bars = this.deps.bars();
    const shift = (a: Anchor): Anchor => ({ t: timeForIndex(bars, indexForTime(bars, a.t) + 3), p: a.p });
    const copy: Drawing = { ...d, id: this.newId(), a: shift(d.a), ...(d.b ? { b: shift(d.b) } : {}), ...(d.pts ? { pts: d.pts.map(shift) } : {}) };
    this.deps.store.add(this.deps.symbol(), copy);
    this.selectedId = copy.id;
    this.deps.changed();
    return copy.id;
  }

  /** Style edits from the floating toolbar. */
  setStyle(id: string, patch: DrawingStyle): void {
    const d = this.find(id);
    if (!d) return;
    this.deps.store.update(this.deps.symbol(), { ...d, style: { ...d.style, ...patch } });
    this.deps.changed();
  }

  /** Text labels: blank text deletes the label. */
  setText(id: string, text: string): void {
    const d = this.find(id);
    if (!d) return;
    if (!text.trim()) {
      this.deps.store.remove(this.deps.symbol(), id);
      if (this.selectedId === id) this.selectedId = null;
    } else {
      this.deps.store.update(this.deps.symbol(), { ...d, text });
    }
    this.deps.changed();
  }

  pointerDown(x: number, y: number): void {
    const tool = this.deps.tool();
    if (this.measure) { this.measure = null; this.deps.changed(); }
    if (this.draft?.phase === 2) return this.commitChannel(x, y);
    if (this.draft?.phase === 3) return this.addAnchor(x, y);
    if (tool === 'eraser') return this.erase(x, y);
    if (isSelectTool(tool)) return this.selectOrGrab(x, y);
    const pt = this.toData(x, y);
    if (!pt) return;
    this.selectedId = null;
    const k = kind(tool);
    if (k === 'one') {
      const d: Drawing = { id: this.newId(), type: tool as DrawingType, a: pt, ...(toolDef(tool)?.text ? { text: '' } : {}) };
      this.commit(d);
      if (toolDef(tool)?.text) this.deps.editText?.(d.id);
      return;
    }
    this.start = { x, y };
    if (k === 'free') {
      this.lastBrush = { x, y };
      this.draft = { type: tool as DrawingType, a: pt, b: pt, phase: 1, pts: [pt] };
    } else if (k === 'sequence') {
      this.draft = { type: tool as DrawingType, a: pt, b: pt, phase: 1, pts: [pt] };
    } else if (k) {
      this.draft = { type: tool as Draft['type'], a: pt, b: pt, phase: 1 };
    }
    this.deps.changed();
  }

  pointerMove(x: number, y: number): void {
    if (this.draft) {
      if (this.draft.phase === 2) {
        this.draft = { ...this.draft, offset: this.offsetAt(this.draft, x, y) };
      } else if (kind(this.deps.tool()) === 'free') {
        const last = this.lastBrush;
        const pt = this.toData(x, y, true);
        if (pt && last && Math.hypot(x - last.x, y - last.y) >= BRUSH_STEP) {
          this.draft = { ...this.draft, b: pt, pts: [...(this.draft.pts ?? []), pt] };
          this.lastBrush = { x, y };
        }
      } else {
        const pt = this.toData(x, y, true);
        if (pt) this.draft = { ...this.draft, b: pt };
      }
      return this.deps.changed();
    }
    if (this.drag) this.applyDrag(x, y);
  }

  pointerUp(x: number, y: number): void {
    if (this.drag) {
      this.drag = null;
      return;
    }
    const d = this.draft;
    if (!d || d.phase !== 1) return;
    const moved = this.start ? Math.hypot(x - this.start.x, y - this.start.y) : 0;
    this.start = null;
    this.lastBrush = null;
    const k = kind(d.type as Tool);
    if (k === 'sequence') {
      // the first press may have been a drag (A -> B) or a plain click (A, then B on the next click)
      const rel = moved >= MIN_DRAG ? this.toData(x, y, true) : null;
      this.draft = { ...d, phase: 3, pts: rel ? [d.a, rel] : [d.a] };
      return this.afterAnchor();
    }
    if (moved < MIN_DRAG || (k === 'free' && (d.pts?.length ?? 0) < 2)) {
      this.draft = null;
      return this.deps.changed();
    }
    if (d.type === 'channel') {
      this.draft = { ...d, phase: 2, offset: 0 };
      return this.deps.changed();
    }
    this.draft = null;
    if (d.type === 'measure') {
      this.measure = { a: d.a, b: d.b };
      return this.deps.changed();
    }
    if (d.type === 'zoom') {
      const bars = this.deps.bars();
      const i0 = indexForTime(bars, d.a.t);
      const i1 = indexForTime(bars, d.b.t);
      this.deps.zoomTo?.({ x0: Math.min(i0, i1), x1: Math.max(i0, i1), p0: Math.min(d.a.p, d.b.p), p1: Math.max(d.a.p, d.b.p) });
      return this.deps.changed();
    }
    if (k === 'free') return this.commit({ id: this.newId(), type: d.type as DrawingType, a: d.a, pts: d.pts });
    const text = toolDef(d.type)?.text;
    const nd: Drawing = { id: this.newId(), type: d.type as DrawingType, a: d.a, b: d.b, ...(text ? { text: '' } : {}) };
    this.commit(nd);
    if (text) this.deps.editText?.(nd.id);
  }

  /** Sequence tools: a click adds the next anchor. */
  private addAnchor(x: number, y: number): void {
    const d = this.draft;
    if (!d) return;
    const pt = this.toData(x, y, true);
    if (!pt) return;
    this.draft = { ...d, pts: [...(d.pts ?? []), pt] };
    this.afterAnchor();
  }

  private afterAnchor(): void {
    const d = this.draft!;
    const n = toolDef(d.type)?.points;
    if (typeof n === 'number' && (d.pts?.length ?? 0) >= n) return this.finishSequence();
    this.deps.changed();
  }

  /** Polyline / path: finish on double-click or Enter (needs two distinct points). */
  finish(): void {
    const d = this.draft;
    if (d?.phase === 3 && toolDef(d.type)?.points === 'poly') this.finishSequence();
  }

  private finishSequence(): void {
    const d = this.draft!;
    let pts = d.pts ?? [];
    // a double-click delivers two presses at the same spot
    const [p, q] = [pts[pts.length - 2], pts[pts.length - 1]].map((a) => (a ? this.pixel(a) : null));
    if (p && q && Math.hypot(p.x - q.x, p.y - q.y) < 3) pts = pts.slice(0, -1);
    this.draft = null;
    if (pts.length < 2) return this.deps.changed();
    const text = toolDef(d.type)?.text;
    const nd: Drawing = { id: this.newId(), type: d.type as DrawingType, a: pts[0], b: pts[1], pts, ...(text ? { text: '' } : {}) };
    this.commit(nd);
    if (text) this.deps.editText?.(nd.id);
  }

  key(k: string): void {
    if ((k === 'Delete' || k === 'Backspace') && this.selectedId && !this.deps.store.locked()) {
      this.deps.store.remove(this.deps.symbol(), this.selectedId);
      this.selectedId = null;
      this.deps.changed();
    } else if (k === 'Enter') {
      this.finish();
    } else if (k === 'Escape') {
      this.draft = null;
      this.drag = null;
      this.start = null;
      this.selectedId = null;
      this.measure = null;
      this.deps.changed();
    }
  }

  /** Anchor → chart pixel (used by the drawing plugin too). */
  pixel(a: Anchor): { x: number; y: number } | null {
    const s = this.scales();
    if (!s) return null;
    return { x: s.x.getPixelForValue(indexForTime(this.deps.bars(), a.t)), y: s.y.getPixelForValue(a.p) };
  }

  // ---- internals ------------------------------------------------------------------

  private find(id: string): Drawing | undefined {
    return this.deps.store.list(this.deps.symbol()).find((d) => d.id === id);
  }

  private newId(): string {
    return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  private commit(d: Drawing): void {
    if (this.deps.store.hidden()) this.deps.store.setHidden(false); // you should see what you just drew
    this.deps.store.add(this.deps.symbol(), d);
    this.selectedId = d.id;
    this.deps.committed?.(d);
    this.deps.changed();
  }

  private commitChannel(x: number, y: number): void {
    const d = this.draft!;
    this.draft = null;
    this.commit({ id: this.newId(), type: 'channel', a: d.a, b: d.b, offset: this.offsetAt(d, x, y) });
  }

  /** Price distance between the base line (at pixel x) and the pointer. */
  private offsetAt(d: { a: Anchor; b: Anchor }, x: number, y: number): number {
    const s = this.scales();
    if (!s) return 0;
    const bars = this.deps.bars();
    const i0 = indexForTime(bars, d.a.t);
    const i1 = indexForTime(bars, d.b.t);
    const idx = s.x.getValueForPixel(x) as number;
    const u = i1 === i0 ? 0 : (idx - i0) / (i1 - i0);
    const lineP = d.a.p + u * (d.b.p - d.a.p);
    return (s.y.getValueForPixel(y) as number) - lineP;
  }

  private scales(): { x: any; y: any; area: any } | null {
    const c = this.deps.chart() as any;
    if (!c?.scales?.x || !c.scales.y) return null;
    return { x: c.scales.x, y: c.scales.y, area: c.chartArea };
  }

  /** Pixel → (time, price); only inside the price pane unless `clamp` (used while dragging). */
  private toData(x: number, y: number, clamp = false): Anchor | null {
    const s = this.scales();
    const bars = this.deps.bars();
    if (!s || !bars.length) return null;
    const inside = x >= s.area.left && x <= s.area.right && y >= s.y.top && y <= s.y.bottom;
    if (!inside && !clamp) return null;
    const cx = Math.min(Math.max(x, s.area.left), s.area.right);
    const cy = Math.min(Math.max(y, s.y.top), s.y.bottom);
    const idx = s.x.getValueForPixel(cx) as number;
    const price = s.y.getValueForPixel(cy) as number;
    if (this.deps.magnet?.()) {
      const i = Math.min(Math.max(Math.round(idx), 0), bars.length - 1);
      return { t: bars[i].timestamp, p: snapToOhlc(bars[i], price) };
    }
    return { t: timeForIndex(bars, idx), p: price };
  }

  /** Shape-generation environment (price pane, pixel mapping, bars). */
  env(): Env | null {
    const s = this.scales();
    if (!s) return null;
    return {
      area: { left: s.area.left, right: s.area.right, top: s.y.top, bottom: s.y.bottom },
      full: { left: s.area.left, right: s.area.right, top: s.area.top, bottom: s.area.bottom },
      bars: this.deps.bars(),
      px: (a) => this.pixel(a)!,
      fmt: (p) => p.toFixed(2),
    };
  }

  /** A draft as a drawing (a sequence tool also follows the cursor with its next anchor). */
  draftDrawing(): Drawing | null {
    const d = this.draft;
    if (!d) return null;
    const sequence = d.phase === 3 || (d.pts && kind(d.type as Tool) === 'sequence');
    const pts = sequence ? [...(d.pts ?? []), d.b] : d.pts;
    return { id: 'draft', type: d.type as DrawingType, a: d.a, b: d.b, ...(pts ? { pts } : {}), ...(d.offset !== undefined ? { offset: d.offset } : {}) };
  }

  /** Pixel geometry of a drawing, for hit-testing. */
  private distance(d: Drawing, x: number, y: number): number {
    const env = this.env();
    return env ? distanceToShapes(shapesFor(d, env), x, y, env) : Infinity;
  }

  /** Eraser: removes the drawing nearest to the pointer. */
  private erase(x: number, y: number): void {
    if (this.deps.store.locked() || this.deps.store.hidden()) return;
    let hit: Drawing | null = null;
    let best = HIT;
    for (const d of this.deps.store.list(this.deps.symbol())) {
      const dist = this.distance(d, x, y);
      if (dist <= best) { best = dist; hit = d; }
    }
    if (!hit) return;
    this.deps.store.remove(this.deps.symbol(), hit.id);
    if (this.selectedId === hit.id) this.selectedId = null;
    this.deps.changed();
  }

  private selectOrGrab(x: number, y: number): void {
    if (this.deps.store.locked() || this.deps.store.hidden()) {
      this.selectedId = null;
      return this.deps.changed();
    }
    const list = this.deps.store.list(this.deps.symbol());
    const sel = list.find((d) => d.id === this.selectedId);
    const env = this.env();
    if (sel && env) {
      const hs = handlePoints(sel, env);
      for (let index = 0; index < hs.length; index++) {
        if (Math.hypot(hs[index].x - x, hs[index].y - y) <= HANDLE) {
          this.drag = { mode: 'handle', id: sel.id, index };
          return;
        }
      }
    }
    let hit: Drawing | null = null;
    let best = HIT;
    for (const d of list) {
      const dist = this.distance(d, x, y);
      if (dist <= best) { best = dist; hit = d; }
    }
    this.selectedId = hit?.id ?? null;
    if (hit) {
      const s = this.scales()!;
      this.drag = { mode: 'body', id: hit.id, idx0: s.x.getValueForPixel(x) as number, p0: s.y.getValueForPixel(y) as number, orig: hit };
    }
    this.deps.changed();
  }

  private applyDrag(x: number, y: number): void {
    const drag = this.drag;
    const s = this.scales();
    const bars = this.deps.bars();
    if (!drag || !s) return;
    const sym = this.deps.symbol();
    if (drag.mode === 'handle') {
      const pt = this.toData(x, y, true);
      const cur = this.find(drag.id);
      if (pt && cur) this.deps.store.update(sym, withAnchor(cur, drag.index, pt));
    } else {
      const dIdx = (s.x.getValueForPixel(x) as number) - drag.idx0;
      const dP = (s.y.getValueForPixel(y) as number) - drag.p0;
      const move = (a: Anchor): Anchor => ({ t: timeForIndex(bars, indexForTime(bars, a.t) + dIdx), p: a.p + dP });
      const o = drag.orig;
      this.deps.store.update(sym, { ...o, a: move(o.a), ...(o.b ? { b: move(o.b) } : {}), ...(o.pts ? { pts: o.pts.map(move) } : {}) });
    }
    this.deps.changed();
  }
}
