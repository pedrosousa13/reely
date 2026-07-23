import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { available, notReady, ready } from './support';

const meta = {
  title: 'Player/PipButton',
  component: Player.PipButton,
  render: () => (
    <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
      <Player.PipButton />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.PipButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  parameters: ready(
    { pictureInPicture: available },
    { pictureInPicture: false }
  ),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {
      name: 'Enter picture-in-picture'
    });
    await expect(button).toHaveAttribute('data-state', 'inline');
  }
};

export const Active: Story = {
  parameters: ready(
    { pictureInPicture: available },
    { pictureInPicture: true }
  ),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {
      name: 'Exit picture-in-picture'
    });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
};

/** Focus behavior: keyboard reaches the button. */
export const KeyboardFocusable: Story = {
  parameters: ready(
    { pictureInPicture: available },
    { pictureInPicture: false }
  ),
  play: async ({ canvas, userEvent }) => {
    const button = await canvas.findByRole('button', {
      name: 'Enter picture-in-picture'
    });
    await userEvent.tab();
    await expect(button).toHaveFocus();
  }
};

/** Capability absent: the button stays out of the DOM until it resolves. */
export const CapabilityAbsent: Story = {
  parameters: ready({ pictureInPicture: notReady }),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
  }
};
