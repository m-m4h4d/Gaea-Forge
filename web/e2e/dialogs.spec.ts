import { writeFile } from 'node:fs/promises';
import { confirmDialog, createArticle, createCanvas, expect, makeImage, openApp, openArticle, openImportTab, test, typeAtEndOfEditor } from './fixtures';

const sidebar = (page: import('@playwright/test').Page) => page.locator('aside').first();
const editor = (page: import('@playwright/test').Page) => page.locator('.ProseMirror');

test('deleting an article can be undone, links and canvas places included', async ({ page }, testInfo) => {
  await openApp(page);
  await createArticle(page, 'Queen Mira');

  // Link to it from another article, and put it on a timeline and a map
  await openArticle(page, 'Welcome to Gaea-Forge');
  await typeAtEndOfEditor(page, ' [[Queen');
  await page.keyboard.press('Enter');
  await createCanvas(page, 'Chronicle', 'Timeline');
  await page.getByRole('button', { name: 'Add Event' }).click();
  const ev = page.getByRole('dialog', { name: 'Add Event' });
  await ev.getByLabel('Linked article').selectOption({ label: 'Queen Mira (Characters & Cast)' });
  await ev.getByLabel('Year *').fill('12');
  await ev.getByRole('button', { name: 'Save' }).click();
  await createCanvas(page, 'Atlas', 'Map');
  const image = testInfo.outputPath('atlas.png');
  await makeImage(page, image, 400, 300);
  await page.getByLabel('Map image file').setInputFiles(image);
  await page.getByRole('button', { name: 'Add Pin' }).click();
  const box = (await page.getByTestId('map-viewport').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole('dialog', { name: 'Add Pin' }).getByLabel('Linked article').selectOption({ label: 'Queen Mira (Characters & Cast)' });
  await page.getByRole('button', { name: 'Save Pin' }).click();

  // Delete without a confirmation prompt, then undo from the notice
  await openArticle(page, 'Queen Mira');
  await page.getByTitle('Delete this article').click();
  await expect(sidebar(page).getByRole('button', { name: 'Queen Mira', exact: true })).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();

  await expect(editor(page).locator('h1')).toHaveText('Queen Mira');
  await expect(page.locator('aside').last().getByRole('button', { name: /Welcome to Gaea-Forge/ })).toBeVisible(); // Mentioned In
  await sidebar(page).getByText('Atlas').click();
  await expect(page.getByRole('button', { name: 'Pin: Queen Mira' })).toBeVisible();
  await sidebar(page).getByText('Chronicle').click();
  await expect(page.getByTestId('timeline-event')).toContainText('Queen Mira');
  await openArticle(page, 'Welcome to Gaea-Forge');
  await expect(editor(page).locator('.lore-link-missing')).toHaveCount(0);
});

test('deleting a canvas can be undone', async ({ page }) => {
  await openApp(page);
  await createCanvas(page, 'Chronicle', 'Timeline');
  await page.getByRole('button', { name: 'Add Era' }).click();
  const era = page.getByRole('dialog', { name: 'Add Era' });
  await era.getByLabel('Name *').fill('First Age');
  await era.getByLabel('Start year *').fill('0');
  await era.getByRole('button', { name: 'Save' }).click();

  await page.getByTitle('Delete this canvas').click();
  await expect(sidebar(page).getByText('Chronicle')).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('region', { name: 'Era: First Age' })).toBeVisible();
  await page.reload();
  await expect(sidebar(page).getByText('Chronicle')).toBeVisible();
});

test('confirmation dialogs are keyboard friendly and can be cancelled', async ({ page }, testInfo) => {
  await openApp(page);
  const md = testInfo.outputPath('one.md');
  await writeFile(md, '## Lone Entry\nSome text.\n');
  await openImportTab(page);
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(md);
  await page.getByText('Replace current world').click();
  await page.getByRole('button', { name: 'Replace World with 1 Articles' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Replace your world?' });
  await expect(dialog).toBeVisible();
  // Danger dialogs focus Cancel first, and Tab stays inside the dialog
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Replace World' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(sidebar(page).getByText('Welcome to Gaea-Forge').first()).toBeVisible();
  await expect(sidebar(page).getByText('Lone Entry')).toHaveCount(0);

  // Confirming goes ahead
  await openImportTab(page);
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(md);
  await page.getByText('Replace current world').click();
  await page.getByRole('button', { name: 'Replace World with 1 Articles' }).click();
  await confirmDialog(page, 'Replace World');
  await expect(page.getByText('Imported 1 articles.')).toBeVisible();
});

test('Ctrl+K jumps to articles and canvases, and can create an article', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Queen Mira');
  await createArticle(page, 'Queensguard Barracks');
  await openArticle(page, 'Welcome to Gaea-Forge');

  const switcher = page.getByRole('dialog', { name: 'Quick switcher' });
  await editor(page).click();
  await page.keyboard.press('Control+k');
  await expect(switcher).toBeVisible();
  await page.keyboard.type('qmira');
  await page.keyboard.press('Enter');
  await expect(switcher).toBeHidden();
  await expect(editor(page).locator('h1')).toHaveText('Queen Mira');

  await page.keyboard.press('Control+k');
  await page.keyboard.type('family');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /Add Character Node/ })).toBeVisible();

  await page.keyboard.press('Control+k');
  await page.keyboard.type('que');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(editor(page).locator('h1')).toHaveText(/Queen/);

  await page.keyboard.press('Control+k');
  await page.keyboard.type('Emberfall Keep');
  await expect(switcher.getByRole('option', { name: /Create article/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(editor(page).locator('h1')).toHaveText('Emberfall Keep');

  await page.keyboard.press('Control+k');
  await page.keyboard.press('Escape');
  await expect(switcher).toBeHidden();
});
