import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      '@reely/core': fileURLToPath(
        new URL('./packages/core/src/index.ts', import.meta.url)
      ),
      '@reely/provider-native': fileURLToPath(
        new URL('./packages/provider-native/src/index.ts', import.meta.url)
      ),
      '@reely/provider-hls': fileURLToPath(
        new URL('./packages/provider-hls/src/index.ts', import.meta.url)
      ),
      '@reely/provider-youtube': fileURLToPath(
        new URL('./packages/provider-youtube/src/index.ts', import.meta.url)
      ),
      '@reely/provider-vimeo': fileURLToPath(
        new URL('./packages/provider-vimeo/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'happy-dom',
    include: [
      'packages/**/*.test.{ts,tsx}',
      'apps/storybook/stories/**/*.contract.test.ts'
    ]
  }
});
