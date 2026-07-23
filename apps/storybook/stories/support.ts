import type {
  Availability,
  PlayerCapabilities,
  ProviderStatePatch
} from '@reely/core';
import type { MockPlayerParameters } from '../.storybook/mock-player';

export const available: Availability = { status: 'available' };
export const notReady: Availability = {
  status: 'unknown',
  reason: 'not-ready'
};
export const unavailable: Availability = {
  status: 'unavailable',
  reason: 'provider'
};

const baseCapabilities: PlayerCapabilities = {
  seek: notReady,
  setVolume: notReady,
  setPlaybackRate: notReady,
  selectQuality: notReady,
  selectTextTrack: notReady,
  fullscreen: notReady,
  pictureInPicture: notReady,
  airPlay: notReady,
  customControls: notReady
};

/**
 * A ready player-state patch with the given capability overrides. Everything
 * unspecified stays `unknown`, which is what capability-absent stories rely on
 * to prove a control renders nothing until its capability resolves.
 */
export const ready = (
  overrides: Partial<PlayerCapabilities> = {},
  patch: ProviderStatePatch = {}
): { player: MockPlayerParameters } => ({
  player: {
    state: {
      lifecycle: 'ready',
      activation: 'ready',
      provider: 'native',
      capabilities: { ...baseCapabilities, ...overrides },
      ...patch
    }
  }
});
