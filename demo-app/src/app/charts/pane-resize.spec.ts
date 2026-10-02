import { paneBoundaryAt, resizeWeights } from './pane-resize';

describe('pane resize (11.19)', () => {
  it('moving a boundary down grows the upper pane and shrinks the lower one; the total stays', () => {
    const w = resizeWeights([6, 1.5, 2], 0, 30, 500);
    expect(w[0]).toBeGreaterThan(6);
    expect(w[1]).toBeLessThan(1.5);
    expect(w[2]).toBe(2);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(9.5, 9);
    const up = resizeWeights([6, 1.5, 2], 1, -20, 500);
    expect(up[1]).toBeLessThan(1.5);
    expect(up[2]).toBeGreaterThan(2);
  });

  it('never squeezes a pane below the minimum', () => {
    const w = resizeWeights([6, 1.5], 0, 10_000, 500, 0.4);
    expect(w[1]).toBeCloseTo(0.4, 9);
    expect(w[0] + w[1]).toBeCloseTo(7.5, 9);
    const v = resizeWeights([6, 1.5], 0, -10_000, 500, 0.4);
    expect(v[0]).toBeCloseTo(0.4, 9);
  });

  it('a bad boundary or zero height changes nothing', () => {
    expect(resizeWeights([1, 2], 5, 10, 500)).toEqual([1, 2]);
    expect(resizeWeights([1, 2], 0, 10, 0)).toEqual([1, 2]);
  });

  it('finds the separator under a y: the top edge of every pane but the first', () => {
    const chart: any = { scales: { x: {}, y: { top: 0, bottom: 300 }, yVol: { top: 300, bottom: 400 }, yInd0: { top: 400, bottom: 500 } } };
    expect(paneBoundaryAt(chart, 301)).toEqual({ index: 0, ids: ['y', 'yVol', 'yInd0'] });
    expect(paneBoundaryAt(chart, 398)).toEqual({ index: 1, ids: ['y', 'yVol', 'yInd0'] });
    expect(paneBoundaryAt(chart, 350)).toBeNull();
    expect(paneBoundaryAt(chart, 2)).toBeNull(); // the first pane has no separator above it
    expect(paneBoundaryAt({ scales: { y: { top: 0, bottom: 10 } } } as any, 5)).toBeNull();
  });
});
