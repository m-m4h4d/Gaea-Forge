import { expect, openApp, test } from './fixtures';

// The 3D view reports how many geometries are alive on the GPU (data-gpu-geometries)
async function open3D(page: import('@playwright/test').Page) {
  await openApp(page);
  await page.getByText('Master World Web').first().click();
  await page.getByRole('button', { name: /3D Cosmos/ }).click();
  const scene = page.locator('[data-gpu-geometries]');
  await expect(scene).toHaveAttribute('data-gpu-geometries', /^\d+$/);
  // Starfield plus a sphere and a ring per node: settle on the full count
  await expect.poll(async () => Number(await scene.getAttribute('data-gpu-geometries'))).toBeGreaterThan(1);
  return scene;
}

const count = async (scene: import('@playwright/test').Locator) => Number(await scene.getAttribute('data-gpu-geometries'));

test('pausing the orbit keeps the stars in the scene', async ({ page }) => {
  const scene = await open3D(page);
  const before = await count(scene);
  await page.getByTitle('Toggle Cinematic Planetary Orbit').click();
  await expect(page.getByTitle('Toggle Cinematic Planetary Orbit')).toHaveText(/Orbit Pause/);
  await page.waitForTimeout(600);
  expect(await count(scene)).toBe(before);
  await page.getByTitle('Toggle Cinematic Planetary Orbit').click();
  await page.waitForTimeout(600);
  expect(await count(scene)).toBe(before);
});

test('rebuilding the scene frees the old node geometry', async ({ page }) => {
  const scene = await open3D(page);
  const before = await count(scene);
  // Each auto-arrange moves every node, which rebuilds all node meshes and lines
  for (let i = 0; i < 5; i++) {
    await page.getByTitle(/Auto-arrange stellar bodies/).click();
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(600);
  expect(await count(scene)).toBe(before);
});
