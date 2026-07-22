// @vitest-environment happy-dom

import * as process from 'node:process';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
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

const confirmMetadataReady = (media: HTMLVideoElement): void => {
  Object.defineProperty(HTMLMediaElement, 'HAVE_METADATA', {
    configurable: true,
    value: 1
  });
  Object.defineProperty(media, 'readyState', {
    configurable: true,
    value: 1
  });
  fireEvent.loadedMetadata(media);
};

test('exposes playback preferences without accepting a playing prop', () => {
  const onMutedChange = vi.fn();
  const onVolumeChange = vi.fn();
  const onPlaybackRateChange = vi.fn();
  const invalidRoot = (
    // @ts-expect-error Playback is confirmed state, not a controlled Root prop.
    <Player.Root playing source="/tracer.mp4">
      <Player.Media />
    </Player.Root>
  );

  render(
    <Player.Root
      defaultMuted
      defaultPlaybackRate={1.5}
      defaultVolume={0.4}
      onMutedChange={onMutedChange}
      onPlaybackRateChange={onPlaybackRateChange}
      onVolumeChange={onVolumeChange}
      source="/tracer.mp4"
    >
      <Player.Media />
    </Player.Root>
  );

  const media = screen.getByLabelText<HTMLVideoElement>('Reely media');
  expect(media.muted).toBe(true);
  expect(media.volume).toBe(0.4);
  expect(media.playbackRate).toBe(1.5);
  expect(onMutedChange).not.toHaveBeenCalled();
  expect(onVolumeChange).not.toHaveBeenCalled();
  expect(onPlaybackRateChange).not.toHaveBeenCalled();
  expect(invalidRoot).toBeDefined();
});

test('seeds default preferences once and retains confirmed values across media replacement', () => {
  const player = (
    source: string,
    defaults: { muted: boolean; volume: number; playbackRate: number }
  ) => (
    <Player.Root
      defaultMuted={defaults.muted}
      defaultPlaybackRate={defaults.playbackRate}
      defaultVolume={defaults.volume}
      source={source}
    >
      <Player.Media />
    </Player.Root>
  );
  const { rerender } = render(
    player('/first.mp4', { muted: true, volume: 0.4, playbackRate: 1.5 })
  );
  const firstMedia = screen.getByLabelText<HTMLVideoElement>('Reely media');

  rerender(
    player('/first.mp4', { muted: false, volume: 0.8, playbackRate: 2 })
  );
  expect(firstMedia.muted).toBe(true);
  expect(firstMedia.volume).toBe(0.4);
  expect(firstMedia.playbackRate).toBe(1.5);

  firstMedia.muted = false;
  firstMedia.volume = 0.6;
  firstMedia.playbackRate = 1.25;
  fireEvent.volumeChange(firstMedia);
  fireEvent.rateChange(firstMedia);
  rerender(
    player('/second.mp4', { muted: false, volume: 0.8, playbackRate: 2 })
  );

  const replacement = screen.getByLabelText<HTMLVideoElement>('Reely media');
  expect(replacement).not.toBe(firstMedia);
  expect(replacement.muted).toBe(false);
  expect(replacement.volume).toBe(0.6);
  expect(replacement.playbackRate).toBe(1.25);
});

test('reconciles controlled preferences without reporting prop-driven confirmations', () => {
  const onMutedChange = vi.fn();
  const onVolumeChange = vi.fn();
  const onPlaybackRateChange = vi.fn();
  const player = (muted: boolean, volume: number, playbackRate: number) => (
    <Player.Root
      muted={muted}
      onMutedChange={onMutedChange}
      onPlaybackRateChange={onPlaybackRateChange}
      onVolumeChange={onVolumeChange}
      playbackRate={playbackRate}
      source="/tracer.mp4"
      volume={volume}
    >
      <Player.Media />
    </Player.Root>
  );
  const { rerender } = render(player(false, 0.7, 1.25));
  const media = screen.getByLabelText<HTMLVideoElement>('Reely media');

  rerender(player(true, 0.3, 1.75));
  expect(media.muted).toBe(true);
  expect(media.volume).toBe(0.3);
  expect(media.playbackRate).toBe(1.75);
  fireEvent.volumeChange(media);
  fireEvent.rateChange(media);

  expect(onMutedChange).not.toHaveBeenCalled();
  expect(onVolumeChange).not.toHaveBeenCalled();
  expect(onPlaybackRateChange).not.toHaveBeenCalled();
});

test('reports confirmed controlled conflicts before restoring controlled values', () => {
  const mediaAtMutedCallback: boolean[] = [];
  const mediaAtVolumeCallback: number[] = [];
  const mediaAtRateCallback: number[] = [];
  const onMutedChange = vi.fn((value: boolean) => {
    const confirmed = screen.getByLabelText<HTMLVideoElement>('Reely media');
    mediaAtMutedCallback.push(confirmed.muted);
    expect(value).toBe(confirmed.muted);
  });
  const onVolumeChange = vi.fn((value: number) => {
    const confirmed = screen.getByLabelText<HTMLVideoElement>('Reely media');
    mediaAtVolumeCallback.push(confirmed.volume);
    expect(value).toBe(confirmed.volume);
  });
  const onPlaybackRateChange = vi.fn((value: number) => {
    const confirmed = screen.getByLabelText<HTMLVideoElement>('Reely media');
    mediaAtRateCallback.push(confirmed.playbackRate);
    expect(value).toBe(confirmed.playbackRate);
  });
  render(
    <Player.Root
      muted={false}
      onMutedChange={onMutedChange}
      onPlaybackRateChange={onPlaybackRateChange}
      onVolumeChange={onVolumeChange}
      playbackRate={1.25}
      source="/tracer.mp4"
      volume={0.7}
    >
      <Player.Media />
    </Player.Root>
  );
  const media = screen.getByLabelText<HTMLVideoElement>('Reely media');

  media.muted = true;
  media.volume = 0.2;
  fireEvent.volumeChange(media);
  media.playbackRate = 2;
  fireEvent.rateChange(media);

  expect(onMutedChange).toHaveBeenCalledExactlyOnceWith(true);
  expect(onVolumeChange).toHaveBeenCalledExactlyOnceWith(0.2);
  expect(onPlaybackRateChange).toHaveBeenCalledExactlyOnceWith(2);
  expect(mediaAtMutedCallback).toEqual([true]);
  expect(mediaAtVolumeCallback).toEqual([0.2]);
  expect(mediaAtRateCallback).toEqual([2]);
  expect(media.muted).toBe(false);
  expect(media.volume).toBe(0.7);
  expect(media.playbackRate).toBe(1.25);

  fireEvent.volumeChange(media);
  fireEvent.rateChange(media);
  expect(onMutedChange).toHaveBeenCalledTimes(1);
  expect(onVolumeChange).toHaveBeenCalledTimes(1);
  expect(onPlaybackRateChange).toHaveBeenCalledTimes(1);
});

test('keeps autoplay disabled by default', () => {
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  render(
    <Player.Root source="/tracer.mp4">
      <Player.Media />
      <Player.PlayButton />
    </Player.Root>
  );

  confirmMetadataReady(screen.getByLabelText('Reely media'));

  expect(play).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Play' }).dataset.autoplayState
  ).toBe('idle');
});

test('mutes before autoplay and reports attempting then confirmed started', async () => {
  const observedMutedAtPlay: boolean[] = [];
  const onMutedChange = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement
  ) {
    observedMutedAtPlay.push(this.muted);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  render(
    <Player.Root
      autoplay="muted"
      onMutedChange={onMutedChange}
      source="/tracer.mp4"
    >
      <Player.Media />
      <Player.PlayButton />
    </Player.Root>
  );
  const media = screen.getByLabelText<HTMLVideoElement>('Reely media');

  confirmMetadataReady(media);
  expect(screen.getByRole('button').dataset.autoplayState).toBe('attempting');
  fireEvent.volumeChange(media);

  await waitFor(() =>
    expect(screen.getByRole('button').dataset.autoplayState).toBe('started')
  );
  expect(observedMutedAtPlay).toEqual([true]);
  expect(onMutedChange).toHaveBeenCalledExactlyOnceWith(true);
});

test('attempts audible autoplay without muting', async () => {
  const mediaMutedAtPlay: boolean[] = [];
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement
  ) {
    mediaMutedAtPlay.push(this.muted);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  render(
    <Player.Root autoplay="audible" source="/tracer.mp4">
      <Player.Media />
      <Player.PlayButton />
    </Player.Root>
  );

  confirmMetadataReady(screen.getByLabelText('Reely media'));

  await waitFor(() =>
    expect(screen.getByRole('button').dataset.autoplayState).toBe('started')
  );
  expect(mediaMutedAtPlay).toEqual([false]);
});

test.each([
  ['blocked', new DOMException('Playback blocked.', 'NotAllowedError')],
  ['failed', new Error('Playback failed.')]
])('reports %s autoplay attempts', async (state, error) => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(error);
  render(
    <Player.Root autoplay="audible" source="/tracer.mp4">
      <Player.Media />
      <Player.PlayButton />
    </Player.Root>
  );

  confirmMetadataReady(screen.getByLabelText('Reely media'));

  await waitFor(() =>
    expect(screen.getByRole('button').dataset.autoplayState).toBe(state)
  );
});

test('keeps blocked autoplay focusable and retries only from a user-origin click', async () => {
  const origins: string[] = [];
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockRejectedValueOnce(
      new DOMException('Playback blocked.', 'NotAllowedError')
    )
    .mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
  const handle = createRef<Player.PlayerHandle>();
  render(
    <Player.Root autoplay="audible" ref={handle} source="/tracer.mp4">
      <Player.Media />
      <Player.PlayButton />
    </Player.Root>
  );
  handle.current?.on('play', (event) => origins.push(event.origin));
  confirmMetadataReady(screen.getByLabelText('Reely media'));
  await waitFor(() =>
    expect(screen.getByRole('button').dataset.autoplayState).toBe('blocked')
  );

  const button = screen.getByRole('button', { name: 'Play' });
  expect(button.tabIndex).toBe(0);
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.click(button);

  await waitFor(() => expect(origins).toEqual(['user']));
  expect(play).toHaveBeenCalledTimes(2);
});

test('reports the controlled-unmuted conflict without trying muted autoplay', () => {
  const play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  const handle = createRef<Player.PlayerHandle>();
  render(
    <Player.Root
      autoplay="muted"
      muted={false}
      ref={handle}
      source="/tracer.mp4"
    >
      <Player.Media />
      <Player.PlayButton />
    </Player.Root>
  );

  confirmMetadataReady(screen.getByLabelText('Reely media'));

  expect(screen.getByRole('button').dataset.autoplayState).toBe('failed');
  expect(handle.current?.getState().error?.category).toBe('configuration');
  expect(play).not.toHaveBeenCalled();
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

test('observes changes to enumerable symbol-key selector values', () => {
  const volume = Symbol('volume');
  const Volume = () => {
    const selection = Player.usePlayerState((state) => ({
      [volume]: state.volume
    }));
    return <output>{selection[volume]}</output>;
  };
  render(
    <Player.Root source="/tracer.mp4">
      <Player.Media />
      <Volume />
    </Player.Root>
  );
  const media = screen.getByLabelText<HTMLVideoElement>('Reely media');
  media.volume = 0.4;

  fireEvent.volumeChange(media);

  expect(screen.getByText('0.4')).toBeDefined();
});

test('reevaluates a changed selector when controller state is unchanged', () => {
  const Selection = ({ selectPlayback }: { selectPlayback: boolean }) => {
    const selected = Player.usePlayerState((state) =>
      selectPlayback ? state.playback : state.volume
    );
    return <output>{selected}</output>;
  };
  const player = (selectPlayback: boolean) => (
    <Player.Root source="/tracer.mp4">
      <Selection selectPlayback={selectPlayback} />
    </Player.Root>
  );
  const { rerender } = render(player(false));
  expect(screen.getByText('1')).toBeDefined();

  rerender(player(true));

  expect(screen.getByText('paused')).toBeDefined();
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
