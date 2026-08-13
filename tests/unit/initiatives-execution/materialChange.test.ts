import { describe, expect, it } from 'vitest';
import {
  changeImpactFindings,
  materialSnapshotHash,
} from '../../../server/src/domain/initiatives-execution/materialChange';
describe('Material Change', () => {
  it('hashes truth deterministically and blocks unknown impact', () => {
    expect(materialSnapshotHash({ b: 2, a: 1 })).toBe(materialSnapshotHash({ a: 1, b: 2 }));
    const known = { knowledgeState: 'KNOWN' as const, refs: [] };
    expect(
      changeImpactFindings({
        oldSnapshot: { a: 1 },
        newSnapshot: { a: 2 },
        diff: [{ path: 'a', oldValue: 1, newValue: 2 }],
        blastRadius: {
          tasks: { ...known, knowledgeState: 'UNKNOWN' },
          decisions: known,
          milestones: known,
          risks: known,
          capacity: known,
          approvals: known,
          handoff: known,
        },
        reversibility: 'REVERSIBLE',
      })
    ).toContain('TASKS_IMPACT_UNKNOWN');
  });
});
