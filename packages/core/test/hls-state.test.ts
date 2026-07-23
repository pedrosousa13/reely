import { expect, test } from 'vitest';
import {
  PlayerController,
  createInitialPlayerState,
  type ProviderStateListener
} from '../src/index';

const createProvider = (
  overrides: {
    onSubscribe?: (listener: ProviderStateListener) => void;
    selectQuality?: (height: number | null) => Promise<{ ok: true }>;
  } = {}
) => ({
  provider: 'hls' as const,
  attach: () => undefined,
  load: () => undefined,
  destroy: () => undefined,
  subscribe: (listener: ProviderStateListener) => {
    overrides.onSubscribe?.(listener);
    return () => undefined;
  },
  ...(overrides.selectQuality ? { selectQuality: overrides.selectQuality } : {})
});

test('initial state reports no effective HLS engine and no quality', () => {
  const state = createInitialPlayerState();

  expect(state.hlsEngine).toBeNull();
  expect(state.quality).toBeNull();
});

test('reflects provider hlsEngine and quality patches in frozen state', () => {
  const controller = new PlayerController();
  let emit: ProviderStateListener | undefined;
  controller.setProvider(
    createProvider({ onSubscribe: (listener) => (emit = listener) })
  );

  emit?.({ hlsEngine: 'hls.js' });
  emit?.({ quality: { height: 720, width: 1280, bitrate: 2_000_000 } });

  const state = controller.getState();
  expect(state.hlsEngine).toBe('hls.js');
  expect(state.quality).toEqual({
    height: 720,
    width: 1280,
    bitrate: 2_000_000
  });
  expect(Object.isFrozen(state.quality)).toBe(true);

  emit?.({ quality: null });
  expect(controller.getState().quality).toBeNull();
  expect(controller.getState().hlsEngine).toBe('hls.js');
});

test('resets hlsEngine and quality when the provider detaches', () => {
  const controller = new PlayerController();
  let emit: ProviderStateListener | undefined;
  controller.setProvider(
    createProvider({ onSubscribe: (listener) => (emit = listener) })
  );
  emit?.({
    hlsEngine: 'native',
    quality: { height: 180, width: 320, bitrate: null }
  });

  controller.setProvider(undefined);

  expect(controller.getState().hlsEngine).toBeNull();
  expect(controller.getState().quality).toBeNull();
});

test('forwards selectQuality to the provider command', async () => {
  const heights: Array<number | null> = [];
  const controller = new PlayerController();
  controller.setProvider(
    createProvider({
      selectQuality: async (height) => {
        heights.push(height);
        return { ok: true };
      }
    })
  );

  await expect(controller.selectQuality(720)).resolves.toEqual({ ok: true });
  await expect(controller.selectQuality(null)).resolves.toEqual({ ok: true });

  expect(heights).toEqual([720, null]);
});

test('reports selectQuality as unsupported when the provider lacks it', async () => {
  const controller = new PlayerController();
  controller.setProvider(createProvider());

  await expect(controller.selectQuality(720)).resolves.toEqual({
    ok: false,
    reason: 'unsupported'
  });
});

test('reports selectQuality as not ready without a provider', async () => {
  const controller = new PlayerController();

  await expect(controller.selectQuality(720)).resolves.toEqual({
    ok: false,
    reason: 'not-ready'
  });
});
