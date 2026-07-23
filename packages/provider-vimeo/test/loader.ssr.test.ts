// @vitest-environment node

import { expect, test, vi } from 'vitest';
import { loadVimeoSdk } from '../src/loader';

test('rejects without importing the SDK when no browser document exists', async () => {
  const importSdk = vi.fn();

  await expect(loadVimeoSdk(importSdk)).rejects.toThrow(
    'The Vimeo SDK requires a browser document.'
  );
  expect(importSdk).not.toHaveBeenCalled();
});
