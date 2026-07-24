import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

// Scans real-playback story source files: any story module tagged
// 'real-playback' must also be tagged '!test' so it never enters the
// zero-network addon-vitest suite. Source-level scan keeps this runnable in
// the root (node) suite without importing story runtimes.
const storyFiles = ['real-playback.stories.tsx', 'player-fixture.stories.tsx'];

const readIfPresent = (name: string): string | null => {
  try {
    return readFileSync(
      fileURLToPath(new URL(`./${name}`, import.meta.url)),
      'utf8'
    );
  } catch {
    return null;
  }
};

describe('real-playback stories opt out of the deterministic suite', () => {
  it('every real-playback story file that exists also declares the !test tag', () => {
    for (const name of storyFiles) {
      const src = readIfPresent(name);
      if (src === null) continue; // not created yet — later tasks add them
      if (!src.includes("'real-playback'")) continue;
      expect(
        src.includes("'!test'"),
        `${name} tags 'real-playback' but is missing '!test'`
      ).toBe(true);
    }
  });
});
