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

  beforeEach(() => {
    sessionStorage.clear();
    store = new DrawingStore();
    chart = fakeChart();
    tool = 'cursor';
    changes = 0;
    ctl = new DrawingController({ chart: () => chart, bars: () => bars, store, symbol: () => 'msft', tool: () => tool, changed: () => changes++ });
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
});
