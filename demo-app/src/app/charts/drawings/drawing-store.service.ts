import { Injectable, signal } from '@angular/core';
import { Drawing } from './drawing-geometry';

const KEY = 'chart-drawings';
const TYPES = ['trend', 'ray', 'channel'];
const EMPTY: Drawing[] = [];

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const anchor = (v: any) => v && num(v.t) && num(v.p);
const valid = (d: any): d is Drawing =>
  !!d && typeof d.id === 'string' && TYPES.includes(d.type) && anchor(d.a) && (d.b === undefined || anchor(d.b)) && (d.offset === undefined || num(d.offset));

/**
 * Chart drawings, kept per symbol in sessionStorage (like the rest of the chart
 * state). Anchors are (timestamp, price) so drawings stay put across intervals.
 * `revision` bumps on every mutation so views can re-render.
 */
@Injectable({ providedIn: 'root' })
export class DrawingStore {
  private data: Record<string, Drawing[]> = this.read();
  readonly revision = signal(0);

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
      for (const [sym, list] of Object.entries(raw ?? {})) if (Array.isArray(list)) out[sym] = list.filter(valid);
      return out;
    } catch {
      return {};
    }
  }
}
