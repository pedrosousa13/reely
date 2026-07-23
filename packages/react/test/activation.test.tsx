// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react';
import { createRef, useLayoutEffect } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  detectSource,
  PlayerController,
  type ProviderAdapter,
  type ProviderStateListener
} from '@reely/core';
import * as Player from '../src/index';
import { loadProvider } from '../src/provider-loaders';
import { useActivation } from '../src/use-activation';
import { createFakeProvider, deferred } from './fixtures/fake-provider';

vi.mock('../src/provider-loaders', () => ({
  loadProvider: vi.fn()
}));

class ControlledIntersectionObserver implements IntersectionObserver {
  static instances: ControlledIntersectionObserver[] = [];
  readonly root = null;
  readonly thresholds = [0];
  readonly rootMargin: string;
  private readonly callback: IntersectionObserverCallback;
  private target?: Element;

  constructor(
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.callback = callback;
    this.rootMargin = options.rootMargin ?? '0px';
    ControlledIntersectionObserver.instances.push(this);
  }

  disconnect = vi.fn();
  observe = vi.fn((target: Element) => {
    this.target = target;
  });
  takeRecords = () => [];
  unobserve = vi.fn();

  intersect() {
    const target = this.target!;
    this.callback(
      [
        {
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target,
          time: 0
        }
      ],
      this
    );
  }
}

const mockedLoadProvider = vi.mocked(loadProvider);

type ActivationProbeProps = {
  readonly autoplay?: Player.RootProps['autoplay'];
  readonly controller: PlayerController;
  readonly loading?: Player.PlayerLoadingStrategy;
  readonly mediaKey?: string;
  readonly onActivate?: (activate: () => void) => void;
  readonly onLayout?: () => void;
  readonly showMedia?: boolean;
  readonly showViewport?: boolean;
  readonly source?: Player.RootProps['source'];
  readonly viewportKey?: string;
};

const ActivationProbe = ({
  autoplay = false,
  controller,
  loading = 'eager',
  mediaKey = 'media',
  onActivate,
  onLayout,
  showMedia = true,
  showViewport = true,
  source = '/tracer.mp4',
  viewportKey = 'viewport'
}: ActivationProbeProps) => {
  const activation = useActivation({
    autoplay,
    controller,
    loadMargin: '200px 0px',
    loading,
    nativeOptions: {},
    prepareMedia: () => undefined,
    preload: 'metadata',
    source: detectSource(source)
  });
  onActivate?.(activation.activateFromInteraction);
  useLayoutEffect(() => onLayout?.(), [onLayout]);
  return (
    <>
      {showViewport ? (
        <div
          data-testid="activation-viewport"
          key={viewportKey}
          ref={activation.registerViewport}
        />
      ) : null}
      {activation.mediaEligible && showMedia ? (
        <video
          data-testid="activation-media"
          key={mediaKey}
          ref={activation.registerMedia}
        />
      ) : null}
    </>
  );
};

const fixture = (
  props: Omit<Player.RootProps, 'children' | 'source'> & {
    source?: Player.RootProps['source'];
  } = {}
) => (
  <Player.Root source={props.source ?? '/tracer.mp4'} {...props}>
    <Player.Viewport data-testid="viewport">
      <Player.Media />
    </Player.Viewport>
  </Player.Root>
);

beforeEach(() => {
  ControlledIntersectionObserver.instances = [];
  mockedLoadProvider.mockReset();
  vi.stubGlobal('IntersectionObserver', ControlledIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('eager loads after client mount and forwards preload', async () => {
  const fake = createFakeProvider();
  mockedLoadProvider.mockResolvedValue(fake.adapter);

  render(fixture({ loading: 'eager', preload: 'none' }));

  await vi.waitFor(() => expect(mockedLoadProvider).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Reely media').getAttribute('preload')).toBe(
    'none'
  );
  await vi.waitFor(() =>
    expect(fake.counts()).toMatchObject({ attachCount: 1, loadCount: 1 })
  );
});

test('viewport uses the default margin and does not load before intersection', async () => {
  const fake = createFakeProvider();
  mockedLoadProvider.mockResolvedValue(fake.adapter);

  render(fixture());

  expect(ControlledIntersectionObserver.instances).toHaveLength(1);
  const observer = ControlledIntersectionObserver.instances[0]!;
  expect(observer.rootMargin).toBe('200px 0px');
  expect(mockedLoadProvider).not.toHaveBeenCalled();

  act(() => observer.intersect());

  await vi.waitFor(() => expect(mockedLoadProvider).toHaveBeenCalledOnce());
  expect(observer.disconnect).toHaveBeenCalledOnce();
});

test('viewport uses a custom margin', () => {
  render(fixture({ loadMargin: '500px 20px' }));

  expect(ControlledIntersectionObserver.instances[0]?.rootMargin).toBe(
    '500px 20px'
  );
});

test('viewport without Viewport reports an error and never imports', async () => {
  const handle = createRef<Player.PlayerHandle>();
  render(
    <Player.Root ref={handle} source="/tracer.mp4">
      <Player.Media />
    </Player.Root>
  );

  await vi.waitFor(() =>
    expect(handle.current?.getState()).toMatchObject({
      activation: 'error',
      lifecycle: 'error',
      error: { category: 'configuration' }
    })
  );
  expect(mockedLoadProvider).not.toHaveBeenCalled();
});

test('source changes invalidate a pending loader', async () => {
  const first = deferred<ProviderAdapter>();
  const stale = createFakeProvider();
  const current = createFakeProvider();
  mockedLoadProvider
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(current.adapter);
  const { rerender } = render(
    fixture({ loading: 'eager', source: '/first.mp4' })
  );
  await vi.waitFor(() => expect(mockedLoadProvider).toHaveBeenCalledOnce());

  rerender(fixture({ loading: 'eager', source: '/second.mp4' }));
  await vi.waitFor(() => expect(mockedLoadProvider).toHaveBeenCalledTimes(2));
  first.resolve(stale.adapter);

  await vi.waitFor(() => expect(stale.counts().destroyCount).toBe(1));
  expect(current.counts()).toMatchObject({ attachCount: 1, loadCount: 1 });
  expect(stale.counts()).toMatchObject({ attachCount: 0, loadCount: 0 });
});

test('interaction plays once when installation synchronously becomes ready', async () => {
  const controller = new PlayerController();
  const listeners = new Set<ProviderStateListener>();
  const adapter: ProviderAdapter = {
    provider: 'native',
    attach: () => {
      listeners.forEach((listener) =>
        listener({ activation: 'ready', lifecycle: 'ready' })
      );
    },
    destroy: () => undefined,
    load: () => undefined,
    play: async () => ({ ok: true }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  mockedLoadProvider.mockResolvedValue(adapter);
  const playWithOrigin = vi.spyOn(controller, 'playWithOrigin');
  let activateFromInteraction!: () => void;

  const Probe = () => {
    const activation = useActivation({
      autoplay: false,
      controller,
      loadMargin: '200px 0px',
      loading: 'interaction',
      nativeOptions: {},
      prepareMedia: () => undefined,
      preload: 'metadata',
      source: detectSource('/tracer.mp4')
    });
    activateFromInteraction = activation.activateFromInteraction;
    return activation.mediaEligible ? (
      <video ref={activation.registerMedia} />
    ) : null;
  };

  render(<Probe />);
  act(() => activateFromInteraction());

  await vi.waitFor(() =>
    expect(playWithOrigin).toHaveBeenCalledExactlyOnceWith('user')
  );
});

test('interaction discards a loader resolved against an immediate error snapshot', async () => {
  const pending = deferred<ProviderAdapter>();
  const fake = createFakeProvider();
  const controller = new PlayerController();
  const playWithOrigin = vi.spyOn(controller, 'playWithOrigin');
  let activateFromInteraction!: () => void;
  mockedLoadProvider.mockReturnValue(pending.promise);

  render(
    <ActivationProbe
      controller={controller}
      loading="interaction"
      onActivate={(activate) => {
        activateFromInteraction = activate;
      }}
    />
  );
  act(() => activateFromInteraction());
  await vi.waitFor(() => expect(mockedLoadProvider).toHaveBeenCalledOnce());
  act(() => {
    controller.setActivation({
      activation: 'error',
      error: {
        category: 'configuration',
        fatal: false,
        message: 'Interaction was invalidated.',
        recoverable: true
      }
    });
  });
  pending.resolve(fake.adapter);

  await vi.waitFor(() => expect(fake.counts().destroyCount).toBe(1));
  expect(fake.counts()).toMatchObject({ attachCount: 0, loadCount: 0 });
  act(() => fake.emit({ activation: 'ready', lifecycle: 'ready' }));
  expect(playWithOrigin).not.toHaveBeenCalled();
});

test('detaching media invalidates its pending loader', async () => {
  const pending = deferred<ProviderAdapter>();
  const stale = createFakeProvider();
  const controller = new PlayerController();
  mockedLoadProvider.mockReturnValue(pending.promise);
  const { rerender } = render(
    <ActivationProbe controller={controller} showMedia />
  );
  await vi.waitFor(() => expect(mockedLoadProvider).toHaveBeenCalledOnce());

  rerender(<ActivationProbe controller={controller} showMedia={false} />);
  pending.resolve(stale.adapter);

  await vi.waitFor(() => expect(stale.counts().destroyCount).toBe(1));
  expect(stale.counts()).toMatchObject({ attachCount: 0, loadCount: 0 });
  expect(controller.getState().provider).toBeNull();
});

test('replacing media detaches and reloads for the replacement node', async () => {
  const previous = createFakeProvider();
  const replacement = createFakeProvider();
  const controller = new PlayerController();
  mockedLoadProvider
    .mockResolvedValueOnce(previous.adapter)
    .mockResolvedValueOnce(replacement.adapter);
  const { rerender } = render(
    <ActivationProbe controller={controller} mediaKey="first" />
  );
  await vi.waitFor(() =>
    expect(previous.counts()).toMatchObject({ attachCount: 1, loadCount: 1 })
  );
  const firstMedia = screen.getByTestId('activation-media');

  rerender(<ActivationProbe controller={controller} mediaKey="second" />);

  await vi.waitFor(() => expect(mockedLoadProvider).toHaveBeenCalledTimes(2));
  const secondMedia = screen.getByTestId('activation-media');
  expect(secondMedia).not.toBe(firstMedia);
  expect(mockedLoadProvider.mock.calls[1]?.[0].media).toBe(secondMedia);
  await vi.waitFor(() =>
    expect(replacement.counts()).toMatchObject({ attachCount: 1, loadCount: 1 })
  );
  expect(previous.counts().destroyCount).toBe(1);
});

test('viewport replacement observes the committed replacement target', async () => {
  const controller = new PlayerController();
  const { rerender } = render(
    <ActivationProbe
      controller={controller}
      loading="viewport"
      showMedia={false}
      viewportKey="first"
    />
  );
  expect(ControlledIntersectionObserver.instances).toHaveLength(1);
  const firstObserver = ControlledIntersectionObserver.instances[0]!;
  const firstViewport = screen.getByTestId('activation-viewport');
  expect(firstObserver.observe).toHaveBeenCalledExactlyOnceWith(firstViewport);

  rerender(
    <ActivationProbe
      controller={controller}
      loading="viewport"
      showMedia={false}
      viewportKey="second"
    />
  );

  await vi.waitFor(() =>
    expect(ControlledIntersectionObserver.instances).toHaveLength(2)
  );
  const secondObserver = ControlledIntersectionObserver.instances[1]!;
  const secondViewport = screen.getByTestId('activation-viewport');
  expect(secondViewport).not.toBe(firstViewport);
  expect(firstObserver.disconnect).toHaveBeenCalled();
  expect(secondObserver.observe).toHaveBeenCalledExactlyOnceWith(
    secondViewport
  );
});

test('viewport restarts its dormant observer after a strategy round-trip', async () => {
  const controller = new PlayerController();
  const { rerender } = render(
    <ActivationProbe
      controller={controller}
      loading="viewport"
      showMedia={false}
    />
  );
  const firstObserver = ControlledIntersectionObserver.instances[0]!;

  rerender(
    <ActivationProbe
      controller={controller}
      loading="interaction"
      showMedia={false}
    />
  );
  expect(firstObserver.disconnect).toHaveBeenCalled();
  rerender(
    <ActivationProbe
      controller={controller}
      loading="viewport"
      showMedia={false}
    />
  );

  await vi.waitFor(() =>
    expect(ControlledIntersectionObserver.instances).toHaveLength(2)
  );
  expect(
    ControlledIntersectionObserver.instances[1]?.observe
  ).toHaveBeenCalledExactlyOnceWith(screen.getByTestId('activation-viewport'));
});

test('source commit rejects an old loader before passive invalidation', async () => {
  const stale = createFakeProvider();
  const current = createFakeProvider();
  const controller = new PlayerController();
  let settleOldLoad: (() => void) | undefined;
  mockedLoadProvider
    .mockReturnValueOnce({
      then: (resolve: (adapter: ProviderAdapter) => void) => {
        settleOldLoad = () => resolve(stale.adapter);
        return Promise.resolve();
      }
    } as Promise<ProviderAdapter>)
    .mockResolvedValueOnce(current.adapter);
  const { rerender } = render(
    <ActivationProbe controller={controller} source="/first.mp4" />
  );
  await vi.waitFor(() => expect(settleOldLoad).toBeTypeOf('function'));

  rerender(
    <ActivationProbe
      controller={controller}
      onLayout={settleOldLoad}
      source="/second.mp4"
    />
  );

  await vi.waitFor(() => expect(stale.counts().destroyCount).toBe(1));
  expect(stale.counts()).toMatchObject({ attachCount: 0, loadCount: 0 });
  await vi.waitFor(() =>
    expect(current.counts()).toMatchObject({ attachCount: 1, loadCount: 1 })
  );
});

test('viewport without IntersectionObserver reports unsupported and never imports', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const handle = createRef<Player.PlayerHandle>();
  render(fixture({ ref: handle }));

  await vi.waitFor(() =>
    expect(handle.current?.getState()).toMatchObject({
      activation: 'error',
      error: { category: 'unsupported' },
      lifecycle: 'error'
    })
  );
  expect(mockedLoadProvider).not.toHaveBeenCalled();
});

test('interaction loading rejects autoplay before importing', async () => {
  const handle = createRef<Player.PlayerHandle>();
  render(fixture({ autoplay: 'muted', loading: 'interaction', ref: handle }));

  await vi.waitFor(() =>
    expect(handle.current?.getState()).toMatchObject({
      activation: 'error',
      error: { category: 'configuration' },
      lifecycle: 'error'
    })
  );
  expect(mockedLoadProvider).not.toHaveBeenCalled();
});

test('Root unmount destroys its installed provider exactly once', async () => {
  const fake = createFakeProvider();
  mockedLoadProvider.mockResolvedValue(fake.adapter);
  const { unmount } = render(fixture({ loading: 'eager' }));
  await vi.waitFor(() =>
    expect(fake.counts()).toMatchObject({ attachCount: 1, loadCount: 1 })
  );

  unmount();

  expect(fake.counts().destroyCount).toBe(1);
});

test('interaction plays exactly once after asynchronous readiness', async () => {
  const fake = createFakeProvider();
  const controller = new PlayerController();
  const playWithOrigin = vi.spyOn(controller, 'playWithOrigin');
  let activateFromInteraction!: () => void;
  mockedLoadProvider.mockResolvedValue(fake.adapter);
  render(
    <ActivationProbe
      controller={controller}
      loading="interaction"
      onActivate={(activate) => {
        activateFromInteraction = activate;
      }}
    />
  );

  act(() => activateFromInteraction());
  await vi.waitFor(() =>
    expect(fake.counts()).toMatchObject({ attachCount: 1, loadCount: 1 })
  );
  act(() => {
    fake.emit({ activation: 'ready', lifecycle: 'ready' });
    fake.emit({ activation: 'ready', lifecycle: 'ready' });
  });

  await vi.waitFor(() =>
    expect(playWithOrigin).toHaveBeenCalledExactlyOnceWith('user')
  );
});

test('real loader returns a Promise and rejects a missing media mount', async () => {
  const actual = await vi.importActual<
    typeof import('../src/provider-loaders')
  >('../src/provider-loaders');

  const result = actual.loadProvider({
    media: null,
    nativeOptions: {},
    source: detectSource('/tracer.mp4').source
  });

  expect(result).toBeInstanceOf(Promise);
  await expect(result).rejects.toThrow(/requires a media mount/i);
});

test('incompatible autoplay commit discards a resolving interaction loader', async () => {
  const stale = createFakeProvider();
  const controller = new PlayerController();
  let activateFromInteraction!: () => void;
  let settleLoad: (() => void) | undefined;
  mockedLoadProvider.mockReturnValue({
    then: (resolve: (adapter: ProviderAdapter) => void) => {
      settleLoad = () => resolve(stale.adapter);
      return Promise.resolve();
    }
  } as Promise<ProviderAdapter>);
  const onActivate = (activate: () => void) => {
    activateFromInteraction = activate;
  };
  const { rerender } = render(
    <ActivationProbe
      controller={controller}
      loading="interaction"
      onActivate={onActivate}
    />
  );
  act(() => activateFromInteraction());
  await vi.waitFor(() => expect(settleLoad).toBeTypeOf('function'));

  rerender(
    <ActivationProbe
      autoplay="muted"
      controller={controller}
      loading="interaction"
      onActivate={onActivate}
      onLayout={settleLoad}
    />
  );

  await vi.waitFor(() => expect(stale.counts().destroyCount).toBe(1));
  expect(stale.counts()).toMatchObject({ attachCount: 0, loadCount: 0 });
  expect(controller.getState()).toMatchObject({
    activation: 'error',
    error: { category: 'configuration' },
    lifecycle: 'error',
    provider: null
  });
});

test('incompatible autoplay commit ignores a rejecting interaction loader', async () => {
  const controller = new PlayerController();
  const setActivation = vi.spyOn(controller, 'setActivation');
  const failure = new Error('Provider load failed.');
  let activateFromInteraction!: () => void;
  let rejectLoad: (() => void) | undefined;
  mockedLoadProvider.mockReturnValue({
    then: () =>
      ({
        catch: (reject: (cause: unknown) => void) => {
          rejectLoad = () => reject(failure);
        }
      }) as Promise<ProviderAdapter>
  } as Promise<ProviderAdapter>);
  const onActivate = (activate: () => void) => {
    activateFromInteraction = activate;
  };
  const { rerender } = render(
    <ActivationProbe
      controller={controller}
      loading="interaction"
      onActivate={onActivate}
    />
  );
  act(() => activateFromInteraction());
  await vi.waitFor(() => expect(rejectLoad).toBeTypeOf('function'));

  rerender(
    <ActivationProbe
      autoplay="audible"
      controller={controller}
      loading="interaction"
      onActivate={onActivate}
      onLayout={rejectLoad}
    />
  );

  expect(setActivation).not.toHaveBeenCalledWith({
    activation: 'error',
    error: expect.objectContaining({ category: 'provider' })
  });
  expect(controller.getState()).toMatchObject({
    activation: 'error',
    error: { category: 'configuration' },
    lifecycle: 'error',
    provider: null
  });
});
