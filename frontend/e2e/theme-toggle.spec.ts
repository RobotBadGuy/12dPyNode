import { test, expect } from '@playwright/test';

// Suppress the PC-909 onboarding tour so its spotlight overlay can't intercept
// clicks (same trick as golden-path.spec.ts).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('pychain_tour_completed', '1');
  });
});

test('theme toggle flips dark<->light and persists across reload', async ({ page }) => {
  await page.goto('/');

  const html = page.locator('html');
  // Default theme is dark.
  await expect(html).toHaveClass(/dark/);

  // The toggle lives in the always-visible TopBar; in dark it offers light.
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(html).not.toHaveClass(/dark/);

  // Choice persists across a reload.
  await page.reload();
  await expect(html).not.toHaveClass(/dark/);

  // And toggles back to dark.
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(html).toHaveClass(/dark/);
});
