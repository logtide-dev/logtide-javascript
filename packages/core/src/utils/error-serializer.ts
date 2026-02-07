export interface StructuredStackFrame {
  file?: string;
  function?: string;
  line?: number;
  column?: number;
  metadata?: Record<string, unknown>;
}

export interface StructuredException {
  type: string;
  message: string;
  stacktrace?: StructuredStackFrame[];
  language?: string;
  cause?: StructuredException;
  metadata?: Record<string, unknown>;
  raw?: string;
}

function parseStackTrace(stack: string | undefined): StructuredStackFrame[] {
  if (!stack) return [];

  const frames: StructuredStackFrame[] = [];
  const lines = stack.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;

    // "at functionName (file:line:column)"
    const match1 = trimmed.match(/^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/);
    if (match1) {
      frames.push({
        function: match1[1],
        file: match1[2],
        line: parseInt(match1[3], 10),
        column: parseInt(match1[4], 10),
      });
      continue;
    }

    // "at file:line:column"
    const match2 = trimmed.match(/^at\s+(.+):(\d+):(\d+)$/);
    if (match2) {
      frames.push({
        file: match2[1],
        line: parseInt(match2[2], 10),
        column: parseInt(match2[3], 10),
      });
      continue;
    }

    // "at functionName (native)" or similar
    const match3 = trimmed.match(/^at\s+(.+?)\s+\((.+)\)$/);
    if (match3) {
      frames.push({ function: match3[1], file: match3[2] });
      continue;
    }

    // "at functionName"
    const match4 = trimmed.match(/^at\s+(.+)$/);
    if (match4) {
      frames.push({ function: match4[1] });
    }
  }

  return frames;
}

export function serializeError(error: unknown): StructuredException {
  if (error instanceof Error) {
    const result: StructuredException = {
      type: error.name,
      message: error.message,
      language: 'javascript',
      stacktrace: parseStackTrace(error.stack),
      raw: error.stack,
    };

    if (error.cause) {
      result.cause = serializeError(error.cause);
    }

    const errorMetadata: Record<string, unknown> = {};
    const standardProps = ['name', 'message', 'stack', 'cause'];

    for (const key of Object.keys(error)) {
      if (!standardProps.includes(key)) {
        errorMetadata[key] = (error as unknown as Record<string, unknown>)[key];
      }
    }

    if ('code' in error) errorMetadata.code = (error as { code?: string }).code;

    if (Object.keys(errorMetadata).length > 0) {
      result.metadata = errorMetadata;
    }

    return result;
  }

  if (typeof error === 'string') {
    return { type: 'Error', message: error, language: 'javascript' };
  }

  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    return {
      type:
        typeof obj.type === 'string'
          ? obj.type
          : typeof obj.name === 'string'
            ? obj.name
            : 'Error',
      message: typeof obj.message === 'string' ? obj.message : JSON.stringify(error),
      language: 'javascript',
      metadata: obj,
    };
  }

  return { type: 'Error', message: String(error), language: 'javascript' };
}
