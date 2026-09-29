import { Injectable, signal } from '@angular/core';
import { Drawing } from './drawing-geometry';
import { isDrawingType } from './drawing-tools';

const KEY = 'chart-drawings';
const DASHES = ['solid', 'dash', 'dot'];
const EMPTY: Drawing[] = [];

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const anchor = (v: any) => v && num(v.t) && num(v.p);
const valid = (d: any): d is Drawing =>
  !!d && typeof d.id === 'string' && isDrawingType(d.type) && anchor(d.a) && (d.b === undefined || anchor(d.b)) && (d.offset === undefined || num(d.offset))
  && (d.text === undefined || typeof d.text === 'string') && (d.pts === undefined || (Array.isArray(d.pts) && d.pts.every(anchor)));

/** Drops invalid per-drawing extras (persisted data is never trusted). */
function cleanDrawing(d: Drawing): Drawing {
  const { locked, hidden, view, ...rest } = d as Drawing & Record<string, unknown>;
  const out: Drawing = { ...(rest as Drawing) };
  if (locked === true) out.locked = true;
  if (hidden === true) out.hidden = true;
  if (view && typeof view === 'object' && num((view as any).x) && num((view as any).y)) out.view = { x: (view as any).x, y: (view as any).y };
  return out;
}

/** Keeps only the known style keys (persisted data is never trusted). */
function cleanStyle(s: any): Drawing['style'] | undefined {
  if (!s || typeof s !== 'object') return undefined;
  const out: NonNullable<Drawing['style']> = {};
  if (typeof s.color === 'string') out.color = s.color;
  if (typeof s.width === 'number') out.width = s.width;
  if (DASHES.includes(s.dash)) out.dash = s.dash;
  return out;
}

/**
 * Chart drawings, kept per symbol in sessionStorage (like the rest of the chart
 * state). Anchors are (timestamp, price) so drawings stay put across intervals.
 * `revision` bumps on every mutation so views can re-render.
 */
@Injectable({ providedIn: 'root' })
export class DrawingStore {
  private data: Record<string, Drawing[]> = this.read();
  readonly revision = signal(0);
  /** Lock all: existing drawings cannot be selected, moved or deleted. Hide all: nothing is drawn. Both persist. */
  readonly locked = signal(this.readFlag('locked'));
  readonly hidden = signal(this.readFlag('hidden'));

  toggleLocked(): void { this.setFlag('locked', !this.locked()); }
  toggleHidden(): void { this.setFlag('hidden', !this.hidden()); }
  setHidden(v: boolean): void { this.setFlag('hidden', v); }

  private setFlag(name: 'locked' | 'hidden', v: boolean): void {
    (name === 'locked' ? this.locked : this.hidden).set(v);
    this.revision.update((r) => r + 1);
    try { localStorage.setItem(`drawings-${name}`, v ? '1' : '0'); } catch { /* per-session only */ }
  }

  private readFlag(name: string): boolean {
    try { return localStorage.getItem(`drawings-${name}`) === '1'; } catch { return false; }
  }

  list(symbol: string): Drawing[] {
    return this.data[symbol.toLowerCase()] ?? EMPTY;
  }

  add(symbol: string, d: Drawing): void {
    this.set(symbol, [...this.list(symbol), d]);
  }

  update(symbol: string, d: Drawing): void {
    const cur = this.list(symbol);
    if (!cur.some((x) => x.id === d.id)) return;
    this.set(symbol, cur.map((x) => (x.id === d.id ? d : x)), 'update');
  }

  remove(symbol: string, id: string): void {
    const cur = this.list(symbol);
    if (!cur.some((x) => x.id === id)) return;
    this.set(symbol, cur.filter((x) => x.id !== id));
  }

  /** Z-order: the list order is the paint order (last = on top). */
  move(symbol: string, id: string, how: 'front' | 'back' | 'forward' | 'backward'): void {
    const cur = this.list(symbol);
    const i = cur.findIndex((d) => d.id === id);
    if (i < 0) return;
    const j = how === 'front' ? cur.length - 1 : how === 'back' ? 0 : how === 'forward' ? Math.min(cur.length - 1, i + 1) : Math.max(0, i - 1);
    if (j === i) return;
    const next = cur.filter((_, k) => k !== i);
    next.splice(j, 0, cur[i]);
    this.set(symbol, next);
  }

  /** Every symbol's drawings (layouts save and restore them). */
  exportAll(): Record<string, Drawing[]> { return JSON.parse(JSON.stringify(this.data)); }

  importAll(all: Record<string, unknown>): void {
    const next: Record<string, Drawing[]> = {};
    for (const [sym, list] of Object.entries(all ?? {})) if (Array.isArray(list)) next[sym.toLowerCase()] = list.filter(valid).map((d) => cleanDrawing(d.style ? { ...d, style: cleanStyle(d.style) } : d));
    this.past = {}; this.future = {}; this.lastEdit = null;
    this.data = next;
    this.revision.update((r) => r + 1);
    try { sessionStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* per-page only */ }
  }

  clear(symbol: string): void {
    if (this.list(symbol).length) this.set(symbol, []);
  }

  // ---- undo / redo (per symbol, in memory) -------------------------------------------
  private past: Record<string, Drawing[][]> = {};
  private future: Record<string, Drawing[][]> = {};
  private lastEdit: { key: string; kind: string; at: number } | null = null;

  canUndo(symbol: string): boolean { this.revision(); return (this.past[symbol.toLowerCase()]?.length ?? 0) > 0; }
  canRedo(symbol: string): boolean { this.revision(); return (this.future[symbol.toLowerCase()]?.length ?? 0) > 0; }

  undo(symbol: string): boolean { return this.travel(symbol, this.past, this.future); }
  redo(symbol: string): boolean { return this.travel(symbol, this.future, this.past); }

  private travel(symbol: string, from: Record<string, Drawing[][]>, to: Record<string, Drawing[][]>): boolean {
    const key = symbol.toLowerCase();
    const snap = from[key]?.pop();
    if (!snap) return false;
    (to[key] ??= []).push(this.list(key));
    this.lastEdit = null;
    this.write(key, snap);
    return true;
  }

  private set(symbol: string, list: Drawing[], kind = 'edit'): void {
    const key = symbol.toLowerCase();
    // a drag is many quick updates of one drawing: they share one undo step
    const now = Date.now();
    const same = kind === 'update' && this.lastEdit?.key === key && this.lastEdit.kind === 'update' && now - this.lastEdit.at < 600;
    if (!same) {
      const stack = (this.past[key] ??= []);
      stack.push(this.list(key));
      if (stack.length > 100) stack.shift();
      this.future[key] = [];
    }
    this.lastEdit = { key, kind, at: now };
    this.write(key, list);
  }

  private write(key: string, list: Drawing[]): void {
    this.data = { ...this.data, [key]: list };
    this.revision.update((r) => r + 1);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(this.data));
    } catch { /* storage unavailable: drawings live for this page only */ }
  }

  private read(): Record<string, Drawing[]> {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
      const out: Record<string, Drawing[]> = {};
      for (const [sym, list] of Object.entries(raw ?? {})) {
        if (Array.isArray(list)) out[sym] = list.filter(valid).map((d) => cleanDrawing(d.style ? { ...d, style: cleanStyle(d.style) } : d));
      }
      return out;
    } catch {
      return {};
    }
  }
}
