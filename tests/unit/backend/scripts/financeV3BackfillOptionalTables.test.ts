import { describe, expect, it, vi } from 'vitest';

import {
  allFinanceOrganizationIds,
  catalogOptionalHistoricalFinanceTables,
  ensureMutableBackfillWorkingRevision,
  OPTIONAL_HISTORICAL_FINANCE_TABLES,
} from '../../../../server/scripts/finance-v3-backfill-dry-run';

describe('Finance v3 backfill current-schema prerequisites', () => {
  it('treats absent optional historical tables as zero input', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(catalogOptionalHistoricalFinanceTables({ query } as never)).resolves.toEqual(
      new Set()
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('to_regclass'), [
      [...OPTIONAL_HISTORICAL_FINANCE_TABLES],
    ]);
  });

  it('keeps present optional historical tables processable', async () => {
    const query = vi
      .fn()
      .mockResolvedValue({
        rows: [{ table_name: 'analysis_financials' }, { table_name: 'initiative_financials' }],
      });
    await expect(catalogOptionalHistoricalFinanceTables({ query } as never)).resolves.toEqual(
      new Set(OPTIONAL_HISTORICAL_FINANCE_TABLES)
    );
  });

  it('preserves the synthetic org-fv3 dry-run boundary', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'org-fv3-alpha' }] });
    await expect(allFinanceOrganizationIds({ query } as never)).resolves.toEqual([
      'org-fv3-alpha',
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/LIKE 'org-fv3-%'.*NOT LIKE '%ghost%'/));
  });

  it('repairs a late mutable version once and replays to the same revision', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ next: 1 }] })
      .mockResolvedValueOnce({ rows: [{ working_revision_id: 'wr-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ working_revision_id: 'wr-1' }] });
    const params = {
      artifactId: 'artifact-1',
      businessVersionId: 'bv-1',
      organizationId: 'org-1',
      contentHash: 'hash-1',
    };
    await expect(ensureMutableBackfillWorkingRevision({ query } as never, params)).resolves.toBe(
      'wr-1'
    );
    await expect(ensureMutableBackfillWorkingRevision({ query } as never, params)).resolves.toBe(
      'wr-1'
    );
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes('INSERT INTO finance_working_revisions')
      )
    ).toHaveLength(1);
  });
});
