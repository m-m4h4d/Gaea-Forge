import { expect, openApp, test, typeAtEndOfEditor } from './fixtures';

test('saves edits after a short debounce and keeps them across reloads', async ({ page }) => {
  await openApp(page);
  await typeAtEndOfEditor(page, ' Persisted edit');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.reload();
  await expect(page.locator('.ProseMirror')).toContainText('Persisted edit');
});

test('recovers an edit typed just before the page reloads', async ({ page }) => {
  await openApp(page);
  await typeAtEndOfEditor(page, ' Typed right before reload');
  await page.reload();
  await expect(page.locator('.ProseMirror')).toContainText('Typed right before reload');
});

test('keeps every character when typing fast', async ({ page }) => {
  await openApp(page);
  const burst = 'The quick brown fox jumps over the lazy dog near Aethelgard. '.repeat(4).trim();
  await typeAtEndOfEditor(page, ` ${burst}`);
  await expect(page.getByText('All changes saved')).toBeVisible();
  await expect(page.locator('.ProseMirror')).toContainText(burst);
});

test('moves canvases saved by older versions out of localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(
      'gaea_canvases_v3',
      JSON.stringify([
        { id: 'canvas-legacy', title: 'Legacy Tree', type: 'family-tree', nodes: [], connections: [], last_updated: 1 },
      ])
    );
  });
  await page.goto('/');
  await expect(page.getByText('Legacy Tree').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('gaea_canvases_v3'))).toBeNull();

  await page.reload();
  await expect(page.getByText('Legacy Tree').first()).toBeVisible();
});
