// Storybook's own dev-server extension point (see
// storybook/dist/core-server/utils/middleware.ts:getMiddleware — it looks
// for `middleware.{js,mjs,cjs}` next to main.ts; TypeScript isn't
// transformed for this file, hence plain JS here). It is applied directly to
// the shared connect app *before* the Vite preview builder attaches its own
// middlewares (see core-server/dev-server.ts: `(await
// getMiddleware(configDir))(app)` runs ahead of `getPreviewBuilder`/
// `useStatics`), so this registration is guaranteed to see the request
// first — independent of Vite plugin ordering or any addon's own
// `viteFinal` contributions.
//
// This duplicates apps/storybook/src/hang-endpoint-plugin.ts (which remains
// the mechanism `pnpm test:storybook` relies on, since the Vitest addon
// builds its own Vite server directly from viteFinal and does not go
// through `storybook dev`'s CLI bootstrap, so this file never loads there).
export default function middleware(app) {
  app.use('/__reely/hang.png', () => {
    // Intentionally never respond and never call next().
  });
}
