import { TestBed } from '@angular/core/testing';
import { ChartStateService } from './chart-state.service';
import { firstValueFrom } from 'rxjs';

describe('ChartStateService (task 4.1)', () => {
  let seed: Record<string, string>;

  beforeEach(() => {
    seed = {};
    // allow each test to seed sessionStorage BEFORE the service is constructed
    (window as any).__chartStateSeed = seed;
    sessionStorage.clear();
    for (const [k, v] of Object.entries(seed)) sessionStorage.setItem(k, v);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    (window as any).__chartStateSeed = undefined;
    sessionStorage.clear();
  });

  it('holds defaults: msft / 1d / 6m / no indicators', async () => {
    const svc = TestBed.inject(ChartStateService);
    const s = await firstValueFrom(svc.state$);
    expect(s.symbol).toBe('msft');
    expect(s.interval).toBe('1d');
    expect(s.range).toBe('6M');
    expect(s.indicators).toEqual([]);
  });

  it('setSymbol updates symbol, leaves others unchanged', async () => {
    const svc = TestBed.inject(ChartStateService);
    svc.setSymbol('nvda');
    const s = await firstValueFrom(svc.state$);
    expect(s.symbol).toBe('nvda');
    expect(s.interval).toBe('1d'); // unchanged
    expect(s.range).toBe('6M'); // unchanged
  });

  it('setInterval and setRange update their fields', async () => {
    const svc = TestBed.inject(ChartStateService);
    svc.setInterval('1w');
    svc.setRange('1y');
    const s = await firstValueFrom(svc.state$);
    expect(s.interval).toBe('1w');
    expect(s.range).toBe('1y');
  });

  it('persists to sessionStorage under chart-state on change', async () => {
    const svc = TestBed.inject(ChartStateService);
    svc.setSymbol('qqq');
    const raw = sessionStorage.getItem('chart-state');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.symbol).toBe('qqq');
  });

  it('rehydrates from sessionStorage on construction (seed before inject)', () => {
    sessionStorage.setItem('chart-state', JSON.stringify({ symbol: 'pltr', interval: '1w', range: '1y' }));
    // fresh injector → new service instance reads the persisted state
    const fixture = TestBed.overrideProvider(ChartStateService, { useValue: undefined });
    // simpler: create a NEW service class instance via a fresh TestBed run
    const svc = new ChartStateService();
    expect(svc.snapshot().symbol).toBe('pltr');
    expect(svc.snapshot().interval).toBe('1w');
    expect(svc.snapshot().range).toBe('1y');
  });

  it('reset() restores defaults and clears storage', async () => {
    sessionStorage.setItem('chart-state', JSON.stringify({ symbol: 'nvda', interval: '1w', range: '1y' }));
    const svc = new ChartStateService();
    svc.reset();
    const s = await firstValueFrom(svc.state$);
    expect(s.symbol).toBe('msft');
    expect(s.interval).toBe('1d');
    expect(s.range).toBe('6M');
    expect(sessionStorage.getItem('chart-state')).toBeNull();
  });

  it('rehydration drops malformed indicator entries instead of crashing later', () => {
    sessionStorage.setItem('chart-state', JSON.stringify({
      symbol: 'msft', interval: '1d', range: '6M',
      indicators: [{ type: 'sma', period: 20 }, { type: 5 }, null, { type: 'rsi', period: 'x' }, { type: 'ema', period: 50 }],
    }));
    const fresh = new ChartStateService();
    expect(fresh.snapshot().indicators).toEqual([{ type: 'sma', period: 20 }, { type: 'ema', period: 50 }]);
  });

  it('toggleHidden flips an indicator\'s visibility, persists it, and ignores bad indexes', () => {
    const svc = new ChartStateService();
    svc.addIndicator({ type: 'sma', period: 20 });
    svc.addIndicator({ type: 'rsi', period: 14 });
    svc.toggleHidden(1);
    expect(svc.snapshot().indicators).toEqual([{ type: 'sma', period: 20 }, { type: 'rsi', period: 14, hidden: true }]);
    expect(new ChartStateService().snapshot().indicators[1].hidden).toBe(true); // survives a reload
    svc.toggleHidden(1);
    expect(svc.snapshot().indicators[1].hidden).toBeFalsy();
    const before = svc.snapshot();
    svc.toggleHidden(9);
    svc.toggleHidden(-1);
    expect(svc.snapshot()).toBe(before);
  });

  it('the same indicator can be added more than once (TradingView behaviour) — each gets its own row', () => {
    const svc = new ChartStateService();
    expect(svc.addIndicator({ type: 'sma', period: 20 })).toBe(true);
    expect(svc.addIndicator({ type: 'sma', period: 20 })).toBe(true);
    expect(svc.snapshot().indicators.length).toBe(2);
  });

  it('chart type + magnet (10.5): defaults, validation, persistence', () => {
    const svc = new ChartStateService();
    expect(svc.snapshot().chartType).toBe('candles');
    expect(svc.snapshot().magnet).toBe(false);
    svc.setChartType('line');
    svc.toggleMagnet();
    expect(svc.snapshot().chartType).toBe('line');
    expect(svc.snapshot().magnet).toBe(true);
    svc.setChartType('bogus' as any); // ignored
    expect(svc.snapshot().chartType).toBe('line');
    const again = new ChartStateService();
    expect(again.snapshot().chartType).toBe('line');
    expect(again.snapshot().magnet).toBe(true);
    again.toggleMagnet();
    expect(again.snapshot().magnet).toBe(false);
    again.reset();
    expect(again.snapshot().chartType).toBe('candles');
  });

  it('rehydration ignores a corrupt chart type / magnet value', () => {
    sessionStorage.setItem('chart-state', JSON.stringify({ symbol: 'msft', interval: '1d', range: '6M', indicators: [], chartType: 'wat', magnet: 'yes' }));
    const svc = new ChartStateService();
    expect(svc.snapshot().chartType).toBe('candles');
    expect(svc.snapshot().magnet).toBe(false);
  });

  it('updateIndicator merges settings; editing the length keeps `period` in sync; bad index ignored', () => {
    const svc = new ChartStateService();
    svc.addIndicator({ type: 'sma', period: 20 });
    svc.updateIndicator(0, { params: { length: 50, source: 'hl2' }, styles: { ma: { color: '#123456', width: 3 } }, intervals: ['1d'] });
    const e = svc.snapshot().indicators[0];
    expect(e.period).toBe(50);
    expect(e.params).toEqual({ length: 50, source: 'hl2' });
    expect(e.styles).toEqual({ ma: { color: '#123456', width: 3 } });
    expect(e.intervals).toEqual(['1d']);
    const before = svc.snapshot();
    svc.updateIndicator(7, { period: 3 });
    expect(svc.snapshot()).toBe(before);
    expect(new ChartStateService().snapshot().indicators[0].styles).toEqual({ ma: { color: '#123456', width: 3 } }); // persisted
  });

  it('rehydration keeps valid settings and drops malformed ones', () => {
    sessionStorage.setItem('chart-state', JSON.stringify({
      symbol: 'msft', interval: '1d', range: '6M',
      indicators: [{ type: 'sma', period: 20, params: { length: 30 }, styles: { ma: { color: '#fff', width: 2, dash: 'dash', visible: false, junk: 1 } }, intervals: ['1d', 5] },
                   { type: 'ema', period: 5, params: 'x', styles: [1], intervals: 'all' }],
    }));
    const [a, b] = new ChartStateService().snapshot().indicators;
    expect(a.params).toEqual({ length: 30 });
    expect(a.styles).toEqual({ ma: { color: '#fff', width: 2, dash: 'dash', visible: false } });
    expect(a.intervals).toEqual(['1d']);
    expect(b).toEqual({ type: 'ema', period: 5 });
  });

  it('logScale (11.4): default off, toggles, persists, corrupt values ignored, reset clears', () => {
    const svc = new ChartStateService();
    expect(svc.snapshot().logScale).toBe(false);
    svc.toggleLogScale();
    expect(svc.snapshot().logScale).toBe(true);
    expect(new ChartStateService().snapshot().logScale).toBe(true);
    svc.reset();
    expect(svc.snapshot().logScale).toBe(false);
    sessionStorage.setItem('chart-state', JSON.stringify({ symbol: 'msft', interval: '1d', range: '6M', indicators: [], logScale: 'yes' }));
    expect(new ChartStateService().snapshot().logScale).toBe(false);
  });

  it('symbol + volume settings (11.6): defaults, replace, hide toggles, persistence, sanitising', () => {
    const svc = TestBed.inject(ChartStateService);
    expect(svc.snapshot().price).toEqual({});
    expect(svc.snapshot().volume).toEqual({});
    svc.setPriceSettings({ up: '#00ff00', width: 3, byPrevClose: true });
    svc.setVolumeSettings({ down: '#ff0000' });
    svc.togglePriceHidden();
    svc.toggleVolumeHidden();
    expect(svc.snapshot().price).toEqual({ up: '#00ff00', width: 3, byPrevClose: true, hidden: true });
    expect(svc.snapshot().volume).toEqual({ down: '#ff0000', hidden: true });
    svc.togglePriceHidden();
    expect(svc.snapshot().price.hidden).toBeUndefined();
    svc.setPriceSettings({ up: 'not-a-colour', width: 50 } as any);
    expect(svc.snapshot().price).toEqual({}); // invalid values are dropped
    expect(JSON.parse(sessionStorage.getItem('chart-state')!).volume).toEqual({ down: '#ff0000', hidden: true });
  });

  it('rehydrates price / volume settings and ignores corrupt ones', () => {
    sessionStorage.setItem('chart-state', JSON.stringify({ price: { up: '#112233', byPrevClose: true }, volume: 'junk' }));
    const svc = TestBed.inject(ChartStateService);
    expect(svc.snapshot().price).toEqual({ up: '#112233', byPrevClose: true });
    expect(svc.snapshot().volume).toEqual({});
  });
});
