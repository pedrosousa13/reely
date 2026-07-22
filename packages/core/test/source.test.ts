// @vitest-environment node

import { expect, test } from 'vitest';
import {
  detectSource,
  type HlsSource,
  type VideoFileSource,
  type VimeoSource,
  type YouTubeSource
} from '../src/index';

const expectDetected = (input: unknown) => {
  const result = detectSource(input);
  expect(result.status).toBe('success');
  if (result.status === 'failure') throw new Error(result.guidance);
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

test('rejects signed, extensionless, and unknown URLs with explicit-object guidance', () => {
  for (const input of [
    'https://cdn.example.com/video?signature=abc',
    'https://cdn.example.com/video',
    'https://example.com/movie.avi'
  ]) {
    const result = detectSource(input);
    expect(result).toMatchObject({
      status: 'failure',
      input,
      reason: 'unsupported-string'
    });
    if (result.status === 'failure') {
      expect(result.guidance).toMatch(/explicit source object/i);
    }
  }
});

test('rejects malformed strings and invalid explicit objects', () => {
  for (const input of [
    '',
    'https://www.youtube.com/watch',
    'https://player.vimeo.com/video/not-a-number',
    { type: 'video', sources: [] },
    { type: 'video', sources: [{ src: '', mimeType: 'video/mp4' }] },
    { type: 'hls', src: '', engine: 'native' },
    { type: 'hls', src: '/master.m3u8', engine: 'other' },
    { type: 'youtube', videoId: '' },
    { type: 'vimeo', videoId: '123', hash: '' }
  ]) {
    const result = detectSource(input);
    expect(result.status).toBe('failure');
    if (result.status === 'failure') {
      expect(['malformed-string', 'invalid-source']).toContain(result.reason);
      expect(result.guidance).toMatch(/explicit source object/i);
    }
  }
});

test('imports and runs source detection in Node without browser globals', () => {
  expect(expectDetected('/server-rendered.mp4').source.type).toBe('video');
});
