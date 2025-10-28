import { test } from '@playwright/test';

test.describe('Billing', () => {
  test.skip('redirects users to the Stripe customer portal', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await page.getByRole('button', { name: /manage subscription/i }).click();
    await page.waitForURL('https://billing.stripe.com/**', { timeout: 30_000 });
  });
});
