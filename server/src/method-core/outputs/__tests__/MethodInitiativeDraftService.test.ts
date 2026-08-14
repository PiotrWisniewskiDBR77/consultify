/**
 * Covers canon test 7 (DB-backed half): Initiative Draft links to findings
 * and (via outputId) the source snapshot; nothing in this service can
 * create a Registered Initiative.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KernelTestDbHandle } from '../../__tests__/kernelTestDb.js';

let testDb: KernelTestDbHandle;

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('../../__tests__/kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodOutputService } = await import('../MethodOutputService.js');
const { InitiativeDraftValidationError, MethodInitiativeDraftService } = await import(
  '../MethodInitiativeDraftService.js'
);
const { makeFreezeInput, makeFindingInput } = await import('./testFixtures.js');
const outputsModule = await import('../MethodOutputService.js');
const initiativeDraftModule = await import('../MethodInitiativeDraftService.js');

const organizationId = 'org-1';
const sessionId = 'session-1';

describe('MethodInitiativeDraftService (test 7)', () => {
  let outputs: InstanceType<typeof MethodOutputService>;
  let drafts: InstanceType<typeof MethodInitiativeDraftService>;

  beforeEach(() => {
    testDb.reset();
    outputs = new MethodOutputService();
    drafts = new MethodInitiativeDraftService();
  });

  it('links to the output (and, through it, the frozen snapshot) and to grouped finding ids', async () => {
    const record = await outputs.freezeOutput(
      makeFreezeInput({
        sessionId,
        snapshotId: 'snapshot-42',
        findings: [
          makeFindingInput({ unitId: 'axis-1.criterion-1' }),
          makeFindingInput({ unitId: 'axis-1.criterion-2' }),
        ],
      })
    );
    const [findingA, findingB] = record.findings;

    const draft = await drafts.create({
      organizationId,
      outputId: record.id,
      sessionId,
      title: 'Close the accountability gap on axis 1',
      summary: 'Grouped from 2 axis-1 findings.',
      findingIds: [findingA.id, findingB.id],
      rationale: 'Both findings share the same root cause.',
      expectedOutcome: 'Faster decisions once ownership is assigned.',
      confidence: 'medium',
    });

    expect(draft.outputId).toBe(record.id);
    expect(draft.findingIds.sort()).toEqual([findingA.id, findingB.id].sort());

    const output = await outputs.getOutput(organizationId, draft.outputId);
    expect(output?.snapshotId).toBe('snapshot-42');
  });

  it('rejects a draft with zero linked findings', async () => {
    await expect(
      drafts.create({
        organizationId,
        outputId: 'output-1',
        sessionId,
        title: 'Empty draft',
        findingIds: [],
        rationale: 'n/a',
        expectedOutcome: 'n/a',
        confidence: 'low',
      })
    ).rejects.toThrow(InitiativeDraftValidationError);
    expect(testDb.getRows('method_initiative_drafts')).toHaveLength(0);
  });

  it('MethodInitiativeDraftService exposes no register/registerInitiative method', () => {
    const proto = MethodInitiativeDraftService.prototype;
    const methodNames = Object.getOwnPropertyNames(proto);
    const forbidden = methodNames.filter((n) => /register/i.test(n));
    expect(forbidden).toEqual([]);
  });

  it('this module exports no way to create a Registered Initiative', () => {
    const exportedNames = [...Object.keys(outputsModule), ...Object.keys(initiativeDraftModule)];
    const forbidden = exportedNames.filter((n) => /registerinitiative|registeredinitiative/i.test(n));
    expect(forbidden).toEqual([]);
  });

  it('the persisted row has no initiative_id / registered_initiative_id column value', async () => {
    const record = await outputs.freezeOutput(makeFreezeInput({ sessionId }));
    await drafts.create({
      organizationId,
      outputId: record.id,
      sessionId,
      title: 'Assign accountable data owners per domain',
      findingIds: [record.findings[0].id],
      rationale: 'x',
      expectedOutcome: 'x',
      confidence: 'low',
    });
    const row = testDb.getRows('method_initiative_drafts')[0];
    expect('initiative_id' in row).toBe(false);
    expect('registered_initiative_id' in row).toBe(false);
  });
});
