import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ready } from './support';

const meta = {
  title: 'Player/PlayButton',
  component: Player.PlayButton,
  render: () => (
    <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
      <Player.PlayButton />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.PlayButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Paused: Story = {
  parameters: ready({}, { playback: 'paused' }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Play' });
    await expect(button).toHaveAttribute('data-state', 'paused');
    await expect(button.tagName).toBe('BUTTON');
  }
};

export const Playing: Story = {
  parameters: ready({}, { playback: 'playing' }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Pause' });
    await expect(button).toHaveAttribute('data-state', 'playing');
  }
};

/** Focus behavior: the native button is reachable by keyboard. */
export const KeyboardFocusable: Story = {
  parameters: ready({}, { playback: 'paused' }),
  play: async ({ canvas, userEvent }) => {
    const button = await canvas.findByRole('button', { name: 'Play' });
    await userEvent.tab();
    await expect(button).toHaveFocus();
  }
};
