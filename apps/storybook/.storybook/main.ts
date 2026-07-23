import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import { hangEndpointPlugin } from '../src/hang-endpoint-plugin';

const fromRepoRoot = (path: string): string =>
  fileURLToPath(new URL(`../../../${path}`, import.meta.url));

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../../../packages/react/src/**/*.stories.tsx'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y'],
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [hangEndpointPlugin()],
      resolve: {
        alias: [
          {
            // Anchored on both ends: Vite's alias plugin does a plain
            // string.replace(find, replacement) of the matched substring,
            // so an unanchored pattern would only swap "provider-loaders"
            // and leave the leading "./" from the original specifier in
            // place, producing an invalid path. Anchoring makes the whole
            // specifier get replaced with the absolute mock module path.
            // This pattern also assumes the importer sits directly in
            // packages/react/src — a `../provider-loaders` import from a
            // future subdirectory would bypass the mock, and the
            // pending/reject stories would then fail loudly.
            find: /^\.\/provider-loaders(\.ts)?$/,
            replacement: fileURLToPath(
              new URL('../src/mock-provider-loader.ts', import.meta.url)
            )
          },
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
          },
          // Stories live in packages/react/src, outside this app's root, so
          // plain node_modules resolution of "storybook/test" (a devDependency
          // declared only here) fails Vite's dependency scan when initiated
          // from that directory — which silently disables prebundling for
          // every dependency and breaks CJS named-export interop (e.g.
          // aria-query). Resolving eagerly from this config file (where
          // "storybook" is a real dependency) and aliasing to the resolved
          // absolute path sidesteps the cross-package resolution gap.
          {
            find: 'storybook/test',
            replacement: require.resolve('storybook/test')
          }
        ]
      }
    })
};

export default config;
