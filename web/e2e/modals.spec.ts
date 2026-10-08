import { writeFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { expect, openApp, openImportTab, test } from './fixtures';

// Tab through more stops than any modal has; focus must never leave the dialog
async function expectTabStaysInside(page: Page, dialog: Locator) {
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
}

test('new article and new canvas modals: focus, Tab trap, Escape and focus return', async ({ page }) => {
  await openApp(page);

  const newArticle = page.getByRole('button', { name: /New Lore Entity/ }).last();
  await newArticle.click();
  const articleDialog = page.getByRole('dialog', { name: 'Create New Lore Entity' });
  await expect(articleDialog).toBeVisible();
  await expect(articleDialog.getByPlaceholder('e.g. Kingdom of Aethelgard')).toBeFocused();
  await expectTabStaysInside(page, articleDialog);
  await page.keyboard.press('Escape');
  await expect(articleDialog).toBeHidden();
  await expect(newArticle).toBeFocused();

  const newCanvas = page.getByTitle('Create New Canvas');
  await newCanvas.click();
  const canvasDialog = page.getByRole('dialog', { name: /Create New World Canvas/ });
  await expect(canvasDialog.getByPlaceholder(/Third Age Conflict Map/)).toBeFocused();
  await expectTabStaysInside(page, canvasDialog);
  await page.keyboard.press('Escape');
  await expect(canvasDialog).toBeHidden();
  await expect(newCanvas).toBeFocused();
});

test('Escape in a confirmation closes only the confirmation, then the import modal', async ({ page }, testInfo) => {
  await openApp(page);
  const md = testInfo.outputPath('one.md');
  await writeFile(md, '## Lone Entry\nSome text.\n');
  await openImportTab(page);
  const importDialog = page.getByRole('dialog', { name: /Import & Export World Data/ });
  await expect(importDialog).toBeVisible();
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(md);
  await page.getByText('Replace current world').click();
  await page.getByRole('button', { name: 'Replace World with 1 Articles' }).click();

  const confirm = page.getByRole('alertdialog', { name: 'Replace your world?' });
  await expect(confirm).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(importDialog).toBeVisible();
  // The review is still there, and Escape now closes the import modal
  await expect(importDialog.locator('input[value="Lone Entry"]')).toBeVisible();
  await expectTabStaysInside(page, importDialog);
  await page.keyboard.press('Escape');
  await expect(importDialog).toBeHidden();
  await expect(page.locator('aside').first().getByText('Lone Entry')).toHaveCount(0);
});

test('the workspace role picker closes with Escape', async ({ page }) => {
  await openApp(page);
  const opener = page.getByTitle('Switch Workspace Role & Theme');
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Choose Your Creative Workspace' });
  await expect(dialog).toBeVisible();
  await expectTabStaysInside(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
