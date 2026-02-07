import { describe, it, expect } from 'vitest';
import { serializeError } from '../src/utils/error-serializer';

describe('serializeError', () => {
  it('should serialize a standard Error', () => {
    const error = new Error('test error');
    const result = serializeError(error);

    expect(result.type).toBe('Error');
    expect(result.message).toBe('test error');
    expect(result.language).toBe('javascript');
    expect(result.raw).toBeDefined();
    expect(result.stacktrace).toBeDefined();
    expect(result.stacktrace!.length).toBeGreaterThan(0);
  });

  it('should serialize a TypeError', () => {
    const error = new TypeError('not a function');
    const result = serializeError(error);

    expect(result.type).toBe('TypeError');
    expect(result.message).toBe('not a function');
  });

  it('should serialize error with cause', () => {
    const cause = new Error('root cause');
    const error = new Error('wrapper', { cause });
    const result = serializeError(error);

    expect(result.cause).toBeDefined();
    expect(result.cause!.type).toBe('Error');
    expect(result.cause!.message).toBe('root cause');
  });

  it('should serialize error with extra properties', () => {
    const error = new Error('http error') as Error & { code: string; statusCode: number };
    error.code = 'ECONNREFUSED';
    error.statusCode = 500;
    const result = serializeError(error);

    expect(result.metadata).toBeDefined();
    expect(result.metadata!.code).toBe('ECONNREFUSED');
    expect(result.metadata!.statusCode).toBe(500);
  });

  it('should serialize a string', () => {
    const result = serializeError('simple error message');

    expect(result.type).toBe('Error');
    expect(result.message).toBe('simple error message');
    expect(result.stacktrace).toBeUndefined();
  });

  it('should serialize an object with message', () => {
    const result = serializeError({ message: 'object error', code: 42 });

    expect(result.type).toBe('Error');
    expect(result.message).toBe('object error');
    expect(result.metadata).toBeDefined();
  });

  it('should serialize an object with type', () => {
    const result = serializeError({ type: 'CustomError', message: 'custom' });

    expect(result.type).toBe('CustomError');
    expect(result.message).toBe('custom');
  });

  it('should serialize null/undefined/numbers', () => {
    expect(serializeError(null).message).toBe('null');
    expect(serializeError(undefined).message).toBe('undefined');
    expect(serializeError(42).message).toBe('42');
  });

  it('should parse stack frames correctly', () => {
    const error = new Error('stack test');
    const result = serializeError(error);

    // The first frame should point to this test file
    expect(result.stacktrace).toBeDefined();
    expect(result.stacktrace!.length).toBeGreaterThan(0);

    const firstFrame = result.stacktrace![0];
    expect(firstFrame.line).toBeDefined();
    expect(typeof firstFrame.line).toBe('number');
  });
});
