import { TestBed } from '@angular/core/testing';
import { IndicatorCalculationService, IndicatorOutputs } from './indicator-calculation.service';
import { OHLCV } from '../models/ohlcv.model';
import moving_average_sma50 from '../indicators/__fixtures__/moving_average_sma50.json';
import moving_average_ema21 from '../indicators/__fixtures__/moving_average_ema21.json';
import moving_average_wma10 from '../indicators/__fixtures__/moving_average_wma10.json';
import moving_average_rma14 from '../indicators/__fixtures__/moving_average_rma14.json';
import rsi14 from '../indicators/__fixtures__/rsi14.json';
import rsi_flat from '../indicators/__fixtures__/rsi_flat.json';
import rsi_noloss from '../indicators/__fixtures__/rsi_noloss.json';
import atr14_rma from '../indicators/__fixtures__/atr14_rma.json';
import atr14_sma from '../indicators/__fixtures__/atr14_sma.json';
import webby_rsi_5150 from '../indicators/__fixtures__/webby_rsi_5150.json';
import webby_rsi_original from '../indicators/__fixtures__/webby_rsi_original.json';
import bob_marley_52w from '../indicators/__fixtures__/bob_marley_52w.json';
import fixtureInput from '../indicators/__fixtures__/fixture_input.json';

/**
 * Task 5.1 — golden-value tests: the TS port MUST match the real Python
 * calculators (screener/viewingApp/indicators/calculators/) within 1e-6.
 * Fixtures generated FROM the Python code (scripts/gen_indicator_fixtures.py;
 * pandas 3.0.6 / numpy 2.5.3; Wilder = ewm(alpha=1/N, adjust=False, min_periods=N)).
 */

interface GoldenFixture {
  n: number;
  outputs: Record<string, (number | null)[]>;
}

const TOL = 1e-6;
const G = (f: unknown) => f as GoldenFixture;

const ohlcv = fixtureInput as OHLCV[];
// Edge inputs — same construction as gen_indicator_fixtures.py: first 16 bars,
// flat at 100 / sorted by close ascending and x5 (monotonic rise → no losses).
const flatBars: OHLCV[] = ohlcv.slice(0, 16).map((b) => ({ ...b, open: 100, high: 100, low: 100, close: 100 }));
const risingBars: OHLCV[] = [...ohlcv.slice(0, 16)]
  .sort((a, b) => a.close - b.close)
  .map((b) => ({ ...b, high: b.high * 5, low: b.low * 5, close: b.close * 5 }));

const RSI_PARAMS = { source: 'close', length: 14, overbought: 70, oversold: 30 };

describe('IndicatorCalculationService — 5.1 golden values (Python-ported)', () => {
  let service: IndicatorCalculationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndicatorCalculationService);
  });

  const expectGolden = (
    fixture: GoldenFixture, type: string, params: Record<string, unknown>, bars: OHLCV[], outputs: string[],
  ) => {
    const result = service.calculate(type, params, bars);
    for (const out of outputs) {
      const golden = fixture.outputs[out];
      const actual = result[out];
      expect(actual, `${type}.${out} missing from result`).toBeTruthy();
      expect(actual.length, `${type}.${out} length`).toBe(fixture.n);
      const bad: string[] = [];
      for (let i = 0; i < fixture.n; i++) {
        const g = golden[i];
        const a = actual[i];
        if (g === null || a === null) {
          if (g !== a) bad.push(`[${i}] golden=${g} actual=${a}`);
        } else if (Math.abs(g - a) > TOL) {
          bad.push(`[${i}] golden=${g} actual=${a}`);
        }
      }
      expect(bad, `${type}.${out} diverges from Python golden (tol ${TOL})`).toEqual([]);
    }
  };

  it('fixture input is the 120-bar slice', () => {
    expect(ohlcv.length).toBe(120);
  });

  it('moving_average: SMA/EMA/WMA/RMA match Python within 1e-6', () => {
    const run = (f: unknown, method: string, length: number) =>
      expectGolden(G(f), 'moving_average', { method, source: 'close', length, offset: 0 }, ohlcv, ['ma']);
    run(moving_average_sma50, 'SMA', 50);
    run(moving_average_ema21, 'EMA', 21);
    run(moving_average_wma10, 'WMA', 10);
    run(moving_average_rma14, 'RMA', 14);
  });

  it('rsi: Wilder ewm semantics match Python; flat→50, no-loss→100', () => {
    expectGolden(G(rsi14), 'rsi', RSI_PARAMS, ohlcv, ['rsi', 'overbought', 'oversold']);
    expectGolden(G(rsi_flat), 'rsi', RSI_PARAMS, flatBars, ['rsi']);
    expectGolden(G(rsi_noloss), 'rsi', RSI_PARAMS, risingBars, ['rsi']);
    const flat = service.calculate('rsi', RSI_PARAMS, flatBars)['rsi'].filter((v): v is number => v !== null);
    expect(flat.length).toBeGreaterThan(0);
    expect(flat.every((v) => Math.abs(v - 50) < TOL)).toBe(true);
    const rising = service.calculate('rsi', RSI_PARAMS, risingBars)['rsi'].filter((v): v is number => v !== null);
    expect(rising.length).toBeGreaterThan(0);
    expect(rising.every((v) => Math.abs(v - 100) < TOL)).toBe(true);
  });

  it('atr: true range + RMA/SMA smoothing match Python within 1e-6', () => {
    expectGolden(G(atr14_rma), 'atr', { length: 14, smoothing: 'RMA' }, ohlcv, ['atr']);
    expectGolden(G(atr14_sma), 'atr', { length: 14, smoothing: 'SMA' }, ohlcv, ['atr']);
  });

  it('webby_rsi: 5.150 + Original modes match Python within 1e-6', () => {
    expectGolden(G(webby_rsi_5150), 'webby_rsi',
      { mode: '5.150', ema_length: 21, sma_length: 10, atr_length: 50, stretched_level: 3 }, ohlcv,
      ['above_21', 'below_21', 'sma_extension', 'stretched']);
    expectGolden(G(webby_rsi_original), 'webby_rsi',
      { mode: 'Original', ema_length: 21, signal_length: 10, positive_only: true }, ohlcv,
      ['webby', 'signal', 'level_0', 'level_05', 'level_2', 'level_4', 'level_6']);
  });

  it('bob_marley: off-high ATR zones match Python within 1e-6', () => {
    expectGolden(G(bob_marley_52w), 'bob_marley',
      { high_reference: '52_week', source: 'low', atr_length: 21, green_max: 4, yellow_max: 8 }, ohlcv,
      ['green', 'yellow', 'red', 'green_boundary', 'red_boundary']);
  });

  it('EDGE: SMA window > data length → no values (warmup guard)', () => {
    const r = service.calculate('moving_average', { method: 'SMA', length: 50 }, ohlcv.slice(0, 10));
    expect(r['ma'].length).toBe(10);
    expect(r['ma'].every((v) => v === null)).toBe(true);
  });

  it('EDGE: insufficient bars for RSI warmup → RSI all null', () => {
    const r = service.calculate('rsi', RSI_PARAMS, ohlcv.slice(0, 10));
    expect(r['rsi'].every((v) => v === null)).toBe(true);
  });

  it('EDGE: empty input → empty outputs for every indicator (no crash)', () => {
    for (const def of service.supportedIndicators()) {
      const r: IndicatorOutputs = service.calculate(def.id, {}, []);
      for (const series of Object.values(r)) expect(series.length).toBe(0);
    }
  });

  it('EDGE: MA offset shifts forward and yields nulls at the head', () => {
    const base = service.calculate('moving_average', { method: 'SMA', length: 5 }, ohlcv)['ma'];
    const shifted = service.calculate('moving_average', { method: 'SMA', length: 5, offset: 3 }, ohlcv)['ma'];
    expect(shifted.slice(0, 7).every((v) => v === null)).toBe(true);
    expect(shifted[10]).toBeCloseTo(base[7] as number, 9);
  });

  it('EDGE: volume source works (MA of volume)', () => {
    const r = service.calculate('moving_average', { method: 'SMA', source: 'volume', length: 2 }, ohlcv);
    expect(r['ma'][1]).toBeCloseTo((ohlcv[0].volume + ohlcv[1].volume) / 2, 3);
  });

  it('ERRORS: unknown indicator / source / method throw', () => {
    expect(() => service.calculate('nope', {}, ohlcv)).toThrowError(/Unknown indicator/);
    expect(() => service.calculate('rsi', { source: 'bogus' }, ohlcv)).toThrowError(/Unsupported indicator source/);
    expect(() => service.calculate('moving_average', { method: 'XMA' }, ohlcv)).toThrowError(/Unsupported moving average/);
  });

  it('REGISTRY: supportedIndicators mirrors registry.py (sorted by category,name)', () => {
    const list = service.supportedIndicators();
    expect(list.map((i) => i.id)).toEqual(expect.arrayContaining(['moving_average', 'atr', 'rsi', 'webby_rsi', 'bob_marley']));
    const sorted = [...list].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    expect(list.map((i) => i.id)).toEqual(sorted.map((i) => i.id));
  });

  it('REGISTRY: normalizeParams fills defaults without overwriting; displayName uses template', () => {
    expect(service.normalizeParams('moving_average', { length: 20 })).toEqual({ method: 'SMA', source: 'close', length: 20, offset: 0 });
    expect(service.displayName('moving_average', { length: 20, method: 'EMA' })).toBe('EMA 20 close');
    expect(service.displayName('rsi')).toBe('RSI 14');
  });
});
