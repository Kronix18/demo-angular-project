import { LayoutService } from './layout.service';
import { defaultView } from '../models/view-settings';

const state = (symbol: string): any => ({ symbol, interval: '1d', range: '6M', indicators: [{ type: 'sma', period: 20 }], chartType: 'candles', magnet: false, logScale: false,
  percentScale: false, invertScale: false, view: defaultView(), compare: [], price: {}, volume: {} });
const drawings = { msft: [{ id: 'a', type: 'hline', a: { t: 1, p: 10 } }] } as any;

describe('LayoutService (11.17)', () => {
  beforeEach(() => localStorage.clear());

  it('saves named layouts (chart state + every symbol\'s drawings), overwrites the same name, lists them, persists', () => {
    const l = new LayoutService();
    l.save('Main', state('msft'), drawings);
    l.save('Tech', state('nvda'), {});
    l.save(' Main ', state('qqq'), drawings); // same name: overwritten
    expect(l.list().map((x) => x.name)).toEqual(['Main', 'Tech']);
    expect(l.get('Main')!.state.symbol).toBe('qqq');
    expect(l.get('Main')!.drawings['msft'].length).toBe(1);
    expect(new LayoutService().list().length).toBe(2);
    expect(l.save('   ', state('msft'), {})).toBe(false);
  });

  it('remove and rename; the current layout name is remembered', () => {
    const l = new LayoutService();
    l.save('A', state('msft'), {});
    l.save('B', state('nvda'), {});
    expect(l.rename('A', 'C')).toBe(true);
    expect(l.rename('B', 'C')).toBe(false); // taken
    expect(l.list().map((x) => x.name)).toEqual(['C', 'B']);
    l.setCurrent('C');
    expect(new LayoutService().current()).toBe('C');
    l.remove('C');
    expect(l.list().map((x) => x.name)).toEqual(['B']);
    expect(l.current()).toBe(''); // the removed layout is no longer current
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem('layouts', '[{"name":1},{"name":"ok","state":{"symbol":"msft"},"drawings":{}},"x"]');
    expect(new LayoutService().list().map((x) => x.name)).toEqual(['ok']);
    localStorage.setItem('layouts', '{{');
    expect(new LayoutService().list()).toEqual([]);
  });
});
