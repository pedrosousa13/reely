import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import type { MockPlayerParameters } from '../.storybook/mock-player';

const overlayState = (
  state: MockPlayerParameters['state']
): { player: MockPlayerParameters } => ({ player: { state } });

const meta = {
  title: 'Player/ActivationButton',
  component: Player.ActivationButton,
  parameters: {
    docs: {
      description: {
        component: [
          '`Player.ActivationButton` triggers pre-provider activation (`dormant`/`eligible`/`loading-provider`/`error`).',
          '',
          '**Contract** — `data-reely-part="activation"`, `data-state="<activation>"`.',
          '',
          '**Accessibility** — native `<button>`, keyboard-operable.'
        ].join('\n')
      }
    }
  },
  render: () => (
    <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
      <Player.ActivationButton />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.ActivationButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Dormant: Story = {
  parameters: overlayState({ activation: 'dormant', lifecycle: 'idle' }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Play video' });
    await waitFor(() =>
      expect(button).toHaveAttribute('data-state', 'dormant')
    );
  }
};

export const Eligible: Story = {
  parameters: overlayState({ activation: 'eligible', lifecycle: 'idle' }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Play video' });
    await waitFor(() =>
      expect(button).toHaveAttribute('data-state', 'eligible')
    );
  }
};

export const LoadingProvider: Story = {
  parameters: overlayState({
    activation: 'loading-provider',
    lifecycle: 'loading'
  }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', { name: 'Play video' });
    await waitFor(() =>
      expect(button).toHaveAttribute('data-state', 'loading-provider')
    );
    await expect(button).toHaveAttribute('aria-disabled', 'true');
  }
};

export const ErrorState: Story = {
  name: 'Error',
  parameters: overlayState({
    activation: 'error',
    lifecycle: 'error',
    error: {
      category: 'provider',
      fatal: false,
      recoverable: true,
      message: 'Unable to load the player provider.'
    }
  }),
  play: async ({ canvas }) => {
    const button = await canvas.findByRole('button', {
      name: 'Retry loading video'
    });
    await waitFor(() => expect(button).toHaveAttribute('data-state', 'error'));
  }
};

/**
 * Reference `play`-function interaction test: clicking the overlay moves the
 * pristine player from `dormant` to `eligible`. No `Player.Media` is
 * rendered, so activation never proceeds to a provider load.
 */
export const ActivatesOnClick: Story = {
  play: async ({ canvas, userEvent }) => {
    const button = await canvas.findByRole('button', { name: 'Play video' });
    await expect(button).toHaveAttribute('data-state', 'dormant');
    await userEvent.click(button);
    await waitFor(() =>
      expect(button).toHaveAttribute('data-state', 'eligible')
    );
  }
};
