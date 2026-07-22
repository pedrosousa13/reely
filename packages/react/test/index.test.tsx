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

test('renders every explicit video source in order with its MIME type', () => {
  render(
    <Player.Root
      source={{
        type: 'video',
        sources: [
          { src: '/tracer.webm', mimeType: 'video/webm' },
          { src: '/tracer.mp4', mimeType: 'video/mp4' }
        ]
      }}
    >
      <Player.Media />
    </Player.Root>
  );

  const sources = screen
    .getByLabelText('Reely media')
    .querySelectorAll('source');
  expect(
    Array.from(sources, (source) => ({
      src: source.getAttribute('src'),
      type: source.getAttribute('type')
    }))
  ).toEqual([
    { src: '/tracer.webm', type: 'video/webm' },
    { src: '/tracer.mp4', type: 'video/mp4' }
  ]);
});

test.each([
  ['HLS', { type: 'hls' as const, src: '/master.m3u8' }],
  ['provider', { type: 'youtube' as const, videoId: 'dQw4w9WgXcQ' }],
  ['detection failure', 'source-without-extension']
])(
  'resets confirmed playing state after a transition to %s',
  (_kind, source) => {
    const player = (playerSource: '/tracer.mp4' | typeof source) => (
      <Player.Root source={playerSource}>
        <Player.Media />
        <Player.PlayButton />
      </Player.Root>
    );
    const { rerender } = render(player('/tracer.mp4'));
    const media = screen.getByLabelText('Reely media');

    fireEvent.play(media);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();

    rerender(player(source));

    expect(screen.queryByLabelText('Reely media')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Play' })
        .getAttribute('data-playback-state')
    ).toBe('paused');
  }
);
