import type { ProviderAdapter, ProviderStatePatch } from '@reely/core';
import { createFakeProvider } from '../../../packages/react/test/fixtures/fake-provider';

export type MockScenario =
  | {
      readonly kind: 'resolve';
      readonly patches?: readonly ProviderStatePatch[];
    }
  | { readonly kind: 'pending' }
  | { readonly kind: 'reject'; readonly message?: string };

type FakeProviderHandle = ReturnType<typeof createFakeProvider>;

let scenario: MockScenario = { kind: 'resolve' };
let handle: FakeProviderHandle | null = null;

export const setScenario = (next: MockScenario): void => {
  scenario = next;
  handle = null;
};

export const getFakeProviderHandle = (): FakeProviderHandle | null => handle;

// Call-compatible with the real private loader in
// packages/react/src/provider-loaders.ts (which receives
// { source, media, nativeOptions }) — the Vite alias substitutes this module
// for it inside the Storybook app only. The request payload is ignored: the
// scenario alone drives the mock's behavior, so no parameter is declared.
export const loadProvider = async (): Promise<ProviderAdapter> => {
  const current = scenario;
  if (current.kind === 'pending') {
    return new Promise<never>(() => {});
  }
  if (current.kind === 'reject') {
    throw new Error(
      current.message ?? 'Storybook scenario: provider load rejected.'
    );
  }
  const fake = createFakeProvider();
  handle = fake;
  const subscribe = fake.adapter.subscribe;
  let patchesFlushed = false;
  return {
    ...fake.adapter,
    subscribe: (listener) => {
      const unsubscribe = subscribe(listener);
      if (!patchesFlushed) {
        patchesFlushed = true;
        // Flush scripted patches after Root has subscribed so stories can
        // dial post-ready playback states deterministically.
        queueMicrotask(() => {
          current.patches?.forEach((patch) => fake.emit(patch));
        });
      }
      return unsubscribe;
    }
  };
};
