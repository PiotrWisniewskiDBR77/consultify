import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncStatementToPack } = vi.hoisted(() => ({
  syncStatementToPack: vi.fn(async () => 'pack-1'),
}));

vi.mock('../financialStatementPackService.js', () => ({ syncStatementToPack }));

import {
  shouldDeferStatementPackSync,
  syncStatementPackAfterValues,
} from '../financialStatementValueWriteService.js';

describe('statement value writes for staged structured imports', () => {
  beforeEach(() => syncStatementToPack.mockClear());

  it('keeps a staged import pack-null until confirm', async () => {
    expect(
      shouldDeferStatementPackSync({
        extraction_strategy: 'spreadsheet_structured_staged',
        status: 'mapped',
      })
    ).toBe(true);
    await expect(
      syncStatementPackAfterValues('statement-staged', {
        extraction_strategy: 'spreadsheet_structured_staged',
        status: 'mapped',
      })
    ).resolves.toBeNull();
    expect(syncStatementToPack).not.toHaveBeenCalled();
  });

  it('preserves ordinary value-write pack sync and resumes it after confirm', async () => {
    expect(
      shouldDeferStatementPackSync({
        extraction_strategy: 'spreadsheet_structured',
        status: 'mapped',
      })
    ).toBe(false);
    await expect(
      syncStatementPackAfterValues('statement-ordinary', {
        extraction_strategy: 'spreadsheet_structured',
        status: 'mapped',
      })
    ).resolves.toBe('pack-1');
    await expect(
      syncStatementPackAfterValues('statement-confirmed', {
        extraction_strategy: 'spreadsheet_structured_staged',
        status: 'confirmed',
      })
    ).resolves.toBe('pack-1');
    expect(syncStatementToPack).toHaveBeenNthCalledWith(1, 'statement-ordinary');
    expect(syncStatementToPack).toHaveBeenNthCalledWith(2, 'statement-confirmed');
  });
});
