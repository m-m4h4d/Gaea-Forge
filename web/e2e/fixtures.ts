import { test as base, expect, Page } from '@playwright/test';

// Every test starts with a fresh browser profile (empty IndexedDB), onboarding
// skipped, and confirm dialogs accepted.
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, provide) => {
    await page.addInitScript(() => localStorage.setItem('gaea_onboarding_completed', 'true'));
    page.on('dialog', (dialog) => dialog.accept());
    const errors: string[] = [];
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
