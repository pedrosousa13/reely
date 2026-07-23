import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { available, notReady, unavailable, ready } from './support';

const meta = {
  title: 'Player/FullscreenButton',
  component: Player.FullscreenButton,
  render: () => (
    <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
      <Player.FullscreenButton />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.FullscreenButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  parameters: ready({ fullscreen: available }, { fullscreen: false }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {
      name: 'Enter fullscreen'
    });
    await expect(button).toHaveAttribute('data-state', 'inline');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  }
};

export const Active: Story = {
  parameters: ready({ fullscreen: available }, { fullscreen: true }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {
      name: 'Exit fullscreen'
    });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
};

/** Focus behavior: keyboard reaches the button. */
export const KeyboardFocusable: Story = {
  parameters: ready({ fullscreen: available }, { fullscreen: false }),
  play: async ({ canvas, userEvent }) => {
    const button = await canvas.findByRole('button', {
      name: 'Enter fullscreen'
    });
    await userEvent.tab();
    await expect(button).toHaveFocus();
  }
};

/**
 * Capability absent: the button stays out of the DOM until the platform
 * resolves fullscreen support — no disabled-but-visible flash-in.
 */
export const CapabilityUnknown: Story = {
  parameters: ready({ fullscreen: notReady }),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
  }
};

export const CapabilityUnavailable: Story = {
  parameters: ready({ fullscreen: unavailable }),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
  }
};
