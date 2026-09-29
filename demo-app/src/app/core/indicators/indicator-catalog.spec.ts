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
});
