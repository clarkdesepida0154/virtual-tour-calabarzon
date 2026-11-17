/**
 * Base64 → bytes, in plain JavaScript.
 *
 * The image manipulator hands back the resized photo as Base64, and Supabase
 * Storage wants an ArrayBuffer. Doing the conversion here keeps uploads free
 * of extra native modules (everything must run in Expo Go).
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INVALID = 255;

const LOOKUP = new Uint8Array(128).fill(INVALID);
for (let index = 0; index < ALPHABET.length; index += 1) {
  LOOKUP[ALPHABET.charCodeAt(index)] = index;
}
// URL-safe alphabet, just in case.
LOOKUP['-'.charCodeAt(0)] = 62;
LOOKUP['_'.charCodeAt(0)] = 63;

function sextet(source: string, index: number): number {
  const code = source.charCodeAt(index);
  const value = code < LOOKUP.length ? LOOKUP[code] : INVALID;
  if (value === undefined || value === INVALID) {
    throw new Error('The photo data is not valid Base64.');
  }
  return value;
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/^data:[^;,]+;base64,/, '').replace(/[\s=]/g, '');
  if (clean.length % 4 === 1) {
    throw new Error('The photo data is not valid Base64.');
  }

  const byteLength = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = sextet(clean, index);
    const b = sextet(clean, index + 1);
    const c = index + 2 < clean.length ? sextet(clean, index + 2) : 0;
    const d = index + 3 < clean.length ? sextet(clean, index + 3) : 0;
    const chunk = (a << 18) | (b << 12) | (c << 6) | d;

    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (chunk >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = chunk & 0xff;
  }

  return bytes.buffer;
}
