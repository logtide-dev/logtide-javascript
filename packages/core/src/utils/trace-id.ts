const HEX = '0123456789abcdef';

function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  }
  return result;
}

/** Generate a W3C-compatible 32-hex-char trace ID. */
export function generateTraceId(): string {
  return randomHex(16);
}

/** Generate a W3C-compatible 16-hex-char span ID. */
export function generateSpanId(): string {
  return randomHex(8);
}
