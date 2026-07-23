import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { available, notReady, ready } from './support';

const meta = {
  title: 'Player/VolumeSlider',
  component: Player.VolumeSlider,
  render: () => (
    <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
      <Player.VolumeSlider />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.VolumeSlider>;

export default meta;

type Story = StoryObj<typeof meta>;

export const HalfVolume: Story = {
  parameters: ready({ setVolume: available }, { volume: 0.5, muted: false }),
  play: async ({ canvas }) => {
    const slider = await canvas.findByRole('slider', { name: 'Volume' });
    await expect(slider).toHaveAttribute('aria-valuetext', '50%');
    await expect(slider).toHaveAttribute('min', '0');
    await expect(slider).toHaveAttribute('max', '1');
  }
};

export const Muted: Story = {
  parameters: ready({ setVolume: available }, { volume: 0.7, muted: true }),
  play: async ({ canvas }) => {
    const slider = await canvas.findByRole('slider', { name: 'Volume' });
    await expect(slider).toHaveAttribute('aria-valuetext', '0%');
  }
};

/** Focus behavior: the native slider is keyboard-reachable. */
export const KeyboardFocusable: Story = {
  parameters: ready({ setVolume: available }, { volume: 0.5 }),
  play: async ({ canvas, userEvent }) => {
    const slider = await canvas.findByRole('slider', { name: 'Volume' });
    await userEvent.tab();
    await expect(slider).toHaveFocus();
  }
};

/** Capability absent: an unresolved volume capability renders nothing. */
export const CapabilityAbsent: Story = {
  parameters: ready({ setVolume: notReady }),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('slider')).toBeNull();
  }
};
