import type { StoryContext } from '@storybook/react-vite';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { withMockPlayer } from '../.storybook/mock-player';

// Directly exercises the tag-gate branch in `withMockPlayer`. Before this,
// the `real-playback` opt-out was only covered transitively (by CI actually
// running the real-playback stories); a typo in the tag string would slip
// past every fast unit test. Structural assertions on the returned element
// keep this in the node suite without rendering Player.Root.

const Story = () => createElement('div');

const decorate = (tags: string[]) =>
  withMockPlayer(Story, {
    tags,
    parameters: {}
  } as unknown as StoryContext);

describe('withMockPlayer tag gate', () => {
  it('renders the story bare (no mock Root wrapper) when tagged real-playback', () => {
    const element = decorate(['real-playback']);
    expect(element.type).toBe(Story);
  });

  it('wraps the story in the mock Root when not tagged real-playback', () => {
    const element = decorate([]);
    expect(element.type).not.toBe(Story);
    // The bare story is nested inside the wrapper, not returned directly.
    const children = (element.props as { children: { type: unknown } })
      .children;
    expect(children.type).toBe(Story);
  });
});
