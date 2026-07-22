// @vitest-environment node

import { expect, test } from 'vitest';
import {
  PlayerController,
  detectSource,
  type HlsSource,
  type MediaProvider,
  type PlaybackState,
  type VideoFileSource,
  type VimeoSource,
  type YouTubeSource
} from '../src/index';

const expectDetected = (input: unknown) => {
  const result = detectSource(input);
  expect(result.status).toBe('success');
  if (result.status === 'failure') throw new Error(result.guidance);
  expect(result.input).toBe(input);
  return result;
};

test('detects MP4 and WebM strings as video sources', () => {
  expect(expectDetected('/media/tracer.mp4?download=1#start').source).toEqual({
    type: 'video',
    sources: [
      { src: '/media/tracer.mp4?download=1#start', mimeType: 'video/mp4' }
    ]
  });
  expect(
    expectDetected('https://cdn.example.com/clip.webm#preview').source
  ).toEqual({
    type: 'video',
    sources: [
      {
        src: 'https://cdn.example.com/clip.webm#preview',
        mimeType: 'video/webm'
      }
    ]
  });
});

test('detects M3U8 strings as HLS sources', () => {
  expect(
    expectDetected('https://cdn.example.com/master.m3u8?token=abc#chapter')
      .source
  ).toEqual({
    type: 'hls',
    src: 'https://cdn.example.com/master.m3u8?token=abc#chapter'
  });
});

test.each([
  ['watch', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['short URL', 'https://youtu.be/dQw4w9WgXcQ'],
  ['embed', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
  ['shorts', 'https://www.youtube.com/shorts/dQw4w9WgXcQ']
])('detects YouTube %s URLs', (_form, input) => {
  expect(expectDetected(input).source).toEqual({
    type: 'youtube',
    videoId: 'dQw4w9WgXcQ'
  });
});

test.each([
  ['canonical', 'https://vimeo.com/123456789', undefined],
  ['player', 'https://player.vimeo.com/video/123456789', undefined],
  ['path hash', 'https://player.vimeo.com/video/123456789/a1b2c3', 'a1b2c3'],
  ['query hash', 'https://vimeo.com/123456789?h=a1b2c3', 'a1b2c3']
])('detects Vimeo %s URLs', (_form, input, hash) => {
  expect(expectDetected(input).source).toEqual({
    type: 'vimeo',
    videoId: '123456789',
    ...(hash ? { hash } : {})
  });
});

test('uses the query Vimeo privacy hash when both supported hash forms are present', () => {
  expect(
    expectDetected(
      'https://player.vimeo.com/video/123456789/pathhash?h=queryhash'
    ).source
  ).toEqual({ type: 'vimeo', videoId: '123456789', hash: 'queryhash' });
});

test('accepts and preserves every explicit source object', () => {
  const video: VideoFileSource = {
    type: 'video',
    sources: [
      { src: '/movie.webm', mimeType: 'video/webm' },
      { src: '/movie.mp4', mimeType: 'video/mp4' }
    ]
  };
  const hls: HlsSource = { type: 'hls', src: '/master.m3u8', engine: 'hls.js' };
  const youtube: YouTubeSource = { type: 'youtube', videoId: 'dQw4w9WgXcQ' };
  const vimeo: VimeoSource = {
    type: 'vimeo',
    videoId: '123456789',
    hash: 'a1b2c3'
  };

  for (const input of [video, hls, youtube, vimeo]) {
    const result = expectDetected(input);
    expect(result.input).toBe(input);
    expect(result.source).toEqual(input);
  }
});

test.each([
  'https://cdn.example.com/video?signature=abc',
  'https://cdn.example.com/video',
  'https://example.com/movie.avi',
  'mailto:clip.mp4',
  'ftp://host/clip.mp4',
  'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
  'https://vimeo.com.evil/123456789'
])('rejects unsupported strings with explicit-object guidance: %s', (input) => {
  const result = detectSource(input);
  expect(result).toMatchObject({
    status: 'failure',
    input,
    reason: 'unsupported-string'
  });
  if (result.status === 'failure') {
    expect(result.guidance).toMatch(/explicit source object/i);
  }
});

test.each([
  '',
  'https://www.youtube.com/watch',
  'https://www.youtube.com/watch?v=',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=another',
  'https://www.youtube.com/embed/dQw4w9WgXcQ/ignored',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ/ignored',
  'https://youtu.be/dQw4w9WgXcQ/ignored',
  'https://youtube.com//embed//abc123',
  'https://youtu.be//abc123',
  'https://www.youtube.com/embed/%zz',
  'https://player.vimeo.com/123456789',
  'https://vimeo.com/video/123456789',
  'https://vimeo.com/123456789/ignored',
  'https://vimeo.com//123456789',
  'https://player.vimeo.com/video/123456789/pathhash/ignored',
  'https://player.vimeo.com//video//123456789//privatehash',
  'https://player.vimeo.com/video/123456789/%zz'
])('rejects malformed provider strings: %s', (input) => {
  expect(detectSource(input)).toMatchObject({
    status: 'failure',
    input,
    reason: 'malformed-string'
  });
});

test.each([
  { type: 'video', sources: [] },
  { type: 'video', sources: [{ src: '', mimeType: 'video/mp4' }] },
  { type: 'hls', src: '', engine: 'native' },
  { type: 'hls', src: '/master.m3u8', engine: 'other' },
  { type: 'youtube', videoId: '' },
  { type: 'youtube', videoId: 'with space' },
  { type: 'youtube', videoId: ' abc123 ' },
  { type: 'youtube', videoId: '   ' },
  { type: 'vimeo', videoId: 'not-numeric' },
  { type: 'vimeo', videoId: ' 123 ' },
  { type: 'vimeo', videoId: '   ' },
  { type: 'vimeo', videoId: '123', hash: '' },
  { type: 'vimeo', videoId: '123', hash: '../x' },
  { type: 'vimeo', videoId: '123', hash: ' privatehash ' },
  { type: 'vimeo', videoId: '123', hash: '   ' }
])('rejects invalid explicit source objects: %o', (input) => {
  const result = detectSource(input);
  expect(result).toMatchObject({
    status: 'failure',
    input,
    reason: 'invalid-source'
  });
  if (result.status === 'failure') {
    expect(result.guidance).toMatch(/explicit source object/i);
  }
});

test.each(['https://youtube.com/embed/id.mp4', 'https://vimeo.com/123.mp4'])(
  'does not detect malformed known-provider URLs as files: %s',
  (input) => {
    expect(detectSource(input)).toMatchObject({
      status: 'failure',
      input,
      reason: 'malformed-string'
    });
  }
);

test.each(['//youtube.com/embed/id.mp4', '//vimeo.com/123.m3u8'])(
  'applies known-provider grammar to network-path references: %s',
  (input) => {
    expect(detectSource(input)).toMatchObject({
      status: 'failure',
      input,
      reason: 'malformed-string'
    });
  }
);

test('detects a generic file on an unknown network-path host', () => {
  expect(expectDetected('//cdn.example.com/video.mp4').source).toEqual({
    type: 'video',
    sources: [{ src: '//cdn.example.com/video.mp4', mimeType: 'video/mp4' }]
  });
});

test('detects a valid provider network-path reference', () => {
  expect(expectDetected('//youtu.be/abc123').source).toEqual({
    type: 'youtube',
    videoId: 'abc123'
  });
});

test.each([
  'https://player.vimeo.com/video/not-a-number',
  'https://player.vimeo.com/video/123456789/%25',
  'https://www.youtube.com/shorts/%25'
])('rejects unusable provider IDs and hashes: %s', (input) => {
  const result = detectSource(input);
  expect(result).toMatchObject({
    status: 'failure',
    input,
    reason: 'malformed-string'
  });
});

test('continues to accept ordinary relative file paths', () => {
  expect(expectDetected('media/clip.mp4').source).toEqual({
    type: 'video',
    sources: [{ src: 'media/clip.mp4', mimeType: 'video/mp4' }]
  });
});

test('imports and runs source detection in Node without browser globals', () => {
  expect(expectDetected('/server-rendered.mp4').source.type).toBe('video');
});

const createTestProvider = () => {
  let listener: ((state: PlaybackState) => void) | undefined;
  let destroyCount = 0;
  let subscribeCount = 0;
  let unsubscribeCount = 0;
  const provider: MediaProvider = {
    play: async () => undefined,
    pause: () => undefined,
    subscribe: (nextListener) => {
      subscribeCount += 1;
      listener = nextListener;
      return () => {
        unsubscribeCount += 1;
        listener = undefined;
      };
    },
    destroy: () => {
      destroyCount += 1;
    }
  };

  return {
    provider,
    emit: (state: PlaybackState) => listener?.(state),
    counts: () => ({ destroyCount, subscribeCount, unsubscribeCount })
  };
};

test('setting the same provider is a no-op', () => {
  const controller = new PlayerController();
  const testProvider = createTestProvider();
  controller.setProvider(testProvider.provider);
  testProvider.emit('playing');

  controller.setProvider(testProvider.provider);

  expect(controller.getState()).toBe('playing');
  expect(testProvider.counts()).toEqual({
    destroyCount: 0,
    subscribeCount: 1,
    unsubscribeCount: 0
  });
});

test('replacing a provider cleans up the old provider and resets state', () => {
  const controller = new PlayerController();
  const firstProvider = createTestProvider();
  const secondProvider = createTestProvider();
  controller.setProvider(firstProvider.provider);
  firstProvider.emit('playing');

  controller.setProvider(secondProvider.provider);

  expect(controller.getState()).toBe('paused');
  expect(firstProvider.counts()).toEqual({
    destroyCount: 1,
    subscribeCount: 1,
    unsubscribeCount: 1
  });
  expect(secondProvider.counts()).toEqual({
    destroyCount: 0,
    subscribeCount: 1,
    unsubscribeCount: 0
  });
});

test('removing a provider cleans it up and resets state', () => {
  const controller = new PlayerController();
  const testProvider = createTestProvider();
  controller.setProvider(testProvider.provider);
  testProvider.emit('playing');

  controller.setProvider(undefined);

  expect(controller.getState()).toBe('paused');
  expect(testProvider.counts()).toEqual({
    destroyCount: 1,
    subscribeCount: 1,
    unsubscribeCount: 1
  });
});
