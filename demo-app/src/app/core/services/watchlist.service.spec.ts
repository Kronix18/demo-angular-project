import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChartDataService } from './chart-data.service';
import { WatchlistService } from './watchlist.service';

const rows = (closes: number[]) => closes.map((c, i) => ({ timestamp: i, open: c, high: c, low: c, close: c, volume: 1 }));

describe('WatchlistService (11.14)', () => {
  let calls: string[];
  beforeEach(() => {
    localStorage.clear();
    calls = [];
    TestBed.configureTestingModule({
      providers: [{ provide: ChartDataService, useValue: { getOHLCV: (s: string) => { calls.push(s); return of(rows(s === 'msft' ? [100, 110] : s === 'empty' ? [] : [50, 45])); } } }],
    });
  });

  it('starts with a default list; add cleans and dedupes, remove removes, both persist', () => {
    const w = TestBed.inject(WatchlistService);
    expect(w.list().length).toBeGreaterThan(2);
    w.add(' QQQ.US ');
    w.add('qqq');
    expect(w.list().filter((s) => s === 'qqq').length).toBe(1);
    w.add('!!');
    expect(w.list()).not.toContain('!!');
    w.remove('qqq');
    expect(w.list()).not.toContain('qqq');
    w.add('pltr');
    expect(JSON.parse(localStorage.getItem('watchlist')!)).toContain('pltr');
    expect(new WatchlistService().list()).toContain('pltr');
  });

  it('a corrupt stored list falls back to the default', () => {
    localStorage.setItem('watchlist', '{"x":1}');
    expect(TestBed.inject(WatchlistService).list().length).toBeGreaterThan(2);
  });

  it('loads a quote once per symbol: last close and % change from the previous close', () => {
    const w = TestBed.inject(WatchlistService);
    w.loadQuote('msft');
    w.loadQuote('msft');
    w.loadQuote('nvda');
    w.loadQuote('empty');
    expect(calls).toEqual(['msft', 'nvda', 'empty']);
    expect(w.quotes()['msft']).toEqual({ last: 110, pct: 10 });
    expect(w.quotes()['nvda'].pct).toBeCloseTo(-10, 6);
    expect(w.quotes()['empty']).toBeUndefined();
  });
});
