import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'theme';
const ORDER: ThemeMode[] = ['system', 'light', 'dark'];

/**
 * Light/dark theme. `mode` is the user's choice (system = follow the OS);
 * `theme` is what is actually applied as `<html data-theme="…">` — the only
 * switch the token palette in styles/theme.scss reacts to. The choice persists
 * in localStorage; in system mode OS changes are followed live.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly osDark = signal(false);
  readonly mode = signal<ThemeMode>('system');
  readonly theme = computed<'light' | 'dark'>(() =>
    this.mode() === 'system' ? (this.osDark() ? 'dark' : 'light') : (this.mode() as 'light' | 'dark'));

  constructor() {
    this.mode.set(this.readStored());
    try {
      const mq = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
      if (mq) {
        this.osDark.set(mq.matches);
        mq.addEventListener('change', (e: { matches: boolean }) => { this.osDark.set(e.matches); this.apply(); });
      }
    } catch { /* no matchMedia: stay light */ }
    this.apply();
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* storage unavailable: choice is per-session */ }
    this.apply();
  }

  /** system → light → dark → system */
  cycle(): void {
    this.setMode(ORDER[(ORDER.indexOf(this.mode()) + 1) % ORDER.length]);
  }

  private apply(): void {
    this.doc.documentElement.setAttribute('data-theme', this.theme());
  }

  private readStored(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch {
      return 'system';
    }
  }
}
