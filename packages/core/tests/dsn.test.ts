import { describe, it, expect } from 'vitest';
import { parseDSN, resolveDSN } from '../src/dsn';

describe('parseDSN', () => {
  it('should parse a DSN without path (new format)', () => {
    const result = parseDSN('https://lp_abc123@api.logtide.dev');
    expect(result).toEqual({
      apiUrl: 'https://api.logtide.dev',
      apiKey: 'lp_abc123',
    });
  });

  it('should accept legacy DSN with project ID path and ignore it', () => {
    const result = parseDSN('https://lp_abc123@api.logtide.dev/my-project');
    expect(result).toEqual({
      apiUrl: 'https://api.logtide.dev',
      apiKey: 'lp_abc123',
    });
  });

  it('should handle DSN with port', () => {
    const result = parseDSN('https://lp_key@localhost:3000');
    expect(result).toEqual({
      apiUrl: 'https://localhost:3000',
      apiKey: 'lp_key',
    });
  });

  it('should handle http scheme', () => {
    const result = parseDSN('http://lp_key@localhost');
    expect(result).toEqual({
      apiUrl: 'http://localhost',
      apiKey: 'lp_key',
    });
  });

  it('should handle DSN with trailing slash', () => {
    const result = parseDSN('https://lp_key@api.logtide.dev/');
    expect(result).toEqual({
      apiUrl: 'https://api.logtide.dev',
      apiKey: 'lp_key',
    });
  });

  it('should throw on missing API key', () => {
    expect(() => parseDSN('https://api.logtide.dev/project')).toThrow('Missing API key');
  });

  it('should throw on invalid DSN string', () => {
    expect(() => parseDSN('not-a-url')).toThrow('Invalid DSN');
  });

  it('should throw on empty string', () => {
    expect(() => parseDSN('')).toThrow('Invalid DSN');
  });
});

describe('resolveDSN', () => {
  it('should resolve from dsn string', () => {
    const result = resolveDSN({ dsn: 'https://lp_key@api.logtide.dev' });
    expect(result).toEqual({
      apiUrl: 'https://api.logtide.dev',
      apiKey: 'lp_key',
    });
  });

  it('should resolve from apiUrl + apiKey', () => {
    const result = resolveDSN({ apiUrl: 'http://localhost:8080', apiKey: 'lp_test_key' });
    expect(result).toEqual({
      apiUrl: 'http://localhost:8080',
      apiKey: 'lp_test_key',
    });
  });

  it('should strip trailing slash from apiUrl', () => {
    const result = resolveDSN({ apiUrl: 'http://localhost:8080/', apiKey: 'lp_key' });
    expect(result).toEqual({
      apiUrl: 'http://localhost:8080',
      apiKey: 'lp_key',
    });
  });

  it('should prefer dsn over apiUrl + apiKey when both provided', () => {
    const result = resolveDSN({
      dsn: 'https://lp_dsn_key@api.logtide.dev',
      apiUrl: 'http://localhost:8080',
      apiKey: 'lp_other_key',
    });
    expect(result).toEqual({
      apiUrl: 'https://api.logtide.dev',
      apiKey: 'lp_dsn_key',
    });
  });

  it('should throw when neither dsn nor apiUrl+apiKey provided', () => {
    expect(() => resolveDSN({})).toThrow('Either "dsn" or both "apiUrl" and "apiKey" must be provided');
  });

  it('should throw when only apiUrl provided without apiKey', () => {
    expect(() => resolveDSN({ apiUrl: 'http://localhost:8080' })).toThrow(
      'Either "dsn" or both "apiUrl" and "apiKey" must be provided',
    );
  });

  it('should throw when only apiKey provided without apiUrl', () => {
    expect(() => resolveDSN({ apiKey: 'lp_key' })).toThrow(
      'Either "dsn" or both "apiUrl" and "apiKey" must be provided',
    );
  });
});
