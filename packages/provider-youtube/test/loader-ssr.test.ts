// @vitest-environment node

import { expect, test } from 'vitest';

test('imports without touching the DOM and rejects loads outside a browser', async () => {
  const { loadYouTubeIframeApi } = await import('../src/loader');
  const { createYouTubeProvider } = await import('../src/index');

  expect(typeof createYouTubeProvider).toBe('function');
  await expect(loadYouTubeIframeApi()).rejects.toThrow(
    'The YouTube iframe API requires a browser environment.'
  );
});
