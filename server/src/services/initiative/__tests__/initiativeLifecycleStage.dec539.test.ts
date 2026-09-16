import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveInitiativeStageForRow } from '../initiativeLifecycleCanon.js';

describe('STAGE-1 / DEC-539', () => {
  it('uses the persisted twelve-stage column before aggregate and status fallbacks', () => {
    expect(
      resolveInitiativeStageForRow({
        lifecycleStage: 'SCHEDULED',
        aggregateLifecycleState: 'APPROVED_BACKLOG',
        dbStatus: 'DRAFT',
      })
    ).toBe('SCHEDULED');
  });

  it('keeps aggregate and seven-code fallbacks for pre-migration reads', () => {
    expect(
      resolveInitiativeStageForRow({
        aggregateLifecycleState: 'DEFINED',
        dbStatus: 'APPROVED',
      })
    ).toBe('DEFINED');
    expect(resolveInitiativeStageForRow({ dbStatus: 'APPROVED' })).toBe('APPROVED_BACKLOG');
  });

  it('migration is additive, constrained and has the required data rollback', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'server/migrations/20262260_initiatives_lifecycle_stage.sql'),
      'utf8'
    );
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT');
    expect(sql).toContain('initiatives_lifecycle_stage_check');
    expect(sql).toContain('sync_initiative_lifecycle_stage');
    expect(sql).toContain("lifecycle_stage_source = 'mapped'");
    expect(sql).toContain('UPDATE initiatives SET lifecycle_stage = NULL');
    expect(sql).not.toMatch(/DROP COLUMN/i);
  });
});
