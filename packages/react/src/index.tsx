import {
  PlayerController,
  detectSource,
  type PlayerSource,
  type PlayerState
} from '@reely/core';
import {
  createNativeProvider,
  type NativePlaybackOptions
} from '@reely/provider-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref
} from 'react';

type PlayerContextValue = {
  controller: PlayerController;
  source: ReturnType<typeof detectSource>;
  registerMedia: (media: HTMLVideoElement | null) => void;
};

export type PlayerHandle = Pick<
  PlayerController,
  | 'getState'
  | 'subscribe'
  | 'on'
  | 'play'
  | 'pause'
  | 'togglePlayback'
  | 'seekTo'
  | 'seekBy'
  | 'mute'
  | 'unmute'
  | 'toggleMuted'
  | 'setVolume'
  | 'setPlaybackRate'
  | 'selectTextTrack'
  | 'requestFullscreen'
  | 'exitFullscreen'
  | 'requestPictureInPicture'
  | 'exitPictureInPicture'
  | 'retry'
>;

export type PlayerActions = Omit<PlayerHandle, 'getState' | 'subscribe' | 'on'>;

const PlayerContext = createContext<PlayerContextValue | null>(null);

const usePlayer = (): PlayerContextValue => {
  const player = useContext(PlayerContext);
  if (!player)
    throw new Error(
      'Player hooks and primitives must be used inside Player.Root.'
    );
  return player;
};

const selectionsEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== 'object' ||
    left === null ||
    typeof right !== 'object' ||
    right === null
  ) {
    return false;
  }
  const leftPrototype = Object.getPrototypeOf(left);
  if (
    leftPrototype !== Object.getPrototypeOf(right) ||
    (leftPrototype !== Object.prototype && !Array.isArray(left))
  ) {
    return false;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        Object.is(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key]
        )
    )
  );
};

export const usePlayerState = <Selected,>(
  selector: (state: PlayerState) => Selected
): Selected => {
  const { controller } = usePlayer();
  const selectionRef = useRef<{
    initialized: boolean;
    state?: PlayerState;
    value?: Selected;
  }>({ initialized: false });
  const getSnapshot = useCallback((): Selected => {
    const state = controller.getState();
    if (
      selectionRef.current.initialized &&
      selectionRef.current.state === state
    ) {
      return selectionRef.current.value as Selected;
    }
    const nextSelection = selector(state);
    if (
      selectionRef.current.initialized &&
      selectionsEqual(selectionRef.current.value, nextSelection)
    ) {
      selectionRef.current.state = state;
      return selectionRef.current.value as Selected;
    }
    selectionRef.current = { initialized: true, state, value: nextSelection };
    return nextSelection;
  }, [controller, selector]);
  return useSyncExternalStore(controller.subscribe, getSnapshot, getSnapshot);
};

export const usePlayerActions = (): PlayerActions => {
  const { controller } = usePlayer();
  return useMemo(
    () => ({
      play: controller.play,
      pause: controller.pause,
      togglePlayback: controller.togglePlayback,
      seekTo: controller.seekTo,
      seekBy: controller.seekBy,
      mute: controller.mute,
      unmute: controller.unmute,
      toggleMuted: controller.toggleMuted,
      setVolume: controller.setVolume,
      setPlaybackRate: controller.setPlaybackRate,
      selectTextTrack: controller.selectTextTrack,
      requestFullscreen: controller.requestFullscreen,
      exitFullscreen: controller.exitFullscreen,
      requestPictureInPicture: controller.requestPictureInPicture,
      exitPictureInPicture: controller.exitPictureInPicture,
      retry: controller.retry
    }),
    [controller]
  );
};

export const Root = ({
  children,
  endTime,
  loop,
  ref,
  source,
  startTime
}: NativePlaybackOptions & {
  children: ReactNode;
  ref?: Ref<PlayerHandle>;
  source: PlayerSource;
}) => {
  const [controller] = useState(() => new PlayerController());
  const currentMedia = useRef<HTMLVideoElement | null>(null);
  const detectedSource = useMemo(() => detectSource(source), [source]);

  useImperativeHandle(ref, () => controller, [controller]);
  useEffect(() => () => controller.setProvider(undefined), [controller]);

  const registerMedia = useCallback(
    (media: HTMLVideoElement | null) => {
      if (currentMedia.current === media) return;
      currentMedia.current = media;
      controller.setProvider(
        media
          ? createNativeProvider(media, { endTime, loop, startTime })
          : undefined
      );
    },
    [controller, endTime, loop, startTime]
  );

  const value = useMemo(
    () => ({ controller, source: detectedSource, registerMedia }),
    [controller, detectedSource, registerMedia]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
};

export const Viewport = ({ children }: { children: ReactNode }) => (
  <div>{children}</div>
);

const sourceKey = (source: ReturnType<typeof detectSource>): string =>
  source.status === 'success'
    ? JSON.stringify(source.source)
    : 'unsupported-source';

export const Media = () => {
  const { registerMedia, source } = usePlayer();
  if (source.status === 'failure' || source.source.type !== 'video') {
    return null;
  }

  return (
    <video
      aria-label="Reely media"
      key={sourceKey(source)}
      playsInline
      preload="metadata"
      ref={registerMedia}
    >
      {source.source.sources.map(({ mimeType, src }, index) => (
        <source key={`${src}:${mimeType}:${index}`} src={src} type={mimeType} />
      ))}
    </video>
  );
};

export const PlayButton = () => {
  const playback = usePlayerState((state) => state.playback);
  const { togglePlayback } = usePlayerActions();
  const isPlaying = playback === 'playing';

  return (
    <button
      aria-label={isPlaying ? 'Pause' : 'Play'}
      data-playback-state={playback}
      onClick={() => void togglePlayback()}
      type="button"
    >
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  );
};
