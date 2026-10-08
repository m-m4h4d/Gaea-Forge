import { writeFile } from 'node:fs/promises';
import { createArticle, expect, openApp, openArticle, openImportTab, test, typeAtEndOfEditor, confirmDialog } from './fixtures';

const editor = (page: import('@playwright/test').Page) => page.locator('.ProseMirror');
const inspector = (page: import('@playwright/test').Page) => page.locator('aside').last();

test('linking with [[ creates a working link and a backlink', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Queen Mira');
  await openArticle(page, 'Welcome to Gaea-Forge');

  await typeAtEndOfEditor(page, ' Ruled by [[que');
  const picker = page.getByRole('listbox', { name: 'Link to article' });
  await expect(picker.getByRole('option', { name: /Queen Mira/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(picker).toBeHidden();

  const link = editor(page).locator('a.lore-link', { hasText: 'Queen Mira' });
  await expect(link).toBeVisible();
  await expect(inspector(page).getByRole('button', { name: 'Queen Mira' })).toBeVisible(); // Links To
  await expect(page.getByText('All changes saved')).toBeVisible();

  // Survives a reload, and clicking it opens the target
  await page.reload();
  await expect(editor(page).locator('a.lore-link', { hasText: 'Queen Mira' })).toBeVisible();
  await editor(page).locator('a.lore-link', { hasText: 'Queen Mira' }).click();
  await expect(editor(page).locator('h1')).toHaveText('Queen Mira');

  // The target lists the source under Mentioned In, which links back
  await expect(inspector(page).getByText('Mentioned In (1)')).toBeVisible();
  await inspector(page).getByRole('button', { name: /Welcome to Gaea-Forge/ }).click();
  await expect(editor(page).locator('h1')).toHaveText('Welcome to Gaea-Forge');
});

test('typing a full [[Title|label]] turns into a link', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Queen Mira');
  await openArticle(page, 'Welcome to Gaea-Forge');

  await typeAtEndOfEditor(page, ' Ask [[queen mira|the Queen]]');
  await page.keyboard.press('Escape');
  const link = editor(page).locator('a.lore-link', { hasText: 'the Queen' });
  await expect(link).toBeVisible();
  // The typed markup is replaced by the link, not left as text
  await expect(editor(page)).not.toContainText('[[queen mira|the Queen]]');
});

test('the [[ picker can create a new article', async ({ page }) => {
  await openApp(page);
  await typeAtEndOfEditor(page, ' Travel to [[Emberfall Keep');
  await page.getByRole('option', { name: /Create “Emberfall Keep”/ }).click();

  await expect(editor(page).locator('a.lore-link', { hasText: 'Emberfall Keep' })).toBeVisible();
  await expect(page.locator('aside').first().getByRole('button', { name: 'Emberfall Keep' })).toBeVisible();
});

test('links to deleted articles are flagged', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Doomed Tower');
  await openArticle(page, 'Welcome to Gaea-Forge');
  await typeAtEndOfEditor(page, ' See [[Doomed');
  await page.keyboard.press('Enter');
  await expect(page.getByText('All changes saved')).toBeVisible();

  await openArticle(page, 'Doomed Tower');
  await page.getByTitle('Delete this article').click();
  await openArticle(page, 'Welcome to Gaea-Forge');

  await expect(editor(page).locator('.lore-link-missing')).toBeVisible();
  await expect(inspector(page).getByText('Deleted article')).toBeVisible();
});

test('[[links]] in imported documents are resolved', async ({ page }, testInfo) => {
  await openApp(page);
  const md = testInfo.outputPath('linked.md');
  await writeFile(md, '## Alpha Hero\nSworn protector of [[Beta City]].\n\n## Beta City\nA city on a lake.\n');
  await openImportTab(page);
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(md);
  await page.getByRole('button', { name: 'Import 2 Articles' }).click();
  await expect(page.getByText('Imported 2 articles.')).toBeVisible();

  await openArticle(page, 'Alpha Hero');
  await expect(editor(page).locator('a.lore-link', { hasText: 'Beta City' })).toBeVisible();
  await openArticle(page, 'Beta City');
  await expect(inspector(page).getByRole('button', { name: /Alpha Hero/ })).toBeVisible();
});

test('linked articles are joined on the world web', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Queen Mira');
  await openArticle(page, 'Welcome to Gaea-Forge');
  await typeAtEndOfEditor(page, ' [[Queen');
  await page.keyboard.press('Enter');

  await page.getByText('Master World Web').first().click();
  await expect(page.getByTestId('article-link-line')).toHaveCount(1);
});

test('links survive a backup export and restore', async ({ page }, testInfo) => {
  await openApp(page);
  await createArticle(page, 'Queen Mira');
  await openArticle(page, 'Welcome to Gaea-Forge');
  await typeAtEndOfEditor(page, ' [[Queen');
  await page.keyboard.press('Enter');
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.getByTitle(/Intelligent Document Import/).click();
  await page.getByRole('button', { name: 'Backup & Restore' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download .json Backup').click(),
  ]);
  const backupPath = testInfo.outputPath('linked-backup.json');
  await download.saveAs(backupPath);

  await page.getByRole('button', { name: 'Document Import' }).click();
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(backupPath);
  await page.getByRole('button', { name: /Restore Backup/ }).click();
  await confirmDialog(page, 'Restore Backup');
  await expect(page.getByText(/Restored 2 articles/)).toBeVisible();

  await openArticle(page, 'Welcome to Gaea-Forge');
  await expect(editor(page).locator('a.lore-link', { hasText: 'Queen Mira' })).toBeVisible();
  await expect(editor(page).locator('.lore-link-missing')).toHaveCount(0);
});
