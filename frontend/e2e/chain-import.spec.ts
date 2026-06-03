import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.join(__dirname, 'fixtures', 'sample.chain');

// Suppress the PC-909 onboarding tour so its overlay can't intercept interaction.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('pychain_tour_completed', '1'));
});

test('import a .chain reconstructs nodes + shows the report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();

  // The Import affordance feeds a hidden file input (accept=".json,.chain").
  await page.setInputFiles('input[type="file"][accept*=".chain"]', FIXTURE);

  // The PC-1101 report modal confirms the reconstruction.
  await expect(page.getByText(/Reconstructed\s+2\s+of\s+2/)).toBeVisible();
});
