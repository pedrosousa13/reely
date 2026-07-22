import type { MediaProvider, PlaybackState } from '@reely/core';

export const createNativeProvider = (
  media: HTMLVideoElement
): MediaProvider => {
  const listeners = new Set<(state: PlaybackState) => void>();
  const notifyPlaying = (): void =>
    listeners.forEach((listener) => listener('playing'));
  const notifyPaused = (): void =>
    listeners.forEach((listener) => listener('paused'));

  media.addEventListener('play', notifyPlaying);
  media.addEventListener('playing', notifyPlaying);
  media.addEventListener('pause', notifyPaused);

  return {
    play: () => media.play(),
    pause: () => media.pause(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      media.removeEventListener('playing', notifyPlaying);
      media.removeEventListener('play', notifyPlaying);
      media.removeEventListener('pause', notifyPaused);
      listeners.clear();
    }
  };
};
