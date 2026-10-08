import { expect, openApp, test } from './fixtures';

const theme = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);

test('the color mode toggle cycles dark, light and system, and persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  expect(await theme(page)).toBe('dark');

  await page.getByRole('button', { name: /Dark theme/ }).click();
  expect(await theme(page)).toBe('light');
  await page.reload();
  await expect(page.getByRole('button', { name: /Light theme/ })).toBeVisible();
  expect(await theme(page)).toBe('light');

  // System follows the OS preference, including later changes
  await page.getByRole('button', { name: /Light theme/ }).click();
  await expect(page.getByRole('button', { name: /System theme/ })).toBeVisible();
  expect(await theme(page)).toBe('light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => theme(page)).toBe('dark');

  await page.getByRole('button', { name: /System theme/ }).click();
  await expect(page.getByRole('button', { name: /Dark theme/ })).toBeVisible();
});

test('saved theme and role are applied on load without hydration errors', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gaea_color_mode', 'light');
  });
  await openApp(page);

  // Pick a non-default role, then reload: both must survive and render cleanly
  await page.getByTitle('Switch Workspace Role & Theme').click();
  await page.getByText('Game Designer / Developer').click();
  await page.getByRole('button', { name: /Launch Game Dev GDD/ }).click();
  await expect(page.getByTitle('Switch Workspace Role & Theme')).toContainText('Game Dev GDD');

  await page.reload();
  await expect(page.getByTitle('Switch Workspace Role & Theme')).toContainText('Game Dev GDD');
  expect(await theme(page)).toBe('light');
  const accent = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--role-accent').trim()
  );
  expect(accent).toBe('#06b6d4');
  // The fixture fails the test on any uncaught page error, including hydration mismatches
});

test('the 3D cosmos stays dark inside a light page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gaea_color_mode', 'light'));
  await openApp(page);
  await page.getByText('Master World Web').first().click();
  await page.getByRole('button', { name: /3D Cosmos/ }).click();
  await expect(page.locator('[data-theme="dark"]').first()).toBeVisible();
});
