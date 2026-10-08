import { readFile, writeFile } from 'node:fs/promises';
import { createArticle, expect, openApp, openBackupTab, openImportTab, test, confirmDialog } from './fixtures';

async function exportBackup(page: import('@playwright/test').Page, path: string) {
  await openBackupTab(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download .json Backup').click(),
  ]);
  await download.saveAs(path);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  return JSON.parse(await readFile(path, 'utf8'));
}

test('deleting an article removes its canvas nodes and connections', async ({ page }, testInfo) => {
  await openApp(page);

  // Link the welcome article to a free node on the Master World Web
  await page.getByText('Master World Web').first().click();
  await page.getByRole('button', { name: /Add Floating Node/ }).click();
  const backupPath = testInfo.outputPath('before.json');
  const before = await exportBackup(page, backupPath);
  const web = before.canvases.find((c: { id: string }) => c.id === 'canvas-master-web');
  expect(web.nodes.some((n: { articleId?: string }) => n.articleId === 'welcome-gaea-forge')).toBe(true);

  await page.getByText('Welcome to Gaea-Forge').first().click();
  await page.getByTitle('Delete this article').click();

  const after = await exportBackup(page, testInfo.outputPath('after.json'));
  expect(after.articles.some((a: { id: string }) => a.id === 'welcome-gaea-forge')).toBe(false);
  const prunedWeb = after.canvases.find((c: { id: string }) => c.id === 'canvas-master-web');
  expect(prunedWeb.nodes.some((n: { articleId?: string }) => n.articleId === 'welcome-gaea-forge')).toBe(false);
  expect(prunedWeb.nodes.length).toBe(web.nodes.length - 1);
});

test('backups include articles, canvases and the workspace role', async ({ page }, testInfo) => {
  await openApp(page);
  await createArticle(page, 'Survivor Keep');
  const backup = await exportBackup(page, testInfo.outputPath('backup.json'));

  expect(backup.format).toBe('gaea-forge-backup');
  expect(backup.roleId).toBe('author-bible');
  expect(backup.articles.map((a: { title: string }) => a.title)).toContain('Survivor Keep');
  expect(backup.canvases.map((c: { title: string }) => c.title)).toEqual(
    expect.arrayContaining(['Master World Web', 'Family Tree Canvas'])
  );
});

test('a replace import can be undone from its safety snapshot', async ({ page }, testInfo) => {
  await openApp(page);
  await createArticle(page, 'Survivor Keep');

  const md = testInfo.outputPath('import.md');
  await writeFile(md, '## Alpha Hero\nAge: 30\nA brave soul.\n\n## Beta City\nA city on a lake.\n');
  await openImportTab(page);
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(md);
  await page.getByText('Replace current world').click();
  await page.getByRole('button', { name: 'Replace World with 2 Articles' }).click();
  await confirmDialog(page, 'Replace World');
  await expect(page.getByText('Imported 2 articles.')).toBeVisible();
  await expect(page.getByText('Survivor Keep')).toHaveCount(0);

  await openBackupTab(page);
  await expect(page.getByText(/Before replacing world with 2 imported articles/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).first().click();
  await confirmDialog(page, 'Restore Snapshot');
  await expect(page.getByText(/Restored 2 articles and 2 canvases/)).toBeVisible();
  await expect(page.getByText('Survivor Keep').first()).toBeVisible();
  await expect(page.getByText('Alpha Hero')).toHaveCount(0);
});

test('a backup file restores the whole world', async ({ page }, testInfo) => {
  await openApp(page);
  await createArticle(page, 'Survivor Keep');
  const backupPath = testInfo.outputPath('backup.json');
  await exportBackup(page, backupPath);

  await page.getByText('Survivor Keep').first().click();
  await page.getByTitle('Delete this article').click();
  await expect(page.locator('aside').first().getByText('Survivor Keep')).toHaveCount(0);

  await openImportTab(page);
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(backupPath);
  await expect(page.getByText('Gaea-Forge World Backup')).toBeVisible();
  await page.getByRole('button', { name: /Restore Backup/ }).click();
  await confirmDialog(page, 'Restore Backup');
  await expect(page.getByText(/Restored 2 articles/)).toBeVisible();

  await page.reload();
  await expect(page.getByText('Survivor Keep').first()).toBeVisible();
});
