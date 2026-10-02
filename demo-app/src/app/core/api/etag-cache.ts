import { HttpEvent, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, tap, throwError } from 'rxjs';
import { API_URL } from '../api-url';
import { TokenStore } from './token-store';

interface Entry { etag: string; body: unknown }

/** In-memory LRU of GET bodies keyed by URL + auth scope (docs/api/README.md §6). */
@Injectable({ providedIn: 'root' })
export class ETagCache {
  max = 200;
  private readonly map = new Map<string, Entry>();
  private lastAsOf = '';

  get(key: string): Entry | undefined {
    const e = this.map.get(key);
    if (e) { this.map.delete(key); this.map.set(key, e); } // refresh recency
    return e;
  }

  set(key: string, e: Entry): void {
    this.map.delete(key);
    this.map.set(key, e);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }

  size(): number { return this.map.size; }
  clear(): void { this.map.clear(); }

  /** Called by MetaService: when any dataset's data_as_of moves, cached bodies are stale. */
  onDataAsOf(asOf: Record<string, string | null>): void {
    const sig = JSON.stringify(Object.entries(asOf).sort(([a], [b]) => a.localeCompare(b)));
    if (this.lastAsOf && sig !== this.lastAsOf) this.clear();
    this.lastAsOf = sig;
  }
}

export const etagCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(API_URL);
  if (req.method !== 'GET' || !req.url.startsWith(api)) return next(req);
  const cache = inject(ETagCache);
  const scope = inject(TokenStore).access()?.slice(-8) ?? 'anon';
  const key = `${scope}|${req.urlWithParams}`;
  const hit = cache.get(key);
  const sent = hit ? req.clone({ setHeaders: { 'If-None-Match': hit.etag } }) : req;

  return (next(sent) as Observable<HttpEvent<unknown>>).pipe(
    tap((ev) => {
      if (!(ev instanceof HttpResponse) || ev.status !== 200) return;
      const etag = ev.headers.get('ETag');
      const noStore = /no-store/i.test(ev.headers.get('Cache-Control') ?? '');
      if (etag && !noStore) cache.set(key, { etag, body: ev.body });
    }),
    catchError((err: unknown) => {
      // Angular surfaces 304 as an error response; turn it back into the cached 200.
      if (hit && (err as { status?: number })?.status === 304) {
        return of(new HttpResponse({ status: 200, body: hit.body, headers: new HttpHeaders({ ETag: hit.etag }), url: req.url }));
      }
      return throwError(() => err);
    }),
  );
};
