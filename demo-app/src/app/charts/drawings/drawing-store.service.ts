import { Injectable, signal } from '@angular/core';
import { Drawing } from './drawing-geometry';

const KEY = 'chart-drawings';
const TYPES = ['trend', 'arrow', 'ray', 'hline', 'vline', 'channel', 'rect', 'ellipse', 'fib', 'brush', 'text'];
const DASHES = ['solid', 'dash', 'dot'];
const EMPTY: Drawing[] = [];

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const anchor = (v: any) => v && num(v.t) && num(v.p);
const valid = (d: any): d is Drawing =>
  !!d && typeof d.id === 'string' && TYPES.includes(d.type) && anchor(d.a) && (d.b === undefined || anchor(d.b)) && (d.offset === undefined || num(d.offset))
  && (d.text === undefined || typeof d.text === 'string') && (d.pts === undefined || (Array.isArray(d.pts) && d.pts.every(anchor)));

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
    this.set(symbol, cur.map((x) => (x.id === d.id ? d : x)));
  }

  remove(symbol: string, id: string): void {
    const cur = this.list(symbol);
    if (!cur.some((x) => x.id === id)) return;
    this.set(symbol, cur.filter((x) => x.id !== id));
  }

  clear(symbol: string): void {
    if (this.list(symbol).length) this.set(symbol, []);
  }

  private set(symbol: string, list: Drawing[]): void {
    this.data = { ...this.data, [symbol.toLowerCase()]: list };
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
        if (Array.isArray(list)) out[sym] = list.filter(valid).map((d) => (d.style ? { ...d, style: cleanStyle(d.style) } : d));
      }
      return out;
    } catch {
      return {};
    }
  }
}
