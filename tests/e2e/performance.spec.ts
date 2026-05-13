import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('home page loads within performance budget', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Performance tests run on desktop only');

    // Measure page load time
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;

    // Performance budget: page should load within 5 seconds (more realistic for E2E)
    expect(loadTime).toBeLessThan(5000);

    // Check that critical resources are loaded
    const mainContent = page.locator('[data-testid="text-month-title"]');
    await expect(mainContent).toBeVisible();

    // Measure Largest Contentful Paint (LCP) approximation
    const lcpElement = await page.locator('[data-testid="text-month-title"]').first();
    const lcpTime = await lcpElement.evaluate(() => {
      return performance.now();
    });

    // LCP should be under 4 seconds (more realistic for E2E)
    expect(lcpTime).toBeLessThan(4000);
  });

  test('series sidebar renders efficiently', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Sidebar tests run on desktop only');

    await page.goto('/');

    // Measure time to render sidebar
    const startTime = Date.now();

    const sidebar = page.locator('[data-testid="series-sidebar"]');
    await expect(sidebar).toBeVisible();

    const renderTime = Date.now() - startTime;

    // Sidebar should render within 500ms
    expect(renderTime).toBeLessThan(500);

    // Check that series items are rendered (may take time to load)
    const seriesItems = sidebar.locator('[data-testid^="sidebar-series-"]');
    
    // Wait up to 10 seconds for series to load
    await expect(seriesItems.first()).toBeVisible({ timeout: 10000 });

    const itemCount = await seriesItems.count();

    // Should have at least some series loaded
    expect(itemCount).toBeGreaterThan(0);
  });

  test('sync dialog opens quickly', async ({ page }) => {
    await page.goto('/');

    const syncButton = page.getByRole('button', { name: /sync/i });
    await expect(syncButton).toBeVisible();

    // Measure dialog open time
    const startTime = Date.now();

    await syncButton.click();

    const syncDialog = page.locator('[data-testid="sync-dialog"]');
    await expect(syncDialog).toBeVisible();

    const openTime = Date.now() - startTime;

    // Dialog should open within 500ms
    expect(openTime).toBeLessThan(500);
  });
});