// Analytics choices, on the built site in a real browser.
//
// The same spec runs in agentos.sh and agentos-live-docs; keep the two copies identical.
// CONSENT_BASE is where the built site is served, CONSENT_PAGES the paths to load (comma-separated),
// CONSENT_PICTURES a folder for screenshots of the bar. The build under test carries made-up vendor ids.
// Every request to Google or Microsoft is answered here with an empty script, so nothing leaves the runner.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.CONSENT_BASE || 'http://127.0.0.1:4173';
const PAGES = (process.env.CONSENT_PAGES || '/').split(',').map((p) => p.trim()).filter(Boolean);
const PICTURES = process.env.CONSENT_PICTURES || '';
const VENDOR = /(^|\.)(googletagmanager\.com|google-analytics\.com|doubleclick\.net|clarity\.ms|bing\.com)$/;
const ANALYTICS_COOKIE = /^(_ga|_gid|_gat|_clck|_clsk|MUID|CLID|ANONCHK)(_|$)/;

function vendorHost(url) {
  try {
    return VENDOR.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function watch(context, page) {
  const seen = [];
  await context.route(
    (url) => VENDOR.test(url.hostname),
    (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }),
  );
  page.on('request', (request) => {
    if (vendorHost(request.url())) seen.push(request.url());
  });
  return seen;
}

const bar = (page) => page.locator('[data-analytics-bar]');
const key = (page, name) => bar(page).getByRole('button', { name, exact: true });

async function analyticsCookies(context) {
  return (await context.cookies()).filter((c) => ANALYTICS_COOKIE.test(c.name)).map((c) => c.name);
}

async function settle(page) {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => Boolean(window.agentosConsent), null, { timeout: 20000 });
  await page.waitForTimeout(2500);
}

for (const path of PAGES) {
  test.describe(`analytics choices on ${path}`, () => {
    test('a first visit shows three equal keys and sends nothing to Google or Microsoft', async ({ context, page }) => {
      const seen = await watch(context, page);
      await page.goto(BASE + path);
      await expect(key(page, 'Accept all')).toBeVisible({ timeout: 20000 });
      await expect(key(page, 'Reject all')).toBeVisible();
      await expect(key(page, 'Choose')).toBeVisible();
      const classes = await bar(page).locator('.aoc-keys button').evaluateAll((b) => b.map((x) => x.className));
      expect(new Set(classes).size).toBe(1);
      await settle(page);
      expect(seen).toEqual([]);
      expect(await analyticsCookies(context)).toEqual([]);
    });

    test('Reject all keeps every vendor off on this page and the next', async ({ context, page }) => {
      const seen = await watch(context, page);
      await page.goto(BASE + path);
      await key(page, 'Reject all').click();
      await expect(bar(page)).toHaveCount(0);
      await page.reload();
      await settle(page);
      await expect(bar(page)).toHaveCount(0);
      expect(seen).toEqual([]);
      expect(await analyticsCookies(context)).toEqual([]);
    });

    test('Choose shows one switch per purpose, all off, and Measurement alone loads Google only', async ({ context, page }) => {
      const seen = await watch(context, page);
      await page.goto(BASE + path);
      await key(page, 'Choose').click();
      const switches = bar(page).getByRole('switch');
      await expect(switches).toHaveCount(2);
      for (const s of await switches.all()) await expect(s).toHaveAttribute('aria-checked', 'false');
      await expect(bar(page).getByText('Always on')).toBeVisible();
      await bar(page).getByRole('switch', { name: 'Measurement' }).click();
      await key(page, 'Save choices').click();
      await settle(page);
      expect(seen.some((u) => u.includes('googletagmanager.com/gtag/js'))).toBe(true);
      expect(seen.some((u) => u.includes('clarity.ms'))).toBe(false);
    });

    test('Accept all loads both, and turning both off from the footer clears their cookies', async ({ context, page }) => {
      const seen = await watch(context, page);
      await page.goto(BASE + path);
      await key(page, 'Accept all').click();
      await settle(page);
      expect(seen.some((u) => u.includes('googletagmanager.com/gtag/js'))).toBe(true);
      expect(seen.some((u) => u.includes('clarity.ms/tag/'))).toBe(true);

      const host = new URL(BASE).hostname;
      await context.addCookies(
        ['_ga', '_ga_TEST', '_clck', '_clsk'].map((name) => ({ name, value: '1', domain: host, path: '/' })),
      );
      await page.reload();
      await settle(page);
      await page.locator('[data-analytics-choices]').first().click();
      const measure = bar(page).getByRole('switch', { name: 'Measurement' });
      const record = bar(page).getByRole('switch', { name: 'Session recordings' });
      await expect(measure).toHaveAttribute('aria-checked', 'true');
      await expect(record).toHaveAttribute('aria-checked', 'true');
      await measure.click();
      await record.click();
      await key(page, 'Save choices').click();
      expect(await analyticsCookies(context)).toEqual([]);

      seen.length = 0;
      await page.reload();
      await settle(page);
      expect(seen).toEqual([]);
    });

    test('Global Privacy Control shows no bar and loads nothing, even over an earlier yes', async ({ context, page }) => {
      await context.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });
        localStorage.setItem(
          'analytics_consent_purposes',
          JSON.stringify({ purposes: { measure: true, record: true }, chosenAt: '2026-11-11T00:00:00Z', version: 'test' }),
        );
      });
      const seen = await watch(context, page);
      await page.goto(BASE + path);
      await settle(page);
      await expect(bar(page)).toHaveCount(0);
      expect(seen).toEqual([]);
    });
  });
}

test('pictures of the bar', async ({ browser }) => {
  test.skip(!PICTURES, 'CONSENT_PICTURES is not set');
  mkdirSync(PICTURES, { recursive: true });
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 } });
    const page = await context.newPage();
    await watch(context, page);
    await page.goto(BASE + PAGES[0]);
    await expect(key(page, 'Accept all')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(PICTURES, `bar-w${width}.png`) });
    await key(page, 'Choose').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(PICTURES, `bar-choose-w${width}.png`) });
    await context.close();
  }
});
