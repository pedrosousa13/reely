// @vitest-environment happy-dom

import { expect, test, vi } from 'vitest';
import type { ProviderAdapter, ProviderStateListener } from '@reely/core';
import { createNativeProvider } from '../src/index';

type ContractAdapter = {
  provider: ProviderAdapter;
  confirmPlayback: () => void;
};

const createFakeAdapter = (): ContractAdapter => {
  let listener: ProviderStateListener | undefined;
  return {
    provider: {
      provider: 'native',
      attach: () => undefined,
      load: () => undefined,
      destroy: () => (listener = undefined),
      subscribe: (nextListener) => {
        listener = nextListener;
        return () => (listener = undefined);
      },
      play: async () => ({ ok: true })
    },
    confirmPlayback: () => listener?.({ playback: 'playing' })
  };
};

const createNativeAdapter = (): ContractAdapter => {
  const media = document.createElement('video');
  vi.spyOn(media, 'play').mockResolvedValue(undefined);
  return {
    provider: createNativeProvider(media),
    confirmPlayback: () => media.dispatchEvent(new Event('playing'))
  };
};

const testProviderContract = (
  name: string,
  createAdapter: () => ContractAdapter
): void =>
  test(`${name} adapter conforms to lifecycle and event-confirmed playback`, async () => {
    const { confirmPlayback, provider } = createAdapter();
    const patches: unknown[] = [];
    provider.subscribe((patch) => patches.push(patch));

    await provider.attach();
    await provider.load();
    await expect(provider.play?.()).resolves.toEqual({ ok: true });
    expect(patches).not.toContainEqual(
      expect.objectContaining({ playback: 'playing' })
    );

    confirmPlayback();
    expect(patches).toContainEqual(
      expect.objectContaining({ playback: 'playing' })
    );

    const patchCount = patches.length;
    await provider.destroy();
    await provider.destroy();
    confirmPlayback();
    expect(patches).toHaveLength(patchCount);
  });

testProviderContract('fake', createFakeAdapter);
testProviderContract('native', createNativeAdapter);

test('reports native command failures without throwing', async () => {
  const media = document.createElement('video');
  const provider = createNativeProvider(media);
  vi.spyOn(media, 'play').mockRejectedValue(
    new DOMException('Playback was blocked.', 'NotAllowedError')
  );

  await expect(provider.play()).resolves.toMatchObject({
    ok: false,
    reason: 'blocked',
    error: { category: 'policy' }
  });
});

test('contains synchronous native pause and retry command failures', async () => {
  const media = document.createElement('video');
  const provider = createNativeProvider(media);
  vi.spyOn(media, 'pause').mockImplementation(() => {
    throw new Error('pause failed');
  });
  vi.spyOn(media, 'load').mockImplementation(() => {
    throw new Error('reload failed');
  });

  await expect(provider.pause?.()).resolves.toMatchObject({
    ok: false,
    reason: 'provider-error',
    error: { message: 'pause failed' }
  });
  await expect(provider.retry?.()).resolves.toMatchObject({
    ok: false,
    reason: 'provider-error',
    error: { message: 'reload failed' }
  });
});

test('stops reporting events after destroy', async () => {
  const media = document.createElement('video');
  const provider = createNativeProvider(media);
  const listener = vi.fn();
  provider.subscribe(listener);

  await provider.destroy();
  media.dispatchEvent(new Event('ended'));

  expect(listener).not.toHaveBeenCalled();
});

test('loads once during ordinary lifecycle and retry forces a reload', async () => {
  const media = document.createElement('video');
  const load = vi.spyOn(media, 'load');
  const provider = createNativeProvider(media);

  await provider.load();
  await provider.load();
  await provider.retry?.();

  expect(load).toHaveBeenCalledTimes(2);
});

test('applies start and end boundaries to initial position and seeking', async () => {
  const media = document.createElement('video');
  Object.defineProperty(media, 'duration', { configurable: true, value: 20 });
  const provider = createNativeProvider(media, {
    startTime: 4,
    endTime: 12
  });
  await provider.attach();

  media.dispatchEvent(new Event('loadedmetadata'));
  expect(media.currentTime).toBe(4);

  await provider.seekTo?.(30);
  expect(media.currentTime).toBe(12);
  await provider.seekTo?.(-1);
  expect(media.currentTime).toBe(4);
});

test('clamps an initial start boundary to finite media duration', async () => {
  const media = document.createElement('video');
  Object.defineProperty(media, 'duration', { configurable: true, value: 5 });
  const provider = createNativeProvider(media, { startTime: 10 });
  await provider.attach();

  media.dispatchEvent(new Event('loadedmetadata'));

  expect(media.currentTime).toBe(5);
});

test('ends playback at the configured end boundary without looping', async () => {
  const media = document.createElement('video');
  const pause = vi.spyOn(media, 'pause');
  const patches: unknown[] = [];
  const provider = createNativeProvider(media, { startTime: 2, endTime: 5 });
  provider.subscribe((patch) => patches.push(patch));
  await provider.attach();
  media.currentTime = 5.5;

  media.dispatchEvent(new Event('timeupdate'));

  expect(media.currentTime).toBe(5);
  expect(pause).toHaveBeenCalledOnce();
  expect(patches).toContainEqual(
    expect.objectContaining({ playback: 'ended', currentTime: 5 })
  );
});

test('loops from the end boundary back to the configured start', async () => {
  const media = document.createElement('video');
  const play = vi.spyOn(media, 'play').mockResolvedValue(undefined);
  const provider = createNativeProvider(media, {
    loop: true,
    startTime: 2,
    endTime: 5
  });
  await provider.attach();
  media.currentTime = 5;

  media.dispatchEvent(new Event('timeupdate'));
  await Promise.resolve();

  expect(media.currentTime).toBe(2);
  expect(play).toHaveBeenCalledOnce();
});

test('loops a native ended event back to the configured start', async () => {
  const media = document.createElement('video');
  const play = vi.spyOn(media, 'play').mockResolvedValue(undefined);
  const patches: unknown[] = [];
  const provider = createNativeProvider(media, { loop: true, startTime: 2 });
  provider.subscribe((patch) => patches.push(patch));
  await provider.attach();
  patches.length = 0;
  media.currentTime = 8;

  media.dispatchEvent(new Event('ended'));
  await Promise.resolve();

  expect(media.currentTime).toBe(2);
  expect(play).toHaveBeenCalledOnce();
  expect(patches).not.toContainEqual(
    expect.objectContaining({ playback: 'ended' })
  );
});

test('restarts play from the configured start after reaching the end boundary', async () => {
  const media = document.createElement('video');
  const play = vi.spyOn(media, 'play').mockResolvedValue(undefined);
  const provider = createNativeProvider(media, { startTime: 2, endTime: 5 });
  media.currentTime = 5;

  await expect(provider.play?.()).resolves.toEqual({ ok: true });

  expect(media.currentTime).toBe(2);
  expect(play).toHaveBeenCalledOnce();
});

test('emits one public play event for the native play and playing pair', async () => {
  const media = document.createElement('video');
  const eventTypes: string[] = [];
  const provider = createNativeProvider(media);
  provider.subscribe((_patch, event) => {
    if (event) eventTypes.push(event.type);
  });
  await provider.attach();

  media.dispatchEvent(new Event('play'));
  media.dispatchEvent(new Event('playing'));

  expect(eventTypes).toEqual(['play']);
});

test('reports native text tracks as unavailable when the command is unsupported', async () => {
  const media = document.createElement('video');
  const patches: Array<Record<string, unknown>> = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));

  await provider.attach();

  expect(patches.at(-1)).toMatchObject({
    capabilities: {
      selectTextTrack: { status: 'unavailable', reason: 'provider' }
    }
  });
  expect(provider.selectTextTrack).toBeUndefined();
});

const createTimeRanges = (
  ranges: ReadonlyArray<readonly [number, number]>
): TimeRanges => ({
  length: ranges.length,
  start: (index) => ranges[index]?.[0] ?? 0,
  end: (index) => ranges[index]?.[1] ?? 0
});

test('reports seeking and ordered buffered and seekable ranges from media events', async () => {
  const media = document.createElement('video');
  Object.defineProperty(media, 'buffered', {
    configurable: true,
    value: createTimeRanges([
      [8, 10],
      [0, 4]
    ])
  });
  Object.defineProperty(media, 'seekable', {
    configurable: true,
    value: createTimeRanges([[0, 12]])
  });
  const patches: unknown[] = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));
  await provider.attach();
  patches.length = 0;

  await provider.seekTo?.(6);
  expect(patches).toEqual([]);
  media.dispatchEvent(new Event('seeking'));
  media.dispatchEvent(new Event('seeked'));
  media.dispatchEvent(new Event('progress'));

  expect(patches).toContainEqual(expect.objectContaining({ seeking: true }));
  expect(patches).toContainEqual(
    expect.objectContaining({ seeking: false, currentTime: 6 })
  );
  expect(patches).toContainEqual({
    buffered: [
      { start: 0, end: 4 },
      { start: 8, end: 10 }
    ],
    seekable: [{ start: 0, end: 12 }]
  });
});

test('waits for authoritative audio and rate events after successful commands', async () => {
  const media = document.createElement('video');
  const patches: unknown[] = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));
  await provider.attach();
  patches.length = 0;

  await expect(provider.setVolume?.(0.4)).resolves.toEqual({ ok: true });
  await expect(provider.mute?.()).resolves.toEqual({ ok: true });
  await expect(provider.setPlaybackRate?.(1.5)).resolves.toEqual({ ok: true });
  expect(patches).toEqual([]);

  media.dispatchEvent(new Event('volumechange'));
  media.dispatchEvent(new Event('ratechange'));
  expect(patches).toContainEqual(
    expect.objectContaining({ muted: true, volume: 0.4 })
  );
  expect(patches).toContainEqual(
    expect.objectContaining({ playbackRate: 1.5 })
  );
});

test('reports waiting, recovery, ended, and source errors from media events', async () => {
  const media = document.createElement('video');
  const patches: unknown[] = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));
  await provider.attach();
  patches.length = 0;

  media.dispatchEvent(new Event('waiting'));
  media.dispatchEvent(new Event('canplay'));
  media.dispatchEvent(new Event('ended'));
  Object.defineProperty(media, 'error', {
    configurable: true,
    value: { code: 4, message: 'unsupported source' }
  });
  media.dispatchEvent(new Event('error'));

  expect(patches).toContainEqual({ buffering: true });
  expect(patches).toContainEqual({ buffering: false });
  expect(patches).toContainEqual(
    expect.objectContaining({ playback: 'ended', buffering: false })
  );
  expect(patches).toContainEqual(
    expect.objectContaining({
      lifecycle: 'error',
      error: expect.objectContaining({
        category: 'source',
        message: 'unsupported source'
      })
    })
  );
});

test('attaches and destroys idempotently and unregisters native listeners', async () => {
  const media = document.createElement('video');
  const add = vi.spyOn(media, 'addEventListener');
  const remove = vi.spyOn(media, 'removeEventListener');
  const provider = createNativeProvider(media);

  await provider.attach();
  await provider.attach();
  await provider.destroy();
  await provider.destroy();

  expect(add.mock.calls.filter(([type]) => type === 'play')).toHaveLength(1);
  expect(remove.mock.calls.filter(([type]) => type === 'play')).toHaveLength(1);
});

test('reports and executes available fullscreen and picture-in-picture commands', async () => {
  const media = document.createElement('video');
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  const requestPictureInPicture = vi.fn().mockResolvedValue(media);
  const exitFullscreen = vi.fn().mockResolvedValue(undefined);
  const exitPictureInPicture = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(media, 'requestFullscreen', {
    configurable: true,
    value: requestFullscreen
  });
  Object.defineProperty(media, 'requestPictureInPicture', {
    configurable: true,
    value: requestPictureInPicture
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen
  });
  Object.defineProperty(document, 'exitPictureInPicture', {
    configurable: true,
    value: exitPictureInPicture
  });
  const patches: Array<Record<string, unknown>> = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));

  try {
    await provider.attach();
    expect(patches.at(-1)).toMatchObject({
      capabilities: {
        fullscreen: { status: 'available' },
        pictureInPicture: { status: 'available' }
      }
    });
    await expect(provider.requestFullscreen?.()).resolves.toEqual({ ok: true });
    await expect(provider.exitFullscreen?.()).resolves.toEqual({ ok: true });
    await expect(provider.requestPictureInPicture?.()).resolves.toEqual({
      ok: true
    });
    await expect(provider.exitPictureInPicture?.()).resolves.toEqual({
      ok: true
    });
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(exitFullscreen).toHaveBeenCalledOnce();
    expect(requestPictureInPicture).toHaveBeenCalledOnce();
    expect(exitPictureInPicture).toHaveBeenCalledOnce();
  } finally {
    Reflect.deleteProperty(document, 'exitFullscreen');
    Reflect.deleteProperty(document, 'exitPictureInPicture');
  }
});

test('reports unsupported fullscreen and picture-in-picture browser APIs consistently', async () => {
  const media = document.createElement('video');
  const patches: Array<Record<string, unknown>> = [];
  const provider = createNativeProvider(media);
  provider.subscribe((patch) => patches.push(patch));

  await provider.attach();

  expect(patches.at(-1)).toMatchObject({
    capabilities: {
      fullscreen: { status: 'unavailable', reason: 'browser' },
      pictureInPicture: { status: 'unavailable', reason: 'browser' }
    }
  });
  await expect(provider.requestFullscreen?.()).resolves.toEqual({
    ok: false,
    reason: 'unsupported'
  });
  await expect(provider.requestPictureInPicture?.()).resolves.toEqual({
    ok: false,
    reason: 'unsupported'
  });
});
