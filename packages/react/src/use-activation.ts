import type {
  AutoplayMode,
  PlayerController,
  ResolvedPlayerSource,
  SourceDetectionResult
} from '@reely/core';
import type { NativePlaybackOptions } from '@reely/provider-native';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { loadProvider } from './provider-loaders';

export type PlayerLoadingStrategy = 'eager' | 'viewport' | 'interaction';
export type PlayerPreload = 'none' | 'metadata' | 'auto';

export type ActivationBindings = {
  readonly activateFromInteraction: () => void;
  readonly loading: PlayerLoadingStrategy;
  readonly mediaEligible: boolean;
  readonly preload: PlayerPreload;
  readonly registerMedia: (media: HTMLVideoElement | null) => void;
  readonly registerViewport: (viewport: HTMLDivElement | null) => void;
};

export type UseActivationOptions = {
  readonly autoplay: AutoplayMode;
  readonly controller: PlayerController;
  readonly loadMargin: string;
  readonly loading: PlayerLoadingStrategy;
  readonly nativeOptions: NativePlaybackOptions;
  readonly prepareMedia: (media: HTMLVideoElement) => void;
  readonly preload: PlayerPreload;
  readonly source: SourceDetectionResult;
};

type Session = {
  generation: number;
  sourceKey: string;
  started: boolean;
  queuedPlay: boolean;
};

type ObserverRegistration = {
  readonly margin: string;
  readonly observer: IntersectionObserver;
  readonly target: HTMLDivElement;
};

const sourceKey = (source: SourceDetectionResult): string =>
  source.status === 'success'
    ? JSON.stringify(source.source)
    : 'unsupported-source';

const configurationError = (message: string) => ({
  category: 'configuration' as const,
  fatal: false,
  recoverable: true,
  message
});

const unsupportedError = (message: string) => ({
  category: 'unsupported' as const,
  fatal: false,
  recoverable: true,
  message
});

const providerError = (cause: unknown) => ({
  category: 'provider' as const,
  cause,
  fatal: false,
  recoverable: true,
  message: 'Unable to load the player provider.'
});

const destroyStale = (adapter: { destroy: () => void }): void => {
  try {
    adapter.destroy();
  } catch {
    // The current session is already authoritative.
  }
};

export const useActivation = (
  options: UseActivationOptions
): ActivationBindings => {
  const currentKey = sourceKey(options.source);
  const optionsRef = useRef(options);
  const session = useRef<Session>({
    generation: 0,
    sourceKey: currentKey,
    started: false,
    queuedPlay: false
  });
  const committedSourceKey = useRef(currentKey);
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ObserverRegistration | undefined>(undefined);
  const loadingGeneration = useRef<number | undefined>(undefined);
  const [mediaVersion, setMediaVersion] = useState(0);
  const [viewportVersion, setViewportVersion] = useState(0);
  const [mediaEligible, setMediaEligible] = useState(false);

  useLayoutEffect(() => {
    optionsRef.current = options;
    committedSourceKey.current = currentKey;
  });

  const activate = useCallback((queuePlay: boolean) => {
    const active = session.current;
    if (active.started) return;
    active.started = true;
    active.queuedPlay = queuePlay;
    const current = optionsRef.current;
    current.controller.setActivation({ activation: 'eligible' });
    setMediaEligible(true);
  }, []);

  const registerMedia = useCallback((media: HTMLVideoElement | null) => {
    const previous = mediaRef.current;
    if (previous === media) return;
    mediaRef.current = media;
    session.current.generation += 1;
    loadingGeneration.current = undefined;
    if (previous) {
      optionsRef.current.controller.setProvider(undefined);
    }
    setMediaVersion((version) => version + 1);
  }, []);

  const registerViewport = useCallback((viewport: HTMLDivElement | null) => {
    if (viewportRef.current === viewport) return;
    const registration = observerRef.current;
    if (registration) {
      registration.observer.disconnect();
      observerRef.current = undefined;
    }
    viewportRef.current = viewport;
    setViewportVersion((version) => version + 1);
  }, []);

  const activateFromInteraction = useCallback(() => {
    const current = optionsRef.current;
    if (current.loading !== 'interaction' || current.autoplay !== false) return;
    activate(true);
  }, [activate]);

  useEffect(() => {
    const active = session.current;
    if (active.sourceKey === currentKey) return;
    active.generation += 1;
    active.sourceKey = currentKey;
    active.started = false;
    active.queuedPlay = false;
    loadingGeneration.current = undefined;
    observerRef.current?.observer.disconnect();
    observerRef.current = undefined;
    options.controller.setProvider(undefined);
    options.controller.setActivation({ activation: 'dormant' });
    setMediaEligible(false);
  }, [currentKey, options.controller]);

  useEffect(() => {
    if (options.loading !== 'eager') return;
    if (options.source.status !== 'success') {
      options.controller.setActivation({
        activation: 'error',
        error: unsupportedError('The player source is not supported.')
      });
      return;
    }
    activate(false);
  }, [
    activate,
    currentKey,
    options.controller,
    options.loading,
    options.source.status
  ]);

  useEffect(() => {
    if (options.loading !== 'interaction') return;
    if (options.autoplay === false) return;
    options.controller.setActivation({
      activation: 'error',
      error: configurationError(
        'Interaction loading cannot be used with autoplay.'
      )
    });
  }, [currentKey, options.autoplay, options.controller, options.loading]);

  useEffect(() => {
    if (options.loading !== 'viewport' || session.current.started) return;
    if (options.source.status !== 'success') {
      options.controller.setActivation({
        activation: 'error',
        error: unsupportedError('The player source is not supported.')
      });
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      options.controller.setActivation({
        activation: 'error',
        error: configurationError(
          'Viewport activation requires Player.Viewport.'
        )
      });
      return;
    }
    if (viewportVersion === 0) return;
    const Observer = globalThis.IntersectionObserver;
    if (!Observer) {
      options.controller.setActivation({
        activation: 'error',
        error: unsupportedError(
          'Viewport loading requires IntersectionObserver.'
        )
      });
      return;
    }
    const currentObserver = observerRef.current;
    if (
      currentObserver?.target === viewport &&
      currentObserver.margin === options.loadMargin
    )
      return;
    currentObserver?.observer.disconnect();
    const observer = new Observer(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        if (observerRef.current?.observer === observer) {
          observerRef.current = undefined;
        }
        activate(false);
      },
      { rootMargin: options.loadMargin }
    );
    const registration: ObserverRegistration = {
      margin: options.loadMargin,
      observer,
      target: viewport
    };
    observerRef.current = registration;
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (observerRef.current === registration) {
        observerRef.current = undefined;
      }
    };
  }, [
    activate,
    currentKey,
    options.controller,
    options.loadMargin,
    options.loading,
    options.source.status,
    viewportVersion
  ]);

  useEffect(() => {
    const active = session.current;
    const media = mediaRef.current;
    const source = optionsRef.current.source;
    if (!active.started || !media || source.status !== 'success') return;
    const generation = active.generation;
    if (loadingGeneration.current === generation) return;
    loadingGeneration.current = generation;
    const key = active.sourceKey;
    const loadOptions = optionsRef.current;
    const controller = loadOptions.controller;
    const isCurrentLoad = (): boolean =>
      session.current.generation === generation &&
      session.current.sourceKey === key &&
      committedSourceKey.current === key &&
      mediaRef.current === media &&
      (optionsRef.current.loading !== 'interaction' ||
        optionsRef.current.autoplay === false);
    loadOptions.prepareMedia(media);
    controller.setActivation({ activation: 'loading-provider' });
    void loadProvider({
      media,
      nativeOptions: loadOptions.nativeOptions,
      source: source.source as ResolvedPlayerSource
    })
      .then((adapter) => {
        if (
          !isCurrentLoad() ||
          controller.getState().activation !== 'loading-provider'
        ) {
          destroyStale(adapter);
          return;
        }
        const current = session.current;
        if (current.queuedPlay) {
          current.queuedPlay = false;
          const subscription: { unsubscribe?: () => void } = {};
          let armed = false;
          let disposed = false;
          const dispose = (): void => {
            if (disposed) return;
            disposed = true;
            if (armed) subscription.unsubscribe?.();
          };
          subscription.unsubscribe = controller.subscribe((state) => {
            if (disposed) return;
            if (!isCurrentLoad() || state.activation === 'error') {
              dispose();
              return;
            }
            if (state.activation !== 'ready') return;
            dispose();
            void controller.playWithOrigin('user');
          });
          armed = true;
          if (disposed) {
            subscription.unsubscribe();
            destroyStale(adapter);
            return;
          }
        }
        if (
          !isCurrentLoad() ||
          controller.getState().activation !== 'loading-provider'
        ) {
          destroyStale(adapter);
          return;
        }
        controller.setProvider(adapter);
      })
      .catch((cause: unknown) => {
        if (!isCurrentLoad()) return;
        controller.setActivation({
          activation: 'error',
          error: providerError(cause)
        });
      });
  }, [currentKey, mediaEligible, mediaVersion]);

  useEffect(
    () => () => {
      session.current.generation += 1;
      observerRef.current?.observer.disconnect();
      observerRef.current = undefined;
      optionsRef.current.controller.setProvider(undefined);
    },
    []
  );

  return useMemo(
    () => ({
      activateFromInteraction,
      loading: options.loading,
      mediaEligible,
      preload: options.preload,
      registerMedia,
      registerViewport
    }),
    [
      activateFromInteraction,
      mediaEligible,
      options.loading,
      options.preload,
      registerMedia,
      registerViewport
    ]
  );
};
