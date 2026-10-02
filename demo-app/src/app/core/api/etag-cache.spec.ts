import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ETagCache, etagCacheInterceptor } from './etag-cache';
import { TokenStore } from './token-store';

const BASE = 'http://localhost:3000';

describe('etagCacheInterceptor (task 12.5, docs/api/README.md §6)', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let cache: ETagCache;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([etagCacheInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(ETagCache);
  });
  afterEach(() => { ctl.verify(); localStorage.clear(); });

  const url = `${BASE}/api/chart/MSFT/ohlcv`;

  it('first GET stores body by ETag; second GET sends If-None-Match and a 304 yields the cached body', () => {
    const got: unknown[] = [];
    http.get(url).subscribe((b) => got.push(b));
    const r1 = ctl.expectOne(url);
    expect(r1.request.headers.has('If-None-Match')).toBe(false);
    r1.flush([{ close: 1 }], { headers: { ETag: '"v1"' } });

    http.get(url).subscribe((b) => got.push(b));
    const r2 = ctl.expectOne(url);
    expect(r2.request.headers.get('If-None-Match')).toBe('"v1"');
    r2.flush(null, { status: 304, statusText: 'Not Modified' });
    expect(got).toEqual([[{ close: 1 }], [{ close: 1 }]]);
  });

  it('a 200 with a new ETag replaces the entry', () => {
    http.get(url).subscribe();
    ctl.expectOne(url).flush({ a: 1 }, { headers: { ETag: '"v1"' } });
    http.get(url).subscribe();
    ctl.expectOne(url).flush({ a: 2 }, { headers: { ETag: '"v2"' } });
    http.get(url).subscribe();
    expect(ctl.expectOne(url).request.headers.get('If-None-Match')).toBe('"v2"');
  });

  it('does not cache non-GET, non-API, no-ETag or no-store responses', () => {
    http.post(url, {}).subscribe();
    ctl.expectOne(url).flush({}, { headers: { ETag: '"p"' } });
    http.get('https://other.example/api/x').subscribe();
    ctl.expectOne('https://other.example/api/x').flush({}, { headers: { ETag: '"o"' } });
    http.get(`${BASE}/api/noetag`).subscribe();
    ctl.expectOne(`${BASE}/api/noetag`).flush({});
    http.get(`${BASE}/api/user/x`).subscribe();
    ctl.expectOne(`${BASE}/api/user/x`).flush({}, { headers: { ETag: '"u"', 'Cache-Control': 'private, no-store' } });
    for (const u of [url, 'https://other.example/api/x', `${BASE}/api/noetag`, `${BASE}/api/user/x`]) {
      http.get(u).subscribe();
      expect(ctl.expectOne(u).request.headers.has('If-None-Match')).toBe(false);
    }
  });

  it('entries are scoped per auth state (different token -> different cache)', () => {
    const tokens = TestBed.inject(TokenStore);
    tokens.set({ access: 'tokenAAAA' });
    http.get(url).subscribe();
    ctl.expectOne(url).flush({ a: 1 }, { headers: { ETag: '"a"' } });
    tokens.set({ access: 'tokenBBBB' });
    http.get(url).subscribe();
    expect(ctl.expectOne(url).request.headers.has('If-None-Match')).toBe(false);
  });

  it('evicts everything when data_as_of moves forward', () => {
    http.get(url).subscribe();
    ctl.expectOne(url).flush({ a: 1 }, { headers: { ETag: '"a"' } });
    cache.onDataAsOf({ prices: '2026-09-22' }); // first sighting: keep
    expect(cache.size()).toBe(1);
    cache.onDataAsOf({ prices: '2026-09-22' }); // unchanged: keep
    expect(cache.size()).toBe(1);
    cache.onDataAsOf({ prices: '2026-09-23' }); // new data: drop
    expect(cache.size()).toBe(0);
  });

  it('is an LRU with a size cap', () => {
    cache.max = 2;
    for (const p of ['a', 'b', 'c']) {
      http.get(`${BASE}/api/${p}`).subscribe();
      ctl.expectOne(`${BASE}/api/${p}`).flush({ p }, { headers: { ETag: `"${p}"` } });
    }
    expect(cache.size()).toBe(2);
    http.get(`${BASE}/api/a`).subscribe(); // oldest was evicted
    expect(ctl.expectOne(`${BASE}/api/a`).request.headers.has('If-None-Match')).toBe(false);
  });
});
