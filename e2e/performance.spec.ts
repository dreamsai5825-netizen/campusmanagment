import { test, expect } from '@playwright/test';

/**
 * E2E performance: assert key pages load within time budget.
 * Run with: npm run test:e2e -- --project=chromium e2e/performance.spec.ts
 */
const MAX_NAVIGATION_MS = 10000;

test.describe('Performance', () => {
  test('home page loads within budget', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(page.getByText('CampusConnect')).toBeVisible({ timeout: 10000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(MAX_NAVIGATION_MS);
  });

  test('student dashboard loads within budget after demo login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /demo login/i }).click();
    await page.getByRole('combobox', { name: /role/i }).click();
    await page.getByRole('option', { name: /student/i }).click();
    const start = Date.now();
    await page.getByRole('button', { name: /login \(demo\)/i }).click();
    await expect(page).toHaveURL(/\/student-dashboard/, { timeout: 10000 });
    await expect(page.getByText(/dashboard|attendance|timetable|my attendance/i).first()).toBeVisible({ timeout: 8000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(MAX_NAVIGATION_MS);
  });
});
