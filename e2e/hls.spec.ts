import { expect, test, type Page } from '@playwright/test';

const hlsLibraryChunk = /\/assets\/hls-[^/]*\.js$/;

const recordRequests = (page: Page): string[] => {
  const requests: string[] = [];
  page.on('request', (request) => {
    requests.push(new URL(request.url()).pathname);
  });
  return requests;
};

const playToCompletion = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute(
    'data-playback-state',
    'playing'
  );

  await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
    'data-playback-state',
    'ended'
  );
};

test('plays the local hls fixture to completion with the hls.js engine', async ({
  browserName,
  page
}) => {
  test.skip(browserName !== 'chromium', 'The hls.js flow runs on Chromium.');

  const requests = recordRequests(page);
  await page.goto('/?source=hls&engine=hls.js');

  await expect(page.getByTestId('hls-engine')).toHaveText('hls.js');
  await playToCompletion(page);

  expect(requests).toContain('/hls/master.m3u8');
  expect(requests.some((path) => hlsLibraryChunk.test(path))).toBe(true);
});

test('plays the local hls fixture natively without downloading hls.js', async ({
  browserName,
  page
}) => {
  test.skip(
    browserName !== 'webkit' || process.platform !== 'darwin',
    'Native HLS requires WebKit on macOS; Linux WebKit lacks native HLS.'
  );

  const requests = recordRequests(page);
  await page.goto('/?source=hls&engine=native');

  await expect(page.getByTestId('hls-engine')).toHaveText('native');
  await playToCompletion(page);

  expect(requests).toContain('/hls/master.m3u8');
  expect(requests.some((path) => hlsLibraryChunk.test(path))).toBe(false);
});

test('surfaces a clear unsupported error for an impossible forced hls engine', async ({
  browserName,
  page
}) => {
  test.skip(
    browserName !== 'firefox',
    'Firefox deterministically lacks native HLS, making the forced native engine impossible.'
  );

  await page.goto('/?source=hls&engine=native');

  await expect(page.getByTestId('error-category')).toHaveText('unsupported');
  await expect(page.getByTestId('hls-engine')).toHaveText('none');
});
