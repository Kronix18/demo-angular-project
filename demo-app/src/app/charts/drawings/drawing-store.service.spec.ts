import { TestBed } from '@angular/core/testing';
import { DrawingStore } from './drawing-store.service';
import { Drawing } from './drawing-geometry';

const d = (id: string, extra: Partial<Drawing> = {}): Drawing => ({ id, type: 'trend', a: { t: 1, p: 10 }, b: { t: 2, p: 20 }, ...extra });

describe('DrawingStore (10.3)', () => {
  beforeEach(() => sessionStorage.clear());
  const make = () => TestBed.inject(DrawingStore);

  it('keeps drawings per symbol (case-insensitive) and persists them in sessionStorage', () => {
    const s = make();
    s.add('MSFT', d('1'));
    s.add('nvda', d('2'));
    expect(s.list('msft').map((x) => x.id)).toEqual(['1']);
    expect(s.list('NVDA').map((x) => x.id)).toEqual(['2']);
    TestBed.resetTestingModule();
    expect(make().list('msft').map((x) => x.id)).toEqual(['1']); // survives a reload
  });

  it('update / remove / clear affect only the given symbol; unknown ids are ignored', () => {
    const s = make();
    s.add('msft', d('1'));
    s.add('msft', d('2'));
    s.add('qqq', d('3'));
    s.update('msft', d('1', { b: { t: 5, p: 50 } }));
    expect(s.list('msft')[0].b).toEqual({ t: 5, p: 50 });
    s.update('msft', d('nope'));
    s.remove('msft', '2');
    s.remove('msft', 'nope');
    expect(s.list('msft').map((x) => x.id)).toEqual(['1']);
    s.clear('msft');
    expect(s.list('msft')).toEqual([]);
    expect(s.list('qqq').length).toBe(1);
  });

  it('revision changes on every mutation (drives re-render); list returns a stable snapshot', () => {
    const s = make();
    const r0 = s.revision();
    s.add('msft', d('1'));
    expect(s.revision()).toBeGreaterThan(r0);
    expect(s.list('msft')).toBe(s.list('msft'));
  });

  it('ignores corrupt storage', () => {
    sessionStorage.setItem('chart-drawings', '{not json');
    expect(make().list('msft')).toEqual([]);
    TestBed.resetTestingModule();
    sessionStorage.setItem('chart-drawings', JSON.stringify({ msft: [{ id: 'x' }, d('ok'), null] }));
    expect(make().list('msft').map((x) => x.id)).toEqual(['ok']);
  });
});
