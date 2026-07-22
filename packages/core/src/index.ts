export type PlaybackState = 'paused' | 'playing';

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

export type MediaProvider = {
  play: () => Promise<void>;
  pause: () => void;
  subscribe: (listener: (state: PlaybackState) => void) => () => void;
  destroy: () => void;
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

  const segments = url.pathname.split('/').filter(Boolean);
  const videoId =
    url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be'
      ? segments[0]
      : segments[0] === 'watch'
        ? (url.searchParams.get('v') ?? undefined)
        : segments[0] === 'embed' || segments[0] === 'shorts'
          ? segments[1]
          : undefined;

  return isNonEmptyString(videoId) ? { type: 'youtube', videoId } : undefined;
};

const sourceFromVimeoUrl = (url: URL): VimeoSource | undefined => {
  if (!isVimeoHost(url.hostname)) return undefined;

  const segments = url.pathname.split('/').filter(Boolean);
  const isPlayerUrl = segments[0] === 'video';
  const videoId = isPlayerUrl ? segments[1] : segments[0];
  const pathHash = isPlayerUrl ? segments[2] : undefined;
  const queryHash = url.searchParams.get('h');

  if (!videoId || !/^\d+$/.test(videoId)) return undefined;
  if (queryHash !== null && !isNonEmptyString(queryHash)) return undefined;
  if (pathHash !== undefined && !isNonEmptyString(pathHash)) return undefined;

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
    return isNonEmptyString(input.videoId)
      ? (input as YouTubeSource)
      : undefined;
  }

  if (input.type === 'vimeo') {
    if (!isNonEmptyString(input.videoId)) return undefined;
    if (input.hash !== undefined && !isNonEmptyString(input.hash))
      return undefined;
    return input as VimeoSource;
  }

  return undefined;
};

export const detectSource = (input: unknown): SourceDetectionResult => {
  if (typeof input === 'string') {
    if (!isNonEmptyString(input) || input !== input.trim()) {
      return failure(input, 'malformed-string');
    }

    const looksLikeAbsoluteUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(input);
    let url: URL | undefined;
    try {
      url = new URL(input);
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        url = undefined;
    } catch {
      if (looksLikeAbsoluteUrl) return failure(input, 'malformed-string');
    }

    const fileSource = sourceFromFileExtension(input);
    if (fileSource) return { status: 'success', input, source: fileSource };

    if (url) {
      const youtubeSource = sourceFromYouTubeUrl(url);
      if (youtubeSource)
        return { status: 'success', input, source: youtubeSource };
      const vimeoSource = sourceFromVimeoUrl(url);
      if (vimeoSource) return { status: 'success', input, source: vimeoSource };
      if (isYouTubeHost(url.hostname) || isVimeoHost(url.hostname)) {
        return failure(input, 'malformed-string');
      }
    }

    return failure(input, 'unsupported-string');
  }

  if (isRecord(input)) {
    const source = sourceFromExplicitObject(input);
    if (source) return { status: 'success', input: source, source };
  }

  return failure(input, 'invalid-source');
};

export class PlayerController {
  #provider: MediaProvider | undefined;
  #unsubscribe: (() => void) | undefined;
  #listeners = new Set<(state: PlaybackState) => void>();
  #state: PlaybackState = 'paused';

  setProvider = (provider: MediaProvider | undefined): void => {
    this.#unsubscribe?.();
    this.#provider?.destroy();
    this.#provider = provider;
    this.#unsubscribe = provider?.subscribe(this.#setState);
  };

  getState = (): PlaybackState => this.#state;

  subscribe = (listener: (state: PlaybackState) => void): (() => void) => {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  };

  play = async (): Promise<void> => {
    await this.#provider?.play();
  };

  pause = (): void => {
    this.#provider?.pause();
  };

  #setState = (state: PlaybackState): void => {
    if (state === this.#state) return;
    this.#state = state;
    this.#listeners.forEach((listener) => listener(state));
  };
}
