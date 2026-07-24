import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Scans real-playback story source files: any story module tagged
// 'real-playback' must also be tagged '!test' so it never enters the
// zero-network addon-vitest suite. Source-level scan keeps this runnable in
// the root (node) suite without importing story runtimes. The file list is
// globbed (not hardcoded) so a newly added real-playback story can't slip
// past this check by being forgotten here.
const storiesDir = dirname(fileURLToPath(import.meta.url));

const read = (name: string): string =>
  readFileSync(join(storiesDir, name), 'utf8');

const realPlaybackStoryFiles = readdirSync(storiesDir)
  .filter((name) => name.endsWith('.stories.tsx'))
  .filter((name) => read(name).includes("'real-playback'"));

describe('real-playback stories opt out of the deterministic suite', () => {
  it('discovers at least one real-playback story file', () => {
    // Guards against a vacuous pass if the glob or tag string ever breaks.
    expect(realPlaybackStoryFiles.length).toBeGreaterThan(0);
  });

  it('every real-playback story file also declares the !test tag', () => {
    for (const name of realPlaybackStoryFiles) {
      expect(
        read(name).includes("'!test'"),
        `${name} tags 'real-playback' but is missing '!test'`
      ).toBe(true);
    }
  });
});
