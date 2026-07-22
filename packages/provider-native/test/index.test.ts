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
      destroy: () => undefined,
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

test('stops reporting events after destroy', async () => {
  const media = document.createElement('video');
  const provider = createNativeProvider(media);
  const listener = vi.fn();
  provider.subscribe(listener);

  await provider.destroy();
  media.dispatchEvent(new Event('ended'));

  expect(listener).not.toHaveBeenCalled();
});
