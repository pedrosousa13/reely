import type { ComponentProps } from 'react';
import type { Decorator } from '@storybook/react-vite';
import * as Player from '@reely/react';
import { setScenario, type MockScenario } from './mock-provider-loader';

type RootProps = Partial<Omit<ComponentProps<typeof Player.Root>, 'children'>>;

export type ReelyParameters = {
  readonly rootProps?: RootProps;
  readonly scenario?: MockScenario;
};

export const withMockController: Decorator = (Story, context) => {
  const reely = (context.parameters.reely ?? {}) as ReelyParameters;
  // Render-phase reset is safe: Root's activation work runs in effects,
  // strictly after this decorator body.
  setScenario(reely.scenario ?? { kind: 'resolve' });
  return (
    // preload="none" keeps the browser from fetching the fake source once
    // Media renders <source> children; the fake adapter never calls load().
    <Player.Root source="/media/sample.mp4" preload="none" {...reely.rootProps}>
      <Story />
    </Player.Root>
  );
};
