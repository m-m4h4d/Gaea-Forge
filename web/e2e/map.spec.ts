import { createCanvas, expect, makeImage, openApp, openArticle, test } from './fixtures';

test('pins link places to articles, can be moved, and survive reloads', async ({ page }, testInfo) => {
  await openApp(page);
  await createCanvas(page, 'The Realm', 'Map');
  const image = testInfo.outputPath('realm.png');
  await makeImage(page, image, 800, 500);
  await page.getByLabel('Map image file').setInputFiles(image);
  await expect(page.getByAltText('Map: The Realm')).toBeVisible();

  // Place a pin in the middle of the map
  await page.getByRole('button', { name: 'Add Pin' }).click();
  const viewport = page.getByTestId('map-viewport');
  const box = (await viewport.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const pinDialog = page.getByRole('dialog', { name: 'Add Pin' });
  await pinDialog.getByLabel('Linked article').selectOption({ label: 'Welcome to Gaea-Forge (Campaign Notes)' });
  await pinDialog.getByRole('button', { name: 'Save Pin' }).click();
  const pin = page.getByRole('button', { name: 'Pin: Welcome to Gaea-Forge' });
  await expect(pin).toBeVisible();

  // Drag it, then reload: it stays where it was dropped
  const before = (await pin.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height - 4);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 120, before.y + before.height - 4 + 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText('All changes saved')).toBeVisible();
  await page.reload();
  await page.locator('aside').first().getByText('The Realm').click();
  const after = (await page.getByRole('button', { name: 'Pin: Welcome to Gaea-Forge' }).boundingBox())!;
  expect(after.x - before.x).toBeGreaterThan(80);
  expect(after.y - before.y).toBeGreaterThan(30);

  // Clicking the pin opens a popover that jumps to the article
  await page.getByRole('button', { name: 'Pin: Welcome to Gaea-Forge' }).click();
  await page.getByRole('button', { name: 'Open Article' }).click();
  await expect(page.locator('.ProseMirror h1')).toHaveText('Welcome to Gaea-Forge');
  await expect(page.locator('aside').last().getByRole('button', { name: 'Pinned on The Realm' })).toBeVisible();
});

test('deleting an article removes its pins', async ({ page }, testInfo) => {
  await openApp(page);
  await createCanvas(page, 'Atlas', 'Map');
  const image = testInfo.outputPath('atlas.png');
  await makeImage(page, image, 400, 300);
  await page.getByLabel('Map image file').setInputFiles(image);
  await page.getByRole('button', { name: 'Add Pin' }).click();
  const box = (await page.getByTestId('map-viewport').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole('dialog', { name: 'Add Pin' }).getByLabel('Linked article').selectOption({ label: 'Welcome to Gaea-Forge (Campaign Notes)' });
  await page.getByRole('button', { name: 'Save Pin' }).click();
  await expect(page.getByTestId('map-pin')).toHaveCount(1);

  await openArticle(page, 'Welcome to Gaea-Forge');
  await page.getByTitle('Delete this article').click();
  await page.locator('aside').first().getByText('Atlas').click();
  await expect(page.getByTestId('map-pin')).toHaveCount(0);
});

test('very large map images are scaled down on upload', async ({ page }, testInfo) => {
  await openApp(page);
  await createCanvas(page, 'Huge', 'Map');
  const image = testInfo.outputPath('huge.png');
  await makeImage(page, image, 6000, 600);
  await page.getByLabel('Map image file').setInputFiles(image);
  const img = page.getByAltText('Map: Huge');
  await expect(img).toBeVisible();
  const width = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
  expect(width).toBe(4096);
});
