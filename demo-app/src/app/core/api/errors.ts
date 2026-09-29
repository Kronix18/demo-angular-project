import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { isApiErrorBody } from './types';

/** Typed API error (docs/api/README.md §5). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly retryAfterSeconds?: number,
    readonly original?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'bad_request', 401: 'unauthenticated', 402: 'upgrade_required', 403: 'forbidden', 404: 'not_found',
  409: 'conflict', 422: 'validation_failed', 429: 'rate_limited', 503: 'data_not_ready',
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof HttpErrorResponse) {
    const retry = Number(err.headers?.get?.('Retry-After'));
    const retryAfter = Number.isFinite(retry) && retry > 0 ? retry : undefined;
    if (err.status === 0) return new ApiError(0, 'network', 'Cannot reach the server', undefined, undefined, err);
    if (isApiErrorBody(err.error)) return new ApiError(err.status, err.error.error, err.error.message, err.error.details, retryAfter, err);
    const code = CODE_BY_STATUS[err.status] ?? (err.status >= 500 ? 'server_error' : 'unknown');
    return new ApiError(err.status, code, err.statusText || `Request failed (${err.status})`, undefined, retryAfter, err);
  }
  if (err instanceof Error && err.name === 'TimeoutError') return new ApiError(0, 'timeout', 'The server took too long to respond', undefined, undefined, err);
  return new ApiError(0, 'unknown', err instanceof Error ? err.message : 'Unexpected error', undefined, undefined, err);
}

/** Errors that are normal control flow (missing optional dataset, paywall, token refresh) never toast. */
export function shouldToast(e: ApiError): boolean {
  if (e.status === 402 || e.status === 404) return false;
  if (e.code === 'token_expired' || e.code === 'data_not_ready') return false;
  return true;
}

export interface ApiToast {
  message: string;
  code: string;
  count: number;
}

const TOAST_MS = 6000;

/** Holds the single visible API error toast. */
@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  private readonly _toast = signal<ApiToast | null>(null);
  private readonly _last = signal<ApiError | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;
  readonly toast = this._toast.asReadonly();
  readonly lastError = this._last.asReadonly();

  report(e: ApiError): void {
    this._last.set(e);
    if (!shouldToast(e)) return;
    const cur = this._toast();
    // A retry of the same failure must not stack or flicker.
    this._toast.set(cur && cur.message === e.message && cur.code === e.code ? cur : { message: e.message, code: e.code, count: 1 });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), TOAST_MS);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this._toast.set(null);
  }
}

/** Optional discovery calls (e.g. /api/meta) set this so failures never toast. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Maps HttpErrorResponse to ApiError for the toast, but rethrows the ORIGINAL error so existing callers are unaffected. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const svc = inject(ApiErrorService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (req.url.includes('/api/') && !req.context.get(SILENT_ERRORS)) svc.report(toApiError(err));
      return throwError(() => err);
    }),
  );
};
