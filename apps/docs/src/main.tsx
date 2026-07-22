import { createRoot } from 'react-dom/client';
import * as Player from '@reely/react';

const App = () => (
  <>
    <h1>Reely</h1>
    <p>A minimal player with explicit, inspectable media source detection.</p>
    <Player.Root source="/tracer.mp4">
      <Player.Viewport>
        <Player.Media />
      </Player.Viewport>
      <Player.PlayButton />
    </Player.Root>
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
