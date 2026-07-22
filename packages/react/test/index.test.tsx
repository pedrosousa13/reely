// @vitest-environment happy-dom

import * as process from 'node:process';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import * as Player from '../src/index';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const verifyReadonlyStateTypes = (
  state: ReturnType<Player.PlayerHandle['getState']>
): void => {
  // @ts-expect-error PlayerState snapshots are readonly.
  state.volume = 0;
  // @ts-expect-error Nested capabilities are readonly.
  state.capabilities.seek.status = 'available';
  // @ts-expect-error Nested time ranges are readonly.
  state.buffered[0]!.end = 10;
};

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

test('exposes stable actions and a ref handle backed by the Root controller', () => {
  const handle = createRef<Player.PlayerHandle>();
  const actionReferences: Player.PlayerActions[] = [];
  const Probe = () => {
    actionReferences.push(Player.usePlayerActions());
    Player.usePlayerState((state) => state.playback);
    return null;
  };
  const player = () => (
    <Player.Root ref={handle} source="/tracer.mp4">
      <Player.Media />
      <Probe />
    </Player.Root>
  );
  const { rerender } = render(player());

  rerender(player());

  expect(actionReferences).toHaveLength(2);
  expect(actionReferences[0]).toBe(actionReferences[1]);
  expect(actionReferences[0]?.play).toBe(handle.current?.play);
  expect(handle.current?.getState().playback).toBe('paused');
  expect(handle.current).toMatchObject({
    getState: expect.any(Function),
    play: expect.any(Function)
  });
  handle.current?.on('volumechange', (event) => {
    expect(event.detail.volume).toBeTypeOf('number');
  });
  expect(verifyReadonlyStateTypes).toBeTypeOf('function');
});

test('throws a clear error when player hooks are used outside Root', () => {
  const Probe = () => {
    Player.usePlayerState((state) => state.playback);
    return null;
  };

  expect(() => render(<Probe />)).toThrow(/inside Player.Root/i);
});

test('reads the same controller state through PlayerHandle and usePlayerState', () => {
  const handle = createRef<Player.PlayerHandle>();
  let selectedPlayback = 'unobserved';
  const Probe = () => {
    selectedPlayback = Player.usePlayerState((state) => state.playback);
    return null;
  };
  render(
    <Player.Root ref={handle} source="/tracer.mp4">
      <Player.Media />
      <Probe />
    </Player.Root>
  );

  fireEvent.play(screen.getByLabelText('Reely media'));

  expect(selectedPlayback).toBe('playing');
  expect(handle.current?.getState().playback).toBe('playing');
});

test('does not rerender a selector when an unrelated confirmed state changes', () => {
  let renders = 0;
  const Volume = () => {
    Player.usePlayerState((state) => state.volume);
    renders += 1;
    return null;
  };

  render(
    <Player.Root source="/tracer.mp4">
      <Player.Media />
      <Volume />
    </Player.Root>
  );
  const initialRenders = renders;

  fireEvent.play(screen.getByLabelText('Reely media'));

  expect(renders).toBe(initialRenders);
});

test('caches an object selector and isolates it from unrelated state changes', () => {
  let renders = 0;
  const Volume = () => {
    const selection = Player.usePlayerState((state) => ({
      volume: state.volume
    }));
    renders += 1;
    return <output>{selection.volume}</output>;
  };

  render(
    <Player.Root source="/tracer.mp4">
      <Player.Media />
      <Volume />
    </Player.Root>
  );
  const initialRenders = renders;

  fireEvent.play(screen.getByLabelText('Reely media'));

  expect(screen.getByText('1')).toBeDefined();
  expect(renders).toBe(initialRenders);
});

test('throws a clear error when usePlayerActions is used outside Root', () => {
  const Probe = () => {
    Player.usePlayerActions();
    return null;
  };

  expect(() => render(<Probe />)).toThrow(/inside Player.Root/i);
});

test('passes loop and playback boundaries from Root to the native adapter', async () => {
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  render(
    <Player.Root loop startTime={3} endTime={6} source="/tracer.mp4">
      <Player.Media />
    </Player.Root>
  );
  const media = screen.getByLabelText<HTMLVideoElement>('Reely media');

  fireEvent.loadedMetadata(media);
  expect(media.currentTime).toBe(3);

  media.currentTime = 6;
  fireEvent.timeUpdate(media);
  await Promise.resolve();
  expect(media.currentTime).toBe(3);
  expect(play).toHaveBeenCalledOnce();
});

test('destroys the previous native adapter and ignores its stale events on source switch', async () => {
  const removeEventListener = vi.spyOn(
    HTMLMediaElement.prototype,
    'removeEventListener'
  );
  const player = (source: string) => (
    <Player.Root source={source}>
      <Player.Media />
      <Player.PlayButton />
    </Player.Root>
  );
  const { rerender } = render(player('/first.mp4'));
  const previousMedia = screen.getByLabelText('Reely media');

  rerender(player('/second.mp4'));
  expect(removeEventListener).toHaveBeenCalledWith(
    'play',
    expect.any(Function)
  );
  await Promise.resolve();
  const currentMedia = screen.getByLabelText('Reely media');
  expect(currentMedia).not.toBe(previousMedia);

  fireEvent.play(previousMedia);
  expect(screen.getByRole('button', { name: 'Play' })).toBeDefined();

  fireEvent.play(currentMedia);
  expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
});
