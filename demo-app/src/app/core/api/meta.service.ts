import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_URL } from '../api-url';
import { SILENT_ERRORS } from './errors';
import { ETagCache } from './etag-cache';
import { Benchmarks, DatasetName, MetaResponse } from './types';

const POLL_MS = 15 * 60_000; // fallback while the daily import is manual (next_refresh_after = null)
const MIN_MS = 60_000;

/** `GET /api/meta` as signals: what the backend has switched on, data dates, benchmarks, display names. */
@Injectable({ providedIn: 'root' })
export class MetaService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly etag = inject(ETagCache);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly _meta = signal<MetaResponse | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly datasets = computed<string[]>(() => this._meta()?.datasets ?? []);
  readonly dataAsOf = computed<Record<string, string | null>>(() => this._meta()?.data_as_of ?? {});
  readonly nextRefreshAfter = computed(() => this._meta()?.next_refresh_after ?? null);
  readonly benchmarks = computed<Benchmarks | null>(() => this._meta()?.benchmarks ?? null);
  readonly modelVersions = computed(() => this._meta()?.model_versions ?? {});

  constructor() {
    if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>)['__meta'] = this; // e2e hook (like __charts)
  }

  has(name: DatasetName | string): boolean {
    return this.datasets().includes(name);
  }

  /** User-facing label for a rating/score key (backend-controlled, task 20.8 builds on this). */
  displayName(key: string, fallback: string): string {
    return this._meta()?.display_names?.[key] ?? fallback;
  }

  load(): void {
    clearTimeout(this.timer);
    this.http
      .get<MetaResponse>(`${this.api}/api/meta`, { context: new HttpContext().set(SILENT_ERRORS, true) })
      .subscribe({
        next: (m) => {
          this._meta.set(m);
          this._loaded.set(true);
          this.etag.onDataAsOf(m.data_as_of ?? {});
          this.schedule(m.next_refresh_after);
        },
        error: () => {
          this._loaded.set(true); // keep the last good meta (or none) and try again later
          this.schedule(null);
        },
      });
  }

  private schedule(next: string | null | undefined): void {
    const at = next ? Date.parse(next) - Date.now() : NaN;
    const delay = Number.isFinite(at) && at > 0 ? Math.max(at, MIN_MS) : POLL_MS;
    this.timer = setTimeout(() => this.load(), delay);
  }
}
