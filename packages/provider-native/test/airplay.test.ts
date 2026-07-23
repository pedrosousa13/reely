// @vitest-environment happy-dom

import { expect, test, vi } from 'vitest';
import { createNativeProvider } from '../src/index';

const define = (target: object, key: string, value: unknown): void => {
  Object.defineProperty(target, key, { configurable: true, value });
};

const createOwnedVideo = (): HTMLVideoElement => {
  const ownerDocument = document.implementation.createHTMLDocument('owner');
  return ownerDocument.createElement('video');
};

test('reports AirPlay available and routes the picker through WebKit', async () => {
  const media = createOwnedVideo();
  const webkitShowPlaybackTargetPicker = vi.fn();
  define(
    media,
    'webkitShowPlaybackTargetPicker',
    webkitShowPlaybackTargetPicker
  );
  const patches: Array<Record<string, unknown>> = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));

  await provider.attach();
  expect(patches.at(-1)).toMatchObject({
    capabilities: { airPlay: { status: 'available' } }
  });

  await expect(provider.showAirPlayPicker()).resolves.toEqual({ ok: true });
  expect(webkitShowPlaybackTargetPicker).toHaveBeenCalledOnce();
});

test('reports AirPlay unavailable when WebKit lacks the picker', async () => {
  const media = createOwnedVideo();
  const patches: Array<Record<string, unknown>> = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));

  await provider.attach();
  expect(patches.at(-1)).toMatchObject({
    capabilities: { airPlay: { status: 'unavailable', reason: 'browser' } }
  });

  await expect(provider.showAirPlayPicker()).resolves.toEqual({
    ok: false,
    reason: 'unsupported'
  });
});

test('reports AirPlay policy-disallowed for x-webkit-airplay="deny"', async () => {
  const media = createOwnedVideo();
  const webkitShowPlaybackTargetPicker = vi.fn();
  define(
    media,
    'webkitShowPlaybackTargetPicker',
    webkitShowPlaybackTargetPicker
  );
  media.setAttribute('x-webkit-airplay', 'deny');
  const patches: Array<Record<string, unknown>> = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));

  await provider.attach();
  expect(patches.at(-1)).toMatchObject({
    capabilities: { airPlay: { status: 'unavailable', reason: 'policy' } }
  });

  await expect(provider.showAirPlayPicker()).resolves.toMatchObject({
    ok: false,
    reason: 'blocked',
    error: { category: 'policy' }
  });
  expect(webkitShowPlaybackTargetPicker).not.toHaveBeenCalled();
});

test('reports AirPlay policy-disallowed when remote playback is disabled', async () => {
  const media = createOwnedVideo();
  define(media, 'webkitShowPlaybackTargetPicker', vi.fn());
  define(media, 'disableRemotePlayback', true);
  const patches: Array<Record<string, unknown>> = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));

  await provider.attach();
  expect(patches.at(-1)).toMatchObject({
    capabilities: { airPlay: { status: 'unavailable', reason: 'policy' } }
  });
});

test('surfaces AirPlay user-gesture rejection as a blocked policy result', async () => {
  const media = createOwnedVideo();
  define(
    media,
    'webkitShowPlaybackTargetPicker',
    vi.fn().mockImplementation(() => {
      throw new DOMException(
        'AirPlay requires a user gesture.',
        'NotAllowedError'
      );
    })
  );
  const provider = createNativeProvider(media);

  await expect(provider.showAirPlayPicker()).resolves.toMatchObject({
    ok: false,
    reason: 'blocked',
    error: {
      category: 'policy',
      message: 'AirPlay requires a user gesture.'
    }
  });
});
