import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { createArticle, createCanvas, expect, openApp, openArticle, openBackupTab, test, typeAtEndOfEditor } from './fixtures';

async function buildWorld(page: import('@playwright/test').Page) {
  await openApp(page);
  await createArticle(page, 'Queen Mira');
  await createArticle(page, 'Ashfall');
  await typeAtEndOfEditor(page, ' Ruled by [[Queen Mira]].');
  await createCanvas(page, 'Chronicle', 'Timeline');
  await page.getByRole('button', { name: 'Add Event' }).click();
  const d = page.getByRole('dialog', { name: 'Add Event' });
  await d.getByLabel('Linked article').selectOption({ label: 'Queen Mira (Characters & Cast)' });
  await d.getByLabel('Title *').fill('Coronation');
  await d.getByLabel('Year *').fill('412');
  await d.getByRole('button', { name: 'Save' }).click();
  await openArticle(page, 'Ashfall');
  await expect(page.getByText('All changes saved')).toBeVisible();
}

async function download(page: import('@playwright/test').Page, button: RegExp) {
  await openBackupTab(page);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button }).click()]);
  return { name: file.suggestedFilename(), data: await readFile((await file.path())!) };
}

test('exports the world as a folder of Markdown files', async ({ page }) => {
  await buildWorld(page);
  const { name, data } = await download(page, /Folder of files/);
  expect(name).toMatch(/^gaea-forge-markdown-\d{4}-\d{2}-\d{2}\.zip$/);

  const files = unzipSync(new Uint8Array(data));
  expect(Object.keys(files)).toEqual(
    expect.arrayContaining(['Index.md', 'Characters & Cast/Queen Mira.md', 'Characters & Cast/Ashfall.md', 'Canvases/Chronicle.md'])
  );
  const ashfall = strFromU8(files['Characters & Cast/Ashfall.md']);
  expect(ashfall).toMatch(/^---\ntitle: "Ashfall"\ncategory: "Characters & Cast"/);
  expect(ashfall).toContain('Ruled by [Queen Mira](../Characters%20%26%20Cast/Queen%20Mira.md).');
  // Template sections come through as headings
  expect(ashfall).toContain('## Appearance');
  expect(strFromU8(files['Canvases/Chronicle.md'])).toContain('- **412**: Coronation ([Queen Mira](../Characters%20%26%20Cast/Queen%20Mira.md))');
});

test('exports the world as one Markdown document', async ({ page }) => {
  await buildWorld(page);
  const { name, data } = await download(page, /Single document/);
  expect(name).toMatch(/^gaea-forge-\d{4}-\d{2}-\d{2}\.md$/);
  const doc = data.toString('utf8');
  expect(doc).toMatch(/^# Author's World Bible\n/);
  expect(doc).toContain('  - [Queen Mira](#queen-mira)');
  expect(doc).toContain('### Ashfall');
  expect(doc).toContain('Ruled by [Queen Mira](#queen-mira).');
  expect(doc).toContain('### Chronicle');
});

test('the desktop app saves the zip through the native Save dialog', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.isTauri = true;
    w.__tauriCalls = [];
    w.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: { defaultName: string }) => {
        (w.__tauriCalls as unknown[]).push({ cmd, args });
        return `/home/me/${args.defaultName}`;
      },
    };
  });
  await openApp(page);
  await openBackupTab(page);
  await page.getByRole('button', { name: /Folder of files/ }).click();
  await expect(page.getByText(/^Markdown export saved to \/home\/me\/gaea-forge-markdown-.*\.zip$/)).toBeVisible();

  type Call = { cmd: string; args: { contentsBase64: string; filterName: string; extensions: string[] } };
  const [call] = await page.evaluate(() => (window as unknown as { __tauriCalls: Call[] }).__tauriCalls);
  expect(call).toMatchObject({ cmd: 'save_file', args: { filterName: 'Zip archive', extensions: ['zip'] } });
  const files = unzipSync(new Uint8Array(Buffer.from(call.args.contentsBase64, 'base64')));
  expect(strFromU8(files['Index.md'])).toContain('Welcome to Gaea-Forge');
});
