import {
  PlayerController,
  detectSource,
  type PlayerSource,
  type PlaybackState
} from '@reely/core';
import { createNativeProvider } from '@reely/provider-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';

type PlayerContextValue = {
  controller: PlayerController;
  source: ReturnType<typeof detectSource>;
  registerMedia: (media: HTMLVideoElement | null) => void;
  state: PlaybackState;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const usePlayer = (): PlayerContextValue => {
  const player = useContext(PlayerContext);
  if (!player)
    throw new Error('Player primitives must be used inside Player.Root.');
  return player;
};

export const Root = ({
  children,
  source
}: {
  children: ReactNode;
  source: PlayerSource;
}) => {
  const [player] = useState(() => new PlayerController());
  const [state, setState] = useState<PlaybackState>(player.getState());
  const currentMedia = useRef<HTMLVideoElement | null>(null);

  useEffect(() => player.subscribe(setState), [player]);
  useEffect(() => () => player.setProvider(undefined), [player]);

  const registerMedia = useCallback(
    (media: HTMLVideoElement | null) => {
      if (currentMedia.current === media) return;
      currentMedia.current = media;
      player.setProvider(media ? createNativeProvider(media) : undefined);
    },
    [player]
  );

  const value = useMemo(
    () => ({
      controller: player,
      source: detectSource(source),
      registerMedia,
      state
    }),
    [player, registerMedia, source, state]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
};

export const Viewport = ({ children }: { children: ReactNode }) => (
  <div>{children}</div>
);

export const Media = () => {
  const { registerMedia, source } = usePlayer();
  if (source.status === 'failure' || source.source.type !== 'video') {
    return null;
  }

  return (
    <video
      aria-label="Reely media"
      playsInline
      preload="metadata"
      ref={registerMedia}
      src={source.source.sources[0]?.src}
    />
  );
};

export const PlayButton = () => {
  const { controller, state } = usePlayer();
  const isPlaying = state === 'playing';
  const toggle = (): void => {
    if (isPlaying) controller.pause();
    else void controller.play().catch(() => undefined);
  };

  return (
    <button
      aria-label={isPlaying ? 'Pause' : 'Play'}
      data-playback-state={state}
      onClick={toggle}
      type="button"
    >
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  );
};
