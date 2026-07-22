export type PlaybackState = 'paused' | 'playing';

export type ParsedSource = {
  type: 'mp4';
  url: string;
};

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
