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
  category: PlayerErrorCategory;
  fatal: boolean;
  recoverable: boolean;
  message: string;
  cause?: unknown;
};

export type CommandResult =
  | { ok: true }
  | { ok: false; reason: CommandFailureReason; error?: PlayerError };

export type Availability =
  | { status: 'available' }
  | { status: 'unknown'; reason: 'not-ready' | 'provider-check' }
  | {
      status: 'unavailable';
      reason: 'browser' | 'provider' | 'provider-plan' | 'source' | 'policy';
    };

export type TimeRange = { start: number; end: number };

export type PlayerProvider = 'native' | 'hls' | 'youtube' | 'vimeo';

export type PlayerCapabilities = {
  seek: Availability;
  setVolume: Availability;
  setPlaybackRate: Availability;
  selectQuality: Availability;
  selectTextTrack: Availability;
  fullscreen: Availability;
  pictureInPicture: Availability;
  airPlay: Availability;
  customControls: Availability;
};

export type PlayerState = {
  lifecycle: 'idle' | 'loading' | 'ready' | 'error';
  activation: 'dormant' | 'eligible' | 'loading-provider' | 'ready' | 'error';
  playback: PlaybackState;
  buffering: boolean;
  seeking: boolean;
  currentTime: number;
  duration: number | null;
  buffered: ReadonlyArray<TimeRange>;
  seekable: ReadonlyArray<TimeRange>;
  muted: boolean;
  volume: number;
  playbackRate: number;
  fullscreen: boolean;
  pictureInPicture: boolean;
  autoplay: 'idle' | 'attempting' | 'started' | 'blocked' | 'failed';
  provider: PlayerProvider | null;
  capabilities: PlayerCapabilities;
  error: PlayerError | null;
};

export type PlayerEventOrigin =
  'user' | 'api' | 'autoplay' | 'provider' | 'system';

export type PlayerEventType =
  | 'play'
  | 'pause'
  | 'ended'
  | 'loading'
  | 'ready'
  | 'error'
  | 'seeking'
  | 'seeked'
  | 'volumechange'
  | 'ratechange'
  | 'fullscreenchange'
  | 'pictureinpicturechange';

export type PlayerEvent = {
  type: PlayerEventType;
  detail: unknown;
  origin: PlayerEventOrigin;
  provider: PlayerProvider | null;
  timestamp: number;
  originalEvent?: Event;
};

export type ProviderStatePatch = Partial<PlayerState>;

export type ProviderEvent = Omit<PlayerEvent, 'provider' | 'timestamp'> & {
  provider?: PlayerProvider;
  timestamp?: number;
};

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

const notReady: Availability = { status: 'unknown', reason: 'not-ready' };

const initialCapabilities = (): PlayerCapabilities => ({
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

export const createInitialPlayerState = (): PlayerState => ({
  lifecycle: 'idle',
  activation: 'dormant',
  playback: 'paused',
  buffering: false,
  seeking: false,
  currentTime: 0,
  duration: null,
  buffered: [],
  seekable: [],
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
  [...ranges].sort((left, right) => left.start - right.start);

const toProviderError = (cause: unknown): PlayerError => ({
  category: 'provider',
  fatal: false,
  recoverable: true,
  message:
    cause instanceof Error ? cause.message : 'The provider command failed.',
  cause
});

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
    if (provider === this.#provider) return;
    const generation = ++this.#generation;
    this.#unsubscribe?.();
    void this.#provider?.destroy();
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
    this.#unsubscribe = provider.subscribe((patch, event) => {
      if (generation !== this.#generation) return;
      this.#setState({ ...this.#state, ...patch });
      if (event) this.#emitEvent(event);
    });
    void Promise.resolve(provider.attach())
      .then(() => {
        if (generation !== this.#generation) return;
        return provider.load();
      })
      .catch((cause: unknown) => {
        if (generation !== this.#generation) return;
        this.#setState({
          ...this.#state,
          lifecycle: 'error',
          activation: 'error',
          error: toProviderError(cause)
        });
      });
  };

  getState = (): PlayerState => this.#state;

  subscribe = (listener: (state: PlayerState) => void): (() => void) => {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  };

  on = (
    type: PlayerEventType,
    listener: (event: PlayerEvent) => void
  ): (() => void) => {
    const listeners = this.#eventListeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#eventListeners.set(type, listeners);
    return () => listeners.delete(listener);
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
  retry = (): Promise<CommandResult> => this.#command('retry');

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
    const command = provider[name] as
      ((value?: number | string | null) => Promise<CommandResult>) | undefined;
    if (!command) return { ok: false, reason: 'unsupported' };
    try {
      return await command(value);
    } catch (cause) {
      return {
        ok: false,
        reason: 'provider-error',
        error: toProviderError(cause)
      };
    }
  };

  #setState = (state: PlayerState): void => {
    const normalized = {
      ...state,
      buffered: orderedRanges(state.buffered),
      seekable: orderedRanges(state.seekable)
    };
    this.#state = normalized;
    this.#listeners.forEach((listener) => listener(normalized));
  };

  #emitEvent = (event: ProviderEvent): void => {
    const completeEvent: PlayerEvent = {
      ...event,
      provider: event.provider ?? this.#state.provider,
      timestamp: event.timestamp ?? Date.now()
    };
    this.#eventListeners
      .get(completeEvent.type)
      ?.forEach((listener) => listener(completeEvent));
  };
}
