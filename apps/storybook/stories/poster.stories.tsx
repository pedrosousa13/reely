import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import type { ReactNode } from 'react';

const Frame = ({ children }: { readonly children: ReactNode }) => (
  <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
    {children}
  </Player.Viewport>
);

const loadedPosterSrc = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#1d2733"/><circle cx="800" cy="450" r="180" fill="#3f8cff"/></svg>'
)}`;

const posterImage = (canvasElement: HTMLElement): HTMLElement => {
  const image = canvasElement.querySelector<HTMLElement>(
    '[data-reely-part="poster-image"]'
  );
  if (!image) throw new Error('Expected a poster image in the story.');
  return image;
};

const meta = {
  title: 'Player/Poster',
  component: Player.Poster,
  parameters: {
    docs: {
      description: {
        component: [
          '`Player.Poster` is the pre-playback surface; wrap a `Player.PosterImage` or arbitrary children.',
          '',
          '**Contract** — `data-reely-part="poster"`, `data-state`.',
          '',
          '**Note** — children replace the default image.'
        ].join('\n')
      }
    }
  }
} satisfies Meta<typeof Player.Poster>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No source configured: the image idles without requesting anything. */
export const Idle: Story = {
  render: () => (
    <Frame>
      <Player.Poster>
        <Player.PosterImage />
      </Player.Poster>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(posterImage(canvasElement)).toHaveAttribute(
      'data-state',
      'idle'
    );
  }
};

/**
 * The dev server holds `/__reely__/pending.png` open forever, so the image
 * stays in `loading` deterministically. In a static Storybook build the URL
 * 404s and this story falls through to the error state instead.
 */
export const Loading: Story = {
  render: () => (
    <Frame>
      <Player.Poster>
        <Player.PosterImage src="/__reely__/pending.png" />
      </Player.Poster>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await expect(posterImage(canvasElement)).toHaveAttribute(
      'data-state',
      'loading'
    );
  }
};

/** A data-URI poster resolves without any request leaving the page. */
export const Loaded: Story = {
  render: () => (
    <Frame>
      <Player.Poster>
        <Player.PosterImage src={loadedPosterSrc} />
      </Player.Poster>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(posterImage(canvasElement)).toHaveAttribute('data-state', 'loaded')
    );
  }
};

/** An unparsable data URI fails to decode without touching the network. */
export const ErrorState: Story = {
  name: 'Error',
  render: () => (
    <Frame>
      <Player.Poster>
        <Player.PosterImage src="data:image/png;base64,AAAA" />
      </Player.Poster>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(posterImage(canvasElement)).toHaveAttribute('data-state', 'error')
    );
  }
};

/** `Player.Poster` accepts arbitrary children instead of an image. */
export const CustomChild: Story = {
  render: () => (
    <Frame>
      <Player.Poster>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            color: '#e8edf4',
            fontFamily: 'system-ui, sans-serif',
            background: 'linear-gradient(135deg, #16324f, #0b0e13)'
          }}
        >
          Custom poster content
        </div>
      </Player.Poster>
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const poster = canvasElement.querySelector('[data-reely-part="poster"]');
    await expect(poster).toHaveTextContent('Custom poster content');
  }
};
