import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { API_URL } from '../api-url';
import { AuthService } from '../auth/auth.service';
import { TokenStore } from './token-store';

interface RefreshResponse { access_token: string; refresh_token?: string; expires_in?: number }

/** One in-flight refresh shared by every request that hit 401 at the same time. */
@Injectable({ providedIn: 'root' })
export class TokenRefresher {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStore);
  private readonly api = inject(API_URL);
  private inflight: Observable<string> | null = null;

  refresh(): Observable<string> {
    if (!this.inflight) {
      this.inflight = this.http
        .post<RefreshResponse>(`${this.api}/api/auth/refresh`, { refresh_token: this.tokens.refresh() })
        .pipe(
          tap((r) => this.tokens.set({ access: r.access_token, refresh: r.refresh_token })),
          map((r) => r.access_token),
          finalize(() => (this.inflight = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.inflight;
  }
}

/** Marks a replayed request so a second 401 does not trigger another refresh. */
const RETRIED = new HttpContextToken<boolean>(() => false);
const isAuthEndpoint = (url: string) => url.includes('/api/auth/');
const withToken = (req: HttpRequest<unknown>, token: string | null) => (token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);

/** Bearer header on our API calls; on 401 refresh once (shared) and replay; failed refresh logs the user out. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(API_URL);
  if (!req.url.startsWith(api) || isAuthEndpoint(req.url)) return next(req);
  const tokens = inject(TokenStore);
  const refresher = inject(TokenRefresher);
  const auth = inject(AuthService);

  return next(withToken(req, tokens.access())).pipe(
    catchError((err: unknown) => {
      const unauthorised = err instanceof HttpErrorResponse && err.status === 401;
      if (!unauthorised || !tokens.refresh() || req.context.get(RETRIED)) return throwError(() => err);
      return refresher.refresh().pipe(
        catchError(() => {
          tokens.clear();
          auth.logout();
          return throwError(() => err);
        }),
        switchMap((token) => next(withToken(req.clone({ context: new HttpContext().set(RETRIED, true) }), token))),
      );
    }),
  );
};
