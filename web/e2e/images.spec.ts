import { readFile } from 'node:fs/promises';
import { expect, makeImage, openApp, openBackupTab, openImportTab, test } from './fixtures';

const artwork = (page: import('@playwright/test').Page) => page.locator('aside').last().getByRole('img', { name: 'Welcome to Gaea-Forge' });

test('cover artwork is stored, survives reloads, and travels in backups', async ({ page }, testInfo) => {
  await openApp(page);
  const image = testInfo.outputPath('cover.png');
  await makeImage(page, image, 3000, 1500);

  await page.getByLabel('Artwork image file').setInputFiles(image);
  await expect(artwork(page)).toBeVisible();
  // Large covers are scaled down to 2048px on their longest side
  expect(await artwork(page).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2048);

  await page.reload();
  await expect(artwork(page)).toBeVisible();

  // Backups carry the image data itself, not the internal reference
  await openBackupTab(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Download .json Backup').click()]);
  const backupPath = testInfo.outputPath('backup.json');
  await download.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  const welcome = backup.articles.find((a: { id: string }) => a.id === 'welcome-gaea-forge');
  expect(welcome.coverImage).toMatch(/^data:image\//);
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  // Restoring the backup brings the artwork back
  await openImportTab(page);
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(backupPath);
  await page.getByRole('button', { name: /Restore Backup/ }).click();
  await expect(page.getByText(/Restored 1 articles/)).toBeVisible();
  await page.reload();
  await expect(artwork(page)).toBeVisible();
});
