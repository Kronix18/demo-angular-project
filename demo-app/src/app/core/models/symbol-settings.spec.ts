import { sanitizePrice, sanitizeVolume } from './symbol-settings';

describe('symbol / volume settings (11.6)', () => {
  it('keeps valid values and drops everything else', () => {
    expect(sanitizePrice({ up: '#00ff00', down: 'red', byPrevClose: true, width: 3, line: '#123456', source: 'hlc3', hidden: true, junk: 1 }))
      .toEqual({ up: '#00ff00', byPrevClose: true, width: 3, line: '#123456', source: 'hlc3', hidden: true });
    expect(sanitizePrice({ width: 99, source: 'nope', byPrevClose: 'yes' })).toEqual({});
    expect(sanitizePrice(null)).toEqual({});
    expect(sanitizePrice([1])).toEqual({});
  });

  it('volume: colours, previous-close colouring and visibility', () => {
    expect(sanitizeVolume({ up: '#0f0', down: '#ff0000', byPrevClose: false, hidden: true, width: 2 })).toEqual({ down: '#ff0000', byPrevClose: false, hidden: true });
    expect(sanitizeVolume('x')).toEqual({});
  });
});
