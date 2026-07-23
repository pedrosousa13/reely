import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { liveHlsFixture } from './live-playlist-plugin';

export default defineConfig({
  plugins: [react(), liveHlsFixture()],
  resolve: {
    alias: {
      '@reely/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url)
      ),
      '@reely/provider-native': fileURLToPath(
        new URL('../../packages/provider-native/src/index.ts', import.meta.url)
      ),
      '@reely/provider-hls': fileURLToPath(
        new URL('../../packages/provider-hls/src/index.ts', import.meta.url)
      ),
      '@reely/provider-youtube': fileURLToPath(
        new URL('../../packages/provider-youtube/src/index.ts', import.meta.url)
      ),
      '@reely/provider-vimeo': fileURLToPath(
        new URL('../../packages/provider-vimeo/src/index.ts', import.meta.url)
      ),
      '@reely/react': fileURLToPath(
        new URL('../../packages/react/src/index.tsx', import.meta.url)
      )
    }
  }
});
