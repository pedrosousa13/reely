# @reely/storybook

Component workbench and story-based test runner for `@reely/react`.

## Commands

| Command                              | What it does                                   |
| ------------------------------------ | ---------------------------------------------- |
| `pnpm --filter @reely/storybook dev` | Storybook dev server on port 6006              |
| `pnpm test:storybook` (root)         | Runs every story as a Chromium Vitest test     |
| `pnpm build` (root)                  | Includes the static `storybook build` CI check |

## Conventions

- **Stories live next to their component:** `packages/react/src/<part>.stories.tsx`.
- **One story per meaningful state.** A component with four `data-state`
  values gets four stories, named after the state.
- **Stories are tests.** Every story runs in a real browser with an axe
  check (`a11y.test = 'error'`). A story's `play` function is its
  interaction test — see `ActivatesOnClick` in
  `packages/react/src/activation.stories.tsx` for the reference pattern:
  arrange via `parameters.reely`, act with `userEvent`, assert on
  `data-state`.
- **No real media, no network.** A global `afterEach` fails any story test
  that touches an external origin or the fake media source. Use data-URI
  images; use `/__reely/hang.png` for perpetual-loading states. This path
  is served in both run modes — the Vite plugin
  `apps/storybook/src/hang-endpoint-plugin.ts` for `pnpm test:storybook`,
  and `apps/storybook/.storybook/middleware.js` for `storybook dev` — since
  the Vitest addon builds its own Vite server and never goes through the
  dev-server bootstrap. The path string is duplicated across stories, the
  plugin, and the middleware; keep all three in sync if it ever changes.
  The `/media/sample.mp4` assertion only covers the decorator's default
  source — a story overriding `rootProps.source` with a different
  same-origin path is only caught by the external-origin check, so keep
  story sources on the default unless there's a reason not to.
- **Give headless states visible chrome.** Stories set a shared
  `viewportStyle` (`border: '1px dashed #94a3b8'`, `background: '#f1f5f9'`)
  on `Player.Viewport` so unstyled states are visible in the workbench.
  This is workbench-only scaffolding — real component styling is issue
  #10's job.
- **Re-declare `rootProps` per story.** Stories that need non-default
  `rootProps` repeat the full object in their own `parameters.reely`
  rather than relying on `meta.parameters` and a story override to
  deep-merge — safer given Storybook's parameter merge semantics.

## Dialing player state

The global `withMockController` decorator wraps every story in
`Player.Root` backed by a fake provider (the same fixture the contract
tests use). Control it per story:

```ts
parameters: {
  reely: {
    rootProps: { loading: 'interaction' },   // any Player.Root props
    scenario: { kind: 'pending' }            // provider-load scenario
  }
}
```

Scenarios:

- `{ kind: 'resolve', patches?: [...] }` (default) — provider loads;
  optional `ProviderStatePatch` list dials post-ready state, e.g. the
  `BufferingState` story in `loading-indicator.stories.tsx`:
  `patches: [{ activation: 'ready', lifecycle: 'ready' }, { buffering: true }]`.
- `{ kind: 'pending' }` — provider load never settles
  (`loading-provider`).
- `{ kind: 'reject', message? }` — provider load fails (`error`).

Pre-provider activation states come from real strategy behavior: use
`loading="interaction"` and click (or omit `Player.Media` to hold
`eligible`). In `play` functions, `getFakeProviderHandle()` from
`apps/storybook/src/mock-provider-loader.ts` exposes the live fake
provider for further `emit()` patches.

## Adding stories for a new issue

1. Create `packages/react/src/<part>.stories.tsx`.
2. Cover every visual state the issue defines, one story each.
3. Add at least one `play` interaction story if the component has
   interaction semantics.
4. Run `pnpm test:storybook` — new stories are picked up automatically.
