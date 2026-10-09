import { createCanvas, expect, openApp, openArticle, test } from './fixtures';

const dialog = (page: import('@playwright/test').Page, name: string | RegExp) => page.getByRole('dialog', { name });
const eventDate = (page: import('@playwright/test').Page) => page.getByTestId('timeline-event').first().locator('.font-mono');

test('a timeline calendar names months, labels years and counts from eras', async ({ page }) => {
  await openApp(page);
  await createCanvas(page, 'Chronicle', 'Timeline');

  await page.getByRole('button', { name: 'Add Era' }).click();
  const eraDialog = dialog(page, 'Add Era');
  await eraDialog.getByLabel('Name *').fill('the Restoration');
  await eraDialog.getByLabel('Start year *').fill('410');
  await eraDialog.getByLabel('End year').fill('450');
  await eraDialog.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('button', { name: 'Add Event' }).click();
  const add = dialog(page, 'Add Event');
  await expect(add.getByLabel('Title *')).toBeFocused();
  await add.getByLabel('Title *').fill('Coronation');
  await add.getByLabel('Year *').fill('412');
  await add.getByLabel('Month').fill('3');
  await add.getByLabel('Day').fill('15');
  await add.getByLabel('Linked article').selectOption({ label: 'Welcome to Gaea-Forge (Campaign Notes)' });
  await add.getByRole('button', { name: 'Save' }).click();
  await expect(eventDate(page)).toHaveText('412.3.15'); // no calendar yet: as before

  // Set up the calendar, with a live example
  await page.getByRole('button', { name: 'Calendar' }).click();
  const cal = dialog(page, 'Timeline Calendar');
  await cal.getByLabel('Months').fill('Frostmere: 30\nThaw\nEmberwane: 28');
  await cal.getByLabel('Year label').fill('AR');
  await cal.getByLabel('Before year 0').fill('BR');
  await expect(cal.getByTestId('calendar-preview')).toHaveText('15 Frostmere 412 AR');
  await cal.getByRole('button', { name: 'Save' }).click();
  await expect(cal).toBeHidden();
  await expect(eventDate(page)).toHaveText('15 Emberwane 412 AR');
  await expect(page.getByLabel('Era: the Restoration')).toContainText('410 AR – 450 AR');

  // The event form offers the named months and checks the day against them
  await page.getByTitle('Edit Coronation').click();
  const edit = dialog(page, 'Edit Event');
  await expect(edit.getByLabel('Month')).toHaveValue('3');
  await expect(edit.getByLabel('Month').locator('option:checked')).toHaveText('Emberwane');
  await edit.getByLabel('Day').fill('29');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit.getByRole('alert')).toHaveText('This date is on day 29 of Emberwane, which has 28 days.');
  await page.keyboard.press('Escape');
  await expect(edit).toBeHidden();

  // Removing a month an event uses is refused
  await page.getByRole('button', { name: 'Calendar' }).click();
  await cal.getByLabel('Months').fill('Frostmere: 30\nThaw');
  await cal.getByRole('button', { name: 'Save' }).click();
  await expect(cal.getByRole('alert')).toContainText('"Coronation" is in month 3, but the calendar has 2 months.');

  // Era-relative dates, with the full date on hover
  await cal.getByLabel('Months').fill('Frostmere: 30\nThaw\nEmberwane: 28');
  await cal.getByLabel('Count years from the start of each era').check();
  await cal.getByRole('button', { name: 'Save' }).click();
  await expect(eventDate(page)).toHaveText('15 Emberwane, Year 3 of the Restoration');
  await expect(eventDate(page)).toHaveAttribute('title', '15 Emberwane 412 AR');

  // Saved, and the linked article's inspector shows the same date
  await page.reload();
  await expect(eventDate(page)).toHaveText('15 Emberwane, Year 3 of the Restoration');
  await openArticle(page, 'Welcome to Gaea-Forge');
  await expect(page.locator('aside').last().getByRole('button', { name: /Coronation/ })).toContainText(
    '15 Emberwane, Year 3 of the Restoration'
  );
});
