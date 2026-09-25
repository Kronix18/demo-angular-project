import {
  aggregateWeeklyWFri,
  filterByRange,
  rangeStartIndex,
  RANGE_PRESETS,
} from './data-aggregation';

const day = 86400000;
/** Daily bars Jan 1..10, 2024 (Wed Jan 3 = first Friday-ending week boundary is Jan 5). */
const bar = (d: Date, o: number, h: number, l: number, c: number, v: number) => ({
  timestamp: d.getTime(), open: o, high: h, low: l, close: c, volume: v,
});

describe('W-FRI weekly aggregation (task 4.3 — port of stock_service W-FRI rule)', () => {
  it('aggregates one Fri-ending week into 1 bar: o=first, h=max, l=min, c=last, v=sum', () => {
    // Week ending Fri Jan 5, 2024: bars Jan 3 (Wed), Jan 4 (Thu), Jan 5 (Fri)
    const week = [
      bar(new Date(2024, 0, 3), 100, 110, 95, 105, 1000),
      bar(new Date(2024, 0, 4), 105, 120, 100, 118, 2000),
      bar(new Date(2024, 0, 5), 118, 125, 115, 122, 1500),
    ];
    const out = aggregateWeeklyWFri(week);
    expect(out.length).toBe(1);
    expect(out[0].open).toBe(100); // first open
    expect(out[0].high).toBe(125); // max high
    expect(out[0].low).toBe(95); // min low
    expect(out[0].close).toBe(122); // last close
    expect(out[0].volume).toBe(4500); // sum
    // bar date = LAST bar's date (W-FRI anchor)
    expect(out[0].timestamp).toBe(new Date(2024, 0, 5).getTime());
  });

  it('splits two weeks correctly (week ends Friday)', () => {
    const twoWeeks = [
      bar(new Date(2024, 0, 3), 100, 110, 95, 105, 1000),
      bar(new Date(2024, 0, 5), 105, 120, 100, 118, 2000), // Fri W1
      bar(new Date(2024, 0, 8), 118, 125, 115, 122, 1500), // Mon W2
      bar(new Date(2024, 0, 12), 122, 130, 120, 128, 1800), // Fri W2
    ];
    const out = aggregateWeeklyWFri(twoWeeks);
    expect(out.length).toBe(2);
    expect(out[0].close).toBe(118); // W1 last close
    expect(out[0].volume).toBe(3000); // W1 sum
    expect(out[1].close).toBe(128); // W2 last close
    expect(out[1].volume).toBe(3300); // W2 sum
  });

  it('returns [] for empty input and passes single bars through', () => {
    expect(aggregateWeeklyWFri([])).toEqual([]);
    const single = [bar(new Date(2024, 0, 5), 100, 110, 95, 105, 1000)];
    const out = aggregateWeeklyWFri(single);
    expect(out.length).toBe(1);
    expect(out[0]).toEqual(single[0]);
  });
});

describe('Range presets (4.3 — port of range_presets.py, LAST-BAR anchored)', () => {
  const bars = [
    bar(new Date(2023, 5, 1), 1, 1, 1, 1, 1), // Jun 2023
    bar(new Date(2024, 0, 10), 2, 2, 2, 2, 2), // Jan 2024 (last bar)
    bar(new Date(2022, 0, 5), 3, 3, 3, 3, 3), // Jan 2022 — out of 1Y
  ];
  const LAST = new Date(2024, 0, 10).getTime();

  it('exposes the 4.3 button set', () => {
    expect(RANGE_PRESETS).toEqual(['1M', '3M', '6M', 'YTD', '1Y', 'ALL']);
  });

  it('anchors to the LAST AVAILABLE BAR, not today', () => {
    // 3M from last bar (Jan 10 2024) → Oct 10 2023 → the Jun 2023 bar is OUT, Jan 2024 IN
    const idx = rangeStartIndex(bars, '3M');
    expect(bars[idx].timestamp).toBe(new Date(2024, 0, 10).getTime());
  });

  it('1M = last bar minus 1 month; ALL = 0', () => {
    // 1M from Jan 10 2024 → Dec 10 2023: all fixture bars before that are out
    const idx1m = rangeStartIndex(bars, '1M');
    expect(bars[idx1m].timestamp).toBe(LAST);
    expect(rangeStartIndex(bars, 'ALL')).toBe(0);
  });

  it('6M from last bar includes the Jun 2023 bar', () => {
    const idx = rangeStartIndex(bars, '6M');
    expect(idx).toBe(0); // Jun 2023 is within 6M of Jan 2024
  });

  it('YTD = Jan 1 of the LAST BAR year (not the current year)', () => {
    // last bar is Jan 2024 → YTD starts Jan 1 2024; the Jun 2023 + Jan 2022 bars are out
    const idx = rangeStartIndex(bars, 'YTD');
    expect(bars[idx].timestamp).toBe(new Date(2024, 0, 10).getTime());
    expect(idx).toBe(1);
  });

  it('filterByRange slices client-side and aggregates weekly when requested', () => {
    const sixMonths = [
      bar(new Date(2023, 8, 1), 1, 2, 0, 1, 10), // Sep 2023
      bar(new Date(2023, 11, 1), 2, 3, 1, 2, 20), // Dec 2023
      bar(new Date(2024, 0, 5), 3, 4, 2, 3, 30), // Jan 2024 (Fri)
      bar(new Date(2024, 0, 10), 4, 5, 3, 4, 40), // Jan 2024 (last, Wed)
    ];
    // 3M range: Jan 2024 bars only (Oct 10 2023 cutoff)
    const daily3m = filterByRange(sixMonths, '3M');
    expect(daily3m.length).toBe(2);
    // weekly + 3M: aggregated into 1 Fri-ending week (Jan 5 + Jan 10 span
    // two ISO weeks — W-FRI weeks ending Jan 5 and Jan 12; Jan 10 is in the
    // week ending Jan 12 → 2 bars out)
    const weekly3m = filterByRange(sixMonths, '3M', '1w');
    expect(weekly3m.length).toBe(2);
    expect(weekly3m[0].volume).toBe(30); // first week sum
  });
});
