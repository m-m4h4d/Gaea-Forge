import { writeFile } from 'node:fs/promises';
import { test as base, expect, Page } from '@playwright/test';

// Every test starts with a fresh browser profile (empty IndexedDB) with onboarding
// skipped, and fails on uncaught page errors or native browser dialogs.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => localStorage.setItem('gaea_onboarding_completed', 'true'));
    const errors: string[] = [];
    // The app uses its own dialogs; a native alert/confirm is a regression
    page.on('dialog', (dialog) => {
      errors.push(`unexpected native dialog: ${dialog.message()}`);
      dialog.dismiss();
    });
    page.on('pageerror', (err) => errors.push(err.message));
    await provide(page);
    expect(errors, 'uncaught page errors').toEqual([]);
  },
});

export { expect };

// Wait until RxDB has loaded and the seeded world is on screen
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Family Tree Canvas').first()).toBeVisible();
  await expect(page.locator('.ProseMirror')).toBeVisible();
}

export async function typeAtEndOfEditor(page: Page, text: string) {
  await page.locator('.ProseMirror').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text, { delay: 5 });
}

export async function openBackupTab(page: Page) {
  await page.getByTitle(/Intelligent Document Import/).click();
  await page.getByRole('button', { name: 'Backup & Restore' }).click();
}

export async function openImportTab(page: Page) {
  await page.getByTitle(/Intelligent Document Import/).click();
  await page.getByRole('button', { name: 'Document Import' }).click();
}

export async function createArticle(page: Page, title: string) {
  await page.getByRole('button', { name: /New Lore Entity/ }).last().click();
  await page.getByPlaceholder('e.g. Kingdom of Aethelgard').fill(title);
  await page.locator('form button[type=submit]').click();
  await expect(page.getByText(title).first()).toBeVisible();
}

// Open an article from the sidebar codex
export async function openArticle(page: Page, title: string) {
  // Pinned entries append a category abbreviation to the button name
  const name = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  await page.locator('aside').first().getByRole('button', { name }).first().click();
  await expect(page.locator('.ProseMirror')).toBeVisible();
}

export async function createCanvas(page: Page, title: string, typeName: 'World Web' | 'Family Tree & Lineage' | 'Timeline' | 'Map') {
  await page.getByTitle('Create New Canvas').click();
  await page.getByPlaceholder(/Third Age Conflict Map/).fill(title);
  await page.getByText(typeName, { exact: true }).click();
  await page.getByRole('button', { name: 'Create Canvas' }).click();
  await expect(page.locator('aside').first().getByText(title)).toBeVisible();
}
// Draw a test map in the browser and save it as a PNG file
export async function makeImage(page: import('@playwright/test').Page, path: string, width: number, height: number) {
  const dataUrl = await page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#7aa874';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#3b6ea8';
      ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
      return c.toDataURL('image/png');
    },
    [width, height]
  );
  await writeFile(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
}


// Answer the app's confirmation dialog by clicking its confirm button
export async function confirmDialog(page: Page, confirmLabel: string) {
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: confirmLabel, exact: true }).click();
  await expect(dialog).toBeHidden();
}
