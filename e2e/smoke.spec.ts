import { expect, test } from '@playwright/test';

/**
 * Smoke coverage for the outcomes step 1 is responsible for: the app boots from
 * the npm-built bundle, Tailwind is compiled rather than fetched, nothing is
 * loaded from a third-party CDN, and the PWA is installable.
 */

const THIRD_PARTY_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'esm.sh',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

test('boots and renders the app shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/SebilLink/);
  await expect(page.locator('#root')).not.toBeEmpty();
});

test('loads no third-party assets', async ({ page }) => {
  const offenders: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (THIRD_PARTY_HOSTS.some((host) => url.includes(host))) offenders.push(url);
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  expect(offenders).toEqual([]);
});

test('compiles Tailwind utilities into the bundle', async ({ page }) => {
  await page.goto('/');

  // The app root carries `flex h-screen`. If Tailwind were missing — as it would
  // be if the Play CDN script were simply deleted — this resolves to `block`.
  const display = await page
    .locator('#root > div')
    .first()
    .evaluate((element) => getComputedStyle(element).display);

  expect(display).toBe('flex');
});

test('serves an installable manifest with raster icons', async ({ page, request }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const response = await request.get(new URL(href!, page.url()).toString());
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.name).toContain('SebilLink');
  expect(manifest.display).toBe('standalone');

  const sizes: string[] = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');

  expect(
    manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable'),
  ).toBe(true);
});

test('registers a service worker for offline use', async ({ page }) => {
  await page.goto('/');

  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });

  expect(scope).toContain('localhost:4173');
});
