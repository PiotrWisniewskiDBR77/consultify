import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.hoisted(() => vi.fn());
const metadataServiceMock = vi.hoisted(() => ({
  createBase: vi.fn().mockResolvedValue({ id: 'base-sheet-1' }),
  createTable: vi.fn(),
  createField: vi.fn(),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../MetadataService.js', () => ({ default: metadataServiceMock }));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import templateService from '../TemplateService.js';

describe('TemplateService export provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists canonical template id and family when creating a base', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1',
            schema_snapshot: { family: 'SHEET-BASE', tables: [] },
            governance_rules: { family: 'SHEET-BASE' },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await templateService.createFromTemplate(
      '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1',
      'workspace-1',
      'Supplier scorecard',
      'user-1',
      'org-1'
    );

    const provenanceCall = mockQuery.mock.calls.find(([sql]) =>
      String(sql).includes('SET metadata =')
    );
    expect(provenanceCall).toBeDefined();
    expect(JSON.parse(String(provenanceCall?.[1]?.[1]))).toEqual({
      originTemplateId: '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1',
      template_family_ref: 'SHEET-BASE',
    });
  });
});
