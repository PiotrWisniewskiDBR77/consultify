import { describe, expect, it } from 'vitest';

import { SeedTargetError, validateSeedTarget } from '../../../scripts/seed-demo-drd-metalpol.js';

const REMOTE_CONFIRMATION = 'I_UNDERSTAND_THIS_IS_A_REMOTE_DATABASE';

describe('Metalpol demo seed target gate', () => {
  it('accepts localhost', () => {
    expect(validateSeedTarget({ DATABASE_URL: 'postgres://u:p@localhost:5602/db' })).toContain(
      'localhost'
    );
  });

  it('rejects a remote host without confirmation with exit 2', () => {
    expect(() => validateSeedTarget({ DATABASE_URL: 'postgres://u:p@remote.invalid/db' })).toThrow(
      expect.objectContaining<Partial<SeedTargetError>>({ exitCode: 2 })
    );
  });

  it('accepts a remote host with explicit confirmation', () => {
    expect(
      validateSeedTarget({
        DATABASE_URL: 'postgres://u:p@remote.invalid/db',
        DEMO_SEED_TARGET_CONFIRM: REMOTE_CONFIRMATION,
      })
    ).toContain('remote.invalid');
  });

  it('rejects a production fingerprint with exit 3 even with confirmation', () => {
    expect(() =>
      validateSeedTarget({
        DATABASE_URL: 'postgres://u:p@centerbeam.internal/db',
        DEMO_SEED_TARGET_CONFIRM: REMOTE_CONFIRMATION,
      })
    ).toThrow(expect.objectContaining<Partial<SeedTargetError>>({ exitCode: 3 }));
  });
});
