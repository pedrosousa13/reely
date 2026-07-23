import type { Plugin } from 'vite';

// Serves a same-origin image URL that never responds, so poster stories can
// hold `data-state="loading"` deterministically without external requests.
export const hangEndpointPlugin = (): Plugin => ({
  name: 'reely-hang-endpoint',
  configureServer(server) {
    server.middlewares.use('/__reely/hang.png', () => {
      // Intentionally never respond and never call next().
    });
  }
});
