import { test } from '@playwright/test';

test.describe('Organizations', () => {
  test.skip('allows owners to invite new teammates', async ({ page }) => {
    await page.goto('/dashboard/team');
    await page.getByRole('button', { name: /invite/i }).click();
    await page.getByLabel('Email').fill('teammate@example.com');
    await page.getByRole('combobox', { name: /role/i }).selectOption('member');
    await page.getByRole('button', { name: /send invite/i }).click();
    await page.getByRole('cell', { name: /teammate@example.com/i }).waitFor();
  });
});
