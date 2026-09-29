import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Subject, catchError, throwError } from 'rxjs';
import { isApiErrorBody, Tier } from './types';

export interface UpgradeRequired {
  feature: string | null;
  requiredTier: Tier | null;
  message: string;
  url: string;
}

/** Stream of "this needs a higher plan" events; the paywall dialog (task 20.4) subscribes. */
@Injectable({ providedIn: 'root' })
export class UpgradeService {
  private readonly subject = new Subject<UpgradeRequired>();
  private readonly _last = signal<UpgradeRequired | null>(null);
  readonly upgrade$ = this.subject.asObservable();
  readonly last = this._last.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>)['__upgrade'] = this; // e2e hook (like __charts)
  }

  emit(e: UpgradeRequired): void {
    this._last.set(e);
    this.subject.next(e);
  }

  clear(): void { this._last.set(null); }
}

/** 402 upgrade_required -> UpgradeService event; the error still propagates so callers can show a locked state. */
export const entitlementInterceptor: HttpInterceptorFn = (req, next) => {
  const svc = inject(UpgradeService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 402) {
        const body = isApiErrorBody(err.error) ? err.error : null;
        const d = (body?.details ?? {}) as { feature?: string; required_tier?: Tier };
        svc.emit({ feature: d.feature ?? null, requiredTier: d.required_tier ?? null, message: body?.message ?? 'Upgrade required', url: req.url });
      }
      return throwError(() => err);
    }),
  );
};
