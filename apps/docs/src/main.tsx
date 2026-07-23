import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Player from '@reely/react';

const parameters = new URLSearchParams(window.location.search);
const autoplayParameter = parameters.get('autoplay');
const autoplay: Player.RootProps['autoplay'] =
  autoplayParameter === 'muted' || autoplayParameter === 'audible'
    ? autoplayParameter
    : false;
const loadingParameter = parameters.get('loading');
const loading: Player.PlayerLoadingStrategy =
  loadingParameter === 'eager' ||
  loadingParameter === 'interaction' ||
  loadingParameter === 'viewport'
    ? loadingParameter
    : 'viewport';
const preloadParameter = parameters.get('preload');
const preload: Player.PlayerPreload =
  preloadParameter === 'none' ||
  preloadParameter === 'metadata' ||
  preloadParameter === 'auto'
    ? preloadParameter
    : 'metadata';
const defaultMuted = parameters.get('defaultMuted') === 'true';
const sourceChange = parameters.get('sourceChange') === 'external';
const activationSource = sourceChange
  ? 'https://provider.invalid/source-a.mp4'
  : parameters.get('activationSource') === 'external'
    ? 'https://provider.invalid/tracer.mp4'
    : '/tracer.mp4';
const replacementSource = sourceChange
  ? 'https://provider.invalid/source-b.mp4'
  : null;

const PresentationControls = () => {
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

const PlayerFixture = () => {
  const [source, setSource] = useState(activationSource);

  return (
    <>
      <Player.Root
        autoplay={autoplay}
        defaultMuted={defaultMuted}
        loading={loading}
        preload={preload}
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
        <PresentationControls />
      </Player.Root>
      {replacementSource && source !== replacementSource ? (
        <button onClick={() => setSource(replacementSource)} type="button">
          Switch to source B
        </button>
      ) : null}
    </>
  );
};

const App = () => (
  <>
    <h1>Reely</h1>
    <p>A minimal player with explicit, inspectable media source detection.</p>
    <PlayerFixture />
    <h2>Activation loading</h2>
    <p>
      A poster&apos;s <code>loading</code> and <code>fetchPriority</code>{' '}
      control only the image. Root <code>loading</code> controls provider
      activation, while Root <code>preload</code> controls native media only
      after activation.
    </p>
    <p>
      Root defaults to viewport loading with a <code>200px 0px</code> viewport
      margin. Interaction loading is incompatible with autoplay: it reports a
      recoverable configuration error instead of importing a provider.
    </p>
    <p>
      With interaction loading, there is no provider contact before the click.
      That click queues playback with the user&apos;s current muted preference;
      blocked audible playback remains blocked and is never silently retried as
      muted. Source changes and Retry invalidate stale loading attempts.
    </p>
    <pre>{`<Player.Root
  source={source}
  loading="interaction"
  preload="metadata"
>
  <Player.Viewport>
    <Player.Media />
    <Player.Poster>{poster}</Player.Poster>
    <Player.ActivationButton />
    <Player.LoadingIndicator />
  </Player.Viewport>
</Player.Root>`}</pre>
    <h2>Posters</h2>
    <p>
      The decorative <code>Player.Poster</code> sits inside the viewport before
      media. Its crop can differ from the native video poster: native posters
      follow the media <code>object-fit</code> and <code>object-position</code>,
      while <code>Player.Poster</code> may choose its own focal position.
    </p>
    <pre>{`<Player.Viewport>
  <Player.Poster>
    <Player.PosterImage
      alt=""
      src="/poster.svg"
      srcSet="/poster.svg 640w, /poster.svg 1280w"
      sizes="(max-width: 48rem) 100vw, 48rem"
      width={1280}
      height={720}
      loading="eager"
      decoding="async"
      objectPosition="30% 40%"
    />
  </Player.Poster>
  <Player.Media />
</Player.Viewport>`}</pre>
    <p>
      A native <code>&lt;picture&gt;</code> remains an opaque custom child; use
      an empty alt because the poster is decorative.
    </p>
    <pre>{`<Player.Poster>
  <picture>
    <source media="(max-width: 48rem)" srcSet="/poster-narrow.webp" />
    <img src="/poster-wide.webp" alt="" width={1280} height={720} />
  </picture>
</Player.Poster>`}</pre>
    <p>
      In Next.js 16, <code>preload</code> replaces deprecated{' '}
      <code>priority</code>. A Next <code>Image</code> is likewise an opaque
      poster child.
    </p>
    <pre>{`import Image from 'next/image'

<Player.Poster>
  <Image src="/poster.webp" alt="" fill preload sizes="100vw" />
</Player.Poster>`}</pre>
    <p>
      Set <code>nativePoster</code> only when the native video poster is needed.
      Combining it with a responsive custom poster can fetch two image
      candidates.
    </p>
    <pre>{`<Player.Media nativePoster="/fallback-poster.webp" />`}</pre>
    <p>
      Choose image priority yourself: known heroes use preload or high fetch
      priority; feed images use <code>loading="lazy"</code>. Reely never guesses
      LCP priority.
    </p>
    <h2>Install</h2>
    <pre>pnpm add @reely/react</pre>
    <h2>Sources</h2>
    <p>
      <code>Player.Root</code> accepts MP4, WebM, HLS, YouTube, and Vimeo
      strings, or an explicit source object. The native tracer above remains a
      working MP4 example. HLS and provider sources are detected in this issue,
      but <code>Player.Media</code> does not load them yet.
    </p>
    <h2>Playback API</h2>
    <p>
      Get a <code>PlayerHandle</code> from the <code>ref</code> prop on{' '}
      <code>Player.Root</code>, or call <code>usePlayerActions()</code> and{' '}
      <code>usePlayerState(selector)</code> inside the Root. Selectors subscribe
      directly to the controller, so they only rerender when their selected
      value changes.
    </p>
    <pre>{`const playback = Player.usePlayerState((state) => state.playback)
const { seekTo, setVolume, retry } = Player.usePlayerActions()

await seekTo(30) // { ok: true } or { ok: false, reason, error? }`}</pre>
    <p>
      Native playback can be constrained with <code>startTime</code> and{' '}
      <code>endTime</code>. Add <code>loop</code> to restart that bounded
      segment at its configured start. Ordinary loading is idempotent;{' '}
      <code>retry()</code> forces a fresh load after an error.
    </p>
    <pre>{`<Player.Root source="/video.mp4" startTime={10} endTime={30} loop>
  <Player.Media />
</Player.Root>`}</pre>
    <h2>Playback preferences</h2>
    <p>
      Muting, volume, and playback rate support standard uncontrolled defaults
      or controlled values. Defaults seed the preference once for a Root and
      survive media replacement; changing a default prop later does not reset
      it. Change callbacks report values only after the provider confirms them.
    </p>
    <pre>{`// Uncontrolled preferences
<Player.Root
  source="/video.mp4"
  defaultMuted
  defaultVolume={0.4}
  defaultPlaybackRate={1.5}
>...</Player.Root>

// Controlled preferences
<Player.Root
  source="/video.mp4"
  muted={muted}
  volume={volume}
  playbackRate={playbackRate}
  onMutedChange={setMuted}
  onVolumeChange={setVolume}
  onPlaybackRateChange={setPlaybackRate}
>...</Player.Root>`}</pre>
    <p>
      There is deliberately no <code>playing</code> prop: playback is confirmed
      provider state, so use player actions to request play or pause and read
      the result with <code>usePlayerState</code>.
    </p>
    <h2>Fullscreen and Picture-in-Picture</h2>
    <p>
      <code>requestFullscreen</code>, <code>exitFullscreen</code>,{' '}
      <code>requestPictureInPicture</code>, and{' '}
      <code>exitPictureInPicture</code> are typed commands with confirmed state:{' '}
      <code>state.fullscreen</code> and <code>state.pictureInPicture</code>{' '}
      change only after the platform reports the transition. Capabilities report
      what the current environment actually supports, so gate controls on{' '}
      <code>capabilities.fullscreen</code> and{' '}
      <code>capabilities.pictureInPicture</code> being <code>available</code>.
    </p>
    <pre>{`const fullscreen = Player.usePlayerState(
  (state) => state.capabilities.fullscreen
)
const { requestFullscreen } = Player.usePlayerActions()

{fullscreen.status === 'available' && (
  <button onClick={() => void requestFullscreen()}>Fullscreen</button>
)}`}</pre>
    <h3>Platform support matrix</h3>
    <table>
      <thead>
        <tr>
          <th>Platform</th>
          <th>Fullscreen</th>
          <th>Picture-in-Picture</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Chrome / Edge (desktop, Android)</td>
          <td>Standard Fullscreen API — available</td>
          <td>Standard Picture-in-Picture API — available</td>
        </tr>
        <tr>
          <td>Firefox (desktop, Android)</td>
          <td>Standard Fullscreen API — available</td>
          <td>
            No programmatic API — <code>unavailable</code> (reason{' '}
            <code>browser</code>)
          </td>
        </tr>
        <tr>
          <td>Safari (macOS, iPadOS)</td>
          <td>Standard Fullscreen API — available</td>
          <td>WebKit presentation mode — available</td>
        </tr>
        <tr>
          <td>Safari (iPhone)</td>
          <td>
            WebKit video fullscreen (<code>webkitEnterFullscreen</code>) —{' '}
            <code>unknown</code> (reason <code>not-ready</code>) until media
            metadata resolves support
          </td>
          <td>WebKit presentation mode — available (iOS 14+)</td>
        </tr>
        <tr>
          <td>
            Embeds without <code>allow="fullscreen"</code> /{' '}
            <code>allow="picture-in-picture"</code>
          </td>
          <td>
            <code>unavailable</code> (reason <code>policy</code>)
          </td>
          <td>
            <code>unavailable</code> (reason <code>policy</code>)
          </td>
        </tr>
      </tbody>
    </table>
    <p>
      Policy restrictions and user-gesture requirements never throw through the
      UI: commands resolve to{' '}
      <code>
        {'{'} ok: false, reason: 'blocked', error: {'{'} category: 'policy'{' '}
        {'}'} {'}'}
      </code>
      . A media element with <code>disablePictureInPicture</code> reports the
      capability as <code>unavailable</code> with reason <code>policy</code>.
    </p>
    <h2>Autoplay</h2>
    <p>
      Set <code>autoplay</code> to <code>false</code> (the default),{' '}
      <code>muted</code>, or <code>audible</code>. Its observable outcome moves
      through <code>attempting</code> and then <code>started</code>,{' '}
      <code>blocked</code>, or <code>failed</code>. The Play button exposes that
      result through <code>data-autoplay-state</code> and remains available
      after a blocked attempt.
    </p>
    <pre>{`<Player.Root source="/video.mp4" autoplay="muted">...</Player.Root>
<Player.Root source="/video.mp4" autoplay="audible">...</Player.Root>`}</pre>
    <p>
      Audible autoplay never silently retries as muted. Muted autoplay also
      cannot be combined with controlled <code>muted={'{false}'}</code>; that
      conflict produces a recoverable configuration error instead of changing
      the controlled value.
    </p>
    <p>
      All commands return a promise of <code>CommandResult</code>:{' '}
      <code>play</code>, <code>pause</code>, <code>togglePlayback</code>, seek,
      mute, volume, rate, text-track, fullscreen, picture-in-picture, and retry.
      Failures are <code>blocked</code>, <code>unsupported</code>,{' '}
      <code>not-ready</code>, or <code>provider-error</code>; they do not throw
      through the React UI boundary.
    </p>
    <p>
      State includes lifecycle, confirmed playback, buffering, seeking, time
      ranges, audio settings, fullscreen and picture-in-picture, provider,
      autoplay status, capabilities, and a nullable error. Capabilities report
      <code>available</code>, <code>unknown</code>, or <code>unavailable</code>{' '}
      with a reason. Subscribe to typed provider events with{' '}
      <code>handle.on(type, listener)</code>; each event includes its type,
      detail, origin, provider, timestamp, and (when available) the native
      event.
    </p>
    <p>
      Errors have a category (<code>configuration</code>, <code>source</code>,{' '}
      <code>network</code>, <code>decode</code>, <code>provider</code>,{' '}
      <code>policy</code>, or <code>unsupported</code>) plus fatal and
      recoverable semantics. Native media events remain the source of truth: a
      successful command does not optimistically change confirmed playback
      state.
    </p>
    <pre>{`// String sources
<Player.Root source="/video.mp4">...</Player.Root>
<Player.Root source="https://cdn.example.com/video.webm">...</Player.Root>
<Player.Root source="https://cdn.example.com/master.m3u8">...</Player.Root>
<Player.Root source="https://www.youtube.com/watch?v=dQw4w9WgXcQ">...</Player.Root>
<Player.Root source="https://youtu.be/dQw4w9WgXcQ">...</Player.Root>
<Player.Root source="https://www.youtube.com/embed/dQw4w9WgXcQ">...</Player.Root>
<Player.Root source="https://www.youtube.com/shorts/dQw4w9WgXcQ">...</Player.Root>
<Player.Root source="https://vimeo.com/123456789">...</Player.Root>
<Player.Root source="https://player.vimeo.com/video/123456789">...</Player.Root>
<Player.Root source="https://player.vimeo.com/video/123456789/a1b2c3">...</Player.Root>
<Player.Root source="https://vimeo.com/123456789?h=a1b2c3">...</Player.Root>

// Explicit video source (preserves source order and MIME types)
<Player.Root source={{
  type: 'video',
  sources: [
    { src: '/video.webm', mimeType: 'video/webm' },
    { src: '/video.mp4', mimeType: 'video/mp4' },
  ],
}}>...</Player.Root>

// Explicit HLS source
<Player.Root source={{ type: 'hls', src: '/master.m3u8', engine: 'hls.js' }}>
  ...
</Player.Root>

// Explicit provider sources
<Player.Root source={{ type: 'youtube', videoId: 'dQw4w9WgXcQ' }}>...</Player.Root>
<Player.Root source={{ type: 'vimeo', videoId: '123456789', hash: 'a1b2c3' }}>
  ...
</Player.Root>`}</pre>
  </>
);

createRoot(document.getElementById('root')!).render(<App />);
