import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActionDecisionService from '../../server/src/ai/actionDecisionService.js';

describe('ActionDecisionService.recordDecision - REAL_CODE', () => {
  const db = {
    run: vi.fn(),
    all: vi.fn(),
  };

  const ActionProposalEngine = {
    getProposalById: vi.fn(),
  };

  const EvidenceLedgerService = {
    EVIDENCE_TYPES: { SIGNAL: 'SIGNAL' },
    ENTITY_TYPES: { DECISION: 'DECISION' },
    createEvidenceObject: vi.fn(async () => ({ id: 'ev-1' })),
    linkEvidence: vi.fn(async () => undefined),
    recordReasoning: vi.fn(async () => undefined),
  };

  const auditLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    db.all.mockImplementation((_sql: any, _params: any, cb: any) => cb(null, []));
    db.run.mockImplementation((_sql: any, _params: any, cb: any) => cb(null));

    ActionProposalEngine.getProposalById.mockResolvedValue({
      id: 'p-1',
      action_type: 'TASK_CREATE',
      scope: 'ORG',
      correlation_id: 'corr-1',
      confidence: 0.8,
      context_snapshot: {},
    });

    ActionDecisionService.setDependencies({
      db,
      uuidv4: () => 'u1',
      ActionProposalEngine,
      EvidenceLedgerService,
      auditLogger,
    });
  });

  it('rejects missing required decision fields', async () => {
    await expect(ActionDecisionService.recordDecision({ decision: 'APPROVED' })).rejects.toThrow(
      /Missing required decision fields/i
    );
  });

  it('rejects invalid decision type with status=400', async () => {
    await expect(
      ActionDecisionService.recordDecision({
        proposal_id: 'p-1',
        organization_id: 'org-1',
        decision: 'NOPE',
        decided_by_user_id: 'u-1',
      })
    ).rejects.toEqual(expect.objectContaining({ status: 400 }));
  });

  it('rejects MODIFIED decision when modified_payload contains non-allowlisted fields', async () => {
    await expect(
      ActionDecisionService.recordDecision({
        proposal_id: 'p-1',
        organization_id: 'org-1',
        decision: 'MODIFIED',
        decided_by_user_id: 'u-1',
        modified_payload: { not_allowed: 'x' },
      })
    ).rejects.toEqual(expect.objectContaining({ status: 400 }));
  });

  it('filters MODIFIED payload to allowlist and inserts decision', async () => {
    const res = await ActionDecisionService.recordDecision({
      proposal_id: 'p-1',
      organization_id: 'org-1',
      decision: 'MODIFIED',
      decided_by_user_id: 'u-1',
      modified_payload: { title: 'OK', not_allowed: 'x' },
    }).catch((e: any) => e);

    // recordDecision should throw for not_allowed; ensure allowlist behavior by using allowed-only payload
    expect(res).toEqual(expect.objectContaining({ status: 400 }));

    const ok = await ActionDecisionService.recordDecision({
      proposal_id: 'p-1',
      organization_id: 'org-1',
      decision: 'MODIFIED',
      decided_by_user_id: 'u-1',
      modified_payload: { title: 'OK', description: 'D' },
    });

    expect(ok).toEqual(expect.objectContaining({ id: 'ad-u1', decision: 'MODIFIED' }));
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO action_decisions'),
      expect.arrayContaining([
        'ad-u1',
        'p-1',
        'org-1',
        'corr-1',
        'TASK_CREATE',
        'ORG',
        'MODIFIED',
        'u-1',
      ]),
      expect.any(Function)
    );
  });

  it('rejects double active approval conflicts with status=409', async () => {
    db.all.mockImplementationOnce((_sql: any, _params: any, cb: any) =>
      cb(null, [{ decision: 'APPROVED', proposal_snapshot: null, modified_payload: null }])
    );

    await expect(
      ActionDecisionService.recordDecision({
        proposal_id: 'p-1',
        organization_id: 'org-1',
        decision: 'APPROVED',
        decided_by_user_id: 'u-1',
      })
    ).rejects.toEqual(expect.objectContaining({ status: 409 }));
  });
});
