import { describe, it, expect } from 'vitest';
import { parseDSN } from '../src/dsn';

describe('parseDSN', () => {
  it('should parse a valid DSN', () => {
    const result = parseDSN('https://lp_abc123@api.logtide.dev/my-project');
    expect(result).toEqual({
      apiUrl: 'https://api.logtide.dev',
      apiKey: 'lp_abc123',
      projectId: 'my-project',
    });
  });

  it('should handle DSN with port', () => {
    const result = parseDSN('https://lp_key@localhost:3000/proj1');
    expect(result).toEqual({
      apiUrl: 'https://localhost:3000',
      apiKey: 'lp_key',
      projectId: 'proj1',
    });
  });

  it('should handle http scheme', () => {
    const result = parseDSN('http://lp_key@localhost/project');
    expect(result).toEqual({
      apiUrl: 'http://localhost',
      apiKey: 'lp_key',
      projectId: 'project',
    });
  });

  it('should throw on missing API key', () => {
    expect(() => parseDSN('https://api.logtide.dev/project')).toThrow('Missing API key');
  });

  it('should throw on missing project ID', () => {
    expect(() => parseDSN('https://lp_key@api.logtide.dev/')).toThrow('Missing project ID');
  });

  it('should throw on invalid DSN string', () => {
    expect(() => parseDSN('not-a-url')).toThrow('Invalid DSN');
  });

  it('should throw on empty string', () => {
    expect(() => parseDSN('')).toThrow('Invalid DSN');
  });
});
