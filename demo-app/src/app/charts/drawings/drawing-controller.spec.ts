import { OHLCV } from '../../core/models/ohlcv.model';
import { DrawingController, Tool } from './drawing-controller';
import { DrawingStore } from './drawing-store.service';

const DAY = 86_400_000;
const bars: OHLCV[] = Array.from({ length: 50 }, (_, i) => ({ timestamp: 1_000_000 + i * DAY, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }));

/** Fake chart: x pixel = index * 10, y pixel = 200 - price. Price pane = y 0..200. */
const fakeChart = () => {
  const x = { getPixelForValue: (v: number) => v * 10, getValueForPixel: (px: number) => px / 10, left: 0, right: 490 };
  const y = { getPixelForValue: (v: number) => 200 - v, getValueForPixel: (px: number) => 200 - px, top: 0, bottom: 200 };
  return { scales: { x, y }, chartArea: { left: 0, right: 490, top: 0, bottom: 260 }, draw: vi.fn(), options: { plugins: { zoom: { pan: { enabled: true } } } }, update: vi.fn() } as any;
};

describe('DrawingController (10.3)', () => {
  let store: DrawingStore;
  let chart: ReturnType<typeof fakeChart>;
  let tool: Tool;
  let changes: number;
  let ctl: DrawingController;
  let zooms: any[];
  let edits: string[];
  let committed: string[];
  let magnet: boolean;

  beforeEach(() => {
    sessionStorage.clear();
    store = new DrawingStore();
    chart = fakeChart();
    tool = 'cursor';
    changes = 0;
    zooms = []; edits = []; committed = []; magnet = false;
    localStorage.clear();
    ctl = new DrawingController({
      chart: () => chart, bars: () => bars, store, symbol: () => 'msft', tool: () => tool, changed: () => changes++,
      magnet: () => magnet, zoomTo: (r) => zooms.push(r), editText: (id) => edits.push(id), committed: (d) => committed.push(d.type),
    });
  });

  it('trend tool: drag from A to B creates a trend line at the right time/price anchors', () => {
    tool = 'trend';
    ctl.pointerDown(100, 100);   // bar 10, price 100
    ctl.pointerMove(300, 60);    // bar 30, price 140
    expect(store.list('msft').length).toBe(0); // still a draft
    expect(ctl.view().draft).toBeTruthy();
    ctl.pointerUp(300, 60);
    const [d] = store.list('msft');
    expect(d.type).toBe('trend');
    expect(d.a).toEqual({ t: bars[10].timestamp, p: 100 });
    expect(d.b).toEqual({ t: bars[30].timestamp, p: 140 });
    expect(ctl.view().draft).toBeNull();
    expect(ctl.view().selectedId).toBe(d.id);
  });

  it('a click without drag with the trend tool creates nothing', () => {
    tool = 'trend';
    ctl.pointerDown(100, 100);
    ctl.pointerUp(101, 100);
    expect(store.list('msft')).toEqual([]);
  });

  it('ray tool: one click places a horizontal ray at that price', () => {
    tool = 'ray';
    ctl.pointerDown(120, 80);
    ctl.pointerUp(120, 80);
    const [d] = store.list('msft');
    expect(d.type).toBe('ray');
    expect(d.a.p).toBe(120);
    expect(d.b).toBeUndefined();
  });

  it('channel tool: drag defines the base line, next click sets the parallel offset', () => {
    tool = 'channel';
    ctl.pointerDown(100, 100);
    ctl.pointerMove(300, 100);
    ctl.pointerUp(300, 100);
    expect(store.list('msft')).toEqual([]);           // phase 2: waiting for the third point
    expect(ctl.view().draft?.type).toBe('channel');
    ctl.pointerMove(200, 60);                          // 40px above the base line at that x
    ctl.pointerDown(200, 60);
    ctl.pointerUp(200, 60);
    const [d] = store.list('msft');
    expect(d.type).toBe('channel');
    expect(d.offset).toBe(40);
    expect(ctl.view().draft).toBeNull();
  });

  it('drawing is limited to the price pane (clicks in volume/indicator panes are ignored)', () => {
    tool = 'trend';
    ctl.pointerDown(100, 230); // below the price pane (y > 200)
    ctl.pointerMove(200, 240);
    ctl.pointerUp(200, 240);
    expect(store.list('msft')).toEqual([]);
  });

  it('cursor tool: click selects the nearest drawing, click elsewhere deselects; Delete removes the selection', () => {
    tool = 'trend';
    ctl.pointerDown(100, 100); ctl.pointerMove(300, 100); ctl.pointerUp(300, 100);
    tool = 'cursor';
    ctl.pointerDown(200, 250); ctl.pointerUp(200, 250);
    expect(ctl.view().selectedId).toBeNull();
    ctl.pointerDown(200, 103); ctl.pointerUp(200, 103); // 3px from the line
    const id = store.list('msft')[0].id;
    expect(ctl.view().selectedId).toBe(id);
    ctl.key('Delete');
    expect(store.list('msft')).toEqual([]);
    expect(ctl.view().selectedId).toBeNull();
  });

  it('dragging a handle moves that endpoint; dragging the body moves the whole line', () => {
    tool = 'trend';
    ctl.pointerDown(100, 100); ctl.pointerMove(300, 100); ctl.pointerUp(300, 100);
    tool = 'cursor';
    ctl.pointerDown(300, 100); ctl.pointerMove(300, 60); ctl.pointerUp(300, 60); // grab endpoint B
    let d = store.list('msft')[0];
    expect(d.a.p).toBe(100);
    expect(d.b!.p).toBe(140);
    ctl.pointerDown(200, 80); ctl.pointerMove(220, 100); ctl.pointerUp(220, 100); // grab the body, move +2 bars, -20px
    d = store.list('msft')[0];
    expect(d.a.t).toBe(bars[12].timestamp);
    expect(d.a.p).toBe(80);
    expect(d.b!.t).toBe(bars[32].timestamp);
  });

  it('Escape cancels a draft and returns; unknown keys are ignored', () => {
    tool = 'trend';
    ctl.pointerDown(100, 100);
    ctl.pointerMove(200, 100);
    ctl.key('Escape');
    expect(ctl.view().draft).toBeNull();
    ctl.pointerUp(200, 100);
    expect(store.list('msft')).toEqual([]);
    ctl.key('a');
  });

  it('pan is disabled while a drawing tool is active and restored for the cursor', () => {
    tool = 'trend';
    ctl.syncPan();
    expect(chart.options.plugins.zoom.pan.enabled).toBe(false);
    tool = 'cursor';
    ctl.syncPan();
    expect(chart.options.plugins.zoom.pan.enabled).toBe(true);
  });

  it('view() carries this symbol\'s drawings so the plugin can render them', () => {
    tool = 'ray';
    ctl.pointerDown(120, 80); ctl.pointerUp(120, 80);
    expect(ctl.view().drawings.length).toBe(1);
    expect(changes).toBeGreaterThan(0);
  });

  describe('more tools (11.5)', () => {
    const drag = (a: [number, number], b: [number, number], mid?: [number, number]) => {
      ctl.pointerDown(...a);
      if (mid) ctl.pointerMove(...mid);
      ctl.pointerMove(...b);
      ctl.pointerUp(...b);
    };

    it('hline / vline: one click; hline keeps the price, vline the time', () => {
      tool = 'hline';
      ctl.pointerDown(120, 80); ctl.pointerUp(120, 80);
      tool = 'vline';
      ctl.pointerDown(200, 80); ctl.pointerUp(200, 80);
      const [h, v] = store.list('msft');
      expect([h.type, h.a.p]).toEqual(['hline', 120]);
      expect([v.type, v.a.t]).toEqual(['vline', bars[20].timestamp]);
      expect(committed).toEqual(['hline', 'vline']);
    });

    it('two-point shapes (arrow, rect, ellipse, fib) are created by dragging', () => {
      for (const t of ['arrow', 'rect', 'ellipse', 'fib'] as const) {
        tool = t;
        drag([100, 100], [300, 40], [200, 70]);
      }
      expect(store.list('msft').map((d) => d.type)).toEqual(['arrow', 'rect', 'ellipse', 'fib']);
      const rect = store.list('msft')[1];
      expect(rect.a).toEqual({ t: bars[10].timestamp, p: 100 });
      expect(rect.b).toEqual({ t: bars[30].timestamp, p: 160 });
    });

    it('brush collects the dragged path (thinned) and needs at least two points', () => {
      tool = 'brush';
      ctl.pointerDown(100, 100);
      for (let x = 105; x <= 200; x += 5) ctl.pointerMove(x, 100 - (x - 100) / 5);
      ctl.pointerUp(200, 80);
      const [b] = store.list('msft');
      expect(b.type).toBe('brush');
      expect(b.pts!.length).toBeGreaterThan(5);
      expect(b.pts![0].p).toBe(100);
      ctl.pointerDown(100, 100); ctl.pointerUp(100, 100); // a click is not a stroke
      expect(store.list('msft').length).toBe(1);
    });

    it('text: a click creates an empty label and asks the viewer to edit it; empty text is discarded by removeIfEmpty', () => {
      tool = 'text';
      ctl.pointerDown(150, 60); ctl.pointerUp(150, 60);
      const [t] = store.list('msft');
      expect(t.type).toBe('text');
      expect(edits).toEqual([t.id]);
      ctl.setText(t.id, 'support');
      expect(store.list('msft')[0].text).toBe('support');
      ctl.setText(t.id, '   ');
      expect(store.list('msft')).toEqual([]); // blank text removes the label
    });

    it('measure: transient readout that is never stored; the next press clears it', () => {
      tool = 'measure';
      drag([100, 100], [300, 60]);
      expect(store.list('msft')).toEqual([]);
      const m = ctl.view().measure!;
      expect(m.a.p).toBe(100);
      expect(m.b.p).toBe(140);
      ctl.pointerDown(50, 50);
      expect(ctl.view().measure).toBeNull();
    });

    it('zoom tool: dragging a rectangle asks the viewer to zoom to that (ordered) region and stores nothing', () => {
      tool = 'zoom';
      drag([300, 60], [100, 120]);
      expect(store.list('msft')).toEqual([]);
      expect(zooms.length).toBe(1);
      expect(zooms[0].x0).toBeCloseTo(10);
      expect(zooms[0].x1).toBeCloseTo(30);
      expect(zooms[0].p0).toBe(80);
      expect(zooms[0].p1).toBe(140);
    });

    it('a rectangle smaller than a few pixels does not zoom', () => {
      tool = 'zoom';
      drag([300, 60], [301, 61]);
      expect(zooms).toEqual([]);
    });

    it('magnet snaps drawing anchors to the nearest open/high/low/close of the bar', () => {
      magnet = true;
      tool = 'trend';
      drag([100, 100], [300, 60]);
      const [d] = store.list('msft');
      expect([0.5, 1, 1.5, 2]).toContain(d.a.p);
      expect([0.5, 1, 1.5, 2]).toContain(d.b!.p);
    });

    it('cursor selects the new shapes by their outline: rect edge, hline, vline, brush, text box', () => {
      store.add('msft', { id: 'r', type: 'rect', a: { t: bars[10].timestamp, p: 100 }, b: { t: bars[30].timestamp, p: 150 } });
      store.add('msft', { id: 'h', type: 'hline', a: { t: bars[5].timestamp, p: 30 } });
      store.add('msft', { id: 'v', type: 'vline', a: { t: bars[40].timestamp, p: 30 } });
      store.add('msft', { id: 'b', type: 'brush', a: { t: bars[2].timestamp, p: 10 }, pts: [{ t: bars[2].timestamp, p: 10 }, { t: bars[4].timestamp, p: 20 }] });
      store.add('msft', { id: 't', type: 'text', a: { t: bars[44].timestamp, p: 180 }, text: 'hi' });
      const pick = (x: number, y: number) => { ctl.pointerDown(x, y); ctl.pointerUp(x, y); return ctl.view().selectedId; };
      expect(pick(200, 100)).toBe('r');          // top edge of the rectangle (price 100 -> y 100)
      expect(pick(200, 170)).toBe('h');          // hline at price 30 -> y 170
      expect(pick(400, 20)).toBe('v');           // vline at bar 40
      expect(pick(30, 185)).toBe('b');           // on the brush segment (bar 2..4, price 10..20)
      expect(pick(440, 22)).toBe('t');           // inside the text box
      expect(pick(250, 250)).toBeNull();
    });

    it('lock all: nothing can be selected, moved or deleted; hide all: nothing can be picked either', () => {
      store.add('msft', { id: 'h', type: 'hline', a: { t: bars[5].timestamp, p: 30 } });
      store.toggleLocked();
      ctl.pointerDown(200, 170); ctl.pointerUp(200, 170);
      expect(ctl.view().selectedId).toBeNull();
      ctl.key('Delete');
      expect(store.list('msft').length).toBe(1);
      store.toggleLocked();
      store.setHidden(true);
      ctl.pointerDown(200, 170); ctl.pointerUp(200, 170);
      expect(ctl.view().selectedId).toBeNull();
    });

    it('creating a drawing while hidden un-hides them (so you see what you draw)', () => {
      store.setHidden(true);
      tool = 'hline';
      ctl.pointerDown(120, 80); ctl.pointerUp(120, 80);
      expect(store.hidden()).toBe(false);
    });

    it('setStyle merges colour / width / dash into the selected drawing', () => {
      store.add('msft', { id: 'h', type: 'hline', a: { t: bars[5].timestamp, p: 30 } });
      ctl.setStyle('h', { color: '#ff0000' });
      ctl.setStyle('h', { width: 3, dash: 'dot' });
      expect(store.list('msft')[0].style).toEqual({ color: '#ff0000', width: 3, dash: 'dot' });
      ctl.setStyle('missing', { width: 2 }); // unknown id is ignored
    });

    it('body drag moves brush points and single-anchor drawings too', () => {
      store.add('msft', { id: 'h', type: 'hline', a: { t: bars[5].timestamp, p: 30 } });
      ctl.pointerDown(200, 170); ctl.pointerMove(200, 150); ctl.pointerUp(200, 150);
      expect(store.list('msft')[0].a.p).toBe(50);
      store.add('msft', { id: 'b', type: 'brush', a: { t: bars[2].timestamp, p: 10 }, pts: [{ t: bars[2].timestamp, p: 10 }, { t: bars[4].timestamp, p: 20 }] });
      ctl.pointerDown(30, 185); ctl.pointerMove(30, 175); ctl.pointerUp(30, 175);
      const b = store.list('msft')[1];
      expect(b.pts![0].p).toBe(20);
      expect(b.pts![1].p).toBe(30);
    });
  });

  describe('multi-point and extended tools (11.7)', () => {
    const click = (x: number, y: number) => { ctl.pointerDown(x, y); ctl.pointerUp(x, y); };

    it('a 3-point tool: drag the first segment, then one click for the last anchor', () => {
      tool = 'fibext';
      ctl.pointerDown(100, 100); ctl.pointerMove(150, 80); ctl.pointerUp(200, 60);
      expect(store.list('msft')).toEqual([]);
      expect(ctl.view().draft!.phase).toBe(3);
      ctl.pointerMove(250, 90);
      expect(ctl.draftDrawing()!.pts!.length).toBe(3); // the cursor is the provisional next anchor
      ctl.pointerDown(260, 90); ctl.pointerUp(260, 90);
      const [d] = store.list('msft');
      expect(d.type).toBe('fibext');
      expect(d.pts!.length).toBe(3);
      expect([d.a, d.b]).toEqual([d.pts![0], d.pts![1]]);
      expect(ctl.view().draft).toBeNull();
      expect(committed).toEqual(['fibext']);
    });

    it('clicking each point works too (click, click, click)', () => {
      tool = 'longpos';
      click(100, 100); click(100, 120); click(300, 60);
      const [d] = store.list('msft');
      expect(d.pts!.map((p) => p.p)).toEqual([100, 80, 140]);
    });

    it('a 5-point pattern needs five anchors; Escape abandons it', () => {
      tool = 'xabcd';
      [[50, 100], [100, 60], [150, 90], [200, 50], [250, 80]].forEach(([x, y], i) => {
        click(x, y);
        expect(store.list('msft').length).toBe(i === 4 ? 1 : 0);
      });
      expect(store.list('msft')[0].pts!.length).toBe(5);
      click(50, 100); click(100, 60);
      ctl.key('Escape');
      expect(ctl.view().draft).toBeNull();
      expect(store.list('msft').length).toBe(1);
    });

    it('polyline / path: click points, finish with Enter (or finish()); fewer than two points stores nothing', () => {
      tool = 'polyline';
      click(50, 100); click(100, 60); click(150, 90);
      ctl.key('Enter');
      expect(store.list('msft')[0].pts!.length).toBe(3);
      tool = 'path';
      click(50, 100);
      ctl.finish();
      expect(store.list('msft').length).toBe(1);
      click(50, 120); click(80, 60); click(80, 60); // a double-click adds the same point twice
      ctl.finish();
      expect(store.list('msft')[1].pts!.length).toBe(2);
    });

    it('extra tools that ask for text: callout after its drag, note after one click', () => {
      tool = 'note';
      click(100, 100);
      tool = 'callout';
      ctl.pointerDown(100, 100); ctl.pointerMove(200, 60); ctl.pointerUp(200, 60);
      expect(store.list('msft').map((d) => d.type)).toEqual(['note', 'callout']);
      expect(edits).toEqual([store.list('msft')[0].id, store.list('msft')[1].id]);
      expect(ctl.textAt(105, 100)).toBe(store.list('msft')[0].id);
    });

    it('one-click tools of the new sets: horizontal ray, cross line, price label, icons', () => {
      for (const t of ['cross', 'pricelabel', 'iconstar', 'iconup'] as const) { tool = t; click(120, 80); }
      expect(store.list('msft').map((d) => d.type)).toEqual(['cross', 'pricelabel', 'iconstar', 'iconup']);
    });

    it('highlighter is freehand like the brush', () => {
      tool = 'highlighter';
      ctl.pointerDown(100, 100);
      for (let x = 105; x <= 160; x += 5) ctl.pointerMove(x, 100 - (x - 100) / 2);
      ctl.pointerUp(160, 70);
      expect(store.list('msft')[0].type).toBe('highlighter');
      expect(store.list('msft')[0].pts!.length).toBeGreaterThan(5);
    });

    it('a selected multi-point drawing has a handle per anchor; dragging one moves only that anchor', () => {
      store.add('msft', { id: 'p', type: 'abcd', a: { t: bars[5].timestamp, p: 50 }, b: { t: bars[10].timestamp, p: 90 },
        pts: [{ t: bars[5].timestamp, p: 50 }, { t: bars[10].timestamp, p: 90 }, { t: bars[15].timestamp, p: 60 }, { t: bars[20].timestamp, p: 100 }] });
      ctl.pointerDown(100, 110); ctl.pointerUp(100, 110); // on the B–... segment: selects
      expect(ctl.view().selectedId).toBe('p');
      // grab the third anchor (bar 15, price 60 -> pixel 150,140) and move it up by 30 price units
      ctl.pointerDown(150, 140); ctl.pointerMove(150, 110); ctl.pointerUp(150, 110);
      const d = store.list('msft')[0];
      expect(d.pts!.map((p) => p.p)).toEqual([50, 90, 90, 100]);
      expect(d.a.p).toBe(50);
      expect(d.b!.p).toBe(90);
    });

    it('moving the body of a multi-point drawing moves every anchor together', () => {
      store.add('msft', { id: 'p', type: 'triangleshape', a: { t: bars[5].timestamp, p: 50 }, b: { t: bars[10].timestamp, p: 90 },
        pts: [{ t: bars[5].timestamp, p: 50 }, { t: bars[10].timestamp, p: 90 }, { t: bars[15].timestamp, p: 60 }] });
      ctl.pointerDown(75, 130); ctl.pointerMove(75, 120); ctl.pointerUp(75, 120); // on the first edge's mid-point
      expect(store.list('msft')[0].pts!.map((p) => p.p)).toEqual([60, 100, 70]);
    });
  });
});