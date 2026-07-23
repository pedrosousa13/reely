import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Player from '@reely/react';

declare global {
  interface Window {
    reelyHandle?: Player.PlayerHandle;
  }
}

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
const engineParameter = parameters.get('engine');
const hlsEngine: 'auto' | 'native' | 'hls.js' =
  engineParameter === 'native' || engineParameter === 'hls.js'
    ? engineParameter
    : 'auto';
const youtubeExampleUrl = 'https://www.youtube.com/watch?v=M7lc1UVf-VE';
const vimeoExampleUrl = 'https://vimeo.com/76979871';
const sourceParameter = parameters.get('source');
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
    : (vimeoSource ??
      (sourceChange
        ? 'https://provider.invalid/source-a.mp4'
        : parameters.get('activationSource') === 'external'
          ? 'https://provider.invalid/tracer.mp4'
          : parameters.get('activationSource') === 'youtube'
            ? youtubeExampleUrl
            : '/tracer.mp4'));
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
      {presentation.airPlayStatus === 'available' ? (
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

const PlayerFixture = () => {
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
        <PresentationControls />
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
      working MP4 example. HLS VOD sources load through the HLS provider,
      YouTube sources through the YouTube iframe player, and Vimeo sources
      through the Vimeo iframe embed.
    </p>
    <h2>HLS</h2>
    <p>
      HLS is native first: where the browser plays HLS natively (Safari, iOS)
      the native media element is used unchanged and hls.js is never downloaded.
      Everywhere else the provider dynamically imports hls.js and drives
      playback through Media Source Extensions. A consumer who never plays HLS
      ships zero hls.js bytes.
    </p>
    <pre>{`// Auto engine selection (default)
<Player.Root source="/hls/master.m3u8">...</Player.Root>

// Forced engine
<Player.Root source={{ type: 'hls', src: '/hls/master.m3u8', engine: 'hls.js' }}>
  ...
</Player.Root>`}</pre>
    <p>Engine selection matrix for the source&apos;s optional engine field:</p>
    <table>
      <thead>
        <tr>
          <th>Engine</th>
          <th>Native HLS support</th>
          <th>MSE only</th>
          <th>Neither</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <code>auto</code> (default)
          </td>
          <td>native</td>
          <td>hls.js (dynamic import)</td>
          <td>
            fatal <code>unsupported</code> error
          </td>
        </tr>
        <tr>
          <td>
            <code>native</code>
          </td>
          <td>native</td>
          <td>
            fatal <code>unsupported</code> error
          </td>
          <td>
            fatal <code>unsupported</code> error
          </td>
        </tr>
        <tr>
          <td>
            <code>hls.js</code>
          </td>
          <td>hls.js (dynamic import)</td>
          <td>hls.js (dynamic import)</td>
          <td>
            fatal <code>unsupported</code> error
          </td>
        </tr>
      </tbody>
    </table>
    <p>
      The effective engine is inspectable as{' '}
      <code>state.hlsEngine: 'native' | 'hls.js' | null</code>. Forced engines
      never silently fall back: an impossible engine surfaces a normalized fatal{' '}
      <code>unsupported</code> error that names the forced engine.
    </p>
    <h3>Serving requirements</h3>
    <p>
      Serve playlists as <code>application/vnd.apple.mpegurl</code> (or keep the{' '}
      <code>.m3u8</code> extension) and MPEG-TS segments as{' '}
      <code>video/mp2t</code>. When the manifest lives on another origin, CORS
      must allow the player origin with <code>Access-Control-Allow-Origin</code>{' '}
      on the manifest, every media playlist, and every segment: hls.js fetches
      them all with XHR, and Safari&apos;s native engine performs its own
      cross-origin manifest and segment requests.
    </p>
    <h3>Adaptation and quality</h3>
    <p>
      Both engines adapt between renditions automatically as bandwidth changes.
      The current rendition is reported as <code>state.quality</code> (height,
      width, bitrate) on the hls.js engine. Quality capability is honest per
      engine: hls.js reports <code>selectQuality</code> as available once the
      manifest is parsed and <code>selectQuality(height)</code> pins a rendition
      (<code>selectQuality(null)</code> returns to automatic adaptation). Native
      HLS offers no manual rendition selection, so the capability reports{' '}
      <code>unavailable</code> with reason <code>provider</code> and{' '}
      <code>state.quality</code> stays null there.
    </p>
    <pre>{`const quality = Player.usePlayerState((state) => state.quality)
const { selectQuality } = Player.usePlayerActions()

await selectQuality(180) // pin the 180p rendition (hls.js engine)
await selectQuality(null) // back to automatic adaptation`}</pre>
    <h3>Failure modes</h3>
    <p>
      Fatal hls.js errors follow a bounded recovery table: up to two{' '}
      <code>startLoad</code> retries for fatal network errors and up to two{' '}
      <code>recoverMediaError</code> attempts for fatal media errors. When
      recovery is exhausted the player surfaces one normalized fatal error (
      <code>network</code> or <code>decode</code>) instead of retrying forever,
      and <code>retry()</code> remains functional: it tears the hls.js instance
      down and restarts with fresh recovery budgets. Unsupported environments
      surface <code>unsupported</code>; on the native engine, media element
      errors map to <code>network</code>, <code>decode</code>, or{' '}
      <code>source</code> exactly as for MP4 playback.
    </p>
    <h2>YouTube</h2>
    <p>
      YouTube sources load the YouTube iframe player on demand: no YouTube code
      is in the initial bundle and no YouTube-domain request happens until the
      activation strategy allows it. Embeds use the privacy-enhanced{' '}
      <code>youtube-nocookie.com</code> host.
    </p>
    <YouTubeExample />
    <pre>{`<Player.Root source="https://www.youtube.com/watch?v=M7lc1UVf-VE" loading="interaction">
  <Player.Viewport>
    <Player.ActivationButton />
    <Player.LoadingIndicator />
    <Player.Media />
  </Player.Viewport>
</Player.Root>`}</pre>
    <p>
      YouTube always uses its own player controls. YouTube&apos;s developer
      policy prohibits blocking or obscuring standard player features (branding,
      settings, watch-later, and so on), so Reely never overlays a control layer
      on the iframe; <code>customControls</code> reports{' '}
      <code>unavailable</code> with reason <code>policy</code>. This is a policy
      constraint, not a technical one.
    </p>
    <p>
      Honest limits of the iframe embed, with no parity claims against native
      playback:
    </p>
    <ul>
      <li>
        YouTube branding and links to youtube.com stay visible inside the
        player; embedded plays may not count toward public view counts until
        YouTube validates them.
      </li>
      <li>
        Captions are controlled from the YouTube settings menu inside the
        iframe. Reely cannot list or select YouTube text tracks, so{' '}
        <code>selectTextTrack</code> reports <code>unavailable</code>.
      </li>
      <li>
        On mobile, playback is inline (<code>playsinline</code>) where the OS
        allows it; iOS may still take over presentation, and programmatic
        playback generally requires a user gesture.
      </li>
      <li>
        Autoplay follows browser policy. YouTube does not report a blocked
        autoplay attempt as an error, it just stays paused; Reely reports an
        unconfirmed play request as <code>blocked</code> instead of conflating
        it with a provider that is not ready.
      </li>
      <li>
        The player lives in a cross-origin iframe: picture-in-picture and
        AirPlay report <code>unavailable</code>, volume and mute changes made
        inside the YouTube controls are not observable as events, and fullscreen
        wraps the whole iframe so the YouTube chrome stays interactive. Entering
        fullscreen from the YouTube button inside the iframe is still tracked
        through the document fullscreen state.
      </li>
      <li>
        Initial muted, volume, and playback-rate preferences cannot be seeded on
        an element, so Reely replays them through the iframe API once the player
        reports ready; commands report intended values immediately and the
        player confirms through its own events and polling.
      </li>
      <li>
        Timing is polled while playing (the iframe API emits no time-update
        events), so <code>currentTime</code> advances in coarse steps.
      </li>
    </ul>
    <h2>Vimeo</h2>
    <p>
      A Vimeo source lazily loads <code>@reely/provider-vimeo</code> and the
      official Vimeo Player SDK, then mounts a chromeless (
      <code>controls=0</code>), Do-Not-Track (<code>dnt=1</code>) iframe embed.
      No Vimeo domain is contacted before activation. Try{' '}
      <code>?source=vimeo</code> on this page.
    </p>
    <pre>{`<Player.Root source="https://vimeo.com/76979871">
  <Player.Viewport>
    <Player.Poster>{poster}</Player.Poster>
    <Player.Media />
  </Player.Viewport>
</Player.Root>`}</pre>
    <p>
      <strong>Plan-dependent controls.</strong> Hiding Vimeo&apos;s own controls
      is gated by the video owner&apos;s Vimeo plan; free-plan videos ignore{' '}
      <code>controls=0</code>. Reely reports this through{' '}
      <code>capabilities.customControls</code>: <code>available</code> when the
      chromeless embed is honored, <code>unavailable</code> with reason{' '}
      <code>provider-plan</code> when Vimeo&apos;s controls stay, or{' '}
      <code>unknown</code> when the plan cannot be resolved. When gated,
      Vimeo&apos;s controls remain the single control layer; hide custom
      controls instead of stacking a second layer on top.
    </p>
    <p>
      <strong>Cross-origin styling limits.</strong> The Vimeo player renders
      inside a cross-origin iframe. Reely can size and position the iframe box,
      but the player UI inside it cannot be styled, themed, or inspected from
      the embedding page.
    </p>
    <p>
      <strong>Unlisted videos.</strong> Unlisted videos require their privacy
      hash. Both URL forms carry it into the embed, or pass it explicitly:
    </p>
    <pre>{`<Player.Root source="https://player.vimeo.com/video/123456789/a1b2c3" />
<Player.Root source="https://vimeo.com/123456789?h=a1b2c3" />
<Player.Root source={{ type: 'vimeo', videoId: '123456789', hash: 'a1b2c3' }} />`}</pre>
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
    <h2>AirPlay and Media Session</h2>
    <p>
      <code>showAirPlayPicker()</code> opens the native AirPlay route picker. It
      is a WebKit-only action (<code>webkitShowPlaybackTargetPicker</code>):
      gate it on <code>capabilities.airPlay</code> being <code>available</code>.
      On non-WebKit engines the capability reports <code>unavailable</code> with
      reason <code>browser</code>; a media element that opts out of AirPlay (
      <code>x-webkit-airplay=&quot;deny&quot;</code> or{' '}
      <code>disableRemotePlayback</code>) reports <code>unavailable</code> with
      reason <code>policy</code>. Like fullscreen, permission and user-gesture
      failures resolve to{' '}
      <code>
        {'{'} ok: false, reason: 'blocked' {'}'}
      </code>{' '}
      instead of throwing.
    </p>
    <pre>{`const airPlay = Player.usePlayerState((state) => state.capabilities.airPlay)
const { showAirPlayPicker } = Player.usePlayerActions()

{airPlay.status === 'available' && (
  <button onClick={() => void showAirPlayPicker()}>AirPlay</button>
)}`}</pre>
    <p>
      Media Session powers lock-screen and hardware-key controls. Reely never
      scrapes metadata from the media source: pass it explicitly through the{' '}
      <code>mediaMetadata</code> prop, and Reely wires the play, pause, and seek
      action handlers to the player. Metadata and handlers are cleaned up on
      source change and unmount.
    </p>
    <pre>{`<Player.Root
  source="/video.mp4"
  mediaMetadata={{
    title: 'Episode 1',
    artist: 'Reely',
    artwork: [{ src: '/art.png', sizes: '512x512', type: 'image/png' }],
  }}
>...</Player.Root>`}</pre>
    <h3>Single-session ownership</h3>
    <p>
      A document has exactly one <code>navigator.mediaSession</code>. When a
      page hosts several players, the <strong>most-recently-playing</strong>{' '}
      Reely root owns the metadata and action handlers. A root releases
      ownership when another root starts playing, on teardown, or on unmount,
      and it never clears handlers it does not own, so the lock screen always
      reflects the player the listener last started.
    </p>
    <p>
      <strong>Media Session is not exclusive playback.</strong> It arbitrates
      only the lock-screen surface; it does not pause other players. Two Reely
      roots can play at the same time, and only the lock-screen controls follow
      the most recent one. Enforcing a single active player (exclusive playback
      groups) is a separate concern and is out of scope for the MVP.
    </p>
    <h3>Platform support matrix</h3>
    <table>
      <thead>
        <tr>
          <th>Platform</th>
          <th>AirPlay picker</th>
          <th>Media Session</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Safari (macOS, iPadOS)</td>
          <td>
            <code>webkitShowPlaybackTargetPicker</code> — available
          </td>
          <td>Available (lock screen / Control Center)</td>
        </tr>
        <tr>
          <td>Safari (iPhone)</td>
          <td>
            <code>webkitShowPlaybackTargetPicker</code> — available
          </td>
          <td>Available (lock screen)</td>
        </tr>
        <tr>
          <td>Chrome / Edge (desktop, Android)</td>
          <td>
            No WebKit picker — <code>unavailable</code> (reason{' '}
            <code>browser</code>); cast lives in the browser menu
          </td>
          <td>Available (hardware keys, Android media notification)</td>
        </tr>
        <tr>
          <td>Firefox (desktop, Android)</td>
          <td>
            <code>unavailable</code> (reason <code>browser</code>)
          </td>
          <td>Available (hardware keys)</td>
        </tr>
        <tr>
          <td>
            <code>x-webkit-airplay=&quot;deny&quot;</code> /{' '}
            <code>disableRemotePlayback</code>
          </td>
          <td>
            <code>unavailable</code> (reason <code>policy</code>)
          </td>
          <td>n/a</td>
        </tr>
      </tbody>
    </table>
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
