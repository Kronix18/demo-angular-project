// @ts-check
/**
 * Visual regression tests for Phase 0B design fixes.
 */

import { test, expect } from '@playwright/test';

/**
 * Assert that all elements matching `selector` have zero inline style attributes.
 * An element has an inline style attribute when its Element.style.cssText is non-empty.
 */
async function noInlineStyles(selector) {
  const elems = await page.$$(`:scope ${selector}`);
  for (const el of elems) {
    // Check via the live DOM: getAttribute('style') === '' means no inline style.
    expect(el.getAttribute('style'), 'Element must not have an inline style attribute').toBe('');
  }
}

/**
 * Assert that the computed value of a CSS custom property on `selector` equals `expectedValue`.
 */
async function checkCustomProperty(selector, varName, expectedValue) {
  const computed = await page.evaluate(
    (sel, v) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error('Element not found: ' + sel);
      return window.getComputedStyle(el).getPropertyValue(v).trim();
    },
    selector,
    varName,
  );
  expect(computed, `CSS custom property ${varName} on ${selector} must resolve to "${expectedValue}"`).toBe(expectedValue);
}

/**
 * Assert that an element's background is a valid CSS gradient string (no JS-assigned hex).
 */
async function hasGradientBackground(selector) {
  const bg = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error('Selector not found');
    return window.getComputedStyle(el).background;
  }, selector);
  expect(bg.includes('linear-gradient'), 'Background must be a CSS gradient, not a JS-assigned color').toBe(true);
}

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-02: Register form — hero card + primary button styling
// ────────────────────────────────────────────────────────────────────────────────
test('0B-02 — register form — CSS-only hero card', async ({ page }) => {
  await page.goto('/register');

  // The header <h3> must use the :root color variable, not a JS-set 'color: red;'
  const computedColor = await page.evaluate(() => {
    const el = document.querySelector('.input-field');
    return window.getComputedStyle(el).backgroundColor;
  });
  expect(computedColor).toContain('var(--color-border)');

  // No inline style attribute present on the form group or its children
  await noInlineStyles('.form-group');
  await noInlineStyles('.input-field');
  await noInlineStyles('.btn-primary');

  // Confirm hero card background uses the primary color, not JS-mutated hex
  const heroBg = await page.evaluate(() => {
    const el = document.querySelector('.register-card') || document.querySelector('main:first-of-type');
    if (!el) throw new Error('No hero card found');
    return window.getComputedStyle(el).backgroundColor;
  });
  expect(heroBg.startsWith('rgb(249,')).toBe(true); // surface-50 is a light gray
});

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-03: Login page — glassmorphism card (backdrop-filter: blur(16px))
// ────────────────────────────────────────────────────────────────────────────────
test('0B-03 — login form — glassmorphism backdrop, no JS blur() mutations', async ({ page }) => {
  await page.goto('/login');

  const computedBackdrop = await page.evaluate(() => {
    const el = document.querySelector('.login-card');
    if (!el) throw new Error('Login card not found');
    return window.getComputedStyle(el).backdropFilter;
  });
  expect(computedBackdrop.includes('blur(16px)'), 'Backdrop filter must be provided by a CSS rule').toBe(true);

  // Assert no inline style attributes on children (e.g. from JS: el.style.transform = `translate3d(...)`):
  await noInlineStyles('.login-card');
});

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-04: Home page — flex grid + hover state lift
// ────────────────────────────────────────────────────────────────────────────────
test('0B-04 — home hero grid — hover-lift via transform, no JS mutations', async ({ page }) => {
  await page.goto('/');

  const el = page.locator('.demo-grid').first();
  await el.click({ button: 'left' }); // scroll to demo

  // Initial state: no transform applied by JS
  await page.waitForSelector('.card');
  const initialTransform = await page.evaluate(() => {
    const card = document.querySelector('.card');
    return window.getComputedStyle(card).transform;
  });
  expect(initialTransform).toBe('none');

  await page.hover('.btn-primary', async () => {
    const hoveredTransform = await page.evaluate(() => {
      const card = document.querySelector('.card');
      if (!card) throw new Error('Cannot find .card');
      return window.getComputedStyle(card).getPropertyValue('--hover-lift-transform');
    });
    // The CSS rule for .btn-primary:hover sets --hover-lift-transform to translateY(-2px)
    expect(hoveredTransform).not.toBe('none');
  });

  // Verify no inline style attribute exists on the card element itself
  await noInlineStyles('.card');
});

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-05: Screener page — sticky header + hover on result cards
// ────────────────────────────────────────────────────────────────────────────────
test('0B-05 — screener results — sticky header, hover results, no JS height mutations', async ({ page }) => {
  await page.goto('/screener');

  // Assertion: .results-header has no inline height attribute (height set via CSS :has rule instead)
  const headerStyleText = await page.evaluate(() => {
    return (document.querySelector('.results-header') || {}).style.cssText;
  });
  expect(headerStyleText.length).toBe(0);

  // Each result card uses a :hover rule that changes border-color and shadow — not a JS transition
  await noInlineStyles('.result-card');
});

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-06: Watchlist cards — CSS gradient price-change bars, no JS color interpolation
// ────────────────────────────────────────────────────────────────────────────────
test('0B-06 — watchlist cards — gradient backgrounds for positive/negative change', async ({ page }) => {
  await page.goto('/watchlist');

  const allCards = await page.locator('.card');
  for (const card of await allCards.all()) {
    // The gradient is computed from a CSS variable defined on :root
    const bg = await card.evaluate((el) => window.getComputedStyle(el).background);
    expect(bg.includes('linear-gradient(90deg,')).toBe(true);
    expect(bg.includes('var(--accent-success)') || bg.includes('var(--accent-error)')).toBe(true);
  }

  await checkCustomProperty('.price-change-bar', '--color-positive', 'rgb(34,197,94)');
});

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-07: Sidebar drawer — CSS transform translate(-100%) for slide-in/out, no JS toggles
// ────────────────────────────────────────────────────────────────────────────────
test('0B-07 — sidebar drawer — CSS-only slide-in via --sidebar-width custom property', async ({ page }) => {
  await page.goto('/?sidepanel=1'); // ?sidepanel=1 is a query param we read from URL, set in a template expression like [routerLink]

  const sidebarWidth = await page.evaluate(() => {
    const bodyStyle = (document.body ?? document.documentElement).style.cssText;
    return bodyStyle.includes('--sidebar-width:');
  });
  expect(sidebarWidth).toBe(true);
});

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-08: Navigation bar — flex-row + hover transitions on nav links
// ────────────────────────────────────────────────────────────────────────────────
test('0B-08 — navigation bar — flex layout, hover transition', async ({ page }) => {
  await page.goto('/');

  const navLink = await page.locator('a.nav-link[data-router-link="/screener"]').first();
  await page.waitForSelector(navLink);

  const transitionProperty = await navLink.evaluate(() => {
    const el = document.querySelector('.nav-link') ?? document.querySelector('[routerlink=/screener]');
    if (!el) throw new Error('Nav link not found');
    return window.getComputedStyle(el).transitionProperty;
  });
  // Should be 'background-color' or 'background, transform', never an empty string (which would indicate no CSS transition rule at all)
  expect(transitionProperty).toBe('background-color');

  await noInlineStyles('.nav-link[data-router-link="/screener"]');
});

// ────────────────────────────────────────────────────────────────────────────────
// Task 0B-XX: General regression — all elements must have style="" (no inline styles at all)
// ────────────────────────────────────────────────────────────────────────────────
test('0B-XX — no element in the DOM has an inline style attribute', async ({ page }) => {
  await page.goto('/');

  // Find every element that currently has a non-empty style attribute value.
  // If any such element exists, it means some JS or a framework directive is mutating styles at render time.
  const inlineStyleEls = await page.evalOnSelectorAll('body', (sel) => {
    const el = document.querySelector(sel);
    if (!el) return undefined;
    const styleAttrElm = document.querySelector(sel + '[style]') ?? null; // selector query for [style] attribute
    return styleAttrElm || null;
  });

  expect(inlineStyleEls).toBe(null);
});

// ────────────────────────────────────────────────────────────────────────────────
/// End of file. Each test above imports `page` from Playwright's test, so no extra imports needed in each task test.
// You also need to run: npm install playwright && npx playwright install-deps
/// ────────────────────────────────────────────────────────────────────────────────
export { noInlineStyles, checkCustomProperty };
