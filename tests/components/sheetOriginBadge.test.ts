/**
 * Badge „model finansowy vs eksport tabeli" (inwentarz Excel 27.07).
 *
 * Na demo 61/75 artefaktów `sheet` to płaskie eksporty Table Studio
 * (`registerGovernedTableSheetArtifact`, `table-platform.routes.ts:2155+`),
 * 6 to realne workbooki (`generated_workbooks`, `workbook.routes.ts`). Obie
 * ścieżki rejestrują z `originRuntime: 'sheet'`, więc runtime SAM nie
 * rozróżnia pochodzenia — lista pokazywała gołe „Sheet" dla obu, fałszując
 * obraz („tabele o niczym").
 *
 * Różnicownik: `originSummary.sourceTable === 'tp_tables'` — jedyne pole,
 * które `registerGovernedTableSheetArtifact` zawsze stempluje, a workbooki
 * nigdy. Test jest deterministyczny: karmimy mapper surowym kształtem wiersza
 * indeksu (`GET /api/artifacts?outputType=sheet`), zero bazy/fetch.
 */

import { describe, expect, it } from 'vitest';

import { mapRegistryItemToUnified, resolveSheetOrigin } from '@/components/ReportsAndPresentations/useRapData';

function sheetRow(originSummary: Record<string, unknown> | null, overrides: object = {}) {
  return {
    artifactId: 'artifact-1',
    originRuntime: 'sheet',
    originRecordId: 'record-1',
    resolvedTitle: 'Model kosztowy Q3',
    originStatus: 'ready',
    originSummary,
    ...overrides,
  };
}

describe('resolveSheetOrigin', () => {
  it('rozpoznaje płaski eksport tabeli po originSummary.sourceTable === tp_tables', () => {
    expect(
      resolveSheetOrigin({
        originSummary: { sourceTable: 'tp_tables', exportFormat: 'xlsx', governanceMode: 'governed' },
      })
    ).toBe('table_export');
  });

  it('rozpoznaje realny workbook, gdy brak markera sourceTable', () => {
    expect(
      resolveSheetOrigin({
        originSummary: { title: 'Model kosztowy', sheetCount: 3, exportFormat: 'xlsx', source: 'chat' },
      })
    ).toBe('workbook');
  });

  it('domyślnie workbook, gdy originSummary jest puste/brak', () => {
    expect(resolveSheetOrigin({ originSummary: null })).toBe('workbook');
    expect(resolveSheetOrigin({})).toBe('workbook');
  });
});

describe('mapRegistryItemToUnified — sheetOrigin na wierszu UnifiedOutputRow', () => {
  it('oznacza wiersz z tp_tables jako table_export', () => {
    const row = mapRegistryItemToUnified(
      sheetRow({ sourceTable: 'tp_tables', exportFormat: 'xlsx', governanceMode: 'governed' })
    );
    expect(row?.kind).toBe('sheet');
    expect(row?.sheetOrigin).toBe('table_export');
  });

  it('oznacza wiersz generated_workbooks jako workbook', () => {
    const row = mapRegistryItemToUnified(
      sheetRow({ title: 'Model kosztowy', sheetCount: 5, exportFormat: 'xlsx', source: 'chat' })
    );
    expect(row?.kind).toBe('sheet');
    expect(row?.sheetOrigin).toBe('workbook');
  });

  it('nie dotyka innych kind (document/presentation) — brak pola sheetOrigin', () => {
    const documentRow = mapRegistryItemToUnified({
      artifactId: 'artifact-2',
      originRuntime: 'report',
      originRecordId: 'record-2',
      resolvedTitle: 'Raport tygodniowy',
      originStatus: 'ready',
    });
    expect(documentRow?.kind).toBe('document');
    expect(documentRow?.sheetOrigin).toBeUndefined();
  });
});
