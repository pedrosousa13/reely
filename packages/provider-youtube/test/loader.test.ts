// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { YouTubeIframeApi } from '../src/index';

const scriptSelector = 'script[src="https://www.youtube.com/iframe_api"]';

type LoaderWindow = Window & {
  YT?: YouTubeIframeApi;
  onYouTubeIframeAPIReady?: () => void;
};

const loaderWindow = (): LoaderWindow => window as LoaderWindow;

const fakeApi = (): YouTubeIframeApi => ({
  Player: class {
    destroy(): void {}
  } as unknown as YouTubeIframeApi['Player'],
  PlayerState: {
    BUFFERING: 3,
    CUED: 5,
    ENDED: 0,
    PAUSED: 2,
    PLAYING: 1,
    UNSTARTED: -1
  }
});

const importLoader = async () => {
  const { loadYouTubeIframeApi } = await import('../src/loader');
  return loadYouTubeIframeApi;
};

beforeEach(() => {
  vi.resetModules();
  // The vitest happy-dom environment cannot fetch script files; it logs a
  // NotSupportedError for every external script append. Silence that noise.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  delete loaderWindow().YT;
  delete loaderWindow().onYouTubeIframeAPIReady;
  document
    .querySelectorAll(scriptSelector)
    .forEach((script) => script.remove());
});

afterEach(() => {
  vi.restoreAllMocks();
  delete loaderWindow().YT;
  delete loaderWindow().onYouTubeIframeAPIReady;
});

test('injects one API script per window and shares one promise', async () => {
  const loadYouTubeIframeApi = await importLoader();

  const first = loadYouTubeIframeApi();
  const second = loadYouTubeIframeApi();

  expect(second).toBe(first);
  expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);

  const api = fakeApi();
  loaderWindow().YT = api;
  loaderWindow().onYouTubeIframeAPIReady?.();

  await expect(first).resolves.toBe(api);
  await expect(second).resolves.toBe(api);
  expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);
});

test('reuses an API script another consumer already injected', async () => {
  const existing = document.createElement('script');
  existing.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(existing);
  const loadYouTubeIframeApi = await importLoader();

  const load = loadYouTubeIframeApi();

  expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);

  const api = fakeApi();
  loaderWindow().YT = api;
  loaderWindow().onYouTubeIframeAPIReady?.();

  await expect(load).resolves.toBe(api);
});

test('resolves immediately when the API is already on the window', async () => {
  const api = fakeApi();
  loaderWindow().YT = api;
  const loadYouTubeIframeApi = await importLoader();

  await expect(loadYouTubeIframeApi()).resolves.toBe(api);
  expect(document.querySelectorAll(scriptSelector)).toHaveLength(0);
});

test('chains a pre-existing onYouTubeIframeAPIReady callback', async () => {
  const previousCallback = vi.fn();
  loaderWindow().onYouTubeIframeAPIReady = previousCallback;
  const loadYouTubeIframeApi = await importLoader();

  const load = loadYouTubeIframeApi();
  const api = fakeApi();
  loaderWindow().YT = api;
  loaderWindow().onYouTubeIframeAPIReady?.();

  await expect(load).resolves.toBe(api);
  expect(previousCallback).toHaveBeenCalledTimes(1);
});

test('cleans up after a script error so a retry injects a fresh script', async () => {
  const loadYouTubeIframeApi = await importLoader();

  const failed = loadYouTubeIframeApi();
  const script = document.querySelector(scriptSelector);
  expect(script).not.toBeNull();
  script?.dispatchEvent(new Event('error'));

  await expect(failed).rejects.toThrow(
    'The YouTube iframe API script failed to load.'
  );
  expect(document.querySelectorAll(scriptSelector)).toHaveLength(0);
  expect(loaderWindow().onYouTubeIframeAPIReady).toBeUndefined();

  const retried = loadYouTubeIframeApi();
  expect(retried).not.toBe(failed);
  expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);

  const api = fakeApi();
  loaderWindow().YT = api;
  loaderWindow().onYouTubeIframeAPIReady?.();

  await expect(retried).resolves.toBe(api);
});

test('rejects without cleanup side effects when the script initializes no API', async () => {
  const loadYouTubeIframeApi = await importLoader();

  const load = loadYouTubeIframeApi();
  loaderWindow().onYouTubeIframeAPIReady?.();

  await expect(load).rejects.toThrow(
    'The YouTube iframe API script did not initialize.'
  );

  const retried = loadYouTubeIframeApi();
  const api = fakeApi();
  loaderWindow().YT = api;
  loaderWindow().onYouTubeIframeAPIReady?.();

  await expect(retried).resolves.toBe(api);
});

test('ignores a late script error after the API resolved', async () => {
  const loadYouTubeIframeApi = await importLoader();

  const load = loadYouTubeIframeApi();
  const api = fakeApi();
  loaderWindow().YT = api;
  loaderWindow().onYouTubeIframeAPIReady?.();
  await expect(load).resolves.toBe(api);

  document.querySelector(scriptSelector)?.dispatchEvent(new Event('error'));

  await expect(loadYouTubeIframeApi()).resolves.toBe(api);
  expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);
});
