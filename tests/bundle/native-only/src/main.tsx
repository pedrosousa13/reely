import { createRoot } from 'react-dom/client';
import * as Player from '@reely/react';

const Fixture = () => (
  <Player.Root loading="interaction" source="/fixture.mp4">
    <Player.Viewport style={{ aspectRatio: '16 / 9', width: '320px' }}>
      <Player.Media />
      <Player.ActivationButton />
    </Player.Viewport>
  </Player.Root>
);

createRoot(document.getElementById('root')!).render(<Fixture />);
