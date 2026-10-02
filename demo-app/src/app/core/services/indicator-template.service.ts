import { Injectable, signal } from '@angular/core';
import { IndicatorEntry } from '../indicators/indicator-catalog';
import { sanitizeIndicator } from './chart-state.service';

export interface IndicatorTemplate { name: string; indicators: IndicatorEntry[]; }

const KEY = 'indicator-templates';

/** Named sets of indicators with all their settings (inputs, styles, visibility), kept in localStorage. */
@Injectable({ providedIn: 'root' })
export class IndicatorTemplateService {
  readonly list = signal<IndicatorTemplate[]>(this.read());

  private read(): IndicatorTemplate[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((t) => t && typeof t.name === 'string' && t.name && Array.isArray(t.indicators))
        .map((t) => ({ name: t.name as string, indicators: (t.indicators as unknown[]).map(sanitizeIndicator).filter((i): i is IndicatorEntry => i !== null) }))
        .filter((t) => t.indicators.length > 0);
    } catch { return []; }
  }

  private persist(): void { try { localStorage.setItem(KEY, JSON.stringify(this.list())); } catch { /* per-session only */ } }

  save(name: string, indicators: IndicatorEntry[]): boolean {
    const n = name.trim();
    if (!n || !indicators.length) return false;
    const t: IndicatorTemplate = { name: n, indicators: JSON.parse(JSON.stringify(indicators)) };
    this.list.update((l) => (l.some((x) => x.name === n) ? l.map((x) => (x.name === n ? t : x)) : [...l, t]));
    this.persist();
    return true;
  }

  remove(name: string): void { this.list.update((l) => l.filter((t) => t.name !== name)); this.persist(); }
}
