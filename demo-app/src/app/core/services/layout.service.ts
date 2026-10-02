import { Injectable, signal } from '@angular/core';
import { ChartState } from './chart-state.service';
import { Drawing } from '../../charts/drawings/drawing-geometry';

export interface SavedLayout { name: string; savedAt: number; state: ChartState; drawings: Record<string, Drawing[]>; }

const KEY = 'layouts';
const CURRENT = 'layout-current';

/** Named chart layouts (chart state + every symbol's drawings) in localStorage. Loading is validated by the state / store, not here. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly list = signal<SavedLayout[]>(this.read());
  readonly current = signal(((): string => { try { return localStorage.getItem(CURRENT) ?? ''; } catch { return ''; } })());

  private read(): SavedLayout[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      return Array.isArray(raw)
        ? raw.filter((l) => l && typeof l.name === 'string' && l.name && l.state && typeof l.state === 'object' && l.drawings && typeof l.drawings === 'object')
        : [];
    } catch { return []; }
  }

  private save_(): void { try { localStorage.setItem(KEY, JSON.stringify(this.list())); } catch { /* per-session only */ } }

  get(name: string): SavedLayout | undefined { return this.list().find((l) => l.name === name); }

  save(name: string, state: ChartState, drawings: Record<string, Drawing[]>): boolean {
    const n = name.trim();
    if (!n) return false;
    const layout: SavedLayout = { name: n, savedAt: Date.now(), state: JSON.parse(JSON.stringify(state)), drawings: JSON.parse(JSON.stringify(drawings)) };
    this.list.update((l) => (l.some((x) => x.name === n) ? l.map((x) => (x.name === n ? layout : x)) : [...l, layout]));
    this.save_();
    this.setCurrent(n);
    return true;
  }

  remove(name: string): void {
    this.list.update((l) => l.filter((x) => x.name !== name));
    this.save_();
    if (this.current() === name) this.setCurrent('');
  }

  rename(from: string, to: string): boolean {
    const n = to.trim();
    if (!n || (n !== from && this.get(n)) || !this.get(from)) return false;
    this.list.update((l) => l.map((x) => (x.name === from ? { ...x, name: n } : x)));
    this.save_();
    if (this.current() === from) this.setCurrent(n);
    return true;
  }

  setCurrent(name: string): void {
    this.current.set(name);
    try { localStorage.setItem(CURRENT, name); } catch { /* per-session only */ }
  }
}
