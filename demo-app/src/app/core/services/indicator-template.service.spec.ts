import { IndicatorTemplateService } from './indicator-template.service';

describe('IndicatorTemplateService (11.17)', () => {
  beforeEach(() => localStorage.clear());

  it('saves a named set of indicators with their settings; the same name overwrites; persists', () => {
    const t = new IndicatorTemplateService();
    expect(t.save('Trend', [{ type: 'sma', period: 50, params: { length: 50 }, styles: { ma: { color: '#112233' } } }, { type: 'rsi', period: 14 }])).toBe(true);
    t.save('Trend', [{ type: 'ema', period: 21 }]);
    t.save('Mom', [{ type: 'rsi', period: 14 }]);
    expect(t.list().map((x) => x.name)).toEqual(['Trend', 'Mom']);
    expect(t.list()[0].indicators).toEqual([{ type: 'ema', period: 21 }]);
    expect(new IndicatorTemplateService().list().length).toBe(2);
  });

  it('needs a name and at least one indicator; remove works; corrupt storage is ignored', () => {
    const t = new IndicatorTemplateService();
    expect(t.save('  ', [{ type: 'sma', period: 5 }])).toBe(false);
    expect(t.save('Empty', [])).toBe(false);
    t.save('A', [{ type: 'sma', period: 5 }]);
    t.remove('A');
    expect(t.list()).toEqual([]);
    localStorage.setItem('indicator-templates', '[{"name":"x","indicators":[{"nope":1}]},{"name":"ok","indicators":[{"type":"sma","period":3}]}]');
    expect(new IndicatorTemplateService().list().map((x) => x.name)).toEqual(['ok']);
  });
});
