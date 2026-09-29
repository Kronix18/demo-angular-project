import { fitRangeLog, panRange, scaleRange } from './y-scale-math';

describe('y-scale math (manual pan / axis scaling, log fit)', () => {
  describe('panRange', () => {
    it('linear: dragging the chart DOWN reveals higher prices (range shifts up) proportionally to the pixels', () => {
      const r = panRange({ min: 100, max: 200 }, 50, 500, false); // 50px of a 500px pane = 10% of the span
      expect(r.min).toBeCloseTo(110);
      expect(r.max).toBeCloseTo(210);
      const up = panRange({ min: 100, max: 200 }, -50, 500, false);
      expect(up.min).toBeCloseTo(90);
      expect(up.max).toBeCloseTo(190);
    });
    it('log: shifts by a constant RATIO (equal pixels = equal percentage move), span ratio preserved', () => {
      const a = panRange({ min: 10, max: 1000 }, 100, 400, true);
      expect(a.max / a.min).toBeCloseTo(100, 6);
      const factor = a.min / 10;
      expect(a.max / 1000).toBeCloseTo(factor, 9);
      expect(factor).toBeGreaterThan(1);
    });
    it('zero movement is the identity', () => {
      expect(panRange({ min: 5, max: 9 }, 0, 300, false)).toEqual({ min: 5, max: 9 });
      const l = panRange({ min: 5, max: 9 }, 0, 300, true);
      expect(l.min).toBeCloseTo(5); expect(l.max).toBeCloseTo(9);
    });
  });

  describe('scaleRange (drag on the axis)', () => {
    it('linear: keeps the centre, dragging down zooms out, up zooms in; symmetric', () => {
      const out = scaleRange({ min: 100, max: 200 }, 100, false);
      const inn = scaleRange({ min: 100, max: 200 }, -100, false);
      expect((out.min + out.max) / 2).toBeCloseTo(150);
      expect((inn.min + inn.max) / 2).toBeCloseTo(150);
      expect(out.max - out.min).toBeGreaterThan(100);
      expect(inn.max - inn.min).toBeLessThan(100);
      const back = scaleRange(out, -100, false);
      expect(back.min).toBeCloseTo(100); expect(back.max).toBeCloseTo(200);
    });
    it('log: keeps the geometric centre and stays strictly positive', () => {
      const r = scaleRange({ min: 10, max: 1000 }, 300, true);
      expect(Math.sqrt(r.min * r.max)).toBeCloseTo(100, 6);
      expect(r.min).toBeGreaterThan(0);
      expect(r.max / r.min).toBeGreaterThan(100);
    });
    it('never collapses to a zero-width range', () => {
      let r = { min: 100, max: 101 };
      for (let i = 0; i < 400; i++) r = scaleRange(r, -50, false);
      expect(r.max - r.min).toBeGreaterThan(0);
    });
  });

  describe('fitRangeLog', () => {
    it('pads multiplicatively (equal ratio above and below) and stays positive', () => {
      const r = fitRangeLog(50, 200, 0.05);
      expect(r.min).toBeLessThan(50);
      expect(r.min).toBeGreaterThan(0);
      expect(r.max).toBeGreaterThan(200);
      expect(50 / r.min).toBeCloseTo(r.max / 200, 9);
    });
    it('flat data still gets a range; non-positive input falls back to a safe default', () => {
      const f = fitRangeLog(30, 30, 0.05);
      expect(f.max).toBeGreaterThan(f.min);
      const bad = fitRangeLog(-5, 10, 0.05);
      expect(bad.min).toBeGreaterThan(0);
      expect(bad.max).toBeGreaterThan(bad.min);
      expect(fitRangeLog(NaN, NaN, 0.05).min).toBeGreaterThan(0);
    });
  });
});
