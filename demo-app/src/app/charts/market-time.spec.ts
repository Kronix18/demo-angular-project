import { barCountdown, formatClock } from './market-time';

describe('market time (11.13)', () => {
  it('clock: UTC, or the exchange (New York) with its UTC offset', () => {
    const t = new Date('2026-09-29T15:00:00Z');
    expect(formatClock(t, 'utc')).toBe('15:00:00 UTC');
    expect(formatClock(t, 'exchange')).toBe('11:00:00 UTC-4');
    expect(formatClock(new Date('2026-01-15T15:00:00Z'), 'exchange')).toBe('10:00:00 UTC-5'); // winter time
  });

  it('daily bar: time to the regular close (16:00 New York), or the extended close (20:00)', () => {
    const t = new Date('2026-09-29T15:00:00Z'); // Tuesday 11:00 EDT
    expect(barCountdown(t, '1d', 'regular')).toBe('05:00:00');
    expect(barCountdown(t, '1d', 'extended')).toBe('09:00:00');
  });

  it('after the close the next weekday counts; weekends are skipped', () => {
    expect(barCountdown(new Date('2026-09-25T21:00:00Z'), '1d', 'regular')).toBe('2d 23:00:00'); // Friday 17:00 EDT -> Monday 16:00
    expect(barCountdown(new Date('2026-09-26T12:00:00Z'), '1d', 'regular')).toBe('2d 08:00:00'); // Saturday morning
  });

  it('weekly bar: time to Friday\'s close', () => {
    expect(barCountdown(new Date('2026-09-29T15:00:00Z'), '1w', 'regular')).toBe('3d 05:00:00');
  });
});
