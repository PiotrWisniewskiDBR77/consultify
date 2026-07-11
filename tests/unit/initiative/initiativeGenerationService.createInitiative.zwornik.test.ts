/**
 * Zwornik Delta C wiring — initiativeGenerationService.createInitiative().
 *
 * This is the last AI-facing entry point that still bypassed the project-
 * anchoring gate (Teresa handoff + the `generate_initiative` chat tool both
 * call it). Previously it routed through initiativeService.createInitiative
 * (InitiativeDefinitionService), whose raw-INSERT path only anchors a project
 * when the unrelated INITIATIVE_FUNNEL_ENABLED flag is 'true' (default OFF
 * everywhere) — i.e. it ALWAYS persisted project_id=NULL in practice.
 *
 * Covers:
 *   1. the generator now routes through the canonical funnel and forwards a
 *      resolved projectId (explicit > source-inherited > null/auto-anchor);
 *   2. cross-record de-dup is advisory (flags, never blocks creation);
 *   3. the REQUIRE_INITIATIVE_PROJECT policy is respected but never blocks
 *      this entry point (shadow logging only) — the funnel owns the actual
 *      anchoring decision.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFunnelCreate, mockFindDuplicate, mockResolveProjectId, mockQueryAll } = vi.hoisted(() => ({
  mockFunnelCreate: vi.fn(),
  mockFindDuplicate: vi.fn(),
  mockResolveProjectId: vi.fn(),
  mockQueryAll: vi.fn(),
}));

vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: (...a: unknown[]) => mockFunnelCreate(...a),
}));
vi.mock('../../../server/src/services/initiative/initiativeCandidateService.js', () => ({
  findDuplicateInitiative: (...a: unknown[]) => mockFindDuplicate(...a),
}));
vi.mock('../../../server/src/services/initiative/sourceProjectResolver.js', () => ({
  resolveProjectIdFromSource: (...a: unknown[]) => mockResolveProjectId(...a),
}));
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
// Heavy/unrelated deps pulled in by the module — stub so import stays light.
vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));
vi.mock('../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {},
}));
vi.mock('../../../server/src/services/initiative/financialsGrounding.js', () => ({
  buildOrgFinancialsSummary: vi.fn(),
}));

import { createInitiative } from '../../../server/src/services/initiativeGenerationService';

const ORG = 'org-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockFindDuplicate.mockResolvedValue(null);
  mockResolveProjectId.mockResolvedValue(null);
  mockFunnelCreate.mockImplementation(async (orgId: string, input: any) => ({
    id: 'init-9',
    name: input.title,
    title: input.title,
    status: 'DRAFT',
    sourceType: input.sourceType ?? 'manual',
    sourceId: input.sourceId ?? null,
    projectId: input.projectId ?? null,
  }));
});

afterEach(() => {
  delete process.env.REQUIRE_INITIATIVE_PROJECT;
});

describe('initiativeGenerationService.createInitiative — zwornik wiring', () => {
  it('routes through the canonical funnel (not the raw-insert bypass)', async () => {
    const res = await createInitiative({ organizationId: ORG, title: 'X', description: 'd' });
    expect(mockFunnelCreate).toHaveBeenCalledTimes(1);
    expect(res.id).toBe('init-9');
    const [orgArg, input, opts] = mockFunnelCreate.mock.calls[0];
    expect(orgArg).toBe(ORG);
    expect(input.title).toBe('X');
    expect(opts).toMatchObject({ validate: false });
  });

  it('defaults lineage to manual when the caller supplies no sourceType/sourceId (safe for existing callers)', async () => {
    await createInitiative({ organizationId: ORG, title: 'X' });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.sourceType).toBe('manual');
    expect(input.sourceId).toBeNull();
    // The resolver is still consulted (it's the single funnel-agnostic lookup
    // seam), but resolveProjectIdFromSource itself short-circuits 'manual' to
    // null (see sourceProjectResolver.test.ts) — mocked here to prove the
    // generator forwards whatever it returns without special-casing 'manual'.
    expect(mockResolveProjectId).toHaveBeenCalledWith(ORG, 'manual', null);
  });

  it('an explicit projectId wins over source inheritance', async () => {
    const res = await createInitiative({
      organizationId: ORG,
      title: 'X',
      projectId: 'proj-explicit',
      sourceType: 'assessment',
      sourceId: 'assess-1',
    });
    expect(mockResolveProjectId).not.toHaveBeenCalled();
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.projectId).toBe('proj-explicit');
    expect(res.projectId).toBe('proj-explicit');
  });

  it('inherits project_id from the source artifact when no explicit projectId is given', async () => {
    mockResolveProjectId.mockResolvedValueOnce('proj-from-assessment');
    const res = await createInitiative({
      organizationId: ORG,
      title: 'X',
      sourceType: 'assessment',
      sourceId: 'assess-1',
    });
    expect(mockResolveProjectId).toHaveBeenCalledWith(ORG, 'assessment', 'assess-1');
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.projectId).toBe('proj-from-assessment');
    expect(res.projectId).toBe('proj-from-assessment');
  });

  it('sourceId without sourceType degrades to manual (lineage guard safety)', async () => {
    // @ts-expect-error — intentionally omitting sourceType to prove the guard.
    await createInitiative({ organizationId: ORG, title: 'X', sourceId: 'assess-1' });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.sourceType).toBe('manual');
    expect(input.sourceId).toBeNull();
  });

  it('null project_id (no explicit + source has none) is forwarded so the funnel auto-anchors', async () => {
    mockResolveProjectId.mockResolvedValueOnce(null);
    await createInitiative({
      organizationId: ORG,
      title: 'X',
      sourceType: 'interview_insight',
      sourceId: 'ins-1',
    });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.projectId).toBeNull();
  });

  it('de-dup: flags a possible duplicate but STILL creates the initiative (advisory, not a hard block)', async () => {
    mockFindDuplicate.mockResolvedValueOnce({ id: 'existing-1', title: 'X existing' });
    const res = await createInitiative({ organizationId: ORG, title: 'X' });
    expect(mockFunnelCreate).toHaveBeenCalledTimes(1); // creation NOT skipped
    expect(res.possibleDuplicate).toBe(true);
    expect(res.duplicateOfInitiativeId).toBe('existing-1');
    expect(res.id).toBe('init-9');
  });

  it('de-dup: no match → possibleDuplicate false, duplicateOfInitiativeId null', async () => {
    const res = await createInitiative({ organizationId: ORG, title: 'X' });
    expect(res.possibleDuplicate).toBe(false);
    expect(res.duplicateOfInitiativeId).toBeNull();
  });

  it('de-dup lookup failing is fail-soft — creation still proceeds', async () => {
    mockFindDuplicate.mockRejectedValueOnce(new Error('db down'));
    const res = await createInitiative({ organizationId: ORG, title: 'X' });
    expect(res.id).toBe('init-9');
    expect(res.possibleDuplicate).toBe(false);
  });

  it('REQUIRE_INITIATIVE_PROJECT=false (policy OFF): generator still creates, zero blocking', async () => {
    process.env.REQUIRE_INITIATIVE_PROJECT = 'false';
    const res = await createInitiative({ organizationId: ORG, title: 'X' });
    expect(mockFunnelCreate).toHaveBeenCalledTimes(1);
    expect(res.id).toBe('init-9');
  });

  it('REQUIRE_INITIATIVE_PROJECT=true (policy ON): generator still creates (funnel auto-anchors, non-interactive posture)', async () => {
    process.env.REQUIRE_INITIATIVE_PROJECT = 'true';
    const res = await createInitiative({ organizationId: ORG, title: 'X' });
    expect(mockFunnelCreate).toHaveBeenCalledTimes(1);
    expect(res.id).toBe('init-9');
  });

  it('source-resolution failure is fail-soft — falls back to null projectId, creation still proceeds', async () => {
    mockResolveProjectId.mockRejectedValueOnce(new Error('db down'));
    const res = await createInitiative({
      organizationId: ORG,
      title: 'X',
      sourceType: 'assessment',
      sourceId: 'assess-1',
    });
    const [, input] = mockFunnelCreate.mock.calls[0];
    expect(input.projectId).toBeNull();
    expect(res.id).toBe('init-9');
  });
});
