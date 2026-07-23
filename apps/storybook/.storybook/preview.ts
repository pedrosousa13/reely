import type { Preview } from '@storybook/react-vite';
import { withMockController } from '../src/with-mock-controller';

const preview: Preview = {
  decorators: [withMockController],
  parameters: {
    a11y: { test: 'error' }
  }
};

export default preview;
