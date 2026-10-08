import { createCanvas, expect, openApp, openArticle, test, confirmDialog } from './fixtures';

const dialog = (page: import('@playwright/test').Page, name: string) => page.getByRole('dialog', { name });

async function addEra(page: import('@playwright/test').Page, name: string, start: string, end = '') {
  await page.getByRole('button', { name: 'Add Era' }).click();
  const d = dialog(page, 'Add Era');
  await d.getByLabel('Name *').fill(name);
  await d.getByLabel('Start year *').fill(start);
  await d.getByLabel('End year').fill(end);
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d).toBeHidden();
}

async function addEvent(page: import('@playwright/test').Page, fields: { title?: string; year: string; article?: string }) {
  await page.getByRole('button', { name: 'Add Event' }).click();
  const d = dialog(page, 'Add Event');
  if (fields.article) await d.getByLabel('Linked article').selectOption({ label: fields.article });
  if (fields.title) await d.getByLabel('Title *').fill(fields.title);
  await d.getByLabel('Year *').fill(fields.year);
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d).toBeHidden();
}

test('events are ordered into eras, persist, and link to articles', async ({ page }) => {
  await openApp(page);
  await createCanvas(page, 'History of the Realm', 'Timeline');
  await expect(page.getByText('An empty timeline')).toBeVisible();

  await addEra(page, 'First Age', '-100', '0');
  await addEvent(page, { title: 'Later Treaty', year: '50' });
  // Choosing an article fills in an empty title
  await addEvent(page, { year: '-50', article: 'Welcome to Gaea-Forge (Campaign Notes)' });

  const era = page.getByRole('region', { name: 'Era: First Age' });
  await expect(era.getByTestId('timeline-event')).toHaveText([/-50[\s\S]*Welcome to Gaea-Forge/]);
  await expect(page.getByTestId('timeline-event')).toHaveText([/-50/, /50[\s\S]*Later Treaty/]);

  await page.reload();
  await page.locator('aside').first().getByText('History of the Realm').click();
  await expect(page.getByTestId('timeline-event')).toHaveCount(2);

  // The linked article lists the event and can jump back to the timeline
  await page.getByRole('button', { name: /Welcome to Gaea-Forge/ }).first().click();
  await expect(page.locator('.ProseMirror h1')).toHaveText('Welcome to Gaea-Forge');
  const appearsOn = page.locator('aside').last().getByRole('button', { name: /Welcome to Gaea-Forge.*History of the Realm/ });
  await expect(appearsOn).toBeVisible();
  await appearsOn.click();
  await expect(page.getByRole('region', { name: 'Era: First Age' })).toBeVisible();
});

test('invalid event input is explained instead of saved', async ({ page }) => {
  await openApp(page);
  await createCanvas(page, 'Chronicle', 'Timeline');
  await page.getByRole('button', { name: 'Add Event' }).click();
  const d = dialog(page, 'Add Event');
  await d.getByLabel('Title *').fill('Bad Date');
  await d.getByLabel('Year *').fill('soon');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d.getByRole('alert')).toHaveText(/Year must be a whole number/);
  await d.getByLabel('Year *').fill('12');
  await d.getByLabel('Day').fill('3');
  await d.getByRole('button', { name: 'Save' }).click();
  await expect(d.getByRole('alert')).toHaveText(/Add a month/);
});

test('events can be edited and deleted, and deleting an article only unlinks its events', async ({ page }) => {
  await openApp(page);
  await createCanvas(page, 'Chronicle', 'Timeline');
  await addEvent(page, { title: 'Coronation', year: '400', article: 'Welcome to Gaea-Forge (Campaign Notes)' });
  await addEvent(page, { title: 'Typo', year: '1' });

  await page.getByTitle('Edit Coronation').click();
  const edit = dialog(page, 'Edit Event');
  await edit.getByLabel('End year (for wars, reigns…)').fill('430');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('timeline-event').last()).toContainText('400 – 430');

  await page.getByTitle('Delete Typo').click();
  await confirmDialog(page, 'Delete Event');
  await expect(page.getByTestId('timeline-event')).toHaveCount(1);

  await openArticle(page, 'Welcome to Gaea-Forge');
  await page.getByTitle('Delete this article').click();
  await page.locator('aside').first().getByText('Chronicle').click();
  await expect(page.getByTestId('timeline-event')).toHaveCount(1);
  await expect(page.getByTestId('timeline-event')).not.toContainText('Welcome to Gaea-Forge');
});

test('an event added just before the page reloads is not lost', async ({ page }) => {
  await openApp(page);
  await createCanvas(page, 'Chronicle', 'Timeline');
  await addEvent(page, { title: 'First', year: '1' });
  await addEvent(page, { title: 'Second', year: '2' });
  // Reload straight away, while the last write may still be in flight
  await page.reload();
  await page.locator('aside').first().getByText('Chronicle').click();
  await expect(page.getByTestId('timeline-event')).toHaveCount(2);
});
