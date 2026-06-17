/**
 * M20 · L-03 — share_password is hashed at rest (bcrypt), with legacy-plaintext
 * fallback so no existing share breaks.
 */
import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import MetadataService from '../../../server/src/services/tablePlatform/MetadataService.js';

describe('M20 · L-03 — verifySharePassword', () => {
  it('accepts the correct password against a bcrypt hash', async () => {
    const hash = await bcrypt.hash('s3cret', 10);
    expect(await MetadataService.verifySharePassword('s3cret', hash)).toBe(true);
    expect(await MetadataService.verifySharePassword('wrong', hash)).toBe(false);
  });

  it('legacy plaintext rows still verify (back-compat)', async () => {
    expect(await MetadataService.verifySharePassword('legacy', 'legacy')).toBe(true);
    expect(await MetadataService.verifySharePassword('nope', 'legacy')).toBe(false);
  });

  it('no stored password → always allowed; empty provided → denied when set', async () => {
    expect(await MetadataService.verifySharePassword('anything', null)).toBe(true);
    expect(await MetadataService.verifySharePassword('', await bcrypt.hash('x', 10))).toBe(false);
  });
});
