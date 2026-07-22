import {
  PlayerController,
  detectSource,
  type PlayerSource,
  type PlayerState
} from '@reely/core';
import { createNativeProvider } from '@reely/provider-native';
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

export const usePlayerState = <Selected,>(
  selector: (state: PlayerState) => Selected
): Selected => {
  const { controller } = usePlayer();
  return useSyncExternalStore(
    controller.subscribe,
    () => selector(controller.getState()),
    () => selector(controller.getState())
  );
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
  ref,
  source
}: {
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
      controller.setProvider(media ? createNativeProvider(media) : undefined);
    },
    [controller]
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
