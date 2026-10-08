import { createArticle, expect, openApp, openBackupTab, test } from './fixtures';

// Stand in for the Tauri bridge: the app sees window.isTauri and calls Rust commands
// through __TAURI_INTERNALS__.invoke. `reply` decides what the fake save_json_file returns.
async function fakeDesktop(page: import('@playwright/test').Page, reply: 'save' | 'cancel' | 'fail') {
  await page.addInitScript((mode) => {
    const w = window as unknown as Record<string, unknown>;
    w.isTauri = true;
    w.__tauriCalls = [];
    w.__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args: { defaultName: string; contents: string }) => {
        (w.__tauriCalls as unknown[]).push({ cmd, args });
        if (mode === 'fail') throw 'Could not write /readonly/backup.json: permission denied';
        return mode === 'save' ? `/home/me/${args.defaultName}` : null;
      },
    };
  }, reply);
}

type Call = { cmd: string; args: { defaultName: string; contents: string } };
const calls = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __tauriCalls: Call[] }).__tauriCalls);

test('the desktop app saves backups through the native Save dialog', async ({ page }) => {
  await fakeDesktop(page, 'save');
  await openApp(page);
  await createArticle(page, 'Desktop Keep');
  await openBackupTab(page);

  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByText('Download .json Backup').click();

  await expect(page.getByText(/^Backup saved to \/home\/me\/gaea-forge-backup-\d{4}-\d{2}-\d{2}\.json$/)).toBeVisible();
  const [call] = await calls(page);
  expect(call.cmd).toBe('save_json_file');
  const backup = JSON.parse(call.args.contents);
  expect(backup.format).toBe('gaea-forge-backup');
  expect(backup.articles.map((a: { title: string }) => a.title)).toContain('Desktop Keep');
  expect(downloads).toBe(0);
});

test('cancelling the desktop Save dialog shows nothing', async ({ page }) => {
  await fakeDesktop(page, 'cancel');
  await openApp(page);
  await openBackupTab(page);
  await page.getByText('Download .json Backup').click();
  await expect.poll(async () => (await calls(page)).length).toBe(1);
  await page.waitForTimeout(300);
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('a desktop write error is shown to the user', async ({ page }) => {
  await fakeDesktop(page, 'fail');
  await openApp(page);
  await openBackupTab(page);
  await page.getByText('Download .json Backup').click();
  await expect(page.getByText('Could not write /readonly/backup.json: permission denied')).toBeVisible();
});
