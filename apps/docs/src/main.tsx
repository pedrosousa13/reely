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
      working MP4 example.
    </p>
    <pre>{`// String sources
<Player.Root source="/video.mp4">...</Player.Root>
<Player.Root source="https://cdn.example.com/video.webm">...</Player.Root>
<Player.Root source="https://cdn.example.com/master.m3u8">...</Player.Root>
<Player.Root source="https://www.youtube.com/watch?v=dQw4w9WgXcQ">...</Player.Root>
<Player.Root source="https://player.vimeo.com/video/123456789/a1b2c3">...</Player.Root>

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
