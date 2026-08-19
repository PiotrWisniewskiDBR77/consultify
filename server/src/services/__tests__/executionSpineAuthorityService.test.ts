import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../utils/queryHelpers.js', () => ({
  withPgTransaction: (work: (tx: { query: typeof query }) => unknown) => work({ query }),
}));

import { linkInitiativeToExecutionCase, linkRuntimeInitiativeToExecutionCase, resolveExecutionSpineAuthority } from '../executionBvpService.js';
import { classifyDomainCode } from '../../routes/caseWorkspace/_shared/errors.js';

const link = {
  link_id: 'link-1', organization_id: 'org-a', initiative_id: null, case_id: null, project_id: null,
  source_kind: 'RUNTIME_V1', runtime_initiative_id: 'initiative-1',
  runtime_execution_case_id: 'case-1', source_version: 7, source_project_id: 'project-1',
  work_ref: null, resource_ref: null, control_ref: null, report_ref: null,
  status: 'ACTIVE', version: 3, reopened_at: null, reopen_count: 0,
};
const runtime = {
  initiative_version: 7,
  initiative_payload: { lifecycleState: 'IN_EXECUTION', projectId: 'project-1' },
  case_payload: { initiativeId: 'initiative-1', state: 'ACTIVE' },
  relation_exists: true,
};

describe('execution spine authority resolver', () => {
  beforeEach(() => query.mockReset());

  it('returns the decision-A projection only after exact tenant/runtime validation', async () => {
    query.mockResolvedValueOnce({ rows: [link] }).mockResolvedValueOnce({ rows: [runtime] });
    await expect(resolveExecutionSpineAuthority({
      organizationId: 'org-a', runtimeInitiativeId: 'initiative-1',
      runtimeExecutionCaseId: 'case-1', expectedVersion: 3, requireActive: true,
    })).resolves.toMatchObject({
      link: { link_id: 'link-1' },
      authority: { identity: 'EXECUTION_CASE_LINKS', workWriter: 'RUNTIME_V1', governance: 'CASE_WORKSPACE' },
    });
    expect(query.mock.calls[0][1][0]).toBe('org-a');
  });

  it.each([
    ['wrong tenant/missing identity', [], 'execution_authority_not_found'],
    ['ambiguous identity', [link, { ...link, link_id: 'link-2' }], 'execution_authority_ambiguous_conflict'],
  ])('fails closed for %s', async (_label, rows, code) => {
    query.mockResolvedValueOnce({ rows });
    await expect(resolveExecutionSpineAuthority({ organizationId: 'org-a', runtimeInitiativeId: 'initiative-1' }))
      .rejects.toThrow(code);
  });

  it('rejects stale link version before returning authority', async () => {
    query.mockResolvedValueOnce({ rows: [link] });
    await expect(resolveExecutionSpineAuthority({
      organizationId: 'org-a', linkId: 'link-1', expectedVersion: 2,
    })).rejects.toThrow('execution_authority_version_conflict');
  });

  it('rejects an inactive or mismatched Runtime-v1 successor', async () => {
    query.mockResolvedValueOnce({ rows: [link] }).mockResolvedValueOnce({ rows: [{
      ...runtime, case_payload: { initiativeId: 'different', state: 'CLOSED' },
    }] });
    await expect(resolveExecutionSpineAuthority({
      organizationId: 'org-a', linkId: 'link-1', requireActive: true,
    })).rejects.toThrow('execution_authority_runtime_mismatch');
  });

  it('retires the legacy writer only through an explicit identity alias', async () => {
    query.mockResolvedValueOnce({ rows: [link] });
    await expect(linkInitiativeToExecutionCase({
      organizationId: 'org-a', initiativeId: 'legacy-initiative', caseId: 'legacy-case',
      actorId: 'actor-1', idempotencyKey: 'legacy-key',
    })).rejects.toThrow('execution_legacy_writer_retired:link-1');
    expect(query.mock.calls[0][0]).toContain('execution_identity_aliases');
    expect(query.mock.calls[0][1]).toEqual(['org-a', 'legacy-initiative', 'legacy-case']);
  });

  it('maps mounted resolver failures to stable fail-closed HTTP classes', () => {
    expect(classifyDomainCode('execution_authority_not_found')).toEqual({ status: 404, code: 'execution_authority_not_found' });
    expect(classifyDomainCode('execution_authority_version_conflict')).toEqual({ status: 409, code: 'execution_authority_version_conflict' });
    expect(classifyDomainCode('execution_authority_runtime_not_active')).toEqual({ status: 409, code: 'execution_authority_runtime_not_active' });
    expect(classifyDomainCode('execution_authority_version_invalid')).toEqual({ status: 400, code: 'execution_authority_version_invalid' });
  });

  it('fails when an explicit legacy alias is already bound to another canonical link', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ version: 7, payload_json: { lifecycleState: 'IN_EXECUTION', projectId: 'project-1' } }] })
      .mockResolvedValueOnce({ rows: [{ payload_json: { initiativeId: 'initiative-1', state: 'ACTIVE' } }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [link] })
      .mockResolvedValueOnce({ rows: [{ initiative_project_id: 'project-1', case_project_id: 'project-1' }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(linkRuntimeInitiativeToExecutionCase({
      organizationId: 'org-a', initiativeId: 'initiative-1', caseId: 'case-1', sourceVersion: 7,
      actorId: 'actor-1', idempotencyKey: 'alias-key',
      legacyInitiativeId: 'legacy-initiative', legacyCaseId: 'legacy-case',
    })).rejects.toThrow('execution_legacy_alias_conflict');
  });
});
