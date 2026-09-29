import { businessDaysBetween, freshness } from './freshness';

describe('freshness (task 12.12, docs/api/00-data-status.md §3.5)', () => {
  it('counts weekdays after the as-of date up to the given day', () => {
    expect(businessDaysBetween('2026-09-22', new Date('2026-09-22T12:00:00Z'))).toBe(0);
    expect(businessDaysBetween('2026-09-22', new Date('2026-09-23T00:10:00Z'))).toBe(1);
    expect(businessDaysBetween('2026-09-25', new Date('2026-09-28T09:00:00Z'))).toBe(1); // Fri -> Mon
    expect(businessDaysBetween('2026-09-25', new Date('2026-09-27T09:00:00Z'))).toBe(0); // Fri -> Sun
    expect(businessDaysBetween('2026-09-22', new Date('2026-09-28T09:00:00Z'))).toBe(4);
  });

  it('fresh up to 3 business days, stale beyond, unknown without a date', () => {
    const map = { prices: '2026-09-22' };
    expect(freshness(map, new Date('2026-09-25T09:00:00Z')).state).toBe('fresh');
    expect(freshness(map, new Date('2026-09-28T09:00:00Z')).state).toBe('stale');
    expect(freshness({}, new Date()).state).toBe('unknown');
    expect(freshness({ prices: null }, new Date()).state).toBe('unknown');
    expect(freshness({ prices: 'garbage' }, new Date()).state).toBe('unknown');
  });

  it('reports the date and the lag; a future date is fresh', () => {
    const f = freshness({ prices: '2026-09-22' }, new Date('2026-09-28T09:00:00Z'));
    expect(f).toEqual({ state: 'stale', asOf: '2026-09-22', lagBusinessDays: 4 });
    expect(freshness({ prices: '2026-10-01' }, new Date('2026-09-28T09:00:00Z')).state).toBe('fresh');
  });

  it('can be evaluated for another dataset key', () => {
    expect(freshness({ prices: '2026-09-22', eps: '2026-06-01' }, new Date('2026-09-23T09:00:00Z'), 'eps').state).toBe('stale');
  });
});
