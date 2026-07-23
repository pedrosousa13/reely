import type { Meta, StoryObj } from '@storybook/react-vite';
import * as Player from '@reely/react';

const meta = {
  title: 'Player/PosterImage',
  component: Player.PosterImage
} satisfies Meta<typeof Player.PosterImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
