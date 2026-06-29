import { test, expect } from "@playwright/test";

test("has manifest link in the page", async ({ page }) => {
  await page.goto("/app");
  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute("href", /manifest/);
});

test("manifest is served and valid", async ({ page }) => {
  await page.goto("/app");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const response = await page.request.get(manifestHref!);
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: expect.stringContaining("GridStart"),
    short_name: "GridStart",
    display: "standalone",
  });
  expect(manifest.icons).toBeDefined();
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});

test("service worker is registered after page load", async ({ page }) => {
  await page.goto("/app");

  // Wait for app to render fully — this also handles any SW-triggered reload
  // from the controllerchange → window.location.reload() in main.tsx
  await expect(page.locator('[data-testid="text-month-title"]')).toBeVisible({ timeout: 15000 });

  const hasSw = await page.evaluate(() => {
    return "serviceWorker" in navigator;
  });
  expect(hasSw).toBeTruthy();

  // Wait for SW to be active (dev mode uses async HMR-based registration)
  const swReady = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(swReady).toBeTruthy();
});

test("PWA icons are served", async ({ request }) => {
  const icons = ["/pwa-192x192.png", "/pwa-512x512.png"];
  for (const icon of icons) {
    const response = await request.get(icon);
    expect(response.ok()).toBeTruthy();
    expect(await response.headers()).toHaveProperty("content-type", expect.stringContaining("image/png"));
  }
});

test("has theme-color meta tag", async ({ page }) => {
  await page.goto("/app");
  const meta = page.locator('meta[name="theme-color"]');
  await expect(meta).toHaveAttribute("content", "#09090b");
});

test.skip("app shell loads offline after service worker activation", async ({ page, context }) => {
  // Load the page first so the SW gets installed
  await page.goto("/app");
  await expect(page.locator('[data-testid="text-month-title"]')).toBeVisible();

  // Wait for SW to activate
  const swReady = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(swReady).toBeTruthy();

  // Go offline
  await context.setOffline(true);

  // Reload - the SW should serve the precached app shell
  await page.reload();
  await expect(page.locator('[data-testid="text-month-title"]')).toBeVisible({
    timeout: 15000,
  });
});
