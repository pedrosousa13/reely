# Task 3 report: Poster docs and real-browser geometry

## RED

Command:

```sh
corepack pnpm@11.15.1 exec playwright test e2e/poster.spec.ts
```

Result: 13 failures and 2 Chromium-only fullscreen skips. The expected failures
were that `data-reely-part="poster"` and `data-reely-part="poster-image"` did
not exist in the docs page. The visual-source assertion also found the existing
unit-test string, so the final source scan deliberately excludes test files.

## GREEN

Added a local decorative SVG and a responsive `Player.PosterImage` inside the
docs viewport before `Player.Media`, with the documented 30% 40% focal point.
Added concise guidance for opaque picture and Next Image children, Next 16
`preload`, explicit `nativePoster`, native/custom crop behavior, duplicate
candidate risk, and consumer-selected LCP priority.

Focused command:

```sh
corepack pnpm@11.15.1 exec playwright test e2e/poster.spec.ts
```

Result: 13 passed in Chromium, Firefox, and WebKit; 2 expected non-Chromium
fullscreen skips. Chromium entered and exited the real Fullscreen API through a
viewport click handler.

Required focused gates:

```sh
corepack pnpm@11.15.1 test:e2e -- --grep poster
corepack pnpm@11.15.1 --filter @reely/docs build
```

Result: passed. The root argument shape invoked all 24 browser tests; 22 passed
and 2 expected non-Chromium fullscreen skips. Docs build passed.

## Full verification

All passed:

```sh
CI=true corepack pnpm@11.15.1 test
corepack pnpm@11.15.1 typecheck
corepack pnpm@11.15.1 lint
corepack pnpm@11.15.1 format:check
corepack pnpm@11.15.1 build
corepack pnpm@11.15.1 test:e2e
corepack pnpm@11.15.1 test:integrations
corepack pnpm@11.15.1 test:packages
```

`format:check` initially reported only the new E2E file; formatting it with the
repository Prettier command resolved that before the final passing run.

## Self-review and concerns

- Rectangle assertions compare exact x/y/width/height values from real browser
  `getBoundingClientRect()` output, including after visibility becomes hidden.
- The poster state and computed `visibility: hidden` are both asserted after
  playback begins.
- Focal position is asserted in landscape, portrait, restored landscape, and
  Chromium fullscreen. Poster/viewport rectangles are asserted in each state.
- The source scan found no `background-image` or `backgroundImage` declarations
  in visual production source files; it intentionally excludes tests because a
  pre-existing test asserts the forbidden string is absent.
- No unresolved concerns. Browser fullscreen support was available in Chromium.
