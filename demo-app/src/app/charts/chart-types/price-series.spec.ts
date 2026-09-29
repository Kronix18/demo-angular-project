import { buildPriceSeries, PriceStyleCtx } from './price-series';
import { LodPoint } from '../chart-lod';

const ctx = (over: Partial<PriceStyleCtx> = {}): PriceStyleCtx => ({
  up: '#00aa00', down: '#aa0000', muted: '#888888', upFill: '#00aa0044', downFill: '#aa000044', line: '#0000aa', area: '#0000aa22', baseline: 100, box: 1, ...over,
});
const pt = (o: Partial<LodPoint> = {}): LodPoint => ({ x: 0, i: 0, n: 1, t: 1, o: 100, h: 112, l: 96, c: 104, v: 10, up: true, upPc: false, ...o });

describe('price series settings (11.6)', () => {
  it('by default candle colours are static up/down objects and points carry no direction', () => {
    const [s] = buildPriceSeries('candles', ctx());
    expect(s.dataset.backgroundColors).toEqual({ up: '#00aa00', down: '#aa0000', unchanged: '#888888' });
    expect(s.builder([pt()])[0].dir).toBeUndefined();
  });

  it('"colour based on previous close": the direction comes from the previous close, not the open', () => {
    const [s] = buildPriceSeries('candles', ctx({ byPrevClose: true }));
    const dirs = s.builder([pt({ up: true, upPc: false }), pt({ up: false, upPc: true })]).map((p: any) => p.dir);
    expect(dirs).toEqual(['down', 'up']); // green-by-open candle that closed below the previous close is red
    const bg = s.dataset.backgroundColors as (c: any) => any;
    expect(bg({ raw: { dir: 'down' } })).toEqual({ up: '#aa0000', down: '#aa0000', unchanged: '#aa0000' });
    expect(bg({ raw: { dir: 'up' } })).toEqual({ up: '#00aa00', down: '#00aa00', unchanged: '#00aa00' });
    const bc = s.dataset.borderColors as (c: any) => any;
    expect(bc({ raw: { dir: 'up' } }).down).toBe('#00aa00');
  });

  it('hollow candles stay hollow for rising bars when colouring by previous close', () => {
    const [s] = buildPriceSeries('hollow', ctx({ byPrevClose: true }));
    expect((s.dataset.backgroundColors as any)({ raw: { dir: 'up' } }).up).toBe('transparent');
  });

  it('bars (OHLC / HLC / high-low) honour previous-close colouring and width', () => {
    const [s] = buildPriceSeries('ohlc', ctx({ byPrevClose: true, width: 3 }));
    expect(s.dataset.lineWidth).toBe(3);
    expect((s.dataset.borderColors as any)({ raw: { dir: 'down' } }).up).toBe('#aa0000');
  });

  it('width applies to candle borders/wicks and to line styles; source picks the line input', () => {
    expect(buildPriceSeries('candles', ctx({ width: 2 }))[0].dataset.borderWidth).toBe(2);
    expect(buildPriceSeries('line', ctx({ width: 4 }))[0].dataset.borderWidth).toBe(4);
    const line = buildPriceSeries('line', ctx({ source: 'hlc3' }))[0];
    expect(line.builder([pt()])[0].y).toBeCloseTo((112 + 96 + 104) / 3, 6);
    expect(buildPriceSeries('area', ctx({ source: 'open' }))[0].builder([pt()])[0].y).toBe(100);
    expect(buildPriceSeries('area', ctx({ source: 'ohlc4' }))[0].builder([pt()])[0].y).toBeCloseTo((100 + 112 + 96 + 104) / 4, 6);
    expect(buildPriceSeries('line', ctx({ source: 'hl2' }))[0].builder([pt()])[0].y).toBe(104);
    expect(buildPriceSeries('line', ctx({ source: 'high' }))[0].builder([pt()])[0].y).toBe(112);
    expect(buildPriceSeries('line', ctx({ source: 'low' }))[0].builder([pt()])[0].y).toBe(96);
  });

  it('a chosen line colour replaces the theme line colour', () => {
    expect(buildPriceSeries('line', ctx({ line: '#ff00ff' }))[0].dataset.borderColor).toBe('#ff00ff');
  });

  it('columns follow previous-close colouring too', () => {
    const [s] = buildPriceSeries('columns', ctx({ byPrevClose: true }));
    const raw = s.builder([pt({ up: true, upPc: false })])[0];
    expect((s.dataset.backgroundColor as any)({ raw })).toBe('#aa0000');
  });
});
