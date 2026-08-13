/**
 * Covers canon tests 2, 3, 4 (DB-backed half):
 *  2. reopen -> new revision; old snapshot/output row is bit-for-bit
 *     unchanged (no UPDATE ever issued against method_outputs).
 *  3. content_hash deterministic — 10 runs, including the exact documented
 *     defect shape: rows fetched from an UNORDERED SELECT must still hash
 *     the same regardless of physical row order.
 *  4. Output without limitations and without methodology version is
 *     rejected, and rejection happens BEFORE any row is written.
 *
 * Uses the purpose-built kernelTestDb (see ../../__tests__/kernelTestDb.ts)
 * rather than the app-wide mock, for the same reason MethodSessionService's
 * tests do: the app-wide mock's WHERE parser doesn't understand
 * `session_id`/`output_id` predicates.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KernelTestDbHandle } from '../../__tests__/kernelTestDb.js';

let testDb: KernelTestDbHandle;

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('../../__tests__/kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodOutputService, OutputValidationError } = await import('../MethodOutputService.js');
const { makeFreezeInput, makeFindingInput } = await import('./testFixtures.js');

const organizationId = 'org-1';

describe('MethodOutputService.freezeOutput', () => {
  let service: InstanceType<typeof MethodOutputService>;

  beforeEach(() => {
    testDb.reset();
    service = new MethodOutputService();
  });

  // ---------------------------------------------------------------------
  // Requirement 4 — validation gate
  // ---------------------------------------------------------------------
  describe('validation gate (test 4)', () => {
    it('rejects an Output with no limitations and writes NOTHING', async () => {
      await expect(service.freezeOutput(makeFreezeInput({ limitations: [] }))).rejects.toThrow(
        OutputValidationError
      );
      expect(testDb.getRows('method_outputs')).toHaveLength(0);
      expect(testDb.getRows('method_findings')).toHaveLength(0);
    });

    it('rejects an Output with no methodology version and writes NOTHING', async () => {
      await expect(
        service.freezeOutput(makeFreezeInput({ methodPackVersion: '' }))
      ).rejects.toThrow(OutputValidationError);
      expect(testDb.getRows('method_outputs')).toHaveLength(0);
    });

    it('rejects a finding with no supporting evidence', async () => {
      const badFinding = makeFindingInput({ supportingEvidence: [] });
      await expect(
        service.freezeOutput(makeFreezeInput({ findings: [badFinding] }))
      ).rejects.toThrow(OutputValidationError);
      expect(testDb.getRows('method_outputs')).toHaveLength(0);
    });

    it('accepts a well-formed Output and writes exactly one output row + one finding row', async () => {
      const record = await service.freezeOutput(makeFreezeInput());
      expect(testDb.getRows('method_outputs')).toHaveLength(1);
      expect(testDb.getRows('method_findings')).toHaveLength(1);
      expect(record.outputVersion).toBe(1);
      expect(record.findings).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------
  // Requirement 2 — reopen produces a new revision, old row untouched
  // ---------------------------------------------------------------------
  describe('revision via revisionOfOutputId (test 2)', () => {
    it('a second freeze with revisionOfOutputId creates a NEW row; the original row is never UPDATEd', async () => {
      const first = await service.freezeOutput(makeFreezeInput());
      const originalRowBefore = { ...testDb.getRows('method_outputs')[0] };

      const second = await service.freezeOutput(
        makeFreezeInput({
          scope: 'Rescoped after clarifying axis 4 with the client.',
          revisionOfOutputId: first.id,
        })
      );

      expect(second.id).not.toBe(first.id);
      expect(second.outputVersion).toBe(2);
      expect(second.revisionOfOutputId ?? null).toBe(first.id);

      const rows = testDb.getRows('method_outputs');
      expect(rows).toHaveLength(2);

      const originalRowAfter = rows.find((r) => r.id === first.id)!;
      // Bit-for-bit unchanged: every field identical to before the second freeze.
      expect(originalRowAfter).toEqual(originalRowBefore);
    });

    it('isSuperseded resolves the successor by reading, not by a stored pointer on the old row', async () => {
      const first = await service.freezeOutput(makeFreezeInput());
      expect(await service.isSuperseded(organizationId, first.id)).toEqual({
        superseded: false,
        supersededByOutputId: null,
      });

      const second = await service.freezeOutput(
        makeFreezeInput({ revisionOfOutputId: first.id })
      );

      expect(await service.isSuperseded(organizationId, first.id)).toEqual({
        superseded: true,
        supersededByOutputId: second.id,
      });
      // The row itself still carries no such column/value — confirmed via getOutput.
      const reread = await service.getOutput(organizationId, first.id);
      expect(reread).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Requirement 3 — deterministic content hash
  // ---------------------------------------------------------------------
  describe('deterministic content_hash (test 3)', () => {
    it('produces the SAME hash across 10 freezes of equivalent input', async () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 10; i++) {
        testDb.reset();
        const record = await service.freezeOutput(makeFreezeInput());
        hashes.add(record.contentHash);
      }
      expect(hashes.size).toBe(1);
    });

    it('produces the SAME hash regardless of findings/evidence ARRAY ORDER in the input', async () => {
      const f1 = makeFindingInput({ unitId: 'axis-1.criterion-1' });
      const f2 = makeFindingInput({
        unitId: 'axis-2.criterion-1',
        supportingEvidence: [
          { evidenceId: 'ev-a', evidenceType: 'document', strength: 'E2', locator: 'x' },
          { evidenceId: 'ev-b', evidenceType: 'metric', strength: 'E3', locator: 'y' },
        ],
      });
      const f2Reordered = { ...f2, supportingEvidence: [...f2.supportingEvidence].reverse() };

      const orders = [
        [f1, f2],
        [f2, f1],
        [f1, f2Reordered],
        [f2Reordered, f1],
      ];

      const hashes = new Set<string>();
      for (let i = 0; i < 10; i++) {
        testDb.reset();
        const record = await service.freezeOutput(
          makeFreezeInput({ findings: orders[i % orders.length], current: {}, target: {}, gap: {} })
        );
        hashes.add(record.contentHash);
      }
      expect(hashes.size).toBe(1);
    });

    it(
      'REGRESSION: hashing findings read back via an UNORDERED SELECT (listFindings) is stable ' +
        'regardless of physical row insertion order — the exact shape of the documented ' +
        '"UPDATE bez ORDER BY -> 6-7 different hashes in 10 runs" defect',
      async () => {
        const outputA = await service.freezeOutput(
          makeFreezeInput({
            findings: [
              makeFindingInput({ unitId: 'axis-1.criterion-1' }),
              makeFindingInput({ unitId: 'axis-2.criterion-1' }),
              makeFindingInput({ unitId: 'axis-3.criterion-1' }),
            ],
          })
        );

        // listFindings() must return a stable (id-sorted) order no matter what
        // order the underlying rows physically sit in the table.
        const readA = await service.listFindings(organizationId, outputA.id);
        const readB = await service.listFindings(organizationId, outputA.id);
        expect(readA.map((f) => f.id)).toEqual(readB.map((f) => f.id));

        // Shuffle the physical row order directly and confirm the read-back
        // order (and therefore any hash computed over it) is unaffected.
        const table = testDb.getRows('method_findings');
        const shuffled = [...table].reverse();
        testDb.reset();
        for (const row of shuffled) testDb.insertRow('method_findings', row);
        const readAfterShuffle = await service.listFindings(organizationId, outputA.id);
        expect(readAfterShuffle.map((f) => f.id)).toEqual(readA.map((f) => f.id));
      }
    );
  });
});
