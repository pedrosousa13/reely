import { afterEach, beforeEach, expect } from 'vitest';

// Preview annotations (decorators, a11y parameters) are applied automatically
// by @storybook/addon-vitest; this file only adds the determinism guard:
// stories must not request anything outside the test origin. Every story test
// checks three surfaces after rendering — requests initiated through fetch,
// resources that finished loading (resource timing), and external URLs
// declared in the DOM (img/src, srcset, video/src, ...), which also catches
// requests still in flight when the test ends.

const skippedProtocols = new Set(['data:', 'blob:', 'about:', 'javascript:']);

const externalUrl = (raw: string): string | undefined => {
  let url: URL;
  try {
    url = new URL(raw, location.href);
  } catch {
    return undefined;
  }
  if (skippedProtocols.has(url.protocol)) return undefined;
  return url.origin === location.origin ? undefined : url.href;
};

const externalUrlsInDom = (): string[] => {
  const urls: string[] = [];
  const elements = document.querySelectorAll(
    'img, source, video, audio, iframe, embed, object, script[src], link[rel="stylesheet"]'
  );
  for (const element of elements) {
    for (const attribute of ['src', 'href', 'data'] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const external = externalUrl(value);
      if (external) urls.push(external);
    }
    const srcSet = element.getAttribute('srcset');
    for (const candidate of srcSet?.split(',') ?? []) {
      const candidateUrl = candidate.trim().split(/\s+/, 1)[0];
      if (!candidateUrl) continue;
      const external = externalUrl(candidateUrl);
      if (external) urls.push(external);
    }
  }
  return urls;
};

const fetchedUrls: string[] = [];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  performance.clearResourceTimings();
  fetchedUrls.length = 0;
  globalThis.fetch = (input, init) => {
    fetchedUrls.push(
      input instanceof Request ? input.url : new URL(input, location.href).href
    );
    return originalFetch(input, init);
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  const externalRequests = [
    ...fetchedUrls,
    ...performance.getEntriesByType('resource').map((entry) => entry.name),
    ...externalUrlsInDom()
  ].filter((url) => externalUrl(url) !== undefined);
  expect(externalRequests).toEqual([]);
});
