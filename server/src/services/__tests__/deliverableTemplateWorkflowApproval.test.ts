import { beforeEach, describe, expect, it, vi } from 'vitest';

const { approveTemplateProvenance, query } = vi.hoisted(() => ({
  approveTemplateProvenance: vi.fn(),
  query: vi.fn(),
}));

vi.mock('../deliverableTemplateService.js', () => ({
  approveTemplateProvenance,
  getDeliverableTemplate: vi.fn(),
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: vi.fn(),
  withPgTransaction: (run: (client: { query: typeof query }) => unknown) => run({ query }),
}));

import {
  approveTemplateWorkflow,
  TemplateWorkflowError,
} from '../deliverableTemplateWorkflowService.js';

const submittedRow = {
  id: 'wf-1',
  organization_id: 'org-1',
  template_type: 'deck',
  template_id: 'tpl-1',
  author_user_id: 'author-1',
  status: 'submitted',
  version: '0.1',
  base_kind: 'archetype',
  base_template_id: null,
  language: 'en',
  document_type: 'board',
  audience: 'board',
  confidentiality: 'internal',
  source_bindings: { a: 'DRD' },
  last_test_run_id: 'run-1',
  last_test_passed_at: '2026-09-17T20:00:00Z',
  submitted_at: '2026-09-17T20:01:00Z',
  approved_by: null,
  approved_at: null,
  is_default: false,
};

describe('TPL-1b independent approval', () => {
  beforeEach(() => {
    query.mockReset();
    approveTemplateProvenance.mockReset();
  });

  it('rejects author self-approval before provenance is changed', async () => {
    query.mockResolvedValueOnce({ rows: [submittedRow], rowCount: 1 });

    await expect(
      approveTemplateWorkflow({
        organizationId: 'org-1',
        actorUserId: 'author-1',
        templateId: 'tpl-1',
      })
    ).rejects.toMatchObject<Partial<TemplateWorkflowError>>({ code: 'AUTHOR_CANNOT_APPROVE' });
    expect(approveTemplateProvenance).not.toHaveBeenCalled();
  });

  it('approves with a different actor and records the test receipt as evidence', async () => {
    query
      .mockResolvedValueOnce({ rows: [submittedRow], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          { ...submittedRow, status: 'approved', version: '1.0', approved_by: 'approver-1' },
        ],
        rowCount: 1,
      });
    approveTemplateProvenance.mockResolvedValue({ replayed: false });

    const result = await approveTemplateWorkflow({
      organizationId: 'org-1',
      actorUserId: 'approver-1',
      templateId: 'tpl-1',
    });

    expect(result.status).toBe('approved');
    expect(result.version).toBe('1.0');
    expect(approveTemplateProvenance).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'approver-1',
        templateId: 'tpl-1',
        provenance: expect.objectContaining({
          evidence: 'deliverable_template_test_runs:run-1',
          version: '1.0',
        }),
      })
    );
  });
});
