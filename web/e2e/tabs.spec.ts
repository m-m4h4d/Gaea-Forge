import type { Page } from '@playwright/test';
import { expect, openApp, test } from './fixtures';

const notice = (page: Page) => page.getByRole('alertdialog', { name: 'Gaea Forge is open in another tab' });
const editor = (page: Page) => page.locator('.ProseMirror');

async function typeAtEnd(page: Page, text: string) {
  await editor(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
}

test('a second tab waits while the first edits, and can take over', async ({ page, context }) => {
  await openApp(page);
  const second = await context.newPage();
  await openApp(second);

  await expect(notice(second)).toBeVisible();
  await expect(notice(second).getByRole('button', { name: 'Use this tab instead' })).toBeFocused();
  await expect(notice(page)).toHaveCount(0);

  await notice(second).getByRole('button', { name: 'Use this tab instead' }).click();
  await expect(notice(second)).toBeHidden();
  await expect(notice(page)).toBeVisible();
});

test('edits typed just before a takeover are kept, not overwritten', async ({ page, context }) => {
  await openApp(page);
  const second = await context.newPage();
  await openApp(second);
  await expect(notice(second)).toBeVisible();

  // Still inside the first tab's save delay when the second tab takes over
  await typeAtEnd(page, ' Written-in-tab-one');
  await notice(second).getByRole('button', { name: 'Use this tab instead' }).click();
  await expect(notice(second)).toBeHidden();
  await expect(editor(second)).toContainText('Written-in-tab-one');

  await typeAtEnd(second, ' Written-in-tab-two');
  await expect(second.getByText('All changes saved')).toBeVisible();
  // The first tab, now waiting, follows along
  await expect(editor(page)).toContainText('Written-in-tab-two');

  await second.reload();
  await expect(editor(second)).toContainText('Written-in-tab-one');
  await expect(editor(second)).toContainText('Written-in-tab-two');
});

test('when the editing tab closes, a waiting tab carries on by itself', async ({ page, context }) => {
  await openApp(page);
  const second = await context.newPage();
  await openApp(second);
  await expect(notice(second)).toBeVisible();

  await page.close();
  await expect(notice(second)).toBeHidden();
  await typeAtEnd(second, ' Still-saving');
  await expect(second.getByText('All changes saved')).toBeVisible();
});

test('a waiting tab ignores Ctrl+K', async ({ page, context }) => {
  await openApp(page);
  const second = await context.newPage();
  await openApp(second);
  await expect(notice(second)).toBeVisible();
  await second.keyboard.press('Control+k');
  await expect(second.getByRole('dialog', { name: 'Quick switcher' })).toHaveCount(0);
});
