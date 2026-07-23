import { afterEach, beforeAll, expect } from 'vitest';

beforeAll(() => {
  // Browsers cap the resource-timing buffer (~250 entries); module fetches
  // accumulate across a file's tests and, once full, later external
  // requests go unrecorded — the guard below would pass vacuously.
  performance.setResourceTimingBufferSize(10_000);
});

afterEach(() => {
  const resources = performance.getEntriesByType(
    'resource'
  ) as PerformanceResourceTiming[];
  const names = resources.map((entry) => entry.name);
  const external = names.filter(
    (name) =>
      new URL(name, window.location.href).origin !== window.location.origin
  );
  // Stories must never contact an external origin — no media, SDKs, or CDNs.
  expect(external).toEqual([]);
  // Same-origin checks alone would miss the decorator's fake source.
  const mediaRequests = names.filter((name) =>
    name.includes('/media/sample.mp4')
  );
  expect(mediaRequests).toEqual([]);
  // Clear so each test is checked against only its own entries.
  performance.clearResourceTimings();
});
