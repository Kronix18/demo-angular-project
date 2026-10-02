import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import bars from '../../../../docs/api/fixtures/ohlcv-msft.json';
import columnar from '../../../../docs/api/fixtures/ohlcv-msft.columnar.json';
import { OhlcvApiClient, mapOhlcv } from './ohlcv-api.client';

const BASE = 'http://localhost:3000/api/chart/MSFT/ohlcv';

describe('OhlcvApiClient (task 13.1, docs/api/02-prices.md)', () => {
  let client: OhlcvApiClient;
  let ctl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(OhlcvApiClient);
    ctl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctl.verify());

  it('json and columnar bodies map to the SAME internal bars', () => {
    expect(mapOhlcv(columnar)).toEqual(mapOhlcv(bars));
    expect(mapOhlcv(bars)).toHaveLength(bars.length);
    expect(mapOhlcv(bars)[0]).toEqual(bars[0]);
  });

  it('empty / missing / malformed bodies give [] and bad rows are dropped', () => {
    expect(mapOhlcv([])).toEqual([]);
    expect(mapOhlcv(null)).toEqual([]);
    expect(mapOhlcv({})).toEqual([]);
    expect(mapOhlcv({ timestamp: [1, 2], open: [1], high: [1, 2], low: [1, 2], close: [1, 2], volume: [1, 2] })).toEqual([]); // unequal lengths
    const out = mapOhlcv([{ timestamp: 2, open: 1, high: 2, low: 1, close: 1.5, volume: 10 }, { timestamp: 'x', open: 1 }, { timestamp: 1, open: 1, high: 2, low: 1, close: 1.2, volume: 5 }]);
    expect(out.map((b) => b.timestamp)).toEqual([1, 2]); // sorted ascending, junk row dropped
  });

  it('requests /api/chart/{SYMBOL}/ohlcv with the documented params and never asks for non-split adjustment', () => {
    let out: unknown;
    client.get('msft', { interval: '1w', from: '2025-01-01', to: '2026-01-01', limit: 500, format: 'columnar' }).subscribe((v) => (out = v));
    const r = ctl.expectOne((q) => q.url === BASE);
    expect(r.request.method).toBe('GET');
    expect(r.request.params.get('interval')).toBe('1w');
    expect(r.request.params.get('from')).toBe('2025-01-01');
    expect(r.request.params.get('to')).toBe('2026-01-01');
    expect(r.request.params.get('limit')).toBe('500');
    expect(r.request.params.get('format')).toBe('columnar');
    expect(r.request.params.has('adjust')).toBe(false);
    r.flush(columnar);
    expect(out).toEqual(mapOhlcv(bars));
  });

  it('defaults: 1d, json, no other params; symbol is upper-cased and encoded', () => {
    client.get('brk.b').subscribe();
    const r = ctl.expectOne((q) => q.url === 'http://localhost:3000/api/chart/BRK.B/ohlcv');
    expect(r.request.params.get('interval')).toBe('1d');
    expect(r.request.params.has('format')).toBe(false);
    r.flush([]);
  });

  it('an empty history for a valid symbol is [] (not an error)', () => {
    let out: unknown = 'unset';
    client.get('MSFT').subscribe((v) => (out = v));
    ctl.expectOne((q) => q.url === BASE).flush([]);
    expect(out).toEqual([]);
  });

  it('HTTP errors propagate (the data source falls back, task 13.2)', () => {
    let status = 0;
    client.get('MSFT').subscribe({ error: (e) => (status = e.status) });
    ctl.expectOne((q) => q.url === BASE).flush({ error: 'symbol_not_found', message: 'x' }, { status: 404, statusText: 'x' });
    expect(status).toBe(404);
  });
});
