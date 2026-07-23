import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import * as Player from '@reely/react';

const viewportStyle = { width: 320, height: 180 } as const;

const meta = {
  title: 'Player/ActivationButton',
  component: Player.ActivationButton,
  parameters: {
    reely: { rootProps: { loading: 'interaction' } }
  },
  render: () => (
    <Player.Viewport style={viewportStyle}>
      <Player.Media />
      <Player.ActivationButton />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.ActivationButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dormant: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Play video'
    });
    await expect(button).toHaveAttribute('data-state', 'dormant');
  }
};

export const Eligible: Story = {
  // Media omitted: with no media mount the loader never starts, so
  // activation holds at `eligible` deterministically after the click.
  render: () => (
    <Player.Viewport style={viewportStyle}>
      <Player.ActivationButton />
    </Player.Viewport>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Play video' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('button')).toHaveAttribute(
        'data-state',
        'eligible'
      );
    });
  }
};

export const LoadingProvider: Story = {
  parameters: {
    reely: {
      rootProps: { loading: 'interaction' },
      scenario: { kind: 'pending' }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Play video' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('button')).toHaveAttribute(
        'data-state',
        'loading-provider'
      );
    });
    await expect(canvas.getByRole('button')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  }
};

export const ErrorState: Story = {
  parameters: {
    reely: {
      rootProps: { loading: 'interaction' },
      scenario: { kind: 'reject' }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Play video' }));
    await waitFor(async () => {
      await expect(
        canvas.getByRole('button', { name: 'Retry loading video' })
      ).toHaveAttribute('data-state', 'error');
    });
  }
};

/**
 * Reference play-function interaction pattern for later issues:
 * arrange via `parameters.reely`, act with `userEvent`, assert the
 * state transition on the part's `data-state` attribute.
 */
export const ActivatesOnClick: Story = {
  parameters: {
    reely: {
      rootProps: { loading: 'interaction' },
      scenario: { kind: 'pending' }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Play video' });
    await expect(button).toHaveAttribute('data-state', 'dormant');
    await userEvent.click(button);
    await waitFor(async () => {
      await expect(canvas.getByRole('button')).toHaveAttribute(
        'data-state',
        'loading-provider'
      );
    });
  }
};
