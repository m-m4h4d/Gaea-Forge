import { expect, openApp, openArticle, test } from './fixtures';

const inspector = (page: import('@playwright/test').Page) => page.locator('aside').last();
const editor = (page: import('@playwright/test').Page) => page.locator('.ProseMirror');

async function openNewArticle(page: import('@playwright/test').Page, category: string) {
  await page.getByRole('button', { name: /New Lore Entity/ }).last().click();
  const dialog = page.getByRole('dialog', { name: 'Create New Lore Entity' });
  await dialog.getByLabel('Category').selectOption(category);
  return dialog;
}

test('new articles start from their category template, which can be customised', async ({ page }) => {
  await openApp(page);

  // Built-in template for characters
  let dialog = await openNewArticle(page, 'Characters & Cast');
  await expect(dialog.getByTestId('template-summary')).toContainText(
    'Starts with: Role, Affiliation, Status · sections Appearance, Personality, Background'
  );
  await dialog.getByPlaceholder('e.g. Kingdom of Aethelgard').fill('Queen Mira');
  await dialog.getByRole('button', { name: 'Create Article' }).click();
  await expect(editor(page).locator('h2')).toHaveText(['Appearance', 'Personality', 'Background']);
  await expect(inspector(page).getByLabel('Role')).toHaveValue('');
  await expect(inspector(page).getByLabel('Status')).toHaveValue('Alive');
  await expect(inspector(page).getByLabel('Created')).not.toHaveValue('');

  // Customise: copy from the open article, then adjust
  dialog = await openNewArticle(page, 'Characters & Cast');
  await dialog.getByRole('button', { name: 'Edit template' }).click();
  const editorDialog = page.getByRole('dialog', { name: 'Template: Characters & Cast' });
  await expect(editorDialog.getByLabel('Properties')).toBeFocused();
  await editorDialog.getByRole('button', { name: 'Copy from “Queen Mira”' }).click();
  await expect(editorDialog.getByLabel('Properties')).toHaveValue('Role\nAffiliation\nStatus');
  await expect(editorDialog.getByLabel('Sections')).toHaveValue('Appearance\nPersonality\nBackground');
  await editorDialog.getByLabel('Properties').fill('Ship\nRank: Captain');
  await editorDialog.getByLabel('Sections').fill('Voyages');
  // Escape closes only the template editor
  await page.keyboard.press('Escape');
  await expect(editorDialog).toBeHidden();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit template' }).click();
  await editorDialog.getByLabel('Properties').fill('Ship\nRank: Captain');
  await editorDialog.getByLabel('Sections').fill('Voyages');
  await editorDialog.getByRole('button', { name: 'Save Template' }).click();
  await expect(editorDialog).toBeHidden();
  await expect(dialog.getByTestId('template-summary')).toContainText('Your template: Ship, Rank · sections Voyages');

  await dialog.getByPlaceholder('e.g. Kingdom of Aethelgard').fill('Captain Vel');
  await dialog.getByRole('button', { name: 'Create Article' }).click();
  await expect(editor(page).locator('h2')).toHaveText(['Voyages']);
  await expect(inspector(page).getByLabel('Rank')).toHaveValue('Captain');
  // Existing articles keep their fields
  await openArticle(page, 'Queen Mira');
  await expect(inspector(page).getByLabel('Role')).toBeVisible();

  // Saved on this device across reloads, and resettable
  await page.reload();
  dialog = await openNewArticle(page, 'Characters & Cast');
  await expect(dialog.getByTestId('template-summary')).toContainText('Your template: Ship, Rank');
  await dialog.getByRole('button', { name: 'Edit template' }).click();
  await editorDialog.getByRole('button', { name: 'Reset to built-in' }).click();
  await expect(dialog.getByTestId('template-summary')).toContainText('Starts with: Role, Affiliation, Status');

  // Other categories have their own
  await dialog.getByLabel('Category').selectOption('Realms & Locations');
  await expect(dialog.getByTestId('template-summary')).toContainText('sections Description, History, Points of Interest');
});
