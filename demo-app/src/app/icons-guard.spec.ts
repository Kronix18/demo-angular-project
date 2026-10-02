import { readFileSync, readdirSync } from 'node:fs';

/** Toolbar icons are drawn (shared/icons), never pictures or symbol characters — this keeps it that way. */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|html)$/.test(e.name) && !e.name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

// emoji / pictographs, arrows, technical + geometric shapes + dingbats, the full-width plus and the multiplication sign (∞ and − are typography, not icons)
const SYMBOL = /[←-⇿⌀-⯿＋×✕]|\p{Extended_Pictographic}/u;

describe('icon guard', () => {
  it('no picture / symbol characters in the app sources (use <app-icon> or drawIcon)', () => {
    const offenders: string[] = [];
    for (const file of walk('src/app')) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        if (SYMBOL.test(line)) offenders.push(`${file}:${i + 1}: ${t.slice(0, 90)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
