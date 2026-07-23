import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import * as Player from '@reely/react';

// Subtle neutral chrome so the headless primitive has visible bounds in the
// workbench — theming itself belongs to issue #10.
const viewportStyle = {
  width: 320,
  height: 180,
  border: '1px dashed #94a3b8',
  background: '#f1f5f9'
} as const;

// A same-origin endpoint (served by the Storybook app's Vite middleware)
// that never responds: the image stays in `loading` forever.
const HANGING_SRC = '/__reely/hang.png';

// 2x1 blue SVG — loads instantly from memory, no network.
const LOADED_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#1d4ed8"/></svg>'
)}`;

// Structurally invalid image payload — fires the error event deterministically.
const BROKEN_SRC = 'data:image/png;base64,broken';

const posterImage = (state: string, canvasElement: HTMLElement) =>
  waitFor(async () => {
    const image = canvasElement.querySelector(
      '[data-reely-part="poster-image"]'
    );
    await expect(image).toHaveAttribute('data-state', state);
  });

const meta = {
  title: 'Player/Poster',
  component: Player.PosterImage,
  render: (args) => (
    <Player.Viewport style={viewportStyle}>
      <Player.Poster>
        <Player.PosterImage {...args} />
      </Player.Poster>
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.PosterImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  play: async ({ canvasElement }) => posterImage('idle', canvasElement)
};

export const Loading: Story = {
  args: { src: HANGING_SRC },
  play: async ({ canvasElement }) => {
    await posterImage('loading', canvasElement);
    // The initial synchronous check above is trivially true the instant the
    // component mounts (before any network event could possibly land), so it
    // alone can't prove the endpoint hangs. Wait a real ~300ms and re-check:
    // a 404 (or any other response) would flip data-state to 'error' well
    // within this window — this asserts the endpoint genuinely never
    // responds, not just that the state started out 'loading'.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const image = canvasElement.querySelector(
      '[data-reely-part="poster-image"]'
    );
    await expect(image).toHaveAttribute('data-state', 'loading');
  }
};

export const Loaded: Story = {
  args: { src: LOADED_SRC },
  play: async ({ canvasElement }) => posterImage('loaded', canvasElement)
};

export const ErrorState: Story = {
  args: { src: BROKEN_SRC },
  play: async ({ canvasElement }) => posterImage('error', canvasElement)
};

export const CustomChildren: Story = {
  render: () => (
    <Player.Viewport style={viewportStyle}>
      <Player.Poster>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: '100%',
            height: '100%',
            background: '#0f172a',
            color: '#f8fafc'
          }}
        >
          Custom poster content
        </div>
      </Player.Poster>
    </Player.Viewport>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText('Custom poster content')
    ).toBeInTheDocument();
  }
};
