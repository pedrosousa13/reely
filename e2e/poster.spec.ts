import { expect, test, type Locator, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';

type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const rect = async (locator: Locator): Promise<Rectangle> =>
  locator.evaluate((element) => {
    const { height, width, x, y } = element.getBoundingClientRect();
    return { height, width, x, y };
  });

const poster = (page: Page) => page.locator('[data-reely-part="poster"]');
const viewport = (page: Page) => page.locator('[data-reely-part="viewport"]');
const posterImage = (page: Page) =>
  page.locator('[data-reely-part="poster-image"]');

const expectMatchingRectangles = async (page: Page) => {
  await expect(poster(page)).toHaveCount(1);
  await expect(viewport(page)).toHaveCount(1);
  await expect(await rect(poster(page))).toEqual(await rect(viewport(page)));
};

test('keeps poster and viewport geometry stable before and after native activation', async ({
  page
}) => {
  await page.route('**/tracer.mp4', async (route) => route.abort());
  await page.goto('/');

  const beforeActivation = await rect(viewport(page));
  await expectMatchingRectangles(page);

  await page.unroute('**/tracer.mp4');
  await page.reload();

  await expectMatchingRectangles(page);
  expect(await rect(viewport(page))).toEqual(beforeActivation);
});

test('preserves the documented focal position through landscape and portrait layouts', async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  await expect(posterImage(page)).toHaveCSS('object-position', '30% 40%');
  await expectMatchingRectangles(page);

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(posterImage(page)).toHaveCSS('object-position', '30% 40%');
  await expectMatchingRectangles(page);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(posterImage(page)).toHaveCSS('object-position', '30% 40%');
  await expectMatchingRectangles(page);
});

test('keeps poster geometry and focal position in Chromium fullscreen', async ({
  page,
  browserName
}) => {
  test.skip(
    browserName !== 'chromium',
    'Fullscreen geometry is Chromium-only.'
  );
  await page.goto('/');

  await viewport(page).evaluate((element) => {
    element.addEventListener('click', () => void element.requestFullscreen(), {
      once: true
    });
  });
  await viewport(page).click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);

  await expectMatchingRectangles(page);
  await expect(posterImage(page)).toHaveCSS('object-position', '30% 40%');

  await page.evaluate(() => document.exitFullscreen());
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
});

test('hides the poster after the first frame without changing its geometry', async ({
  page
}) => {
  await page.goto('/');
  const visibleGeometry = await rect(poster(page));

  await page.getByRole('button', { name: 'Play' }).click();

  await expect(poster(page)).toHaveAttribute('data-state', 'hidden');
  await expect(poster(page)).toHaveCSS('visibility', 'hidden');
  expect(await rect(poster(page))).toEqual(visibleGeometry);
  await expectMatchingRectangles(page);
});

test('visual source files do not declare background images', () => {
  const result = spawnSync(
    'rg',
    [
      '-n',
      '--glob',
      '*.{css,ts,tsx,js,jsx}',
      '--glob',
      '!**/test/**',
      '--glob',
      '!**/*.test.*',
      'background-image|backgroundImage',
      'apps',
      'packages'
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );

  expect(result.status, result.stdout || result.stderr).toBe(1);
});
