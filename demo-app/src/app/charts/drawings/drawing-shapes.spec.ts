import { OHLCV } from '../../core/models/ohlcv.model';
import { Anchor, Drawing } from './drawing-geometry';
import { Env, Shape, distanceToShapes, handlePoints, shapesFor } from './drawing-shapes';
import { TOOL_DEFS, TOOL_GROUPS, isDrawingType, toolDef, toolsInGroup } from './drawing-tools';

const DAY = 86_400_000;
// bar i: close = 100 + i, timestamp i days; pixel x = index * 10, y = 300 - price
const bars: OHLCV[] = Array.from({ length: 100 }, (_, i) => ({ timestamp: i * DAY, open: 100 + i, high: 102 + i, low: 98 + i, close: 100 + i, volume: 10 }));
const env: Env = {
  area: { left: 0, right: 900, top: 0, bottom: 300 },
  full: { left: 0, right: 900, top: 0, bottom: 500 },
  bars,
  px: (a: Anchor) => ({ x: (a.t / DAY) * 10, y: 300 - a.p }),
  fmt: (p) => p.toFixed(2),
};
const at = (i: number, p: number): Anchor => ({ t: i * DAY, p });
const drawing = (type: string, anchors: Anchor[], extra: Partial<Drawing> = {}): Drawing =>
  ({ id: 'x', type: type as any, a: anchors[0], ...(anchors[1] ? { b: anchors[1] } : {}), ...(anchors.length > 2 || toolDef(type)?.points === 'poly' || toolDef(type)?.points === 'free' ? { pts: anchors } : {}), ...extra });
const texts = (s: Shape[]) => s.filter((x): x is Extract<Shape, { k: 'text' }> => x.k === 'text').map((x) => x.text);
const lines = (s: Shape[]) => s.filter((x): x is Extract<Shape, { k: 'line' }> => x.k === 'line');

/** Plausible anchors for a tool with `n` points (a zig-zag so every pattern has distinct highs and lows). */
const anchorsFor = (n: number): Anchor[] => Array.from({ length: n }, (_, k) => at(10 + k * 6, 120 + (k % 2 ? 25 : 0) + k * 3));

describe('drawing tool registry (11.7)', () => {
  it('has unique ids, every group is populated and TradingView-sized (50+ tools)', () => {
    const ids = TOOL_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(50);
    for (const g of TOOL_GROUPS) expect(toolsInGroup(g.id).length, g.id).toBeGreaterThan(0);
    expect(isDrawingType('fibext')).toBe(true);
    expect(isDrawingType('measure')).toBe(false); // transient, not a stored drawing
    expect(toolDef('longpos')!.points).toBe(3);
  });
});

describe('drawing shapes (11.7)', () => {
  it('every tool renders finite, non-empty geometry from plausible anchors', () => {
    for (const def of TOOL_DEFS) {
      const n = typeof def.points === 'number' ? def.points : 6;
      const d = drawing(def.id, anchorsFor(n), def.id === 'channel' ? { offset: 10 } : def.text ? { text: 'hi' } : {});
      const shapes = shapesFor(d, env);
      expect(shapes.length, def.id).toBeGreaterThan(0);
      expect(JSON.stringify(shapes).includes('null'), `${def.id} produced NaN/Infinity`).toBe(false);
      expect(Number.isNaN(distanceToShapes(shapes, 5, 5, env)), def.id).toBe(false);
    }
  });

  it('a drawing missing anchors renders nothing instead of throwing', () => {
    for (const def of TOOL_DEFS) expect(() => shapesFor({ id: 'x', type: def.id, a: at(1, 100) } as Drawing, env), def.id).not.toThrow();
  });

  it('trend / ray / extended lines: the same segment with different extension', () => {
    const a = at(10, 120), b = at(20, 130);
    const [t] = lines(shapesFor(drawing('trend', [a, b]), env));
    expect(t).toMatchObject({ x1: 100, y1: 180, x2: 200, y2: 170 });
    expect(lines(shapesFor(drawing('rayline', [a, b]), env))[0].ext).toBe('right');
    expect(lines(shapesFor(drawing('extended', [a, b]), env))[0].ext).toBe('both');
  });

  it('horizontal / vertical / cross lines span the pane; vertical ones the whole chart height', () => {
    const [h] = lines(shapesFor(drawing('hline', [at(10, 120)]), env));
    expect(h).toMatchObject({ x1: 0, x2: 900, y1: 180, y2: 180 });
    const [v] = lines(shapesFor(drawing('vline', [at(10, 120)]), env));
    expect(v).toMatchObject({ x1: 100, x2: 100, y1: 0, y2: 500 });
    expect(lines(shapesFor(drawing('cross', [at(10, 120)]), env)).length).toBe(2);
    expect(lines(shapesFor(drawing('ray', [at(10, 120)]), env))[0]).toMatchObject({ x1: 100, y1: 180, ext: 'right' });
  });

  it('info line and trend angle carry a readout; angle is measured against the horizontal', () => {
    const a = at(10, 100), b = at(20, 110); // 100px right, 10px up -> ~5.7 degrees
    expect(texts(shapesFor(drawing('info', [a, b]), env)).join(' ')).toMatch(/10\.00.*10\.00%.*10 bars/);
    expect(texts(shapesFor(drawing('angle', [a, b]), env)).join(' ')).toContain('5.7°');
  });

  it('fib retracement keeps the levels from 0 at b to 1 at a; extension projects from c', () => {
    const fib = shapesFor(drawing('fib', [at(10, 100), at(30, 140)]), env);
    expect(texts(fib)).toContain('0.618 (115.28)');
    const ext = shapesFor(drawing('fibext', [at(10, 100), at(20, 120), at(30, 110)]), env);
    expect(texts(ext).some((s) => s.startsWith('1.618') && s.includes('142.36'))).toBe(true); // 110 + 20 * 1.618
  });

  it('fib channel offsets parallels by the distance from c to the base line', () => {
    const shapes = lines(shapesFor(drawing('fibchannel', [at(10, 100), at(20, 110), at(15, 130)]), env));
    const ys = shapes.filter((l) => l.dash === undefined).map((l) => Math.round(l.y1));
    expect(ys.length).toBeGreaterThanOrEqual(5);
    expect(new Set(ys).size).toBe(ys.length);
  });

  it('fib time zones: verticals at fibonacci multiples of the distance, inside the chart', () => {
    const xs = lines(shapesFor(drawing('fibtime', [at(10, 100), at(12, 110)]), env)).map((l) => l.x1);
    expect(xs.slice(0, 6)).toEqual([100, 120, 140, 160, 200, 260]);
    expect(Math.max(...xs)).toBeLessThanOrEqual(900);
  });

  it('gann fan: nine rays from a; the 1x1 passes through b', () => {
    const a = at(10, 100), b = at(20, 110);
    const fan = lines(shapesFor(drawing('gannfan', [a, b]), env));
    expect(fan.length).toBe(9);
    const one = fan.find((l) => Math.abs(l.x2 - 200) < 1e-6 && Math.abs(l.y2 - 190) < 1e-6);
    expect(one).toBeTruthy();
    expect(fan.every((l) => l.ext === 'right')).toBe(true);
  });

  it('pitchfork: median from a through the middle of b–c, parallels through b and c', () => {
    const [a, b, c] = [at(10, 100), at(20, 130), at(20, 110)];
    const [median, up, low] = lines(shapesFor(drawing('pitchfork', [a, b, c]), env));
    // midpoint of b and c is (200, 180); a is (100, 200) -> the median passes through it
    expect((median.y2 - median.y1) / (median.x2 - median.x1)).toBeCloseTo((180 - 200) / (200 - 100), 6);
    expect(up.x1).toBe(200); expect(up.y1).toBe(170);
    expect(low.x1).toBe(200); expect(low.y1).toBe(190);
    expect((up.y2 - up.y1) / (up.x2 - up.x1)).toBeCloseTo(-0.2, 6);
  });

  it('regression trend: least-squares centre line through the closes between the anchors, bands at ±2σ', () => {
    const shapes = lines(shapesFor(drawing('regression', [at(10, 110), at(50, 150)]), env));
    const base = shapes.find((l) => l.role === undefined)!;
    expect(base.y1).toBeCloseTo(300 - 110, 6); // closes are exactly 100 + i -> perfect fit, sigma 0
    expect(base.y2).toBeCloseTo(300 - 150, 6);
    expect(shapes.length).toBe(3);
  });

  it('long / short position: profit and loss zones with the risk/reward readout', () => {
    const shapes = shapesFor(drawing('longpos', [at(10, 100), at(10, 95), at(40, 110)]), env);
    const rects = shapes.filter((s) => s.k === 'rect') as Extract<Shape, { k: 'rect' }>[];
    expect(rects.map((r) => r.role).sort()).toEqual(['down', 'up']);
    expect(texts(shapes).join(' ')).toContain('2.00');
    expect(texts(shapesFor(drawing('shortpos', [at(10, 100), at(10, 105), at(40, 90)]), env)).join(' ')).toContain('2.00');
  });

  it('patterns: labelled points, connected in order', () => {
    expect(texts(shapesFor(drawing('xabcd', anchorsFor(5)), env)).filter((s) => /^[XABCD]$/.test(s))).toEqual(['X', 'A', 'B', 'C', 'D']);
    expect(texts(shapesFor(drawing('abcd', anchorsFor(4)), env)).filter((s) => /^[ABCD]$/.test(s))).toEqual(['A', 'B', 'C', 'D']);
    expect(texts(shapesFor(drawing('elliottcorrection', anchorsFor(4)), env))).toEqual(['0', 'A', 'B', 'C']);
    expect(texts(shapesFor(drawing('elliottimpulse', anchorsFor(6)), env))).toEqual(['0', '1', '2', '3', '4', '5']);
    expect(texts(shapesFor(drawing('elliotttriangle', anchorsFor(6)), env))).toEqual(['0', 'A', 'B', 'C', 'D', 'E']);
    expect(texts(shapesFor(drawing('headshoulders', anchorsFor(7)), env))).toEqual(expect.arrayContaining(['Left shoulder', 'Head', 'Right shoulder']));
  });

  it('ranges read out bars / time / price / percent', () => {
    expect(texts(shapesFor(drawing('daterange', [at(10, 100), at(30, 100)]), env)).join(' ')).toMatch(/20 bars.*20d/);
    expect(texts(shapesFor(drawing('pricerange', [at(10, 100), at(30, 120)]), env)).join(' ')).toMatch(/20\.00.*20\.00%/);
    expect(texts(shapesFor(drawing('daterangeprice', [at(10, 100), at(30, 120)]), env)).join(' ')).toMatch(/20 bars/);
    expect(texts(shapesFor(drawing('forecast', [at(10, 100), at(30, 120)]), env)).join(' ')).toMatch(/120\.00/);
  });

  it('shapes: rotated rectangle is a parallelogram, circle uses the anchor distance as radius', () => {
    const rot = shapesFor(drawing('rotrect', [at(10, 100), at(20, 100), at(15, 120)]), env).find((s) => s.k === 'poly') as Extract<Shape, { k: 'poly' }>;
    expect(rot.pts.length).toBe(4);
    expect(rot.closed).toBe(true);
    const c = shapesFor(drawing('circle', [at(10, 100), at(13, 100)]), env).find((s) => s.k === 'ellipse') as Extract<Shape, { k: 'ellipse' }>;
    expect(c.rx).toBeCloseTo(30, 6);
    expect(c.ry).toBeCloseTo(30, 6);
  });

  it('text-like tools: text, note, callout show their text; price label shows the price; icons are glyphs', () => {
    expect(texts(shapesFor(drawing('text', [at(10, 100)], { text: 'hello' }), env))).toContain('hello');
    expect(texts(shapesFor(drawing('note', [at(10, 100)], { text: 'n' }), env))).toContain('n');
    expect(texts(shapesFor(drawing('callout', [at(10, 100), at(20, 120)], { text: 'c' }), env))).toContain('c');
    expect(texts(shapesFor(drawing('pricelabel', [at(10, 123.4)]), env))).toContain('123.40');
    expect(texts(shapesFor(drawing('iconstar', [at(10, 100)]), env))).toEqual(['★']);
  });

  it('hit testing: segment, ray, filled areas, text boxes', () => {
    const trend = shapesFor(drawing('trend', [at(10, 100), at(20, 110)]), env);
    expect(distanceToShapes(trend, 150, 195, env)).toBeCloseTo(0, 6);
    expect(distanceToShapes(trend, 150, 205, env)).toBeCloseTo(9.95, 1); // perpendicular to a 0.1 slope
    const ray = shapesFor(drawing('rayline', [at(10, 100), at(20, 110)]), env);
    expect(distanceToShapes(ray, 400, 200 - 30, env)).toBeLessThan(1); // far along the extension
    const rect = shapesFor(drawing('rect', [at(10, 100), at(30, 120)]), env);
    expect(distanceToShapes(rect, 200, 190, env)).toBe(0); // inside the fill
    expect(distanceToShapes(rect, 500, 190, env)).toBeGreaterThan(100);
    const text = shapesFor(drawing('text', [at(10, 100)], { text: 'hello' }), env);
    expect(distanceToShapes(text, 110, 200, env)).toBe(0);
    expect(distanceToShapes([], 0, 0, env)).toBe(Infinity);
  });

  it('handles: every anchor of a multi-point tool, none for freehand', () => {
    expect(handlePoints(drawing('trend', [at(10, 100), at(20, 110)]), env)).toEqual([{ x: 100, y: 200 }, { x: 200, y: 190 }]);
    expect(handlePoints(drawing('xabcd', anchorsFor(5)), env).length).toBe(5);
    expect(handlePoints(drawing('brush', anchorsFor(6)), env)).toEqual([]);
    expect(handlePoints(drawing('hline', [at(10, 100)]), env).length).toBe(1);
  });
});
