import { createArticle, createCanvas, expect, openApp, openArticle, test } from './fixtures';

const sidebar = (page: import('@playwright/test').Page) => page.locator('aside').first();
const editorTitle = (page: import('@playwright/test').Page) => page.locator('.ProseMirror h1');

// openApp waits for the editor, which a restored canvas view doesn't show
async function reload(page: import('@playwright/test').Page) {
  await page.reload();
  await expect(sidebar(page).getByText('Family Tree Canvas').first()).toBeVisible();
}

test('a reload reopens the last article, canvas, panels and folders', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Queen Mira');
  await createArticle(page, 'Ashfall');
  await openArticle(page, 'Queen Mira');
  await reload(page);
  await expect(editorTitle(page)).toHaveText('Queen Mira');

  // Hide the inspector and collapse a folder, then move to a canvas
  await page.getByTitle('Hide Entity Inspector').click();
  const emptyFolders = await sidebar(page).getByText('No articles yet').count();
  await sidebar(page).getByRole('button', { name: 'Realms & Locations' }).click();
  await expect(sidebar(page).getByText('No articles yet')).toHaveCount(emptyFolders - 1);
  await createCanvas(page, 'Chronicle', 'Timeline');
  await expect(page.getByRole('button', { name: 'Add Event' })).toBeVisible();
  await reload(page);
  await expect(page.getByRole('button', { name: 'Add Event' })).toBeVisible();
  // Realms stays collapsed, Characters stays open
  await expect(sidebar(page).getByText('No articles yet')).toHaveCount(emptyFolders - 1);
  await expect(sidebar(page).getByRole('button', { name: 'Queen Mira', exact: true })).toBeVisible();

  // Going back to the editor lands on the article that was open before, inspector still hidden
  await page.getByRole('button', { name: 'Lore Editor' }).click();
  await expect(editorTitle(page)).toHaveText('Queen Mira');
  await expect(page.getByTitle('Show Entity Inspector')).toBeVisible();

  // Recent items survive too: the quick switcher lists them first, newest first
  await page.keyboard.press('Control+k');
  const options = page.getByRole('dialog', { name: 'Quick switcher' }).getByRole('option');
  await expect(options.nth(0)).toContainText('Chronicle');
  await expect(options.nth(1)).toContainText('Queen Mira');
});

test('a saved view pointing at deleted items falls back safely', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() =>
    localStorage.setItem(
      'gaea_view_state',
      JSON.stringify({ viewMode: 'canvas', canvasId: 'deleted-canvas', articleId: 'deleted-article', recentIds: ['deleted-article'] })
    )
  );
  await page.reload();
  await expect(editorTitle(page)).toHaveText(/Welcome to Gaea-Forge/);

  // Garbage in storage is ignored too
  await page.evaluate(() => localStorage.setItem('gaea_view_state', '{not json'));
  await page.reload();
  await expect(editorTitle(page)).toHaveText(/Welcome to Gaea-Forge/);
});
