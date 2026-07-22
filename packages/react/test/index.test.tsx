import * as process from 'node:process';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import * as Player from '../src/index';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('keeps confirmed paused state when the media play command rejects', async () => {
  const unhandledRejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown): void => {
    unhandledRejections.push(reason);
  };
  process.on('unhandledRejection', onUnhandledRejection);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(
    new DOMException('Playback was blocked.', 'NotAllowedError')
  );

  try {
    render(
      <Player.Root source="video.mp4">
        <Player.Media />
        <Player.PlayButton />
      </Player.Root>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(unhandledRejections).toEqual([]);
    expect(
      screen
        .getByRole('button', { name: 'Play' })
        .getAttribute('data-playback-state')
    ).toBe('paused');
  } finally {
    process.off('unhandledRejection', onUnhandledRejection);
  }
});
