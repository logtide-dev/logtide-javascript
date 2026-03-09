import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('uploadSourceMap', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends multipart form data with correct fields', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { uploadSourceMap } = await import('../src/utils/http.js');

    const result = await uploadSourceMap({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-key',
      release: '1.0.0',
      fileName: 'app.js.map',
      content: Buffer.from('{"version":3}'),
    });

    expect(result.success).toBe(true);
    expect(result.fileName).toBe('app.js.map');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/sourcemaps');
    expect(opts.method).toBe('POST');
    expect(opts.headers['X-API-Key']).toBe('test-key');
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it('strips trailing slash from apiUrl', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const { uploadSourceMap } = await import('../src/utils/http.js');

    await uploadSourceMap({
      apiUrl: 'https://api.example.com/',
      apiKey: 'key',
      release: '1.0.0',
      fileName: 'a.map',
      content: Buffer.from('{}'),
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/v1/sourcemaps');
  });

  it('returns error on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Invalid API key' }),
    });

    const { uploadSourceMap } = await import('../src/utils/http.js');

    const result = await uploadSourceMap({
      apiUrl: 'https://api.example.com',
      apiKey: 'bad-key',
      release: '1.0.0',
      fileName: 'app.js.map',
      content: Buffer.from('{}'),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });

  it('returns HTTP status on non-JSON error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => { throw new Error('not json'); },
    });

    const { uploadSourceMap } = await import('../src/utils/http.js');

    const result = await uploadSourceMap({
      apiUrl: 'https://api.example.com',
      apiKey: 'key',
      release: '1.0.0',
      fileName: 'app.js.map',
      content: Buffer.from('{}'),
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('HTTP 500 Internal Server Error');
  });
});

describe('findMapFiles and uploadSourcemaps', () => {
  let tmpDir: string;

  beforeEach(async () => {
    mockFetch.mockReset();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'logtide-cli-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('finds .map files recursively', async () => {
    // Create test structure
    await fs.mkdir(path.join(tmpDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'app.js.map'), '{"version":3}');
    await fs.writeFile(path.join(tmpDir, 'assets', 'vendor.js.map'), '{"version":3}');
    await fs.writeFile(path.join(tmpDir, 'app.js'), 'console.log("hi")');

    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    // Mock process.exit to prevent test from exiting
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { uploadSourcemaps } = await import('../src/commands/sourcemaps/upload.js');

    await uploadSourcemaps(tmpDir, {
      release: '1.0.0',
      apiKey: 'test-key',
      apiUrl: 'https://api.example.com',
      concurrency: 2,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('reports no .map files found', async () => {
    await fs.writeFile(path.join(tmpDir, 'app.js'), 'code');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const { uploadSourcemaps } = await import('../src/commands/sourcemaps/upload.js');

    await uploadSourcemaps(tmpDir, {
      release: '1.0.0',
      apiKey: 'test-key',
      apiUrl: 'https://api.example.com',
      concurrency: 5,
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('No .map files found.');
    logSpy.mockRestore();
  });

  it('exits with code 1 when api key is missing', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { uploadSourcemaps } = await import('../src/commands/sourcemaps/upload.js');

    await uploadSourcemaps(tmpDir, {
      release: '1.0.0',
      apiKey: '',
      apiUrl: 'https://api.example.com',
      concurrency: 5,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exits with code 1 when some uploads fail', async () => {
    await fs.writeFile(path.join(tmpDir, 'ok.js.map'), '{}');
    await fs.writeFile(path.join(tmpDir, 'fail.js.map'), '{}');

    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { ok: true, status: 200 };
      return {
        ok: false,
        status: 500,
        statusText: 'Error',
        json: async () => ({ error: 'Server error' }),
      };
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { uploadSourcemaps } = await import('../src/commands/sourcemaps/upload.js');

    await uploadSourcemaps(tmpDir, {
      release: '1.0.0',
      apiKey: 'test-key',
      apiUrl: 'https://api.example.com',
      concurrency: 5,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exits with code 1 for invalid directory', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { uploadSourcemaps } = await import('../src/commands/sourcemaps/upload.js');

    await uploadSourcemaps('/nonexistent/dir/that/does/not/exist', {
      release: '1.0.0',
      apiKey: 'test-key',
      apiUrl: 'https://api.example.com',
      concurrency: 5,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
