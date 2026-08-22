import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, withPgTransactionMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  withPgTransactionMock: vi.fn(),
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  withPgTransaction: withPgTransactionMock,
}));

import {
  ensureSystemInterviewTemplateSnapshotForAssignment,
  TemplatePublicationError,
} from '../interviewTemplatePublicationService.js';

describe('system Interview template assignment snapshot', () => {
  beforeEach(() => {
    queryMock.mockReset();
    withPgTransactionMock.mockReset().mockImplementation(async (work) =>
      work({ query: queryMock })
    );
  });

  it('materializes one immutable global snapshot for an approved system template', async () => {
    const snapshot = {
      template: { id: 'system-template', version: 3, status: 'approved' },
      questions: [{ id: 'q-1', question_text: 'What changed?' }],
    };
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'system-template',
            organization_id: null,
            template_scope: 'system',
            status: 'approved',
            version: 3,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: snapshot.questions })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ snapshot_json: snapshot }] });

    await expect(
      ensureSystemInterviewTemplateSnapshotForAssignment({
        templateId: 'system-template',
        version: 3,
      })
    ).resolves.toEqual(snapshot);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, ?, 'system', ?, ?::jsonb, 'system')"),
      expect.arrayContaining(['system-template', 3])
    );
  });

  it('reuses an existing immutable snapshot without reading mutable questions', async () => {
    const snapshot = {
      template: { id: 'system-template', version: 3 },
      questions: [{ id: 'q-1' }],
    };
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'system-template',
            organization_id: null,
            template_scope: 'system',
            status: 'approved',
            version: 3,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ snapshot_json: JSON.stringify(snapshot) }] });

    await expect(
      ensureSystemInterviewTemplateSnapshotForAssignment({
        templateId: 'system-template',
        version: 3,
      })
    ).resolves.toEqual(snapshot);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('does not promote organization templates or stale system versions', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'org-template',
          organization_id: 'org-1',
          template_scope: 'organization',
          status: 'approved',
          version: 1,
        },
      ],
    });
    await expect(
      ensureSystemInterviewTemplateSnapshotForAssignment({
        templateId: 'org-template',
        version: 1,
      })
    ).rejects.toMatchObject<Partial<TemplatePublicationError>>({
      code: 'SYSTEM_TEMPLATE_NOT_FOUND',
      status: 404,
    });

    queryMock.mockReset().mockResolvedValueOnce({
      rows: [
        {
          id: 'system-template',
          organization_id: null,
          template_scope: 'system',
          status: 'approved',
          version: 4,
        },
      ],
    });
    await expect(
      ensureSystemInterviewTemplateSnapshotForAssignment({
        templateId: 'system-template',
        version: 3,
      })
    ).rejects.toMatchObject<Partial<TemplatePublicationError>>({
      code: 'SYSTEM_TEMPLATE_VERSION_NOT_APPROVED',
      status: 409,
    });
  });
});
