import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';

const meta = {
  title: 'Player/LoadingIndicator',
  component: Player.LoadingIndicator,
  render: () => (
    <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
      <Player.LoadingIndicator
        style={{
          display: 'grid',
          placeItems: 'center',
          color: '#e8edf4',
          fontFamily: 'system-ui, sans-serif'
        }}
      />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.LoadingIndicator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoadingProvider: Story = {
  parameters: {
    player: {
      state: { activation: 'loading-provider', lifecycle: 'loading' }
    }
  },
  play: async ({ canvas }) => {
    const indicator = await canvas.findByRole('status');
    await waitFor(() =>
      expect(indicator).toHaveAttribute('data-state', 'loading-provider')
    );
  }
};

export const Buffering: Story = {
  parameters: {
    player: {
      state: {
        activation: 'ready',
        lifecycle: 'ready',
        playback: 'playing',
        buffering: true
      }
    }
  },
  play: async ({ canvas }) => {
    const indicator = await canvas.findByRole('status');
    await waitFor(() =>
      expect(indicator).toHaveAttribute('data-state', 'buffering')
    );
  }
};
