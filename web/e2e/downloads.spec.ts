import { expect, openApp, test } from './fixtures';

const INSTALLER = 'https://github.com/m-m4h4d/Gaea-Forge/releases/latest/download/Gaea-Forge-Windows-x64-setup.exe';

test('the web version offers the Windows app from the latest release', async ({ page }) => {
  await openApp(page);
  const link = page.getByRole('link', { name: 'Download the Windows app' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', INSTALLER);
});

test('the desktop app does not offer itself', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.isTauri = true;
    w.__TAURI_INTERNALS__ = { invoke: async () => null };
  });
  await openApp(page);
  await expect(page.getByRole('link', { name: 'Download the Windows app' })).toHaveCount(0);
});
