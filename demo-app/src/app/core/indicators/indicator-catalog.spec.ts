import { INDICATOR_CATALOG, catalogItem, resolveEntry } from './indicator-catalog';

describe('indicator catalog (5.2) — state entry → calculation + placement', () => {
  it('classifies moving averages as overlays and oscillators/volatility as panes', () => {
    expect(resolveEntry({ type: 'sma', period: 20 }).kind).toBe('overlay');
    expect(resolveEntry({ type: 'ema', period: 21 }).kind).toBe('overlay');
    for (const t of ['rsi', 'atr', 'webby_rsi', 'bob_marley']) {
      expect(resolveEntry({ type: t, period: 14 }).kind).toBe('pane');
    }
  });

  it('maps sma/ema entries onto the moving_average calculator with method + length', () => {
    const r = resolveEntry({ type: 'ema', period: 21 });
    expect(r.definitionId).toBe('moving_average');
    expect(r.params).toEqual({ method: 'EMA', source: 'close', length: 21 });
  });

  it('maps rsi/atr period onto length; webby/bob use their defaults', () => {
    expect(resolveEntry({ type: 'rsi', period: 9 }).params['length']).toBe(9);
    expect(resolveEntry({ type: 'atr', period: 10 }).params['length']).toBe(10);
    expect(resolveEntry({ type: 'webby_rsi', period: 0 }).params).toEqual({});
  });

  it('labels entries for the legend', () => {
    expect(resolveEntry({ type: 'sma', period: 20 }).label).toBe('SMA 20');
    expect(resolveEntry({ type: 'rsi', period: 14 }).label).toBe('RSI 14');
    expect(resolveEntry({ type: 'bob_marley', period: 0 }).label).toBe('Bob Marley');
  });

  it('unknown types throw; catalog exposes every addable type once', () => {
    expect(() => resolveEntry({ type: 'nope', period: 1 })).toThrowError(/Unknown indicator type/);
    const types = INDICATOR_CATALOG.map((c) => c.type);
    expect(new Set(types).size).toBe(types.length);
    expect(catalogItem('sma')?.defaultPeriod).toBe(20);
  });

  it('wma/rma are moving-average overlays with their method', () => {
    expect(resolveEntry({ type: 'wma', period: 10 }).params).toEqual({ method: 'WMA', source: 'close', length: 10 });
    expect(resolveEntry({ type: 'rma', period: 14 }).kind).toBe('overlay');
  });

  it('entry params override the catalog defaults and drive the label (SMA switched to EMA reads "EMA 34")', () => {
    const r = resolveEntry({ type: 'sma', period: 20, params: { method: 'EMA', length: 34, source: 'hl2' } });
    expect(r.params).toMatchObject({ method: 'EMA', length: 34, source: 'hl2' });
    expect(r.label).toBe('EMA 34');
    expect(resolveEntry({ type: 'rsi', period: 14, params: { length: 9 } }).label).toBe('RSI 9');
  });

  it('carries per-output styles and per-interval visibility through', () => {
    const r = resolveEntry({ type: 'rsi', period: 14, styles: { rsi: { color: '#ff0000', width: 3, dash: 'dot', visible: true } }, intervals: ['1d'] });
    expect(r.styles['rsi']).toEqual({ color: '#ff0000', width: 3, dash: 'dot', visible: true });
    expect(r.visibleOn('1d')).toBe(true);
    expect(r.visibleOn('1w')).toBe(false);
    expect(resolveEntry({ type: 'rsi', period: 14 }).visibleOn('1w')).toBe(true); // no restriction = every timeframe
  });

  it('catalog items know their category and a description for the picker', () => {
    for (const c of INDICATOR_CATALOG) {
      expect(c.category.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(10);
    }
    expect(catalogItem('rsi')!.category).toBe('Momentum');
    expect(catalogItem('sma')!.category).toBe('Trend');
  });
});
