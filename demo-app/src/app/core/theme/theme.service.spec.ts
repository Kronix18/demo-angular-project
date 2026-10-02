import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService (dark mode)', () => {
  let listeners: ((e: { matches: boolean }) => void)[];
  let osDark: boolean;

  const stubMatchMedia = () => {
    listeners = [];
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('dark') ? osDark : false,
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
      removeEventListener: () => undefined,
    }));
  };
  const attr = () => document.documentElement.getAttribute('data-theme');
  const make = () => TestBed.inject(ThemeService);

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    osDark = false;
    stubMatchMedia();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to "system": follows the OS preference (light OS → light, dark OS → dark)', () => {
    expect(make().mode()).toBe('system');
    expect(make().theme()).toBe('light');
    expect(attr()).toBe('light');
    TestBed.resetTestingModule();
    osDark = true;
    expect(make().theme()).toBe('dark');
    expect(attr()).toBe('dark');
  });

  it('live-follows OS changes while in system mode, ignores them once a mode is chosen', () => {
    const s = make();
    listeners.forEach((l) => l({ matches: true }));
    expect(s.theme()).toBe('dark');
    expect(attr()).toBe('dark');
    s.setMode('light');
    listeners.forEach((l) => l({ matches: true }));
    expect(s.theme()).toBe('light');
    expect(attr()).toBe('light');
  });

  it('setMode applies + persists; a stored choice wins on the next start', () => {
    make().setMode('dark');
    expect(attr()).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    TestBed.resetTestingModule();
    const again = make();
    expect(again.mode()).toBe('dark');
    expect(again.theme()).toBe('dark');
  });

  it('cycle() walks system → light → dark → system', () => {
    const s = make();
    const seen = [s.mode()];
    for (let i = 0; i < 3; i++) { s.cycle(); seen.push(s.mode()); }
    expect(seen).toEqual(['system', 'light', 'dark', 'system']);
  });

  it('ignores a corrupt stored value and works without matchMedia / storage', () => {
    localStorage.setItem('theme', 'purple');
    expect(make().mode()).toBe('system');
    TestBed.resetTestingModule();
    vi.stubGlobal('matchMedia', undefined);
    expect(make().theme()).toBe('light');
    TestBed.resetTestingModule();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => make().setMode('dark')).not.toThrow();
    vi.restoreAllMocks();
  });
});
