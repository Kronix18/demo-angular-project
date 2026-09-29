import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_URL } from '../api-url';
import { SILENT_ERRORS } from './errors';
import { Tier } from './types';

/** GET /api/user/entitlements (docs/api/09-user-tiers.md §2). */
export interface Entitlements {
  tier: Tier;
  status?: string;
  renews_at?: string | null;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  usage?: Record<string, number>;
}

/** Minimal entitlement store used by the gating directives; task 20.2 adds refresh-on-login/402. */
@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly _ent = signal<Entitlements | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly tier = computed<Tier>(() => this._ent()?.tier ?? 'free');
  readonly features = computed(() => this._ent()?.features ?? {});

  has(feature: string): boolean { return this._ent()?.features?.[feature] === true; }
  limit(key: string): number | null { return this._ent()?.limits?.[key] ?? null; }

  load(): void {
    this.http.get<Entitlements>(`${this.api}/api/user/entitlements`, { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({
      next: (e) => { this._ent.set(e); this._loaded.set(true); },
      error: () => { this._ent.set(null); this._loaded.set(true); }, // anonymous/offline: everything locked
    });
  }
}
