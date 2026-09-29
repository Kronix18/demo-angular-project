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
});
