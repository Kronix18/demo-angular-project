import { readFileSync, readdirSync } from 'node:fs';

/**
 * Design-token guard (6.2, tightened with the dark theme). Every colour/shadow
 * literal lives in src/styles/theme.scss; app code references custom properties
 * ONLY — no exceptions, no legacy allowlist. Run from demo-app (`ng test` does).
 */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\bhwb\(|\blab\(|\blch\(|(?<![\w-])(?:white|black)(?![\w-])/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|scss|html)$/.test(e.name) && !e.name.endsWith('.spec.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const files = [...walk('src/app'), 'src/index.html'];
const read = (p: string) => readFileSync(p, 'utf8');
/** Source without comments (doc comments mention example tokens/colours). */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const theme = readFileSync('src/styles/theme.scss', 'utf8');
const darkStart = theme.indexOf(":root[data-theme='dark']");
const light = theme.slice(0, darkStart);
const dark = theme.slice(darkStart);
const defs = (block: string) => [...block.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);

/** Tokens intentionally identical in both themes (brand identity, on-colour text, fixed-dark panels, data colours). */
const SAME_IN_BOTH = [
  '--c-on-primary', '--c-on-brand', '--on-ac', '--c-shadow', '--c-neutral', '--c-nav-text',
  '--tr-purple', '--tr-pink', '--tr-gold', '--tr-orange', '--c-up', '--c-down',
  '--c-up-fill', '--c-down-fill', '--c-up-strong', '--c-down-strong', '--c-teal', '--ac', '--ac2',
];
/** color-mix() tokens derived from other tokens — they follow their source automatically. */
const DERIVED = ['--c-primary-tint', '--c-focus-ring', '--c-nav-hover-bg', '--c-nav-surface-hover', '--c-nav-outline', '--c-crosshair'];
const SAME_PREFIXES = ['--grad', '--c-brand-a', '--ac-a', '--ac2-a', '--c-shadow-a', '--nu-a', '--tr-', '--c-up-a', '--c-down-a', '--pn', '--c-ind-', '--c-indicator-', '--border-radius'];

describe('design tokens', () => {
  it('finds the app sources (guard is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(30);
    expect(darkStart).toBeGreaterThan(0);
  });

  it('NO colour literals anywhere in the app (only src/styles/theme.scss may define them)', () => {
    const offenders = files.filter((f) => (code(f).match(LITERAL) ?? []).length > 0)
      .map((f) => `${f}: ${(code(f).match(LITERAL) ?? []).join(' ')}`);
    expect(offenders).toEqual([]);
  });

  it('no var(--token, <fallback>) with a colour fallback (tokens are always defined)', () => {
    const offenders = files.filter((f) => /var\(--[\w-]+\s*,\s*(#|rgb|hsl|white|black)/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('every custom property used anywhere in app code is defined by the theme', () => {
    const used = new Set<string>();
    for (const f of files) {
      for (const m of code(f).matchAll(/var\((--[\w-]+)/g)) used.add(m[1]);
      for (const m of code(f).matchAll(/cssVar\('(--[\w-]+)'\)/g)) used.add(m[1]);
    }
    const defined = new Set(defs(theme));
    // component-local custom properties (declared and used in the same file) are fine
    const local = new Set<string>();
    for (const f of files) for (const m of code(f).matchAll(/(--[\w-]+)\s*:/g)) local.add(m[1]);
    const undefinedTokens = [...used].filter((t) => !defined.has(t) && !local.has(t) && !t.startsWith('--c-indicator-'));
    expect(undefinedTokens).toEqual([]);
  });

  it('dark palette overrides only tokens that exist in the light palette', () => {
    const lightDefs = new Set(defs(light));
    expect(defs(dark).length).toBeGreaterThan(30);
    expect(defs(dark).filter((d) => !lightDefs.has(d))).toEqual([]);
  });

  it('dark palette covers EVERY theme-dependent colour token (a new light token needs a dark value)', () => {
    const darkDefs = new Set(defs(dark));
    const missing = defs(light).filter((t) =>
      !darkDefs.has(t) && !SAME_IN_BOTH.includes(t) && !DERIVED.includes(t) && !SAME_PREFIXES.some((p) => t.startsWith(p)) && /^--(c-|auth-|navbar-)/.test(t));
    expect(missing).toEqual([]);
  });

  it('the theme is applied by a data-theme attribute only (no stray prefers-color-scheme block to drift)', () => {
    expect(theme).not.toMatch(/prefers-color-scheme/);
  });
});
