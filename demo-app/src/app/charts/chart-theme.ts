/**
 * Runtime access to the theme's custom properties for canvas drawing (Chart.js
 * cannot use var()). Tokens live in src/styles/theme.scss — never inline colours.
 */
export function cssVar(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return '';
  }
}

/** Resolves `var(--name)` references (as used by indicator definitions); other values pass through. */
export function resolveColor(color: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(color.trim());
  return m ? cssVar(m[1]) : color;
}
