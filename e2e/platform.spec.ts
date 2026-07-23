import { expect, test, type Page } from '@playwright/test';

type PresentationExpectation = {
  fullscreen: string;
  pictureInPicture: string;
};

const capabilities = (page: Page) =>
  page.getByTestId('presentation-capabilities');

const awaitCapabilityResolution = async (page: Page): Promise<void> => {
  await expect(capabilities(page)).not.toHaveAttribute(
    'data-fullscreen-status',
    'unknown'
  );
  await expect(capabilities(page)).not.toHaveAttribute(
    'data-pip-status',
    'unknown'
  );
};

const environmentExpectation = (page: Page): Promise<PresentationExpectation> =>
  page.evaluate(() => {
    const media = document.querySelector('video') as HTMLVideoElement &
      Record<string, unknown>;
    const fullscreen =
      typeof media.requestFullscreen === 'function'
        ? document.fullscreenEnabled === false
          ? 'unavailable'
          : 'available'
        : typeof media.webkitEnterFullscreen === 'function' &&
            media.webkitSupportsFullscreen === true
          ? 'available'
          : 'unavailable';
    const supportsWebKitPictureInPicture =
      typeof media.webkitSetPresentationMode === 'function' &&
      typeof media.webkitSupportsPresentationMode === 'function' &&
      (media.webkitSupportsPresentationMode as (mode: string) => boolean)(
        'picture-in-picture'
      ) === true;
    const pictureInPicture =
      media.disablePictureInPicture === true
        ? 'unavailable'
        : typeof media.requestPictureInPicture === 'function'
          ? document.pictureInPictureEnabled === false
            ? 'unavailable'
            : 'available'
          : supportsWebKitPictureInPicture
            ? 'available'
            : 'unavailable';
    return { fullscreen, pictureInPicture };
  });

test('platform capability reporting matches what the browser supports', async ({
  page
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await awaitCapabilityResolution(page);

  const expected = await environmentExpectation(page);

  await expect(capabilities(page)).toHaveAttribute(
    'data-fullscreen-status',
    expected.fullscreen
  );
  await expect(capabilities(page)).toHaveAttribute(
    'data-pip-status',
    expected.pictureInPicture
  );
});

test('platform capability gating shows presentation controls only when available', async ({
  browserName,
  page
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await awaitCapabilityResolution(page);

  const fullscreenStatus = await capabilities(page).getAttribute(
    'data-fullscreen-status'
  );
  const pictureInPictureStatus =
    await capabilities(page).getAttribute('data-pip-status');
  await expect(page.getByTestId('fullscreen-toggle')).toHaveCount(
    fullscreenStatus === 'available' ? 1 : 0
  );
  await expect(page.getByTestId('pip-toggle')).toHaveCount(
    pictureInPictureStatus === 'available' ? 1 : 0
  );

  if (browserName === 'chromium') {
    expect(fullscreenStatus).toBe('available');
    expect(pictureInPictureStatus).toBe('available');
  }
  if (browserName === 'firefox') {
    expect(fullscreenStatus).toBe('available');
    expect(pictureInPictureStatus).toBe('unavailable');
    await expect(capabilities(page)).toHaveAttribute(
      'data-pip-reason',
      'browser'
    );
  }
});

test('platform fullscreen commands confirm state through fullscreenchange', async ({
  browserName,
  page
}) => {
  test.skip(
    browserName !== 'chromium',
    'Programmatic fullscreen coverage is Chromium-only; Safari and iOS run in the manual device matrix.'
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await awaitCapabilityResolution(page);

  await page.getByTestId('fullscreen-toggle').click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  await expect(capabilities(page)).toHaveAttribute(
    'data-fullscreen-state',
    'active'
  );

  await page.evaluate(() => document.exitFullscreen());
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  await expect(capabilities(page)).toHaveAttribute(
    'data-fullscreen-state',
    'inline'
  );
});
