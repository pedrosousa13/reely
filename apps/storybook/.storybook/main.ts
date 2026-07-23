import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const fromRepoRoot = (path: string): string =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url));

const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../../../packages/react/src/**/*.stories.tsx'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: [
          {
            find: '@reely/react',
            replacement: fromRepoRoot('packages/react/src/index.tsx')
          },
          {
            find: '@reely/core',
            replacement: fromRepoRoot('packages/core/src/index.ts')
          },
          {
            find: '@reely/provider-native',
            replacement: fromRepoRoot('packages/provider-native/src/index.ts')
          }
        ]
      }
    })
};

export default config;
