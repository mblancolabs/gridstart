import { test, expect } from '@playwright/test';

test('home page loads and displays the sidebar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'This test is only for desktop viewports');

  await page.goto('/app');

  // Check that the page title is correct
  await expect(page).toHaveTitle(/GridStart/);

  // Check that the main content area exists
  await expect(page.locator('[data-testid="text-month-title"]')).toBeVisible();

  // Check that the sidebar is present
  const sidebar = page.locator('[data-testid="series-sidebar"]');
  await expect(sidebar).toBeVisible();

  // Check that series are displayed in the sidebar (wait for them to load)
  const seriesItems = sidebar.locator('[data-testid^="sidebar-series-"]');
  await expect(seriesItems.first()).toBeVisible({ timeout: 10000 });

  // Visual regression test - take a screenshot
  await expect(page).toHaveScreenshot('home-page-desktop.png', {
    fullPage: true,
    threshold: 0.1,
    maxDiffPixelRatio: 0.02,
  });
});

test('home page sync functionality works', async ({ page }) => {
  await page.goto('/app');

  // Find and click the sync button
  const syncButton = page.getByRole('button', { name: /sync/i });
  await expect(syncButton).toBeVisible();
  await syncButton.click();

  // Check that sync dialog appears
  const syncDialog = page.locator('[data-testid="sync-dialog"]');
  await expect(syncDialog).toBeVisible();

  // Take screenshot of dialog
  await expect(page).toHaveScreenshot('sync-dialog-open.png', {
    threshold: 0.1,
    maxDiffPixelRatio: 0.02,
  });

  // Close the dialog
  const closeButton = syncDialog.getByRole('button', { name: /close/i });
  await closeButton.click();

  // Dialog should be closed
  await expect(syncDialog).not.toBeVisible();
});

test('mobile series sheet works on small screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'This test is only for mobile viewports');

  await page.goto('/app');

  // On mobile, the sidebar should be hidden by default
  const sidebar = page.locator('[data-testid="series-sidebar"]');
  await expect(sidebar).not.toBeVisible();

  // Mobile series sheet should be accessible
  const mobileSheetTrigger = page.locator('[data-testid="mobile-series-trigger"]');
  await expect(mobileSheetTrigger).toBeVisible();
  await mobileSheetTrigger.click();

  // Sheet should open
  const mobileSheet = page.locator('[data-testid="mobile-series-sheet"]');
  await expect(mobileSheet).toBeVisible();

  // Visual regression for mobile view
  await expect(page).toHaveScreenshot('mobile-series-sheet-open.png', {
    fullPage: true,
    threshold: 0.1,
    maxDiffPixelRatio: 0.02,
  });
});