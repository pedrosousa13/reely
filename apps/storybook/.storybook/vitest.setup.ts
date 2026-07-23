import { afterEach, expect } from 'vitest';

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
});
