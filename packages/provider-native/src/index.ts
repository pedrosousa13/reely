import type {
  Availability,
  CommandResult,
  PlayerError,
  ProviderAdapter,
  ProviderEvent,
  ProviderStateListener,
  TimeRange
} from '@reely/core';

const available: Availability = { status: 'available' };
const unsupported: Availability = {
  status: 'unavailable',
  reason: 'browser'
};

const toRanges = (ranges: globalThis.TimeRanges): ReadonlyArray<TimeRange> =>
  Array.from({ length: ranges.length }, (_, index) => ({
    start: ranges.start(index),
    end: ranges.end(index)
  }));

const mediaError = (media: HTMLVideoElement): PlayerError => {
  const code = media.error?.code;
  const category =
    code === 2
      ? 'network'
      : code === 3
        ? 'decode'
        : code === 4
          ? 'source'
          : 'provider';
  return {
    category,
    fatal: true,
    recoverable: category === 'network',
    message:
      media.error?.message || 'The media element could not load the source.'
  };
};

const commandError = (cause: unknown): Exclude<CommandResult, { ok: true }> => {
  const blocked =
    cause instanceof DOMException && cause.name === 'NotAllowedError';
  return {
    ok: false,
    reason: blocked ? 'blocked' : 'provider-error',
    error: {
      category: blocked ? 'policy' : 'provider',
      fatal: false,
      recoverable: true,
      message:
        cause instanceof Error ? cause.message : 'The native command failed.',
      cause
    }
  };
};

const withinMediaBounds = (media: HTMLVideoElement, time: number): number => {
  const duration = Number.isFinite(media.duration) ? media.duration : undefined;
  const bounded = Math.max(
    0,
    duration === undefined ? time : Math.min(time, duration)
  );
  if (media.seekable.length === 0) return bounded;
  for (let index = 0; index < media.seekable.length; index += 1) {
    const start = media.seekable.start(index);
    const end = media.seekable.end(index);
    if (bounded >= start && bounded <= end) return bounded;
  }
  const start = media.seekable.start(0);
  const end = media.seekable.end(media.seekable.length - 1);
  return bounded < start ? start : end;
};

export const createNativeProvider = (
  media: HTMLVideoElement
): ProviderAdapter => {
  const listeners = new Set<ProviderStateListener>();
  let attached = false;
  let destroyed = false;

  const emit = (
    patch: Parameters<ProviderStateListener>[0],
    event?: ProviderEvent
  ): void => listeners.forEach((listener) => listener(patch, event));

  const event = (
    type: ProviderEvent['type'],
    originalEvent: Event,
    detail: unknown = undefined
  ): ProviderEvent => ({ type, detail, origin: 'provider', originalEvent });

  const emitMediaState = (originalEvent?: Event): void =>
    emit(
      {
        lifecycle:
          media.readyState >= HTMLMediaElement.HAVE_METADATA
            ? 'ready'
            : 'loading',
        activation:
          media.readyState >= HTMLMediaElement.HAVE_METADATA
            ? 'ready'
            : 'loading-provider',
        currentTime: media.currentTime,
        duration: Number.isFinite(media.duration) ? media.duration : null,
        buffered: toRanges(media.buffered),
        seekable: toRanges(media.seekable),
        muted: media.muted,
        volume: media.volume,
        playbackRate: media.playbackRate,
        capabilities: {
          seek: available,
          setVolume: available,
          setPlaybackRate: available,
          selectQuality: { status: 'unknown', reason: 'provider-check' },
          selectTextTrack: { status: 'unknown', reason: 'provider-check' },
          fullscreen:
            typeof media.requestFullscreen === 'function'
              ? available
              : unsupported,
          pictureInPicture:
            typeof media.requestPictureInPicture === 'function'
              ? available
              : unsupported,
          airPlay: { status: 'unknown', reason: 'provider-check' },
          customControls: available
        }
      },
      originalEvent ? event('ready', originalEvent) : undefined
    );

  const onPlay = (originalEvent: Event): void =>
    emit(
      { playback: 'playing', buffering: false },
      event('play', originalEvent)
    );
  const onPause = (originalEvent: Event): void =>
    emit({ playback: 'paused' }, event('pause', originalEvent));
  const onEnded = (originalEvent: Event): void =>
    emit(
      { playback: 'ended', buffering: false },
      event('ended', originalEvent)
    );
  const onWaiting = (): void => emit({ buffering: true });
  const onCanPlay = (originalEvent: Event): void => {
    emit({ buffering: false });
    emitMediaState(originalEvent);
  };
  const onSeeking = (originalEvent: Event): void =>
    emit({ seeking: true }, event('seeking', originalEvent));
  const onSeeked = (originalEvent: Event): void =>
    emit(
      { seeking: false, currentTime: media.currentTime },
      event('seeked', originalEvent)
    );
  const onTimeUpdate = (): void => emit({ currentTime: media.currentTime });
  const onProgress = (): void =>
    emit({
      buffered: toRanges(media.buffered),
      seekable: toRanges(media.seekable)
    });
  const onVolumeChange = (originalEvent: Event): void =>
    emit(
      { muted: media.muted, volume: media.volume },
      event('volumechange', originalEvent)
    );
  const onRateChange = (originalEvent: Event): void =>
    emit(
      { playbackRate: media.playbackRate },
      event('ratechange', originalEvent)
    );
  const onError = (originalEvent: Event): void =>
    emit(
      { lifecycle: 'error', activation: 'error', error: mediaError(media) },
      event('error', originalEvent)
    );
  const onFullscreenChange = (originalEvent: Event): void =>
    emit(
      { fullscreen: document.fullscreenElement === media },
      event('fullscreenchange', originalEvent)
    );
  const onPictureInPictureChange = (originalEvent: Event): void =>
    emit(
      { pictureInPicture: document.pictureInPictureElement === media },
      event('pictureinpicturechange', originalEvent)
    );

  const addListeners = (): void => {
    media.addEventListener('play', onPlay);
    media.addEventListener('playing', onPlay);
    media.addEventListener('pause', onPause);
    media.addEventListener('ended', onEnded);
    media.addEventListener('waiting', onWaiting);
    media.addEventListener('canplay', onCanPlay);
    media.addEventListener('loadedmetadata', onCanPlay);
    media.addEventListener('seeking', onSeeking);
    media.addEventListener('seeked', onSeeked);
    media.addEventListener('timeupdate', onTimeUpdate);
    media.addEventListener('progress', onProgress);
    media.addEventListener('volumechange', onVolumeChange);
    media.addEventListener('ratechange', onRateChange);
    media.addEventListener('error', onError);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    media.addEventListener('enterpictureinpicture', onPictureInPictureChange);
    media.addEventListener('leavepictureinpicture', onPictureInPictureChange);
  };

  const removeListeners = (): void => {
    media.removeEventListener('play', onPlay);
    media.removeEventListener('playing', onPlay);
    media.removeEventListener('pause', onPause);
    media.removeEventListener('ended', onEnded);
    media.removeEventListener('waiting', onWaiting);
    media.removeEventListener('canplay', onCanPlay);
    media.removeEventListener('loadedmetadata', onCanPlay);
    media.removeEventListener('seeking', onSeeking);
    media.removeEventListener('seeked', onSeeked);
    media.removeEventListener('timeupdate', onTimeUpdate);
    media.removeEventListener('progress', onProgress);
    media.removeEventListener('volumechange', onVolumeChange);
    media.removeEventListener('ratechange', onRateChange);
    media.removeEventListener('error', onError);
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    media.removeEventListener(
      'enterpictureinpicture',
      onPictureInPictureChange
    );
    media.removeEventListener(
      'leavepictureinpicture',
      onPictureInPictureChange
    );
  };

  return {
    provider: 'native',
    attach: () => {
      if (attached || destroyed) return;
      attached = true;
      addListeners();
      emitMediaState();
    },
    load: () => {
      if (!destroyed) media.load();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (attached) removeListeners();
      listeners.clear();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play: async () => {
      try {
        await media.play();
        return { ok: true };
      } catch (cause) {
        return commandError(cause);
      }
    },
    pause: async () => {
      media.pause();
      return { ok: true };
    },
    seekTo: async (time) => {
      if (!Number.isFinite(time))
        return { ok: false, reason: 'provider-error' };
      media.currentTime = withinMediaBounds(media, time);
      return { ok: true };
    },
    seekBy: async (offset) => {
      if (!Number.isFinite(offset))
        return { ok: false, reason: 'provider-error' };
      media.currentTime = withinMediaBounds(media, media.currentTime + offset);
      return { ok: true };
    },
    mute: async () => {
      media.muted = true;
      return { ok: true };
    },
    unmute: async () => {
      media.muted = false;
      return { ok: true };
    },
    setVolume: async (volume) => {
      if (!Number.isFinite(volume))
        return { ok: false, reason: 'provider-error' };
      media.volume = Math.min(1, Math.max(0, volume));
      return { ok: true };
    },
    setPlaybackRate: async (rate) => {
      if (!Number.isFinite(rate) || rate <= 0)
        return { ok: false, reason: 'provider-error' };
      media.playbackRate = rate;
      return { ok: true };
    },
    requestFullscreen: async () => {
      if (!media.requestFullscreen) return { ok: false, reason: 'unsupported' };
      try {
        await media.requestFullscreen();
        return { ok: true };
      } catch (cause) {
        return commandError(cause);
      }
    },
    exitFullscreen: async () => {
      if (!document.exitFullscreen) return { ok: false, reason: 'unsupported' };
      try {
        await document.exitFullscreen();
        return { ok: true };
      } catch (cause) {
        return commandError(cause);
      }
    },
    requestPictureInPicture: async () => {
      if (!media.requestPictureInPicture)
        return { ok: false, reason: 'unsupported' };
      try {
        await media.requestPictureInPicture();
        return { ok: true };
      } catch (cause) {
        return commandError(cause);
      }
    },
    exitPictureInPicture: async () => {
      if (!document.exitPictureInPicture)
        return { ok: false, reason: 'unsupported' };
      try {
        await document.exitPictureInPicture();
        return { ok: true };
      } catch (cause) {
        return commandError(cause);
      }
    },
    retry: async () => {
      media.load();
      return { ok: true };
    }
  };
};
