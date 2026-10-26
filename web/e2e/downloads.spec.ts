import { expect, openApp, test } from './fixtures';

const LATEST = 'https://github.com/m-m4h4d/Gaea-Forge/releases/latest';

test('the web version offers the desktop app for each platform', async ({ page }) => {
  await openApp(page);
  const downloads = page.getByRole('navigation', { name: 'Download the desktop app' });
  await expect(downloads).toBeVisible();
  await expect(downloads.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute(
    'href',
    `${LATEST}/download/Gaea-Forge-Windows-x64-setup.exe`
  );
  await expect(downloads.getByRole('link', { name: 'Download for macOS' })).toHaveAttribute(
    'href',
    `${LATEST}/download/Gaea-Forge-macOS-universal.dmg`
  );
  await expect(downloads.getByRole('link', { name: 'Download for Linux' })).toHaveAttribute(
    'href',
    `${LATEST}/download/Gaea-Forge-Linux-x86_64.AppImage`
  );
  // The label links to the release page with every file
  await expect(downloads.getByRole('link', { name: 'Desktop app:' })).toHaveAttribute('href', LATEST);
});

test('the desktop app does not offer itself', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.isTauri = true;
    w.__TAURI_INTERNALS__ = { invoke: async () => null };
  });
  await openApp(page);
  await expect(page.getByRole('navigation', { name: 'Download the desktop app' })).toHaveCount(0);
});
