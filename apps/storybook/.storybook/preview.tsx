import type { Preview } from '@storybook/react-vite';
import { withMockPlayer } from './mock-player';

const preview: Preview = {
  decorators: [withMockPlayer],
  tags: ['autodocs'],
  parameters: {
    a11y: {
      // Fail the Vitest story test when axe reports a violation.
      test: 'error'
    }
  }
};

export default preview;
