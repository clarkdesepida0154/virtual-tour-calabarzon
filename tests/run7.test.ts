/// <reference types="node" />
/** Run 7 unit tests: the certificate share flow (image first, text fallback). */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shareCertificate } from '../src/lib/certificateShareFlow';
import type { CertificateSharer } from '../src/lib/certificateShareFlow';

const text = { title: 'Certificate', message: 'I toured Cavite' };

function fakeSharer(over: Partial<CertificateSharer> = {}) {
  const calls: string[] = [];
  const sharer: CertificateSharer = {
    isAvailable: async () => true,
    shareFile: async (uri) => void calls.push(`file:${uri}`),
    shareText: async () => (calls.push('text'), 'shared'),
    ...over,
  };
  return { sharer, calls };
}

describe('shareCertificate', () => {
  it('captures and shares the image when sharing is available', async () => {
    const { sharer, calls } = fakeSharer();
    assert.equal(await shareCertificate(async () => 'file:///tmp/c.png', text, sharer), 'shared');
    assert.deepEqual(calls, ['file:file:///tmp/c.png']);
  });
  it('falls back to text only when file sharing is unavailable (no capture)', async () => {
    const { sharer, calls } = fakeSharer({ isAvailable: async () => false });
    let captured = false;
    const out = await shareCertificate(async () => ((captured = true), 'x'), text, sharer);
    assert.equal(out, 'shared');
    assert.deepEqual(calls, ['text']);
    assert.equal(captured, false);
  });
  it('reports a text fallback dismissal', async () => {
    const { sharer } = fakeSharer({ isAvailable: async () => false, shareText: async () => 'dismissed' });
    assert.equal(await shareCertificate(async () => 'x', text, sharer), 'dismissed');
  });
  it('maps a cancelled share sheet (AbortError) to dismissed', async () => {
    const { sharer } = fakeSharer({ shareFile: async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; } });
    assert.equal(await shareCertificate(async () => 'x', text, sharer), 'dismissed');
  });
  it('reports unavailable when capture fails', async () => {
    const { sharer } = fakeSharer();
    assert.equal(await shareCertificate(async () => { throw new Error('boom'); }, text, sharer), 'unavailable');
  });
});
