import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { retry, timer } from 'rxjs';

/** Random source in [0,1); replaceable in tests. */
export const RETRY_JITTER = new InjectionToken<() => number>('RETRY_JITTER', { providedIn: 'root', factory: () => Math.random });

const MAX_RETRIES = 2;
const BASE_MS = 500;

const retryable = (e: unknown): e is HttpErrorResponse => e instanceof HttpErrorResponse && (e.status === 0 || e.status === 429 || e.status === 503);

/** GET-only retry of 429/503/network errors: honours Retry-After, else 500 ms * 2^n with +-25% jitter, max 2 retries. */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  const jitter = inject(RETRY_JITTER);
  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error, retryCount) => {
        if (!retryable(error)) throw error;
        const header = Number(error.headers?.get?.('Retry-After'));
        const ms = Number.isFinite(header) && header > 0 ? header * 1000 : BASE_MS * 2 ** (retryCount - 1) * (0.75 + jitter() * 0.5);
        return timer(ms);
      },
    }),
  );
};
