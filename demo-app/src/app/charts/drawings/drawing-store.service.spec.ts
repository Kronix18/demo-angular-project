import { TestBed } from '@angular/core/testing';
import { DrawingStore } from './drawing-store.service';
import { Drawing } from './drawing-geometry';

const d = (id: string, extra: Partial<Drawing> = {}): Drawing => ({ id, type: 'trend', a: { t: 1, p: 10 }, b: { t: 2, p: 20 }, ...extra });

describe('DrawingStore (10.3)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
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

  it('accepts the new drawing types with their payloads and drops malformed ones', () => {
    sessionStorage.setItem('chart-drawings', JSON.stringify({ msft: [
      { id: '1', type: 'hline', a: { t: 1, p: 5 } },
      { id: '2', type: 'text', a: { t: 1, p: 5 }, text: 'hello', style: { color: '#fff', width: 2, dash: 'dot', junk: 1 } },
      { id: '3', type: 'brush', a: { t: 1, p: 1 }, pts: [{ t: 1, p: 1 }, { t: 2, p: 2 }] },
      { id: '4', type: 'brush', a: { t: 1, p: 1 }, pts: [{ t: 'x' }] },
      { id: '5', type: 'fib', a: { t: 1, p: 1 }, b: { t: 2, p: 2 } },
      { id: '6', type: 'wat', a: { t: 1, p: 1 } },
      { id: '7', type: 'rect', a: { t: 1, p: 1 }, b: { t: 2, p: 2 }, text: 5 },
    ] }));
    const list = make().list('msft');
    expect(list.map((d) => d.id)).toEqual(['1', '2', '3', '5']);
    expect(list[1].text).toBe('hello');
    expect(list[1].style).toEqual({ color: '#fff', width: 2, dash: 'dot' });
    expect(list[2].pts!.length).toBe(2);
  });

  it('lock + hide flags persist, default off, and are independent of symbol', () => {
    const s = make();
    expect(s.locked()).toBe(false);
    expect(s.hidden()).toBe(false);
    s.toggleLocked();
    s.toggleHidden();
    expect(s.locked()).toBe(true);
    expect(s.hidden()).toBe(true);
    TestBed.resetTestingModule();
    const again = make();
    expect(again.locked()).toBe(true);
    expect(again.hidden()).toBe(true);
    again.setHidden(false);
    expect(again.hidden()).toBe(false);
    expect(again.revision()).toBeGreaterThan(0);
  });

  describe('undo / redo (11.10)', () => {
    const h = (id: string, price = 10) => ({ id, type: 'hline' as const, a: { t: 1, p: price } });

    it('undo steps back through add / remove / clear and redo replays them, per symbol', () => {
      const st = new DrawingStore();
      expect(st.canUndo('msft')).toBe(false);
      st.add('msft', h('a'));
      st.add('msft', h('b'));
      st.add('aapl', h('z'));
      st.remove('msft', 'a');
      expect(st.list('msft').map((d) => d.id)).toEqual(['b']);
      expect(st.undo('msft')).toBe(true);
      expect(st.list('msft').map((d) => d.id)).toEqual(['a', 'b']);
      expect(st.undo('msft')).toBe(true);
      expect(st.list('msft').map((d) => d.id)).toEqual(['a']);
      expect(st.list('aapl').map((d) => d.id)).toEqual(['z']); // other symbols are untouched
      expect(st.canRedo('msft')).toBe(true);
      expect(st.redo('msft')).toBe(true);
      expect(st.list('msft').map((d) => d.id)).toEqual(['a', 'b']);
      st.clear('msft');
      expect(st.undo('msft')).toBe(true);
      expect(st.list('msft').length).toBe(2);
    });

    it('a new change clears the redo stack; undo / redo on an empty history do nothing', () => {
      const st = new DrawingStore();
      expect(st.undo('msft')).toBe(false);
      expect(st.redo('msft')).toBe(false);
      st.add('msft', h('a'));
      st.undo('msft');
      st.add('msft', h('b'));
      expect(st.canRedo('msft')).toBe(false);
    });

    it('a drag (many quick updates of one drawing) is one undo step', () => {
      const st = new DrawingStore();
      st.add('msft', h('a', 10));
      for (let p = 11; p <= 20; p++) st.update('msft', h('a', p));
      expect(st.list('msft')[0].a.p).toBe(20);
      st.undo('msft');
      expect(st.list('msft')[0].a.p).toBe(10);
      st.undo('msft');
      expect(st.list('msft')).toEqual([]);
    });

    it('history is capped', () => {
      const st = new DrawingStore();
      for (let i = 0; i < 300; i++) st.add('msft', h(`d${i}`));
      let n = 0;
      while (st.undo('msft')) n++;
      expect(n).toBe(100);
    });
  });

  describe('per-drawing state and z-order (11.12)', () => {
    const h = (id: string) => ({ id, type: 'hline' as const, a: { t: 1, p: 10 } });

    it('locked / hidden flags and the anchored-text position survive persistence; junk is dropped', () => {
      const st = new DrawingStore();
      st.add('msft', { ...h('a'), locked: true, hidden: true });
      st.add('msft', { id: 't', type: 'anchoredtext', a: { t: 1, p: 1 }, text: 'x', view: { x: 0.2, y: 0.3 } });
      const again = new DrawingStore();
      expect(again.list('msft')[0]).toMatchObject({ locked: true, hidden: true });
      expect(again.list('msft')[1].view).toEqual({ x: 0.2, y: 0.3 });
      sessionStorage.setItem('chart-drawings', JSON.stringify({ msft: [{ ...h('b'), locked: 'yes', view: { x: 'a' } }] }));
      const clean = new DrawingStore().list('msft')[0];
      expect(clean.locked).toBeUndefined();
      expect(clean.view).toBeUndefined();
    });

    it('move() reorders: front, back, forward, backward (and is undoable)', () => {
      const st = new DrawingStore();
      for (const id of ['a', 'b', 'c']) st.add('msft', h(id));
      const order = () => st.list('msft').map((d) => d.id);
      st.move('msft', 'a', 'front');
      expect(order()).toEqual(['b', 'c', 'a']);
      st.move('msft', 'a', 'backward');
      expect(order()).toEqual(['b', 'a', 'c']);
      st.move('msft', 'c', 'back');
      expect(order()).toEqual(['c', 'b', 'a']);
      st.move('msft', 'c', 'forward');
      expect(order()).toEqual(['b', 'c', 'a']);
      st.move('msft', 'a', 'front'); // already there: no-op, no history entry
      st.undo('msft');
      expect(order()).toEqual(['b', 'a', 'c']);
    });

    it('exportAll / importAll round-trip every symbol (used by layouts)', () => {
      const st = new DrawingStore();
      st.add('msft', h('a'));
      st.add('nvda', h('b'));
      const dump = st.exportAll();
      st.clear('msft');
      st.importAll(dump);
      expect(st.list('msft').map((d) => d.id)).toEqual(['a']);
      expect(st.list('nvda').map((d) => d.id)).toEqual(['b']);
      st.importAll({ bad: 'x' } as any);
      expect(st.list('msft')).toEqual([]);
    });
  });
});
