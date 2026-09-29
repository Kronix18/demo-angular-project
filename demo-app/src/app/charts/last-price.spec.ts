import { alertLines, lastPriceInfo } from './last-price';

const bars = (closes: number[]) => closes.map((c, i) => ({ timestamp: i, open: c, high: c, low: c, close: c, volume: 1 }));
const chart = (closes: number[], y = { top: 0, bottom: 300, min: 0, max: 300 }) => ({
  chartArea: { left: 0, right: 900, top: 0, bottom: 500 },
  scales: { y: { ...y, getPixelForValue: (v: number) => y.bottom - ((v - y.min) / (y.max - y.min)) * (y.bottom - y.top) } },
  $lastBars: () => bars(closes),
});

describe('last price line (11.11)', () => {
  it('sits at the last close, coloured by the change from the previous close', () => {
    expect(lastPriceInfo(chart([100, 110]) as any)).toMatchObject({ y: 190, text: '110.00', up: true, clamped: false });
    expect(lastPriceInfo(chart([100, 90]) as any)).toMatchObject({ y: 210, text: '90.00', up: false });
  });

  it('is clamped to the pane edge when the last bar is off the scale', () => {
    const i = lastPriceInfo(chart([100, 500]) as any)!;
    expect(i.y).toBe(0);
    expect(i.clamped).toBe(true);
    expect(lastPriceInfo(chart([100, -50]) as any)!.y).toBe(300);
  });

  it('percent scale shows % from the base; no bars, no line', () => {
    const c: any = chart([100, 110]);
    c.$percentBase = () => 100;
    c.$percentOn = true;
    expect(lastPriceInfo(c)!.text).toBe('+10.00%');
    c.$percentOn = false;
    expect(lastPriceInfo(c)!.text).toBe('110.00'); // the base alone does not switch the label
    expect(lastPriceInfo(chart([]) as any)).toBeNull();
    expect(lastPriceInfo({ chartArea: null } as any)).toBeNull();
  });

  it('carries the bar countdown when the chart has one', () => {
    const c: any = chart([100, 110]);
    expect(lastPriceInfo(c)!.countdown).toBeUndefined();
    c.$countdown = () => '05:00:00';
    expect(lastPriceInfo(c)!.countdown).toBe('05:00:00');
  });

  it('alert lines: one per alert inside the pane, labelled with the price; off-scale ones are dropped', () => {
    const c: any = chart([100, 110]);
    c.$alerts = () => [{ price: 150, triggered: false }, { price: 5000, triggered: false }, { price: 50, triggered: true }];
    const lines = alertLines(c);
    expect(lines.map((l) => l.text)).toEqual(['150.00', '50.00']);
    expect(lines.map((l) => l.y)).toEqual([150, 250]);
    expect(lines.map((l) => l.triggered)).toEqual([false, true]);
    expect(alertLines(chart([100, 110]) as any)).toEqual([]);
  });
});
