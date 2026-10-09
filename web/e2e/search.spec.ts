import { createArticle, expect, openApp, test, typeAtEndOfEditor } from './fixtures';

test('search ranks matches, shows where they matched and never matches markup', async ({ page }) => {
  await openApp(page);
  await createArticle(page, 'Ashfall');
  await typeAtEndOfEditor(page, ' A volcanic city where the dragon sleeps.');
  await createArticle(page, 'Vyrnax the Dragon');
  await typeAtEndOfEditor(page, ' Sleeps beneath the peaks.');

  const search = page.getByLabel('Search articles');
  const results = page.getByRole('region', { name: 'Search results' });

  // Title matches rank above mentions in the text, which show the matching passage
  await search.fill('dragon');
  const items = results.getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Vyrnax the Dragon');
  await expect(items.nth(1)).toContainText('Ashfall');
  await expect(items.nth(1).locator('mark')).toHaveText('dragon');
  await expect(items.nth(1).getByTestId('search-snippet')).toContainText('volcanic city where the dragon sleeps');

  // A typo still finds it
  await search.fill('dragn');
  await expect(items.first()).toContainText('Vyrnax the Dragon');

  // The welcome article is full of <strong> tags, but markup is not text
  await search.fill('strong');
  await expect(results.getByText('No matching lore')).toBeVisible();
  await expect(results.getByText('0 matches')).toBeVisible();

  // Opening a result, then Escape clears the search and brings the categories back
  await search.fill('volcanic');
  await results.getByRole('button', { name: /Ashfall/ }).click();
  await expect(page.locator('.ProseMirror h1')).toHaveText('Ashfall');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(results).toBeHidden();
  await expect(page.locator('aside').first().getByText('Characters & Cast')).toBeVisible();
});
