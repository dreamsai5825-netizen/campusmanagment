import { test, expect } from '@playwright/test';

test.describe('Home and login flow', () => {
  test('home page loads and shows CampusConnect', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('CampusConnect')).toBeVisible({ timeout: 10000 });
  });

  test('login page has sign in and demo tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /demo login/i })).toBeVisible();
  });

  test('demo login tab shows role selector and login button', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /demo login/i }).click();
    await expect(page.getByRole('combobox', { name: /role/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /login \(demo\)/i })).toBeVisible();
  });

  test('demo login navigates to dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /demo login/i }).click();
    await page.getByRole('button', { name: /login \(demo\)/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|admin-dashboard|student-dashboard)/);
  });
});
