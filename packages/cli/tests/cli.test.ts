import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/commands/sourcemaps/upload.js', () => ({
  uploadSourcemaps: vi.fn().mockResolvedValue(undefined),
}));

import { uploadSourcemaps } from '../src/commands/sourcemaps/upload.js';
import { buildProgram, normalizeArgv } from '../src/index.js';

const run = (args: string[]) =>
  buildProgram().parseAsync(['node', 'logtide', ...normalizeArgv(args)]);

describe('normalizeArgv', () => {
  it('maps camelCase flag aliases to canonical kebab-case', () => {
    expect(normalizeArgv(['--apiKey', 'K', '--apiUrl', 'U'])).toEqual([
      '--api-key', 'K', '--api-url', 'U',
    ]);
  });

  it('handles the --flag=value form', () => {
    expect(normalizeArgv(['--apiKey=K'])).toEqual(['--api-key=K']);
  });

  it('leaves unrelated args untouched', () => {
    expect(normalizeArgv(['upload', './dist', '--release', '1.0.0'])).toEqual([
      'upload', './dist', '--release', '1.0.0',
    ]);
  });
});

describe('sourcemaps upload command', () => {
  beforeEach(() => {
    vi.mocked(uploadSourcemaps).mockClear();
  });

  it('accepts the directory as a positional argument', async () => {
    await run(['sourcemaps', 'upload', './dist', '--release', '1.0.0', '--api-key', 'K']);

    expect(uploadSourcemaps).toHaveBeenCalledWith(
      './dist',
      expect.objectContaining({ release: '1.0.0', apiKey: 'K' }),
    );
  });

  it('accepts the directory via --path', async () => {
    await run(['sourcemaps', 'upload', '--path', './dist', '--release', '1.0.0', '--api-key', 'K']);

    expect(uploadSourcemaps).toHaveBeenCalledWith(
      './dist',
      expect.objectContaining({ release: '1.0.0' }),
    );
  });

  it('accepts the documented --apiKey alias', async () => {
    await run(['sourcemaps', 'upload', '--path', './dist', '--release', '1.0.0', '--apiKey', 'SECRET']);

    expect(uploadSourcemaps).toHaveBeenCalledWith(
      './dist',
      expect.objectContaining({ apiKey: 'SECRET' }),
    );
  });
});
