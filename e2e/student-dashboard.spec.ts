import { test, expect } from '@playwright/test';

test.describe('Student dashboard (demo)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /demo login/i }).click();
    await page.getByRole('combobox', { name: /role/i }).click();
    await page.getByRole('option', { name: /student/i }).click();
    await page.getByRole('button', { name: /login \(demo\)/i }).click();
    await expect(page).toHaveURL(/\/student-dashboard/);
  });

  test('student dashboard shows My Attendance link or content', async ({ page }) => {
    await expect(page.getByRole('link', { name: /attendance/i }).or(page.getByText(/attendance/i)).first()).toBeVisible({ timeout: 5000 });
  });

  test('attendance page loads', async ({ page }) => {
    await page.goto('/student-dashboard/attendance');
    await expect(page.getByRole('heading', { name: /my attendance/i })).toBeVisible({ timeout: 5000 });
  });
});
