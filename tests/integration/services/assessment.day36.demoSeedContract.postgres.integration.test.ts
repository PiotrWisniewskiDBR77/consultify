/** @vitest-environment node */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import DRD_STRUCTURE from '../../../server/src/data/drdStructure.js';
import { areaAverage } from '../../../server/src/services/assessment/assessmentDrdReportSchemaService.js';
import { assessmentReportContractService } from '../../../server/src/services/assessment/assessmentReportContractService.js';
import { EXPECTED_RADAR } from '../../../scripts/demo-seed/metalpolDrdDataset.js';
import { run } from '../../../scripts/seed-demo-drd-metalpol.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('Day 36 Metalpol seed contract — real PostgreSQL', () => {
  beforeAll(async () => run('apply'));
  afterAll(async () => run('purge'));

  it('projects full, partial, single-code and multi-code skip decisions', async () => {
    const contract = await assessmentReportContractService.build(
      'demo-metalpol-org',
      'demo-metalpol-session'
    );
    const byUnit = new Map(
      contract.chapters
        .flatMap((chapter) => chapter.matrix.areas)
        .map((area) => [area.unitId, area])
    );
    expect(byUnit.get('1B')).toMatchObject({ skipped: true });
    expect(byUnit.get('3B')).toMatchObject({ skipped: true });
    expect(byUnit.get('6B')).toMatchObject({ skipped: true });
    expect(byUnit.get('4E')).toMatchObject({ skipped: false, skips: expect.any(Array) });
    expect(byUnit.get('4E')!.skips).toHaveLength(2);
    expect(byUnit.get('7C')).toMatchObject({
      skipped: false,
      skipCode: 'odroczone_do_kolejnej_rewizji',
    });
    expect(byUnit.get('5D')).toMatchObject({ skipped: false, skipCode: null });
    expect(byUnit.get('5D')!.skips).toHaveLength(2);
    expect(byUnit.get('1A')!.evidenceState).toBe('evidenced');
    expect(byUnit.get('1G')!.evidenceState).toBe('incomplete');
    expect(byUnit.get('2A')!.evidenceState).toBe('declared');
    expect(byUnit.get('1C')!.evidenceState).toBe('not_assessed');

    for (const chapter of contract.chapters) {
      const axis = DRD_STRUCTURE.find((candidate) => candidate.id === chapter.axisId)!;
      const expected = EXPECTED_RADAR[chapter.axisId as keyof typeof EXPECTED_RADAR];
      expect(areaAverage(chapter.matrix.areas, 'currentLevel', axis.levelCount)).toBe(
        expected.currentLevel
      );
      expect(areaAverage(chapter.matrix.areas, 'targetLevel', axis.levelCount)).toBe(
        expected.targetLevel
      );
    }
  });
});
