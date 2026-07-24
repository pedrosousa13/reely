import { useState } from 'react';
import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

declare global {
  interface Window {
    reelyHandle?: Player.PlayerHandle;
  }
}

const youtubeExampleUrl = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';
const vimeoExampleUrl = 'https://vimeo.com/76979871';

/**
 * Story args mirror the `apps/docs` `PlayerFixture`'s `URLSearchParams` reads
 * one-for-one (see `apps/docs/src/main.tsx`) so the same source-selection
 * branching runs against Storybook args instead of the query string.
 */
type PlayerFixtureArgs = {
  readonly source?: string;
  readonly engine: 'auto' | 'native' | 'hls.js';
  readonly activationSource?: 'youtube' | 'external';
  readonly autoplay: Player.RootProps['autoplay'];
  readonly loading: Player.PlayerLoadingStrategy;
  readonly preload: Player.PlayerPreload;
  readonly defaultMuted: boolean;
  readonly airplay?: 'demo';
  readonly sourceChange?: 'external';
};

const PresentationControls = ({
  airplayDemo
}: {
  readonly airplayDemo: boolean;
}) => {
  const presentation = Player.usePlayerState((state) => ({
    fullscreen: state.fullscreen,
    fullscreenStatus: state.capabilities.fullscreen.status,
    fullscreenReason:
      'reason' in state.capabilities.fullscreen
        ? state.capabilities.fullscreen.reason
        : undefined,
    pictureInPicture: state.pictureInPicture,
    pictureInPictureStatus: state.capabilities.pictureInPicture.status,
    pictureInPictureReason:
      'reason' in state.capabilities.pictureInPicture
        ? state.capabilities.pictureInPicture.reason
        : undefined,
    airPlayStatus: state.capabilities.airPlay.status,
    airPlayReason:
      'reason' in state.capabilities.airPlay
        ? state.capabilities.airPlay.reason
        : undefined
  }));
  const actions = Player.usePlayerActions();

  return (
    <p
      data-testid="presentation-capabilities"
      data-fullscreen-status={presentation.fullscreenStatus}
      data-fullscreen-reason={presentation.fullscreenReason}
      data-fullscreen-state={presentation.fullscreen ? 'active' : 'inline'}
      data-pip-status={presentation.pictureInPictureStatus}
      data-pip-reason={presentation.pictureInPictureReason}
      data-pip-state={presentation.pictureInPicture ? 'active' : 'inline'}
      data-airplay-status={presentation.airPlayStatus}
      data-airplay-reason={presentation.airPlayReason}
    >
      {presentation.fullscreenStatus === 'available' ? (
        <button
          data-testid="fullscreen-toggle"
          onClick={() =>
            void (presentation.fullscreen
              ? actions.exitFullscreen()
              : actions.requestFullscreen())
          }
          type="button"
        >
          {presentation.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        </button>
      ) : null}{' '}
      {presentation.pictureInPictureStatus === 'available' ? (
        <button
          data-testid="pip-toggle"
          onClick={() =>
            void (presentation.pictureInPicture
              ? actions.exitPictureInPicture()
              : actions.requestPictureInPicture())
          }
          type="button"
        >
          {presentation.pictureInPicture
            ? 'Exit picture-in-picture'
            : 'Enter picture-in-picture'}
        </button>
      ) : null}{' '}
      {airplayDemo && presentation.airPlayStatus === 'available' ? (
        <button
          data-testid="airplay-picker"
          onClick={() => void actions.showAirPlayPicker()}
          type="button"
        >
          AirPlay
        </button>
      ) : null}{' '}
      Fullscreen: {presentation.fullscreenStatus}
      {presentation.fullscreenReason
        ? ` (${presentation.fullscreenReason})`
        : ''}{' '}
      · Picture-in-picture: {presentation.pictureInPictureStatus}
      {presentation.pictureInPictureReason
        ? ` (${presentation.pictureInPictureReason})`
        : ''}
    </p>
  );
};

const StateProbes = () => {
  const { engine, errorCategory } = Player.usePlayerState((state) => ({
    engine: state.hlsEngine,
    errorCategory: state.error?.category ?? null
  }));
  return (
    <p>
      Engine: <span data-testid="hls-engine">{engine ?? 'none'}</span> · Error:{' '}
      <span data-testid="error-category">{errorCategory ?? 'none'}</span>
    </p>
  );
};

const formatClock = (seconds: number): string => {
  // Never renders NaN or a negative value: unusable inputs collapse to 0:00.
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const whole = Math.floor(safe);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const LiveControls = () => {
  const live = Player.usePlayerState((state) => ({
    isLive: state.live?.isLive ?? false,
    atLiveEdge: state.live?.atLiveEdge ?? false,
    known: state.live !== null,
    currentTime: state.currentTime,
    duration: state.duration,
    seekableEnd:
      state.seekable.length > 0
        ? Math.max(...state.seekable.map((range) => range.end))
        : null,
    seekableStart:
      state.seekable.length > 0
        ? Math.min(...state.seekable.map((range) => range.start))
        : null,
    seekStatus: state.capabilities.seek.status
  }));
  const actions = Player.usePlayerActions();

  // While live the seek slider maps the moving window; the time display shows
  // how far behind the live edge the position is, never a fixed duration.
  const behindEdgeSeconds =
    live.isLive && live.seekableEnd !== null
      ? Math.max(0, live.seekableEnd - live.currentTime)
      : 0;
  const timeLabel = live.isLive
    ? live.atLiveEdge
      ? 'LIVE'
      : `-${formatClock(behindEdgeSeconds)}`
    : `${formatClock(live.currentTime)} / ${formatClock(live.duration ?? 0)}`;

  return (
    <p
      data-testid="live-panel"
      data-live-known={live.known ? 'true' : 'false'}
      data-live-status={live.isLive ? 'live' : 'vod'}
      data-live-edge={
        live.isLive ? (live.atLiveEdge ? 'at-edge' : 'behind-edge') : 'none'
      }
      data-seek-status={live.seekStatus}
    >
      <span data-testid="live-indicator">
        {live.isLive ? (live.atLiveEdge ? 'LIVE' : 'BEHIND LIVE') : 'VOD'}
      </span>{' '}
      · <span data-testid="live-time">{timeLabel}</span>{' '}
      {live.isLive && live.seekStatus === 'available' ? (
        <>
          <button
            data-testid="live-seek-back"
            onClick={() =>
              void (
                live.seekableStart !== null &&
                actions.seekTo(live.seekableStart)
              )
            }
            type="button"
          >
            Jump to start
          </button>{' '}
          <button
            data-testid="live-seek-edge"
            onClick={() =>
              void (
                live.seekableEnd !== null && actions.seekTo(live.seekableEnd)
              )
            }
            type="button"
          >
            Jump to live
          </button>
        </>
      ) : null}
    </p>
  );
};

const PlayerFixture = ({ args }: { readonly args: PlayerFixtureArgs }) => {
  const {
    source: sourceParameter,
    engine: hlsEngine,
    activationSource: activationSourceParameter,
    autoplay,
    loading,
    preload,
    defaultMuted,
    airplay,
    sourceChange: sourceChangeParameter
  } = args;

  // See the "AirPlay demo control" note in apps/docs/src/main.tsx: gated so
  // the default fixture keeps a single page-global "Play" button.
  const airplayDemo = airplay === 'demo';
  const sourceChange = sourceChangeParameter === 'external';

  const vimeoSource: Player.RootProps['source'] | null =
    sourceParameter === 'vimeo'
      ? vimeoExampleUrl
      : sourceParameter === 'vimeo-unlisted'
        ? 'https://player.vimeo.com/video/76979871/abc123hash'
        : sourceParameter?.startsWith('https://')
          ? sourceParameter
          : null;

  const activationSource: Player.RootProps['source'] =
    sourceParameter === 'hls'
      ? { type: 'hls', src: '/hls/master.m3u8', engine: hlsEngine }
      : sourceParameter === 'live'
        ? { type: 'hls', src: '/live/index.m3u8', engine: hlsEngine }
        : (vimeoSource ??
          (sourceChange
            ? 'https://provider.invalid/source-a.mp4'
            : activationSourceParameter === 'external'
              ? 'https://provider.invalid/tracer.mp4'
              : activationSourceParameter === 'youtube'
                ? youtubeExampleUrl
                : '/tracer.mp4'));

  const replacementSource = sourceChange
    ? 'https://provider.invalid/source-b.mp4'
    : null;

  const [source, setSource] = useState(activationSource);

  return (
    <>
      <Player.Root
        autoplay={autoplay}
        defaultMuted={defaultMuted}
        loading={loading}
        mediaMetadata={{
          title: 'Reely tracer',
          artist: 'Reely',
          artwork: [
            { src: '/poster.svg', sizes: '1280x720', type: 'image/svg+xml' }
          ]
        }}
        preload={preload}
        ref={(handle) => {
          window.reelyHandle = handle ?? undefined;
        }}
        source={source}
      >
        <Player.Viewport
          data-testid="viewport"
          style={{ aspectRatio: '16 / 9', maxWidth: '48rem', width: '100%' }}
        >
          <Player.Poster>
            <Player.PosterImage
              alt=""
              decoding="async"
              fetchPriority="high"
              height={720}
              loading="eager"
              objectPosition="30% 40%"
              sizes="(max-width: 48rem) 100vw, 48rem"
              src="/poster.svg"
              srcSet="/poster.svg 640w, /poster.svg 1280w"
              width={1280}
            />
          </Player.Poster>
          <Player.ActivationButton />
          <Player.LoadingIndicator />
          <Player.Media />
        </Player.Viewport>
        <Player.PlayButton />
        <PresentationControls airplayDemo={airplayDemo} />
        <LiveControls />
        <StateProbes />
      </Player.Root>
      {replacementSource && source !== replacementSource ? (
        <button onClick={() => setSource(replacementSource)} type="button">
          Switch to source B
        </button>
      ) : null}
    </>
  );
};

const YouTubeExample = () => (
  <Player.Root loading="interaction" source={youtubeExampleUrl}>
    <Player.Viewport
      data-testid="youtube-example"
      style={{ aspectRatio: '16 / 9', maxWidth: '48rem', width: '100%' }}
    >
      <Player.ActivationButton aria-label="Watch YouTube example" />
      <Player.LoadingIndicator />
      <Player.Media />
    </Player.Viewport>
  </Player.Root>
);

const meta: Meta<PlayerFixtureArgs> = {
  title: 'Fixtures/PlayerFixture',
  tags: ['real-playback', '!test'],
  argTypes: {
    source: {
      control: 'text',
      description:
        "'hls' | 'live' | 'vimeo' | 'vimeo-unlisted' | an https:// URL | undefined (defaults to the native tracer)."
    },
    engine: {
      control: 'radio',
      options: ['auto', 'native', 'hls.js']
    },
    activationSource: {
      control: 'radio',
      options: ['youtube', 'external']
    },
    autoplay: {
      control: 'radio',
      options: [false, 'muted', 'audible']
    },
    loading: {
      control: 'radio',
      options: ['viewport', 'eager', 'interaction']
    },
    preload: {
      control: 'radio',
      options: ['metadata', 'none', 'auto']
    },
    defaultMuted: { control: 'boolean' },
    airplay: {
      control: 'radio',
      options: ['demo']
    },
    sourceChange: {
      control: 'radio',
      options: ['external']
    }
  },
  parameters: {
    docs: {
      description: {
        component:
          'Reproduces the `apps/docs` `PlayerFixture` e2e contract as a Storybook story: same testids, same `data-*` state attributes, same `window.reelyHandle`, and the same arg-driven source-selection branching (Storybook args replace the docs query string). Real providers, real media, real network — excluded from the deterministic story test suite (tagged `!test`).'
      }
    }
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    engine: 'auto',
    autoplay: false,
    loading: 'viewport',
    preload: 'metadata',
    defaultMuted: false
  },
  render: (args) => (
    <>
      <PlayerFixture args={args} />
      <YouTubeExample />
    </>
  )
};
