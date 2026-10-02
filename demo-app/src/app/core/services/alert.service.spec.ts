import { AlertService } from './alert.service';

describe('AlertService (11.15)', () => {
  beforeEach(() => localStorage.clear());

  it('adds, lists per symbol, removes, and persists', () => {
    const a = new AlertService();
    const x = a.add('MSFT', 500)!;
    a.add('nvda', 100);
    expect(a.add('msft', -3)).toBeNull();
    expect(a.add('msft', NaN)).toBeNull();
    expect(a.forSymbol('msft').map((i) => i.price)).toEqual([500]);
    expect(new AlertService().list().length).toBe(2);
    a.remove(x.id);
    expect(a.forSymbol('msft')).toEqual([]);
    expect(new AlertService().list().length).toBe(1);
  });

  it('triggers when the price crosses the level between two closes (either direction), once', () => {
    const a = new AlertService();
    a.add('msft', 100);
    expect(a.evaluate('msft', 90, 99)).toEqual([]);
    const hit = a.evaluate('msft', 99, 101);
    expect(hit.map((i) => i.price)).toEqual([100]);
    expect(a.forSymbol('msft')[0].triggered).toBe(true);
    expect(a.evaluate('msft', 101, 99)).toEqual([]); // already triggered
    a.add('msft', 50);
    expect(a.evaluate('msft', 60, 40).length).toBe(1); // downwards
    expect(a.evaluate('nvda', 0, 1000)).toEqual([]); // other symbols untouched
  });

  it('touching the level exactly counts; a price that stays on one side does not', () => {
    const a = new AlertService();
    a.add('msft', 100);
    expect(a.evaluate('msft', 95, 96)).toEqual([]);
    expect(a.evaluate('msft', 95, 100).length).toBe(1);
  });

  it('re-arm and clearing triggered alerts', () => {
    const a = new AlertService();
    const x = a.add('msft', 100)!;
    a.evaluate('msft', 99, 101);
    a.rearm(x.id);
    expect(a.forSymbol('msft')[0].triggered).toBe(false);
    a.evaluate('msft', 99, 101);
    a.clearTriggered();
    expect(a.list()).toEqual([]);
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem('alerts', '[{"id":1},"x",{"id":"a","symbol":"msft","price":10,"triggered":false}]');
    expect(new AlertService().list().map((i) => i.id)).toEqual(['a']);
    localStorage.setItem('alerts', 'not json');
    expect(new AlertService().list()).toEqual([]);
  });
});
