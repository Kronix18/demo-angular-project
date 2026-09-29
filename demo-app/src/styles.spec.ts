import { readFileSync, readdirSync } from 'node:fs';

/**
 * Task 6.2 — design-token guard. Every colour/shadow literal lives in
 * src/styles/theme.scss; app code references custom properties only.
 * Pages that predate the token system are grandfathered with a per-file
 * ceiling (a RATCHET: counts may only go down; new files start at zero).
 * Run from the demo-app directory (`ng test` does).
 */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|(?<![\w-])(?:white|black)(?![\w-])/g;

/** File -> max allowed literals. Lower these as pages are migrated; never raise. */
const LEGACY_CEILING: Record<string, number> = {
  'app/features/auth/login/login.component.scss': 34,
  'app/features/auth/login/login.component.ts': 1,
  'app/features/auth/register/register.component.scss': 23,
  'app/features/auth/registration-success/registration-success.component.scss': 22,
  'app/features/auth/verify-email/verify-email.component.scss': 31,
  'app/features/home/home.component.scss': 38,
  'app/features/pricing/pricing.component.scss': 32,
  'app/features/profile/profile.component.scss': 61,
  'app/features/screener/screener.component.scss': 37,
  'app/features/stock/candlestick-chart/candlestick-chart.component.scss': 14,
  'app/features/stock/candlestick-chart/candlestick-chart.component.ts': 10,
  'app/features/stock/stock.component.scss': 34,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|scss|html)$/.test(e.name) && !e.name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

const files = walk('src/app');
const read = (p: string) => readFileSync(p, 'utf8');
/** Source without comments (doc comments mention example tokens). */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const theme = readFileSync('src/styles/theme.scss', 'utf8');

describe('design tokens (6.2)', () => {
  it('finds the app sources (guard is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(30);
    expect(theme).toContain(':root');
  });

  it('no colour literals outside the theme file (legacy pages capped by a ratchet)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const key = f.replace(/^src\//, '');
      const n = (read(f).match(LITERAL) ?? []).length;
      const ceiling = LEGACY_CEILING[key] ?? 0;
      if (n > ceiling) offenders.push(`${key}: ${n} literal(s), allowed ${ceiling}`);
    }
    expect(offenders).toEqual([]);
  });

  it('ratchet stays honest: no stale entries for files that were cleaned up', () => {
    const stale = Object.entries(LEGACY_CEILING)
      .filter(([k, max]) => (read(`src/${k}`).match(LITERAL) ?? []).length < max)
      .map(([k]) => k);
    expect(stale, 'lower these ceilings to the current counts').toEqual([]);
  });

  it('every custom property used by the shell + chart code is defined in the theme', () => {
    const scoped = files.filter((f) => !f.startsWith('src/app/features/'));
    const used = new Set<string>();
    for (const f of scoped) for (const m of code(f).matchAll(/var\((--[\w-]+)/g)) used.add(m[1]);
    for (const f of scoped) for (const m of code(f).matchAll(/cssVar\('(--[\w-]+)'\)/g)) used.add(m[1]);
    const defined = new Set([...theme.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const undefinedTokens = [...used].filter((t) => !defined.has(t) && !t.startsWith('--c-indicator-'));
    expect(undefinedTokens).toEqual([]);
  });

  it('dark palette overrides only tokens that exist in the light palette', () => {
    const dark = theme.slice(theme.indexOf("[data-theme='dark']"));
    const light = theme.slice(0, theme.indexOf("[data-theme='dark']"));
    const lightDefs = new Set([...light.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const darkDefs = [...dark.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
    expect(darkDefs.length).toBeGreaterThan(5);
    expect(darkDefs.filter((d) => !lightDefs.has(d))).toEqual([]);
  });
});
