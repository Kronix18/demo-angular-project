import type { Chart } from 'chart.js';
import { OHLCV } from '../../core/models/ohlcv.model';
import { Anchor, Drawing, DrawingType, distToRay, distToSegment, indexForTime, timeForIndex } from './drawing-geometry';
import { DrawingStore } from './drawing-store.service';

export type Tool = 'cursor' | DrawingType;

/** In-progress drawing (not persisted until committed). */
export interface Draft { type: DrawingType; a: Anchor; b: Anchor; offset?: number; phase: 1 | 2; }

export interface DrawingView { drawings: Drawing[]; draft: Draft | null; selectedId: string | null; }

interface Deps {
  chart: () => Chart | null;
  bars: () => OHLCV[];
  store: DrawingStore;
  symbol: () => string;
  tool: () => Tool;
  /** something visible changed: redraw */
  changed: () => void;
}

type Drag =
  | { mode: 'handle'; id: string; which: 'a' | 'b' }
  | { mode: 'body'; id: string; idx0: number; p0: number; orig: Drawing }
  | null;

const HIT = 6;      // px: line pick tolerance
const HANDLE = 9;   // px: endpoint pick tolerance
const MIN_DRAG = 3; // px: below this a "drag" is just a click

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

  constructor(private deps: Deps) {}

  view(): DrawingView {
    return { drawings: this.deps.store.list(this.deps.symbol()), draft: this.draft, selectedId: this.selectedId };
  }

  /** The zoom plugin's drag-pan would fight with drawing: only the cursor tool may pan. */
  syncPan(): void {
    const chart = this.deps.chart();
    const pan = (chart?.options?.plugins as any)?.zoom?.pan;
    if (!pan) return;
    const enabled = this.deps.tool() === 'cursor';
    if (pan.enabled === enabled) return;
    pan.enabled = enabled;
    // the zoom plugin caches its options per update cycle
    chart!.update('none');
  }

  cancel(): void {
    this.draft = null;
    this.drag = null;
    this.start = null;
    this.selectedId = null;
    this.deps.changed();
  }

  pointerDown(x: number, y: number): void {
    const tool = this.deps.tool();
    if (this.draft?.phase === 2) return this.commitChannel(x, y);
    if (tool === 'cursor') return this.selectOrGrab(x, y);
    const pt = this.toData(x, y);
    if (!pt) return;
    this.selectedId = null;
    if (tool === 'ray') return this.commit({ id: this.newId(), type: 'ray', a: pt });
    this.start = { x, y };
    this.draft = { type: tool, a: pt, b: pt, phase: 1 };
    this.deps.changed();
  }

  pointerMove(x: number, y: number): void {
    if (this.draft) {
      if (this.draft.phase === 1) {
        const pt = this.toData(x, y, true);
        if (pt) this.draft = { ...this.draft, b: pt };
      } else {
        this.draft = { ...this.draft, offset: this.offsetAt(this.draft, x, y) };
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
    if (moved < MIN_DRAG) {
      this.draft = null;
      return this.deps.changed();
    }
    if (d.type === 'channel') {
      this.draft = { ...d, phase: 2, offset: 0 };
      return this.deps.changed();
    }
    this.draft = null;
    this.commit({ id: this.newId(), type: d.type, a: d.a, b: d.b });
  }

  key(k: string): void {
    if ((k === 'Delete' || k === 'Backspace') && this.selectedId) {
      this.deps.store.remove(this.deps.symbol(), this.selectedId);
      this.selectedId = null;
      this.deps.changed();
    } else if (k === 'Escape') {
      this.draft = null;
      this.drag = null;
      this.start = null;
      this.selectedId = null;
      this.deps.changed();
    }
  }

  // ---- internals ------------------------------------------------------------------

  private newId(): string {
    return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }

  private commit(d: Drawing): void {
    this.deps.store.add(this.deps.symbol(), d);
    this.selectedId = d.id;
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
    return { t: timeForIndex(bars, s.x.getValueForPixel(cx) as number), p: s.y.getValueForPixel(cy) as number };
  }

  /** Anchor → chart pixel (used by the drawing plugin too). */
  pixel(a: Anchor): { x: number; y: number } | null {
    const s = this.scales();
    if (!s) return null;
    return { x: s.x.getPixelForValue(indexForTime(this.deps.bars(), a.t)), y: s.y.getPixelForValue(a.p) };
  }

  private distance(d: Drawing, x: number, y: number): number {
    const a = this.pixel(d.a);
    if (!a) return Infinity;
    if (d.type === 'ray') return distToRay(x, y, a.x, a.y);
    const b = this.pixel(d.b!);
    if (!b) return Infinity;
    let best = distToSegment(x, y, a.x, a.y, b.x, b.y);
    if (d.type === 'channel') {
      const a2 = this.pixel({ t: d.a.t, p: d.a.p + (d.offset ?? 0) })!;
      const b2 = this.pixel({ t: d.b!.t, p: d.b!.p + (d.offset ?? 0) })!;
      best = Math.min(best, distToSegment(x, y, a2.x, a2.y, b2.x, b2.y));
    }
    return best;
  }

  private selectOrGrab(x: number, y: number): void {
    const list = this.deps.store.list(this.deps.symbol());
    const sel = list.find((d) => d.id === this.selectedId);
    if (sel) {
      for (const which of ['a', 'b'] as const) {
        const anchor = sel[which];
        const px = anchor && this.pixel(anchor);
        if (px && Math.hypot(px.x - x, px.y - y) <= HANDLE) {
          this.drag = { mode: 'handle', id: sel.id, which };
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
      const cur = this.deps.store.list(sym).find((d) => d.id === drag.id);
      if (pt && cur) this.deps.store.update(sym, { ...cur, [drag.which]: pt });
    } else {
      const dIdx = (s.x.getValueForPixel(x) as number) - drag.idx0;
      const dP = (s.y.getValueForPixel(y) as number) - drag.p0;
      const move = (a: Anchor): Anchor => ({ t: timeForIndex(bars, indexForTime(bars, a.t) + dIdx), p: a.p + dP });
      const o = drag.orig;
      this.deps.store.update(sym, { ...o, a: move(o.a), ...(o.b ? { b: move(o.b) } : {}) });
    }
    this.deps.changed();
  }
}
