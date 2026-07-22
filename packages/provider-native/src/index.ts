import type {
  Availability,
  CommandResult,
  PlayerError,
  PlayerEventDetailMap,
  PlayerEventType,
  ProviderAdapter,
  ProviderEvent,
  ProviderEventFor,
  ProviderStateListener,
  TimeRange
} from '@reely/core';

const available: Availability = { status: 'available' };
const unsupported: Availability = {
  status: 'unavailable',
  reason: 'browser'
};

export type NativePlaybackOptions = {
  readonly loop?: boolean;
  readonly startTime?: number;
  readonly endTime?: number;
};

const toRanges = (ranges: globalThis.TimeRanges): ReadonlyArray<TimeRange> =>
  Array.from({ length: ranges.length }, (_, index) => ({
    start: ranges.start(index),
    end: ranges.end(index)
  })).sort((left, right) => left.start - right.start);

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

const runCommand = async (
  command: () => void | Promise<unknown>
): Promise<CommandResult> => {
  try {
    await command();
    return { ok: true };
  } catch (cause) {
    return commandError(cause);
  }
};

const withinMediaBounds = (
  media: HTMLVideoElement,
  time: number,
  startTime: number,
  endTime: number | undefined
): number | undefined => {
  const duration = Number.isFinite(media.duration) ? media.duration : undefined;
  const effectiveEnd =
    endTime === undefined
      ? duration
      : duration === undefined
        ? endTime
        : Math.min(endTime, duration);
  const effectiveStart =
    effectiveEnd === undefined ? startTime : Math.min(startTime, effectiveEnd);
  const bounded = Math.max(
    effectiveStart,
    effectiveEnd === undefined ? time : Math.min(time, effectiveEnd)
  );
  if (media.seekable.length === 0) return bounded;
  const intersections = Array.from(
    { length: media.seekable.length },
    (_, index) => ({
      start: Math.max(media.seekable.start(index), effectiveStart),
      end: Math.min(
        media.seekable.end(index),
        effectiveEnd ?? Number.POSITIVE_INFINITY
      )
    })
  ).filter(({ end, start }) => start <= end);
  if (intersections.length === 0) return undefined;
  for (const { end, start } of intersections) {
    if (bounded >= start && bounded <= end) return bounded;
  }
  return intersections
    .flatMap(({ end, start }) => [start, end])
    .reduce((closest, point) =>
      Math.abs(point - bounded) < Math.abs(closest - bounded) ? point : closest
    );
};

export const createNativeProvider = (
  media: HTMLVideoElement,
  options: NativePlaybackOptions = {}
): ProviderAdapter => {
  const listeners = new Set<ProviderStateListener>();
  const startTime =
    Number.isFinite(options.startTime) && (options.startTime ?? 0) > 0
      ? (options.startTime ?? 0)
      : 0;
  const endTime =
    Number.isFinite(options.endTime) && (options.endTime ?? 0) > startTime
      ? options.endTime
      : undefined;
  const loop = options.loop ?? false;
  let attached = false;
  let destroyed = false;
  let loaded = false;
  let positioned = false;
  let boundaryEnded = false;

  const emit = (
    patch: Parameters<ProviderStateListener>[0],
    event?: ProviderEvent
  ): void => listeners.forEach((listener) => listener(patch, event));

  const event = <Type extends PlayerEventType>(
    type: Type,
    originalEvent: Event,
    detail: PlayerEventDetailMap[Type]
  ): ProviderEventFor<Type> => ({
    type,
    detail,
    origin: 'provider',
    originalEvent
  });

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
          selectTextTrack: { status: 'unavailable', reason: 'provider' },
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
      originalEvent ? event('ready', originalEvent, undefined) : undefined
    );

  const onPlay = (originalEvent: Event): void =>
    emit(
      {
        playback: 'playing',
        buffering: false,
        currentTime: media.currentTime
      },
      event('play', originalEvent, undefined)
    );
  const onPlaying = (): void => emit({ playback: 'playing', buffering: false });
  const onPause = (originalEvent: Event): void => {
    if (boundaryEnded) return;
    emit({ playback: 'paused' }, event('pause', originalEvent, undefined));
  };
  const boundaryStart = (): number =>
    withinMediaBounds(media, startTime, startTime, endTime) ?? startTime;
  const restartFromBoundary = (): void => {
    boundaryEnded = false;
    const restartTime = boundaryStart();
    media.currentTime = restartTime;
    emit({ currentTime: restartTime, buffering: false });
    void Promise.resolve()
      .then(() => media.play())
      .catch(() => undefined);
  };
  const onEnded = (originalEvent: Event): void => {
    if (loop) {
      restartFromBoundary();
      return;
    }
    boundaryEnded = true;
    emit(
      { playback: 'ended', buffering: false },
      event('ended', originalEvent, undefined)
    );
  };
  const onWaiting = (): void => emit({ buffering: true });
  const applyInitialPosition = (): void => {
    if (positioned) return;
    positioned = true;
    const initialPosition = withinMediaBounds(
      media,
      startTime,
      startTime,
      endTime
    );
    if (initialPosition !== undefined) media.currentTime = initialPosition;
  };
  const onCanPlay = (originalEvent: Event): void => {
    emit({ buffering: false });
    emitMediaState(originalEvent);
  };
  const onLoadedMetadata = (originalEvent: Event): void => {
    applyInitialPosition();
    onCanPlay(originalEvent);
  };
  const onSeeking = (originalEvent: Event): void =>
    emit(
      { seeking: true },
      event('seeking', originalEvent, { currentTime: media.currentTime })
    );
  const onSeeked = (originalEvent: Event): void =>
    emit(
      { seeking: false, currentTime: media.currentTime },
      event('seeked', originalEvent, { currentTime: media.currentTime })
    );
  const onTimeUpdate = (originalEvent: Event): void => {
    if (endTime !== undefined && media.currentTime >= endTime) {
      if (loop) {
        restartFromBoundary();
        return;
      }
      media.currentTime = endTime;
      if (!boundaryEnded) {
        boundaryEnded = true;
        media.pause();
        emit(
          { currentTime: endTime, playback: 'ended', buffering: false },
          event('ended', originalEvent, undefined)
        );
      }
      return;
    }
    boundaryEnded = false;
    emit({ currentTime: media.currentTime });
  };
  const onProgress = (): void =>
    emit({
      buffered: toRanges(media.buffered),
      seekable: toRanges(media.seekable)
    });
  const onVolumeChange = (originalEvent: Event): void =>
    emit(
      { muted: media.muted, volume: media.volume },
      event('volumechange', originalEvent, {
        muted: media.muted,
        volume: media.volume
      })
    );
  const onRateChange = (originalEvent: Event): void =>
    emit(
      { playbackRate: media.playbackRate },
      event('ratechange', originalEvent, {
        playbackRate: media.playbackRate
      })
    );
  const onError = (originalEvent: Event): void => {
    const error = mediaError(media);
    emit(
      { lifecycle: 'error', activation: 'error', error },
      event('error', originalEvent, error)
    );
  };
  const onFullscreenChange = (originalEvent: Event): void =>
    emit(
      { fullscreen: document.fullscreenElement === media },
      event('fullscreenchange', originalEvent, {
        fullscreen: document.fullscreenElement === media
      })
    );
  const onPictureInPictureChange = (originalEvent: Event): void =>
    emit(
      { pictureInPicture: document.pictureInPictureElement === media },
      event('pictureinpicturechange', originalEvent, {
        pictureInPicture: document.pictureInPictureElement === media
      })
    );

  const addListeners = (): void => {
    media.addEventListener('play', onPlay);
    media.addEventListener('playing', onPlaying);
    media.addEventListener('pause', onPause);
    media.addEventListener('ended', onEnded);
    media.addEventListener('waiting', onWaiting);
    media.addEventListener('canplay', onCanPlay);
    media.addEventListener('loadedmetadata', onLoadedMetadata);
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
    media.removeEventListener('playing', onPlaying);
    media.removeEventListener('pause', onPause);
    media.removeEventListener('ended', onEnded);
    media.removeEventListener('waiting', onWaiting);
    media.removeEventListener('canplay', onCanPlay);
    media.removeEventListener('loadedmetadata', onLoadedMetadata);
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
      if (destroyed || loaded) return;
      loaded = true;
      media.load();
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
    play: () =>
      runCommand(() => {
        if (
          boundaryEnded ||
          (endTime !== undefined && media.currentTime >= endTime)
        ) {
          boundaryEnded = false;
          media.currentTime = boundaryStart();
        }
        return media.play();
      }),
    pause: () => runCommand(() => media.pause()),
    seekTo: (time) => {
      if (!Number.isFinite(time))
        return Promise.resolve({ ok: false, reason: 'provider-error' });
      const target = withinMediaBounds(media, time, startTime, endTime);
      if (target === undefined)
        return Promise.resolve({ ok: false, reason: 'provider-error' });
      return runCommand(() => {
        media.currentTime = target;
      });
    },
    seekBy: (offset) => {
      if (!Number.isFinite(offset))
        return Promise.resolve({ ok: false, reason: 'provider-error' });
      const target = withinMediaBounds(
        media,
        media.currentTime + offset,
        startTime,
        endTime
      );
      if (target === undefined)
        return Promise.resolve({ ok: false, reason: 'provider-error' });
      return runCommand(() => {
        media.currentTime = target;
      });
    },
    mute: () =>
      runCommand(() => {
        media.muted = true;
      }),
    unmute: () =>
      runCommand(() => {
        media.muted = false;
      }),
    setVolume: (volume) => {
      if (!Number.isFinite(volume))
        return Promise.resolve({ ok: false, reason: 'provider-error' });
      return runCommand(() => {
        media.volume = Math.min(1, Math.max(0, volume));
      });
    },
    setPlaybackRate: (rate) => {
      if (!Number.isFinite(rate) || rate <= 0)
        return Promise.resolve({ ok: false, reason: 'provider-error' });
      return runCommand(() => {
        media.playbackRate = rate;
      });
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
    retry: () =>
      runCommand(() => {
        positioned = false;
        boundaryEnded = false;
        media.load();
      })
  };
};
