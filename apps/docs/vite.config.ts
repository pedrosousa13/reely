import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@reely/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url)
      ),
      '@reely/provider-native': fileURLToPath(
        new URL('../../packages/provider-native/src/index.ts', import.meta.url)
      ),
      '@reely/react': fileURLToPath(
        new URL('../../packages/react/src/index.tsx', import.meta.url)
      )
    }
  }
});
