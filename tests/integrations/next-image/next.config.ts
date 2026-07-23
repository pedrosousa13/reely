import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  },
  turbopack: {
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    resolveAlias: {
      '@reely/core': '../../../packages/core/src/index.ts',
      '@reely/provider-native': '../../../packages/provider-native/src/index.ts'
    }
  }
};

export default nextConfig;
