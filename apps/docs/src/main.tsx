import { createRoot } from 'react-dom/client';
import * as Player from '@reely/react';

const App = () => (
  <>
    <h1>Reely</h1>
    <p>A minimal native MP4 player.</p>
    <Player.Root source="/tracer.mp4">
      <Player.Viewport>
        <Player.Media />
      </Player.Viewport>
      <Player.PlayButton />
    </Player.Root>
    <h2>Install</h2>
    <pre>pnpm add @reely/react</pre>
  </>
);

createRoot(document.getElementById('root')!).render(<App />);
