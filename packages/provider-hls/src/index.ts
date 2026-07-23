import type {
  CommandResult,
  HlsEngine,
  HlsSource,
  PlayerCapabilities,
  PlayerError,
  ProviderAdapter,
  ProviderEvent,
  ProviderStateListener,
  ProviderStatePatch
} from '@reely/core';
import {
  createNativeProvider,
  type NativePlaybackOptions
} from '@reely/provider-native';

export type HlsEnvironment = {
  readonly nativeHls: boolean;
  readonly mse: boolean;
};

export type HlsEngineSelection =
  | { readonly engine: HlsEngine }
  | { readonly engine: null; readonly error: PlayerError };

export type HlsLevelLike = {
  readonly height?: number;
  readonly width?: number;
  readonly bitrate?: number;
};

export type HlsInstanceLike = {
  readonly levels: ReadonlyArray<HlsLevelLike>;
  currentLevel: number;
  on: (event: string, listener: (event: string, data: unknown) => void) => void;
  startLoad: () => void;
  recoverMediaError: () => void;
  attachMedia: (media: HTMLMediaElement) => void;
  loadSource: (url: string) => void;
  destroy: () => void;
};

export type HlsConstructorLike = {
  new (): HlsInstanceLike;
  isSupported: () => boolean;
  readonly Events: {
    readonly ERROR: string;
    readonly LEVEL_SWITCHED: string;
    readonly MANIFEST_PARSED: string;
  };
  readonly ErrorTypes: {
    readonly NETWORK_ERROR: string;
    readonly MEDIA_ERROR: string;
  };
};

export type HlsModuleLoader = () => Promise<{
  readonly default: HlsConstructorLike;
}>;

export type HlsProviderOptions = NativePlaybackOptions & {
  readonly loadHls?: HlsModuleLoader;
};

const NATIVE_HLS_MIME = 'application/vnd.apple.mpegurl';
const MSE_TEST_CODEC = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';
const MAX_FATAL_NETWORK_RECOVERIES = 2;
const MAX_FATAL_MEDIA_RECOVERIES = 2;

type MediaSourceLike = { isTypeSupported?: (type: string) => boolean };

const supportsMse = (candidate: unknown): boolean => {
  const mediaSource = candidate as MediaSourceLike | undefined | null;
  try {
    return (
      typeof mediaSource?.isTypeSupported === 'function' &&
      mediaSource.isTypeSupported(MSE_TEST_CODEC)
    );
  } catch {
    return false;
  }
};

export const detectHlsEnvironment = (
  media: HTMLVideoElement
): HlsEnvironment => {
  const globals = globalThis as {
    MediaSource?: unknown;
    ManagedMediaSource?: unknown;
  };
  return {
    nativeHls: media.canPlayType(NATIVE_HLS_MIME) !== '',
    mse:
      supportsMse(globals.ManagedMediaSource) ||
      supportsMse(globals.MediaSource)
  };
};

const unsupportedSelection = (message: string): HlsEngineSelection => ({
  engine: null,
  error: {
    category: 'unsupported',
    fatal: true,
    recoverable: false,
    message
  }
});

export const selectHlsEngine = (
  requested: NonNullable<HlsSource['engine']>,
  environment: HlsEnvironment
): HlsEngineSelection => {
  if (requested === 'native') {
    return environment.nativeHls
      ? { engine: 'native' }
      : unsupportedSelection(
          'The forced "native" HLS engine is unavailable: this browser cannot play HLS natively.'
        );
  }
  if (requested === 'hls.js') {
    return environment.mse
      ? { engine: 'hls.js' }
      : unsupportedSelection(
          'The forced "hls.js" HLS engine is unavailable: this browser does not support Media Source Extensions.'
        );
  }
  if (environment.nativeHls) return { engine: 'native' };
  if (environment.mse) return { engine: 'hls.js' };
  return unsupportedSelection(
    'HLS is unsupported in this browser: it has neither native HLS playback nor Media Source Extensions.'
  );
};

// hls.js publishes stricter generic event signatures than the minimal
// structural surface this adapter consumes, so the dynamic module boundary
// narrows through a cast instead of importing hls.js types eagerly.
const defaultLoadHls: HlsModuleLoader = () =>
  import('hls.js') as unknown as Promise<{
    readonly default: HlsConstructorLike;
  }>;

export const createHlsProvider = (
  media: HTMLVideoElement,
  source: HlsSource,
  options: HlsProviderOptions = {}
): ProviderAdapter => {
  const { loadHls = defaultLoadHls, ...nativeOptions } = options;
  const selection = selectHlsEngine(
    source.engine ?? 'auto',
    detectHlsEnvironment(media)
  );
  const engine = selection.engine;
  const native = createNativeProvider(media, nativeOptions);
  const listeners = new Set<ProviderStateListener>();
  let attached = false;
  let destroyed = false;
  let hls: HlsInstanceLike | undefined;
  let hlsConstructor: HlsConstructorLike | undefined;
  let generation = 0;
  let networkRecoveries = 0;
  let mediaRecoveries = 0;
  let qualitySelectable = false;
  let lastCapabilities: PlayerCapabilities | undefined;

  const emit = (patch: ProviderStatePatch, event?: ProviderEvent): void => {
    if (destroyed) return;
    listeners.forEach((listener) => listener(patch, event));
  };

  const withQualityCapability = (
    capabilities: PlayerCapabilities
  ): PlayerCapabilities => ({
    ...capabilities,
    selectQuality:
      engine === 'native'
        ? { status: 'unavailable', reason: 'provider' }
        : qualitySelectable
          ? { status: 'available' }
          : { status: 'unknown', reason: 'provider-check' }
  });

  const unsubscribeNative = native.subscribe((patch, event) => {
    if (destroyed) return;
    if (engine === 'hls.js' && patch.lifecycle === 'error') {
      // hls.js owns error recovery and surfacing on the MSE path; raw media
      // element errors would preempt its bounded recovery table.
      return;
    }
    if (patch.capabilities) {
      lastCapabilities = patch.capabilities;
      emit(
        { ...patch, capabilities: withQualityCapability(patch.capabilities) },
        event
      );
      return;
    }
    emit(patch, event);
  });

  const teardownHls = (): void => {
    const instance = hls;
    hls = undefined;
    if (!instance) return;
    try {
      instance.destroy();
    } catch {
      // Teardown must not escape the provider boundary.
    }
  };

  const surfaceFatal = (error: PlayerError): void => {
    teardownHls();
    emit(
      {
        lifecycle: 'error',
        activation: 'error',
        playback: 'paused',
        buffering: false,
        seeking: false,
        quality: null,
        error
      },
      { type: 'error', detail: error, origin: 'provider' }
    );
  };

  const handleHlsError = (
    instance: HlsInstanceLike,
    Hls: HlsConstructorLike,
    data: unknown
  ): void => {
    if (destroyed || hls !== instance) return;
    const errorData = data as {
      type?: string;
      details?: string;
      fatal?: boolean;
    };
    if (!errorData.fatal) return;
    if (errorData.type === Hls.ErrorTypes.NETWORK_ERROR) {
      if (networkRecoveries < MAX_FATAL_NETWORK_RECOVERIES) {
        networkRecoveries += 1;
        instance.startLoad();
        return;
      }
      surfaceFatal({
        category: 'network',
        fatal: true,
        recoverable: true,
        message: 'HLS playback failed after bounded network error recovery.',
        cause: data
      });
      return;
    }
    if (errorData.type === Hls.ErrorTypes.MEDIA_ERROR) {
      if (mediaRecoveries < MAX_FATAL_MEDIA_RECOVERIES) {
        mediaRecoveries += 1;
        instance.recoverMediaError();
        return;
      }
      surfaceFatal({
        category: 'decode',
        fatal: true,
        recoverable: true,
        message: 'HLS playback failed after bounded media error recovery.',
        cause: data
      });
      return;
    }
    surfaceFatal({
      category: 'provider',
      fatal: true,
      recoverable: true,
      message: errorData.details
        ? `hls.js reported an unrecoverable fatal error: ${errorData.details}`
        : 'hls.js reported an unrecoverable fatal error.',
      cause: data
    });
  };

  const startHlsJs = async (): Promise<CommandResult> => {
    const startGeneration = ++generation;
    let Hls = hlsConstructor;
    if (!Hls) {
      try {
        Hls = (await loadHls()).default;
      } catch (cause) {
        if (destroyed || generation !== startGeneration) {
          return { ok: false, reason: 'not-ready' };
        }
        const error: PlayerError = {
          category: 'provider',
          fatal: true,
          recoverable: true,
          message: 'Unable to load the hls.js engine module.',
          cause
        };
        surfaceFatal(error);
        return { ok: false, reason: 'provider-error', error };
      }
    }
    if (destroyed || generation !== startGeneration) {
      return { ok: false, reason: 'not-ready' };
    }
    hlsConstructor = Hls;
    if (!Hls.isSupported()) {
      const error: PlayerError = {
        category: 'unsupported',
        fatal: true,
        recoverable: false,
        message: 'hls.js does not support this browser environment.'
      };
      surfaceFatal(error);
      return { ok: false, reason: 'unsupported', error };
    }
    const HlsRuntime = Hls;
    const instance = new HlsRuntime();
    hls = instance;
    instance.on(HlsRuntime.Events.ERROR, (_event, data) =>
      handleHlsError(instance, HlsRuntime, data)
    );
    instance.on(HlsRuntime.Events.LEVEL_SWITCHED, (_event, data) => {
      if (destroyed || hls !== instance) return;
      const level = instance.levels[(data as { level: number }).level];
      emit({
        quality: level
          ? {
              height: level.height ?? null,
              width: level.width ?? null,
              bitrate: level.bitrate ?? null
            }
          : null
      });
    });
    instance.on(HlsRuntime.Events.MANIFEST_PARSED, () => {
      if (destroyed || hls !== instance) return;
      qualitySelectable = true;
      if (lastCapabilities) {
        emit({ capabilities: withQualityCapability(lastCapabilities) });
      }
    });
    instance.attachMedia(media);
    instance.loadSource(source.src);
    return { ok: true };
  };

  const emitSelectionFailure = (): void => {
    if (selection.engine !== null) return;
    emit(
      {
        lifecycle: 'error',
        activation: 'error',
        hlsEngine: null,
        error: selection.error
      },
      { type: 'error', detail: selection.error, origin: 'provider' }
    );
  };

  return {
    provider: 'hls',
    attach: () => {
      if (destroyed || attached) return;
      attached = true;
      if (!engine) {
        emitSelectionFailure();
        return;
      }
      emit({ hlsEngine: engine });
      native.attach();
    },
    load: async () => {
      if (destroyed || !engine) return;
      if (engine === 'native') {
        media.src = source.src;
        await native.load();
        return;
      }
      await startHlsJs();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      teardownHls();
      unsubscribeNative();
      native.destroy();
      listeners.clear();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: native.play,
    pause: native.pause,
    seekTo: native.seekTo,
    seekBy: native.seekBy,
    mute: native.mute,
    unmute: native.unmute,
    setVolume: native.setVolume,
    setPlaybackRate: native.setPlaybackRate,
    requestFullscreen: native.requestFullscreen,
    exitFullscreen: native.exitFullscreen,
    requestPictureInPicture: native.requestPictureInPicture,
    exitPictureInPicture: native.exitPictureInPicture,
    retry: async (): Promise<CommandResult> => {
      if (destroyed) return { ok: false, reason: 'not-ready' };
      if (!engine) {
        return { ok: false, reason: 'unsupported', error: selection.error };
      }
      if (engine === 'native') return native.retry();
      networkRecoveries = 0;
      mediaRecoveries = 0;
      qualitySelectable = false;
      teardownHls();
      return startHlsJs();
    },
    ...(engine === 'hls.js'
      ? {
          selectQuality: async (
            height: number | null
          ): Promise<CommandResult> => {
            const instance = hls;
            if (destroyed || !instance) {
              return { ok: false, reason: 'not-ready' };
            }
            if (height === null) {
              instance.currentLevel = -1;
              return { ok: true };
            }
            if (!Number.isFinite(height)) {
              return { ok: false, reason: 'provider-error' };
            }
            const index = instance.levels.findIndex(
              (level) => level.height === height
            );
            if (index === -1) return { ok: false, reason: 'unsupported' };
            instance.currentLevel = index;
            return { ok: true };
          }
        }
      : {})
  };
};
