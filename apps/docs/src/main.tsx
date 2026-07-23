import { createRoot } from 'react-dom/client';
import * as Player from '@reely/react';

const autoplayParameter = new URLSearchParams(window.location.search).get(
  'autoplay'
);
const autoplay: Player.RootProps['autoplay'] =
  autoplayParameter === 'muted' || autoplayParameter === 'audible'
    ? autoplayParameter
    : false;

const App = () => (
  <>
    <h1>Reely</h1>
    <p>A minimal player with explicit, inspectable media source detection.</p>
    <Player.Root autoplay={autoplay} source="/tracer.mp4">
      <Player.Viewport
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
        <Player.Media />
      </Player.Viewport>
      <Player.PlayButton />
    </Player.Root>
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
