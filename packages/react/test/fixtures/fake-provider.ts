import type {
  CommandResult,
  PlayerProvider,
  ProviderAdapter,
  ProviderStateListener,
  ProviderStatePatch
} from '@reely/core';

export const deferred = <Value>() => {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
};

export const createFakeProvider = ({
  playResult = { ok: true } as CommandResult,
  provider = 'native' as PlayerProvider
} = {}) => {
  const listeners = new Set<ProviderStateListener>();
  let attachCount = 0;
  let destroyCount = 0;
  let loadCount = 0;
  let playCount = 0;
  const adapter: ProviderAdapter = {
    provider,
    attach: () => {
      attachCount += 1;
    },
    load: () => {
      loadCount += 1;
    },
    destroy: () => {
      destroyCount += 1;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: async () => {
      playCount += 1;
      return playResult;
    }
  };
  return {
    adapter,
    counts: () => ({ attachCount, destroyCount, loadCount, playCount }),
    emit: (patch: ProviderStatePatch) => {
      listeners.forEach((listener) => listener(patch));
    }
  };
};
