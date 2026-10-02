import { Injectable } from '@angular/core';

const ACCESS_KEY = 'auth_token'; // same key the legacy ApiService already reads
const REFRESH_KEY = 'auth_refresh_token';

/** Single place that touches token storage (no storage access in components). */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  access(): string | null { return this.read(ACCESS_KEY); }
  refresh(): string | null { return this.read(REFRESH_KEY); }

  set(t: { access: string; refresh?: string | null }): void {
    this.write(ACCESS_KEY, t.access);
    if (t.refresh) this.write(REFRESH_KEY, t.refresh);
  }

  clear(): void {
    try { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); } catch { /* storage unavailable */ }
  }

  private read(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
  private write(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
}
