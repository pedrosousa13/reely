import * as Player from '@reely/react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ready } from './support';

const meta = {
  title: 'Player/Time',
  component: Player.Time,
  render: (args) => (
    <Player.Viewport style={{ width: 480, height: 270, background: '#0b0e13' }}>
      <Player.Time
        {...args}
        style={{ color: '#e8edf4', fontFamily: 'system-ui, sans-serif' }}
      />
    </Player.Viewport>
  )
} satisfies Meta<typeof Player.Time>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Current: Story = {
  args: { type: 'current' },
  parameters: ready({}, { currentTime: 75, duration: 100 }),
  play: async ({ canvas }) => {
    const time = await canvas.findByText('1:15');
    await expect(time).toHaveAttribute('data-time-type', 'current');
    await expect(time.tagName).toBe('TIME');
  }
};

export const Duration: Story = {
  args: { type: 'duration' },
  parameters: ready({}, { currentTime: 10, duration: 3725 }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('1:02:05')).toBeInTheDocument();
  }
};

export const Remaining: Story = {
  args: { type: 'remaining' },
  parameters: ready({}, { currentTime: 30, duration: 100 }),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('-1:10')).toBeInTheDocument();
  }
};
