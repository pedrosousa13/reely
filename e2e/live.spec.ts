import { expect, test, type Page } from '@playwright/test';

const hlsLibraryChunk = /\/assets\/hls-[^/]*\.js$/;

const recordRequests = (page: Page): string[] => {
  const requests: string[] = [];
  page.on('request', (request) => {
    requests.push(new URL(request.url()).pathname);
  });
  return requests;
};

// The live fixture is a sliding media playlist with no #EXT-X-ENDLIST, served by
// the docs Vite plugin. Liveness is derived from stream data, so a neutral URL
// (/live/index.m3u8, nothing "live" about the path beyond the folder name is
// load-bearing) is still detected through the hls.js live flag or an infinite
// duration.

test('detects a live stream and adapts controls on the hls.js engine', async ({
  browserName,
  page
}) => {
  test.skip(browserName !== 'chromium', 'The hls.js flow runs on Chromium.');

  const requests = recordRequests(page);
  await page.goto(
    '/iframe.html?id=fixtures-playerfixture--default&viewMode=story&args=source:live;engine:hls.js'
  );

  await expect(page.getByTestId('hls-engine')).toHaveText('hls.js');

  // Live status is derived, not guessed from the URL.
  const panel = page.getByTestId('live-panel');
  await expect(panel).toHaveAttribute('data-live-known', 'true');
  await expect(panel).toHaveAttribute('data-live-status', 'live');

  // The time display never shows a fixed duration or NaN while live.
  const time = page.getByTestId('live-time');
  await expect(time).not.toContainText('NaN');
  await expect(time).not.toContainText('/');

  expect(requests).toContain('/live/index.m3u8');
  expect(requests.some((path) => hlsLibraryChunk.test(path))).toBe(true);
});

test('surfaces a behind-edge seek within the live window on the hls.js engine', async ({
  browserName,
  page
}) => {
  test.skip(browserName !== 'chromium', 'The hls.js flow runs on Chromium.');
  // The window has to fill and settle at the live edge before a behind-edge
  // seek is meaningful, which takes longer than the default per-test budget.
  test.setTimeout(30_000);

  await page.goto(
    '/iframe.html?id=fixtures-playerfixture--default&viewMode=story&args=source:live;engine:hls.js'
  );
  await expect(page.getByTestId('hls-engine')).toHaveText('hls.js');

  const panel = page.getByTestId('live-panel');
  await expect(panel).toHaveAttribute('data-live-status', 'live');

  // Once the buffer fills, hls.js parks the position at the live edge.
  await expect(panel).toHaveAttribute('data-live-edge', 'at-edge', {
    timeout: 15_000
  });

  // Jumping to the oldest available position stays inside the window and reads
  // as behind the live edge.
  await page.getByTestId('live-seek-back').click();
  await expect(panel).toHaveAttribute('data-live-edge', 'behind-edge');
  const time = page.getByTestId('live-time');
  await expect(time).not.toContainText('NaN');
  await expect(time).toContainText('-');

  // Jumping back to the live edge returns to at-edge.
  await page.getByTestId('live-seek-edge').click();
  await expect(panel).toHaveAttribute('data-live-edge', 'at-edge');
});

test('detects a live stream and never shows a fixed duration on native HLS', async ({
  browserName,
  page
}) => {
  test.skip(
    browserName !== 'webkit' || process.platform !== 'darwin',
    'Native HLS requires WebKit on macOS; Linux WebKit lacks native HLS.'
  );

  const requests = recordRequests(page);
  await page.goto(
    '/iframe.html?id=fixtures-playerfixture--default&viewMode=story&args=source:live;engine:native'
  );

  await expect(page.getByTestId('hls-engine')).toHaveText('native');
  await page.getByRole('button', { name: 'Play' }).click();

  const panel = page.getByTestId('live-panel');
  await expect(panel).toHaveAttribute('data-live-status', 'live');

  const time = page.getByTestId('live-time');
  await expect(time).not.toContainText('NaN');
  await expect(time).not.toContainText('/');

  expect(requests).toContain('/live/index.m3u8');
  // Native HLS never downloads hls.js.
  expect(requests.some((path) => hlsLibraryChunk.test(path))).toBe(false);
});
