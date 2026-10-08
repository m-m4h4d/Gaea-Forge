import { writeFile } from 'node:fs/promises';
import { expect, openApp, openImportTab, test } from './fixtures';
import { SCIFI_GUIDE } from '../src/lib/__fixtures__/importSamples';

const draftRow = (page: import('@playwright/test').Page, title: string) =>
  page.getByTestId('import-draft').filter({ has: page.locator(`input[value="${title}"]`) });

test('documents from any world are split and sorted by editable keyword rules', async ({ page }, testInfo) => {
  await openApp(page);
  const file = testInfo.outputPath('solar-guide.md');
  await writeFile(file, SCIFI_GUIDE);

  await openImportTab(page);
  await page.locator('input[type=file][accept*=".pdf"]').setInputFiles(file);
  await expect(page.getByText('8 Entities Found')).toBeVisible();
  await expect(draftRow(page, 'Commander Ines Okafor').locator('select')).toHaveValue('Characters & Cast');
  await expect(draftRow(page, 'Ceres Port').locator('select')).toHaveValue('Realms & Locations');
  await expect(draftRow(page, 'Fold Drive').locator('select')).toHaveValue('Magic & Relics');

  // A category picked by hand is kept when entries are re-sorted
  await draftRow(page, 'Plasma Lance').locator('select').selectOption('Plot & Chapters');

  // Move "technology" from Magic & Relics to Realms & Locations, then re-sort
  await page.getByText('Category keywords').click();
  const magic = page.getByLabel('Magic & Relics');
  await magic.fill('magic, relic');
  const realms = page.getByLabel('Realms & Locations');
  await realms.fill(`${await realms.inputValue()}, technology`);
  await page.getByRole('button', { name: 'Save & Re-sort Entries' }).click();

  await expect(draftRow(page, 'Fold Drive').locator('select')).toHaveValue('Realms & Locations');
  await expect(draftRow(page, 'Plasma Lance').locator('select')).toHaveValue('Plot & Chapters');

  // Keywords are saved for the role, and can be reset
  await page.reload();
  await openImportTab(page);
  await page.getByText('Category keywords').click();
  await expect(page.getByLabel('Magic & Relics')).toHaveValue('magic, relic');
  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.getByLabel('Magic & Relics')).not.toHaveValue('magic, relic');
});
