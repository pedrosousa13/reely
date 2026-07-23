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

const meta = {
  title: 'Player/LoadingIndicator',
  component: Player.LoadingIndicator,
  render: () => (
    <Player.Viewport style={viewportStyle}>
      <Player.Media />
      <Player.LoadingIndicator />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.LoadingIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

// `loading="eager"` + a pending scenario holds `loading-provider` with no
// interaction needed.
export const LoadingProviderState: Story = {
  parameters: {
    reely: { rootProps: { loading: 'eager' }, scenario: { kind: 'pending' } }
  },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('status')).toHaveAttribute(
        'data-state',
        'loading-provider'
      );
    });
  }
};

// Resolve, then a scripted buffering patch after the provider is ready.
//
// The fake provider never emits its own `ready` transition (unlike the real
// native provider, which derives it from media events), so the scenario
// scripts it explicitly before the buffering patch — matching the
// `fake.emit({ activation: 'ready', lifecycle: 'ready' })` pattern used by
// packages/react/test/activation.test.tsx.
export const BufferingState: Story = {
  parameters: {
    reely: {
      rootProps: { loading: 'eager' },
      scenario: {
        kind: 'resolve',
        patches: [
          { activation: 'ready', lifecycle: 'ready' },
          { buffering: true }
        ]
      }
    }
  },
  play: async ({ canvasElement }) => {
    await waitFor(async () => {
      await expect(within(canvasElement).getByRole('status')).toHaveAttribute(
        'data-state',
        'buffering'
      );
    });
  }
};
