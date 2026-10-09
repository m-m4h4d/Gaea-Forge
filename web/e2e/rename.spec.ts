import { createArticle, createCanvas, expect, openApp, openArticle, test, typeAtEndOfEditor } from './fixtures';

const editor = (page: import('@playwright/test').Page) => page.locator('.ProseMirror');
const titleField = (page: import('@playwright/test').Page) => page.getByLabel('Article title');

test('renaming an article offers to update text that repeats the old title', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Mira');
  await createArticle(page, 'Ashfall');
  // One link labelled with the title, one with custom wording
  await typeAtEndOfEditor(page, ' Ruled by [[Mira]], also called [[mira|her majesty]].');
  await expect(editor(page).locator('a.lore-link')).toHaveCount(2);

  // A timeline event named after the article
  await createCanvas(page, 'Chronicle', 'Timeline');
  await page.getByRole('button', { name: 'Add Event' }).click();
  const d = page.getByRole('dialog', { name: 'Add Event' });
  await d.getByLabel('Linked article').selectOption({ label: 'Mira (Characters & Cast)' });
  await d.getByLabel('Title *').fill('Mira');
  await d.getByLabel('Year *').fill('12');
  await d.getByRole('button', { name: 'Save' }).click();

  // Rename; nothing is offered until the edit is finished
  await openArticle(page, 'Mira');
  await titleField(page).fill('Queen Mira');
  await expect(page.getByRole('status')).toHaveCount(0);
  await titleField(page).press('Enter');
  const notice = page.getByRole('status');
  await expect(notice).toContainText('Update 1 link, its heading and 1 canvas label to "Queen Mira"?');
  await notice.getByRole('button', { name: 'Update' }).click();
  await expect(page.getByRole('status')).toContainText('Updated 1 link, its heading and 1 canvas label.');

  await expect(editor(page).locator('h1')).toHaveText('Queen Mira');
  await openArticle(page, 'Ashfall');
  await expect(editor(page).locator('a.lore-link').nth(0)).toHaveText('Queen Mira');
  await expect(editor(page).locator('a.lore-link').nth(1)).toHaveText('her majesty');

  // Saved: still there after a reload
  await expect(page.getByText('All changes saved')).toBeVisible();
  await page.reload();
  await openArticle(page, 'Ashfall');
  await expect(editor(page).locator('a.lore-link').nth(0)).toHaveText('Queen Mira');
  await page.locator('aside').first().getByText('Chronicle').click();
  await expect(page.getByTestId('timeline-event')).toContainText('Queen Mira');
});

test('without confirming, a rename changes only the title', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Lonely Tower');
  await createArticle(page, 'Mira');
  await typeAtEndOfEditor(page, ' Lives in [[Lonely Tower]].');

  // Leaving the field without changing the title offers nothing
  await openArticle(page, 'Lonely Tower');
  await titleField(page).click();
  await titleField(page).press('Enter');
  await expect(page.getByRole('status')).toHaveCount(0);

  // An offer that isn't taken: links keep the old text, the rename itself stays
  await titleField(page).fill('The Tower');
  await titleField(page).press('Enter');
  await expect(page.getByRole('status')).toContainText('Update 1 link and its heading');
  await openArticle(page, 'Mira');
  await expect(editor(page).locator('a.lore-link')).toHaveText('Lonely Tower');
  await expect(page.locator('aside').first().getByRole('button', { name: 'The Tower' })).toBeVisible();
});
