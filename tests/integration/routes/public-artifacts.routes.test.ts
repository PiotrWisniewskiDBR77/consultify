import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();
const dbGetMock = vi.fn();
const tableExistsMock = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAllMock(...args),
  get: (...args: any[]) => dbGetMock(...args),
  tableExists: (...args: any[]) => tableExistsMock(...args),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import publicArtifactsRouter from '../../../server/src/routes/public-artifacts.routes.js';

const app = express();
app.use('/api/public/artifacts', publicArtifactsRouter);

describe('public artifacts route — report document publication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_REPORT_DOCUMENT_PUBLIC_LINKS = 'true';
    tableExistsMock.mockImplementation(async (table: string) =>
      ['work_canvas_drafts', 'work_canvas_versions'].includes(table)
    );
    dbGetMock.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS count')) return { count: 2 };
      if (sql.includes('FROM organizations')) return { name: 'Northwind' };
      return null;
    });
  });

  it('fails closed before any draft lookup when public links are OFF', async () => {
    process.env.ENABLE_REPORT_DOCUMENT_PUBLIC_LINKS = 'false';

    await request(app).get('/api/public/artifacts/a1b2c3d4e5f600112233445566778899').expect(404);

    expect(tableExistsMock).not.toHaveBeenCalled();
    expect(dbAllMock).not.toHaveBeenCalled();
  });

  it('returns sanitized markdown and viewer version metadata for an active token', async () => {
    const token = 'a1b2c3d4e5f600112233445566778899';
    dbAllMock.mockResolvedValueOnce([
      {
        id: 'draft-1',
        organization_id: 'org-1',
        kind: 'report',
        title: 'Pipeline Report',
        content_md: '# Pipeline Report',
        provenance_json: JSON.stringify({
          share: { token, expiresAt: '2099-01-01T00:00:00.000Z' },
        }),
        updated_at: '2026-09-18T20:00:00.000Z',
      },
    ]);

    const response = await request(app).get(`/api/public/artifacts/${token}`).expect(200);

    expect(response.body).toMatchObject({
      title: 'Pipeline Report',
      kind: 'report',
      contentMd: '# Pipeline Report',
      version: { current: 3, total: 3, label: 'v3' },
      orgBranding: { name: 'Northwind' },
    });
    expect(response.body).not.toHaveProperty('organizationId');
    expect(response.body).not.toHaveProperty('provenance');
  });
});
