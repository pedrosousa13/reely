import { fileURLToPath, URL } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import type { PluginOption } from 'vite';

/**
 * Serves `/__reely__/pending.png` by never responding, so a poster image can
 * stay in its `loading` state deterministically without touching the network.
 * Only available on dev servers (`storybook dev`, Vitest browser mode); in a
 * static build the URL 404s and the image falls through to `error`.
 */
const pendingAssetPlugin = (): PluginOption => {
  const hang = () => {
    // Intentionally never respond and never call next().
  };
  return {
    name: 'reely-pending-asset',
    configureServer(server) {
      server.middlewares.use('/__reely__/pending.png', hang);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__reely__/pending.png', hang);
    }
  };
};

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), pendingAssetPlugin()],
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        '@reely/core': fileURLToPath(
          new URL('../../../packages/core/src/index.ts', import.meta.url)
        ),
        '@reely/provider-native': fileURLToPath(
          new URL(
            '../../../packages/provider-native/src/index.ts',
            import.meta.url
          )
        ),
        '@reely/provider-hls': fileURLToPath(
          new URL(
            '../../../packages/provider-hls/src/index.ts',
            import.meta.url
          )
        ),
        '@reely/react': fileURLToPath(
          new URL('../../../packages/react/src/index.tsx', import.meta.url)
        )
      }
    }
  })
};

export default config;
