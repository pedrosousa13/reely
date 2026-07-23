import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview';
import { setProjectAnnotations } from '@storybook/react-vite';
import { afterEach, beforeAll, expect } from 'vitest';
import * as projectAnnotations from './preview';

const annotations = setProjectAnnotations([
  a11yAddonAnnotations,
  projectAnnotations
]);

beforeAll(annotations.beforeAll);

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
