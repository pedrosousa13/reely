export type PlaybackState = 'paused' | 'playing' | 'ended';

export type CommandFailureReason =
  'blocked' | 'unsupported' | 'not-ready' | 'provider-error';

export type PlayerErrorCategory =
  | 'configuration'
  | 'source'
  | 'network'
  | 'decode'
  | 'provider'
  | 'policy'
  | 'unsupported';

export type PlayerError = {
  readonly category: PlayerErrorCategory;
  readonly fatal: boolean;
  readonly recoverable: boolean;
  readonly message: string;
  readonly cause?: unknown;
};

export type CommandResult =
  | { ok: true }
  | { ok: false; reason: CommandFailureReason; error?: PlayerError };

export type Availability =
  | { readonly status: 'available' }
  | {
      readonly status: 'unknown';
      readonly reason: 'not-ready' | 'provider-check';
    }
  | {
      readonly status: 'unavailable';
      readonly reason:
        'browser' | 'provider' | 'provider-plan' | 'source' | 'policy';
    };

export type TimeRange = { readonly start: number; readonly end: number };

export type PlayerProvider = 'native' | 'hls' | 'youtube' | 'vimeo';

export type PlayerCapabilities = {
  readonly seek: Availability;
  readonly setVolume: Availability;
  readonly setPlaybackRate: Availability;
  readonly selectQuality: Availability;
  readonly selectTextTrack: Availability;
  readonly fullscreen: Availability;
  readonly pictureInPicture: Availability;
  readonly airPlay: Availability;
  readonly customControls: Availability;
};

export type PlayerState = {
  readonly lifecycle: 'idle' | 'loading' | 'ready' | 'error';
  readonly activation:
    'dormant' | 'eligible' | 'loading-provider' | 'ready' | 'error';
  readonly playback: PlaybackState;
  readonly buffering: boolean;
  readonly seeking: boolean;
  readonly currentTime: number;
  readonly duration: number | null;
  readonly buffered: ReadonlyArray<TimeRange>;
  readonly seekable: ReadonlyArray<TimeRange>;
  readonly muted: boolean;
  readonly volume: number;
  readonly playbackRate: number;
  readonly fullscreen: boolean;
  readonly pictureInPicture: boolean;
  readonly autoplay: 'idle' | 'attempting' | 'started' | 'blocked' | 'failed';
  readonly provider: PlayerProvider | null;
  readonly capabilities: PlayerCapabilities;
  readonly error: PlayerError | null;
};

export type PlayerEventOrigin =
  'user' | 'api' | 'autoplay' | 'provider' | 'system';

export type PlayerEventDetailMap = {
  play: undefined;
  pause: undefined;
  ended: undefined;
  loading: undefined;
  ready: undefined;
  error: PlayerError;
  seeking: { readonly currentTime: number };
  seeked: { readonly currentTime: number };
  volumechange: { readonly muted: boolean; readonly volume: number };
  ratechange: { readonly playbackRate: number };
  fullscreenchange: { readonly fullscreen: boolean };
  pictureinpicturechange: { readonly pictureInPicture: boolean };
};

export type PlayerEventType = keyof PlayerEventDetailMap;

export type PlayerEventFor<Type extends PlayerEventType> = {
  readonly type: Type;
  readonly detail: PlayerEventDetailMap[Type];
  readonly origin: PlayerEventOrigin;
  readonly provider: PlayerProvider | null;
  readonly timestamp: number;
  readonly originalEvent?: unknown;
};

export type PlayerEvent = {
  [Type in PlayerEventType]: PlayerEventFor<Type>;
}[PlayerEventType];

export type ProviderStatePatch = Partial<PlayerState>;

export type ProviderEventFor<Type extends PlayerEventType> = Omit<
  PlayerEventFor<Type>,
  'provider' | 'timestamp'
> & {
  readonly provider?: PlayerProvider;
  readonly timestamp?: number;
};

export type ProviderEvent = {
  [Type in PlayerEventType]: ProviderEventFor<Type>;
}[PlayerEventType];

export type ProviderStateListener = (
  patch: ProviderStatePatch,
  event?: ProviderEvent
) => void;

export type ParsedSource = {
  type: 'mp4';
  url: string;
};

export type VideoFileSource = {
  type: 'video';
  sources: ReadonlyArray<{ src: string; mimeType: string }>;
};

export type HlsSource = {
  type: 'hls';
  src: string;
  engine?: 'auto' | 'native' | 'hls.js';
};

export type YouTubeSource = { type: 'youtube'; videoId: string };

export type VimeoSource = { type: 'vimeo'; videoId: string; hash?: string };

export type PlayerSource =
  string | VideoFileSource | HlsSource | YouTubeSource | VimeoSource;

export type ResolvedPlayerSource = Exclude<PlayerSource, string>;

export type SourceDetectionFailureReason =
  'malformed-string' | 'unsupported-string' | 'invalid-source';

export type SourceDetectionSuccess = {
  status: 'success';
  input: PlayerSource;
  source: ResolvedPlayerSource;
};

export type SourceDetectionFailure = {
  status: 'failure';
  input: unknown;
  reason: SourceDetectionFailureReason;
  guidance: string;
};

export type SourceDetectionResult =
  SourceDetectionSuccess | SourceDetectionFailure;

export type ProviderAdapter = {
  provider: PlayerProvider;
  attach: () => void | Promise<void>;
  load: () => void | Promise<void>;
  destroy: () => void | Promise<void>;
  subscribe: (listener: ProviderStateListener) => () => void;
  play?: () => Promise<CommandResult>;
  pause?: () => Promise<CommandResult>;
  seekTo?: (time: number) => Promise<CommandResult>;
  seekBy?: (offset: number) => Promise<CommandResult>;
  mute?: () => Promise<CommandResult>;
  unmute?: () => Promise<CommandResult>;
  setVolume?: (volume: number) => Promise<CommandResult>;
  setPlaybackRate?: (rate: number) => Promise<CommandResult>;
  selectTextTrack?: (track: string | null) => Promise<CommandResult>;
  requestFullscreen?: () => Promise<CommandResult>;
  exitFullscreen?: () => Promise<CommandResult>;
  requestPictureInPicture?: () => Promise<CommandResult>;
  exitPictureInPicture?: () => Promise<CommandResult>;
  retry?: () => Promise<CommandResult>;
};

const freezeAvailability = (availability: Availability): Availability =>
  Object.freeze({ ...availability });

const freezeCapabilities = (
  capabilities: PlayerCapabilities
): PlayerCapabilities =>
  Object.freeze({
    seek: freezeAvailability(capabilities.seek),
    setVolume: freezeAvailability(capabilities.setVolume),
    setPlaybackRate: freezeAvailability(capabilities.setPlaybackRate),
    selectQuality: freezeAvailability(capabilities.selectQuality),
    selectTextTrack: freezeAvailability(capabilities.selectTextTrack),
    fullscreen: freezeAvailability(capabilities.fullscreen),
    pictureInPicture: freezeAvailability(capabilities.pictureInPicture),
    airPlay: freezeAvailability(capabilities.airPlay),
    customControls: freezeAvailability(capabilities.customControls)
  });

const freezeError = (error: PlayerError): PlayerError =>
  Object.freeze({ ...error });

const notReady: Availability = freezeAvailability({
  status: 'unknown',
  reason: 'not-ready'
});

const initialCapabilities = (): PlayerCapabilities =>
  freezeCapabilities({
    seek: notReady,
    setVolume: notReady,
    setPlaybackRate: notReady,
    selectQuality: notReady,
    selectTextTrack: notReady,
    fullscreen: notReady,
    pictureInPicture: notReady,
    airPlay: notReady,
    customControls: notReady
  });

export const createInitialPlayerState = (): PlayerState =>
  Object.freeze({
    lifecycle: 'idle',
    activation: 'dormant',
    playback: 'paused',
    buffering: false,
    seeking: false,
    currentTime: 0,
    duration: null,
    buffered: Object.freeze([]),
    seekable: Object.freeze([]),
    muted: false,
    volume: 1,
    playbackRate: 1,
    fullscreen: false,
    pictureInPicture: false,
    autoplay: 'idle',
    provider: null,
    capabilities: initialCapabilities(),
    error: null
  });

const orderedRanges = (
  ranges: ReadonlyArray<TimeRange>
): ReadonlyArray<TimeRange> =>
  Object.freeze(
    ranges
      .map(({ end, start }) => Object.freeze({ end, start }))
      .sort((left, right) => left.start - right.start)
  );

const toProviderError = (cause: unknown): PlayerError =>
  freezeError({
    category: 'provider',
    fatal: false,
    recoverable: true,
    message:
      cause instanceof Error ? cause.message : 'The provider command failed.',
    cause
  });

const destroyProviderSafely = (provider: ProviderAdapter): void => {
  try {
    void Promise.resolve(provider.destroy()).catch(() => undefined);
  } catch {
    // Provider cleanup must not escape the controller boundary.
  }
};

const unsubscribeSafely = (unsubscribe: (() => void) | undefined): void => {
  try {
    unsubscribe?.();
  } catch {
    // Provider cleanup must not escape the controller boundary.
  }
};

export const parseSource = (source: string): ParsedSource => {
  if (!/\.mp4(?:$|[?#])/i.test(source)) {
    throw new Error(
      'Only MP4 sources are supported by the native tracer bullet.'
    );
  }

  return { type: 'mp4', url: source };
};

const explicitObjectGuidance =
  'Pass an explicit source object with a supported type and the required fields.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isYouTubeVideoId = (value: unknown): value is string =>
  isNonEmptyString(value) && /^[A-Za-z0-9_-]+$/.test(value);

const isVimeoVideoId = (value: unknown): value is string =>
  isNonEmptyString(value) && /^\d+$/.test(value);

const isVimeoHash = (value: unknown): value is string =>
  isNonEmptyString(value) && /^[A-Za-z0-9]+$/.test(value);

const failure = (
  input: unknown,
  reason: SourceDetectionFailureReason
): SourceDetectionFailure => ({
  status: 'failure',
  input,
  reason,
  guidance: explicitObjectGuidance
});

const sourceFromFileExtension = (
  input: string
): VideoFileSource | HlsSource | undefined => {
  const path = input.split(/[?#]/, 1)[0] ?? '';
  if (/\.mp4$/i.test(path)) {
    return { type: 'video', sources: [{ src: input, mimeType: 'video/mp4' }] };
  }
  if (/\.webm$/i.test(path)) {
    return { type: 'video', sources: [{ src: input, mimeType: 'video/webm' }] };
  }
  if (/\.m3u8$/i.test(path)) return { type: 'hls', src: input };
  return undefined;
};

const isYouTubeHost = (hostname: string): boolean =>
  hostname === 'youtube.com' ||
  hostname === 'www.youtube.com' ||
  hostname === 'm.youtube.com' ||
  hostname === 'music.youtube.com' ||
  hostname === 'youtu.be' ||
  hostname === 'www.youtu.be';

const isVimeoHost = (hostname: string): boolean =>
  hostname === 'vimeo.com' ||
  hostname === 'www.vimeo.com' ||
  hostname === 'player.vimeo.com';

const sourceFromYouTubeUrl = (url: URL): YouTubeSource | undefined => {
  if (!isYouTubeHost(url.hostname)) return undefined;

  const isShortUrl =
    url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be';
  const watchVideoIds = url.searchParams.getAll('v');
  const shortUrlMatch = /^\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  const embeddedVideoMatch = /^\/(?:embed|shorts)\/([A-Za-z0-9_-]+)$/.exec(
    url.pathname
  );
  const videoId = isShortUrl
    ? shortUrlMatch?.[1]
    : url.pathname === '/watch'
      ? watchVideoIds.length === 1
        ? watchVideoIds[0]
        : undefined
      : embeddedVideoMatch?.[1];

  return isYouTubeVideoId(videoId) ? { type: 'youtube', videoId } : undefined;
};

const sourceFromVimeoUrl = (url: URL): VimeoSource | undefined => {
  if (!isVimeoHost(url.hostname)) return undefined;

  const isPlayerUrl = url.hostname === 'player.vimeo.com';
  const playerMatch = /^\/video\/(\d+)(?:\/([A-Za-z0-9]+))?$/.exec(
    url.pathname
  );
  const canonicalMatch = /^\/(\d+)$/.exec(url.pathname);
  const videoId = isPlayerUrl ? playerMatch?.[1] : canonicalMatch?.[1];
  const pathHash = isPlayerUrl ? playerMatch?.[2] : undefined;
  const queryHashes = url.searchParams.getAll('h');
  const queryHash = queryHashes.length === 1 ? queryHashes[0] : undefined;

  if (!isVimeoVideoId(videoId)) return undefined;
  if (
    queryHashes.length > 1 ||
    (queryHashes.length === 1 && !isVimeoHash(queryHash))
  ) {
    return undefined;
  }
  if (pathHash !== undefined && !isVimeoHash(pathHash)) return undefined;

  const hash = queryHash ?? pathHash;
  return { type: 'vimeo', videoId, ...(hash ? { hash } : {}) };
};

const sourceFromExplicitObject = (
  input: Record<string, unknown>
): ResolvedPlayerSource | undefined => {
  if (input.type === 'video') {
    if (!Array.isArray(input.sources) || input.sources.length === 0)
      return undefined;
    if (
      !input.sources.every(
        (source) =>
          isRecord(source) &&
          isNonEmptyString(source.src) &&
          isNonEmptyString(source.mimeType)
      )
    ) {
      return undefined;
    }
    return input as VideoFileSource;
  }

  if (input.type === 'hls') {
    if (!isNonEmptyString(input.src)) return undefined;
    if (
      input.engine !== undefined &&
      input.engine !== 'auto' &&
      input.engine !== 'native' &&
      input.engine !== 'hls.js'
    ) {
      return undefined;
    }
    return input as HlsSource;
  }

  if (input.type === 'youtube') {
    return isYouTubeVideoId(input.videoId)
      ? (input as YouTubeSource)
      : undefined;
  }

  if (input.type === 'vimeo') {
    if (!isVimeoVideoId(input.videoId)) return undefined;
    if (input.hash !== undefined && !isVimeoHash(input.hash)) return undefined;
    return input as VimeoSource;
  }

  return undefined;
};

export const detectSource = (input: unknown): SourceDetectionResult => {
  if (typeof input === 'string') {
    if (!isNonEmptyString(input) || input !== input.trim()) {
      return failure(input, 'malformed-string');
    }

    if (/%(?![\da-f]{2})/i.test(input)) {
      return failure(input, 'malformed-string');
    }

    const scheme = input.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
    if (scheme && scheme !== 'http' && scheme !== 'https') {
      return failure(input, 'unsupported-string');
    }

    const isNetworkPath = input.startsWith('//');
    if (isNetworkPath && !/^\/\/[^/]/.test(input)) {
      return failure(input, 'malformed-string');
    }

    const urlInput = isNetworkPath
      ? `https:${input}`
      : scheme
        ? input
        : undefined;
    if (scheme && !/^https?:\/\//i.test(input)) {
      return failure(input, 'malformed-string');
    }

    let url: URL | undefined;
    if (urlInput) {
      try {
        url = new URL(urlInput);
      } catch {
        return failure(input, 'malformed-string');
      }
    }

    if (url) {
      if (isYouTubeHost(url.hostname)) {
        const source = sourceFromYouTubeUrl(url);
        return source
          ? { status: 'success', input, source }
          : failure(input, 'malformed-string');
      }
      if (isVimeoHost(url.hostname)) {
        const source = sourceFromVimeoUrl(url);
        return source
          ? { status: 'success', input, source }
          : failure(input, 'malformed-string');
      }
    }

    const fileSource = sourceFromFileExtension(input);
    if (fileSource) return { status: 'success', input, source: fileSource };

    return failure(input, 'unsupported-string');
  }

  if (isRecord(input)) {
    const source = sourceFromExplicitObject(input);
    if (source) return { status: 'success', input: source, source };
  }

  return failure(input, 'invalid-source');
};

export class PlayerController {
  #provider: ProviderAdapter | undefined;
  #unsubscribe: (() => void) | undefined;
  #listeners = new Set<(state: PlayerState) => void>();
  #eventListeners = new Map<
    PlayerEventType,
    Set<(event: PlayerEvent) => void>
  >();
  #state = createInitialPlayerState();
  #generation = 0;

  setProvider = (provider: ProviderAdapter | undefined): void => {
    const alreadyDetached =
      this.#state.lifecycle === 'idle' &&
      this.#state.activation === 'dormant' &&
      this.#state.provider === null &&
      this.#state.error === null;
    if (
      provider === this.#provider &&
      (provider !== undefined || alreadyDetached)
    )
      return;
    const generation = ++this.#generation;
    const unsubscribe = this.#unsubscribe;
    const previousProvider = this.#provider;
    this.#unsubscribe = undefined;
    this.#provider = undefined;
    unsubscribeSafely(unsubscribe);
    if (previousProvider) {
      destroyProviderSafely(previousProvider);
    }
    if (generation !== this.#generation) return;
    this.#provider = provider;
    if (!provider) {
      this.#setState(createInitialPlayerState());
      return;
    }

    this.#setState({
      ...createInitialPlayerState(),
      lifecycle: 'loading',
      activation: 'loading-provider',
      provider: provider.provider
    });
    if (generation !== this.#generation || provider !== this.#provider) return;
    let nextUnsubscribe: (() => void) | undefined;
    try {
      nextUnsubscribe = provider.subscribe((patch, event) => {
        if (generation !== this.#generation) return;
        const originatingEvent = event
          ? { ...event, provider: provider.provider }
          : undefined;
        this.#applyPatch(patch);
        if (originatingEvent) this.#emitEvent(originatingEvent);
      });
    } catch (cause) {
      if (generation !== this.#generation || provider !== this.#provider) {
        return;
      }
      this.#provider = undefined;
      destroyProviderSafely(provider);
      this.#handleLifecycleFailure(cause, ++this.#generation);
      return;
    }
    if (generation !== this.#generation || provider !== this.#provider) {
      unsubscribeSafely(nextUnsubscribe);
      return;
    }
    this.#unsubscribe = nextUnsubscribe;
    let attachResult: void | Promise<void>;
    try {
      attachResult = provider.attach();
    } catch (cause) {
      this.#handleLifecycleFailure(cause, generation);
      return;
    }
    void Promise.resolve(attachResult)
      .then(() => {
        if (generation !== this.#generation) return;
        return provider.load();
      })
      .catch((cause: unknown) =>
        this.#handleLifecycleFailure(cause, generation)
      );
  };

  getState = (): PlayerState => this.#state;

  subscribe = (listener: (state: PlayerState) => void): (() => void) => {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  };

  on = <Type extends PlayerEventType>(
    type: Type,
    listener: (event: PlayerEventFor<Type>) => void
  ): (() => void) => {
    const listeners = this.#eventListeners.get(type) ?? new Set();
    const keyedListener = (event: PlayerEvent): void =>
      listener(event as PlayerEventFor<Type>);
    listeners.add(keyedListener);
    this.#eventListeners.set(type, listeners);
    return () => listeners.delete(keyedListener);
  };

  play = (): Promise<CommandResult> => this.#command('play');
  pause = (): Promise<CommandResult> => this.#command('pause');
  togglePlayback = (): Promise<CommandResult> =>
    this.#state.playback === 'playing' ? this.pause() : this.play();
  seekTo = (time: number): Promise<CommandResult> =>
    this.#command('seekTo', time);
  seekBy = (offset: number): Promise<CommandResult> =>
    this.#command('seekBy', offset);
  mute = (): Promise<CommandResult> => this.#command('mute');
  unmute = (): Promise<CommandResult> => this.#command('unmute');
  toggleMuted = (): Promise<CommandResult> =>
    this.#state.muted ? this.unmute() : this.mute();
  setVolume = (volume: number): Promise<CommandResult> =>
    this.#command('setVolume', volume);
  setPlaybackRate = (rate: number): Promise<CommandResult> =>
    this.#command('setPlaybackRate', rate);
  selectTextTrack = (track: string | null): Promise<CommandResult> =>
    this.#command('selectTextTrack', track);
  requestFullscreen = (): Promise<CommandResult> =>
    this.#command('requestFullscreen');
  exitFullscreen = (): Promise<CommandResult> =>
    this.#command('exitFullscreen');
  requestPictureInPicture = (): Promise<CommandResult> =>
    this.#command('requestPictureInPicture');
  exitPictureInPicture = (): Promise<CommandResult> =>
    this.#command('exitPictureInPicture');
  retry = (): Promise<CommandResult> => {
    const provider = this.#provider;
    if (!provider?.retry) return this.#command('retry');
    const generation = this.#generation;
    const previousState = this.#state;
    this.#applyPatch({
      lifecycle: 'loading',
      activation: 'loading-provider',
      error: null
    });
    if (this.#provider !== provider || this.#generation !== generation) {
      return Promise.resolve({ ok: false, reason: 'not-ready' });
    }
    return this.#providerCommand(provider, 'retry').then((result) => {
      if (
        this.#provider !== provider ||
        this.#generation !== generation ||
        this.#state.lifecycle !== 'loading'
      ) {
        return result;
      }
      if (!result.ok && result.error) {
        this.#applyPatch({
          lifecycle: 'error',
          activation: 'error',
          error: result.error
        });
      } else if (!result.ok) {
        this.#applyPatch({
          lifecycle: previousState.lifecycle,
          activation: previousState.activation,
          error: previousState.error
        });
      }
      return result;
    });
  };

  #command = async (
    name: keyof Pick<
      ProviderAdapter,
      | 'play'
      | 'pause'
      | 'seekTo'
      | 'seekBy'
      | 'mute'
      | 'unmute'
      | 'setVolume'
      | 'setPlaybackRate'
      | 'selectTextTrack'
      | 'requestFullscreen'
      | 'exitFullscreen'
      | 'requestPictureInPicture'
      | 'exitPictureInPicture'
      | 'retry'
    >,
    value?: number | string | null
  ): Promise<CommandResult> => {
    const provider = this.#provider;
    if (!provider) return { ok: false, reason: 'not-ready' };
    return this.#providerCommand(provider, name, value);
  };

  #providerCommand = async (
    provider: ProviderAdapter,
    name: keyof Pick<
      ProviderAdapter,
      | 'play'
      | 'pause'
      | 'seekTo'
      | 'seekBy'
      | 'mute'
      | 'unmute'
      | 'setVolume'
      | 'setPlaybackRate'
      | 'selectTextTrack'
      | 'requestFullscreen'
      | 'exitFullscreen'
      | 'requestPictureInPicture'
      | 'exitPictureInPicture'
      | 'retry'
    >,
    value?: number | string | null
  ): Promise<CommandResult> => {
    const command = provider[name] as
      ((value?: number | string | null) => Promise<CommandResult>) | undefined;
    if (!command) return { ok: false, reason: 'unsupported' };
    try {
      return await command.call(provider, value);
    } catch (cause) {
      return {
        ok: false,
        reason: 'provider-error',
        error: toProviderError(cause)
      };
    }
  };

  #setState = (state: PlayerState): void => {
    const snapshot = Object.freeze(state);
    this.#state = snapshot;
    this.#listeners.forEach((listener) => listener(snapshot));
  };

  #applyPatch = (patch: ProviderStatePatch): void => {
    const nextState: PlayerState = {
      ...this.#state,
      ...patch,
      buffered:
        patch.buffered === undefined
          ? this.#state.buffered
          : orderedRanges(patch.buffered),
      seekable:
        patch.seekable === undefined
          ? this.#state.seekable
          : orderedRanges(patch.seekable),
      capabilities:
        patch.capabilities === undefined
          ? this.#state.capabilities
          : freezeCapabilities(patch.capabilities),
      error:
        patch.lifecycle === 'ready' && patch.error === undefined
          ? null
          : patch.error === undefined
            ? this.#state.error
            : patch.error === null
              ? null
              : freezeError(patch.error)
    };
    this.#setState(nextState);
  };

  #emitEvent = (event: ProviderEvent): void => {
    const completeEvent = {
      ...event,
      provider: event.provider ?? this.#state.provider,
      timestamp: event.timestamp ?? Date.now()
    } as PlayerEvent;
    this.#eventListeners
      .get(completeEvent.type)
      ?.forEach((listener) => listener(completeEvent));
  };

  #handleLifecycleFailure = (cause: unknown, generation: number): void => {
    if (generation !== this.#generation) return;
    this.#applyPatch({
      lifecycle: 'error',
      activation: 'error',
      error: toProviderError(cause)
    });
  };
}
