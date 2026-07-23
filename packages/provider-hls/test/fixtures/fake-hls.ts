import type { HlsInstanceLike, HlsLevelLike } from '../../src/index';

type FakeHlsListener = (event: string, data: unknown) => void;

export class FakeHls implements HlsInstanceLike {
  static instances: FakeHls[] = [];
  static supported = true;
  static readonly Events = {
    ERROR: 'hlsError',
    LEVEL_SWITCHED: 'hlsLevelSwitched',
    MANIFEST_PARSED: 'hlsManifestParsed'
  };
  static readonly ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError'
  };
  static isSupported = (): boolean => FakeHls.supported;
  static reset = (): void => {
    FakeHls.instances = [];
    FakeHls.supported = true;
  };

  levels: HlsLevelLike[] = [];
  currentLevel = -1;
  destroyed = false;
  attachedMedia: HTMLMediaElement | undefined;
  loadedSource: string | undefined;
  startLoadCalls = 0;
  recoverMediaErrorCalls = 0;
  swapAudioCodecCalls = 0;
  readonly #listeners = new Map<string, Set<FakeHlsListener>>();

  constructor() {
    FakeHls.instances.push(this);
  }

  on = (event: string, listener: FakeHlsListener): void => {
    const listeners = this.#listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(event, listeners);
  };

  emit = (event: string, data: unknown): void => {
    this.#listeners.get(event)?.forEach((listener) => listener(event, data));
  };

  emitFatalError = (type: string, details = 'fatal'): void => {
    this.emit(FakeHls.Events.ERROR, { type, details, fatal: true });
  };

  startLoad = (): void => {
    this.startLoadCalls += 1;
  };

  recoverMediaError = (): void => {
    this.recoverMediaErrorCalls += 1;
  };

  swapAudioCodec = (): void => {
    this.swapAudioCodecCalls += 1;
  };

  attachMedia = (media: HTMLMediaElement): void => {
    this.attachedMedia = media;
  };

  loadSource = (url: string): void => {
    this.loadedSource = url;
  };

  destroy = (): void => {
    this.destroyed = true;
    this.#listeners.clear();
  };
}

export const fakeHlsLoader = () => {
  let calls = 0;
  const loadHls = async () => {
    calls += 1;
    return { default: FakeHls };
  };
  return { loadHls, calls: () => calls };
};
