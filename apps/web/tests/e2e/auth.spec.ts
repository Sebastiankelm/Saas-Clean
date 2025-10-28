import { test } from '@playwright/test';

test.describe('Authentication', () => {
  test.skip('allows a user to sign in with email and password', async ({ page }) => {
    await page.goto('/sign-in');
    // TODO: Replace selectors with real values once the auth form is wired to test data.
    await page.getByLabel('Email').fill('test@test.com');
    await page.getByLabel('Password').fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');
  });
});
