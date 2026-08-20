import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ all: vi.fn(), get: vi.fn() }));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => db.all(...args),
  get: (...args: unknown[]) => db.get(...args),
  run: vi.fn(),
}));

import { getStatementPackDetail } from '../financialStatementPackService.js';
import { listStatements } from '../financialStatementReadService.js';

describe('Finance Statement authoritative identity read boundaries', () => {
  beforeEach(() => {
    db.all.mockReset();
    db.get.mockReset();
  });

  it('returns entity, full source filename, period and scale from the durable Statement list', async () => {
    const durable = {
      id: 'statement-1',
      entity_name: 'CD PROJEKT S.A.',
      source_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
      statement_type: 'P&L',
      period_label: '2025',
      currency: 'PLN',
      scaling: 'thousands',
    };
    db.all.mockResolvedValueOnce([durable]);

    await expect(listStatements('org-1')).resolves.toEqual([durable]);
    expect(String(db.all.mock.calls[0][0])).toContain('fs.entity_name');
    expect(String(db.all.mock.calls[0][0])).toContain('fs.source_file_name');
  });

  it('keeps entity and source identity on statements nested in pack detail', async () => {
    db.get.mockResolvedValueOnce({
      id: 'pack-1',
      organization_id: 'org-1',
      entity_name: 'CD PROJEKT S.A.',
      scaling: 'thousands',
    });
    db.all
      .mockResolvedValueOnce([
        {
          id: 'statement-1',
          entity_name: 'CD PROJEKT S.A.',
          source_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
          statement_type: 'P&L',
          period_label: '2025',
          scaling: 'thousands',
        },
      ])
      .mockResolvedValueOnce([]);

    const detail = await getStatementPackDetail('org-1', 'pack-1');
    expect(detail.statements[0]).toMatchObject({
      entity_name: 'CD PROJEKT S.A.',
      source_file_name: 'CD_PROJEKT_Skonsolidowane_Sprawozdanie_FY2025.pdf',
      period_label: '2025',
      scaling: 'thousands',
    });
    expect(String(db.all.mock.calls[0][0])).toContain('fs.entity_name');
  });
});
