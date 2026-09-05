/**
 * Patrz `../statusCounts.ts` — chipy statusów w zakładce „Dokumenty" pokazywały
 * 0 przy 79 rekordach, bo licznik czytał `status`, a wiersze
 * (`UnifiedOutputRow`) trzymają status w `statusKey`; filtr tabeli czytał
 * `statusKey`, więc licznik i filtr rozjeżdżały się na tym samym wierszu.
 *
 * Test broni ZABEZPIECZENIA: liczy się to samo pole, po którym filtruje tabela,
 * a suma chipów musi zgadzać się z liczbą wierszy.
 *
 * DOWÓD MUTACYJNY (wykonany): powrót `statusFieldForScope` do stałego 'status'
 * → czerwienieją 4 z 6 przypadków.
 */
import { describe, expect, it } from 'vitest';

import { REPORT_STATUS_META, type UnifiedOutputRow } from '../types';
import { countRowsByStatus, statusFieldForScope } from '../statusCounts';

function docRow(statusKey: string): Partial<UnifiedOutputRow> {
  return { kind: 'document', statusKey, title: 't', originRecordId: 'x' };
}

describe('countRowsByStatus — liczniki statusów Menu 3', () => {
  it('„Dokumenty" liczą po statusKey (a nie po nieistniejącym status)', () => {
    const rows = [docRow('draft'), docRow('draft'), docRow('archived')];
    expect(countRowsByStatus(rows as never, 'outputs_documents')).toEqual({
      draft: 2,
      archived: 1,
    });
  });

  it('suma chipów równa się liczbie wierszy (żaden wiersz nie ginie)', () => {
    const rows = [docRow('draft'), docRow('ready'), docRow('exported'), docRow('archived')];
    const counts = countRowsByStatus(rows as never, 'outputs_documents');
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(rows.length);
  });

  it('każdy klucz statusu z REPORT_STATUS_META daje niezerowy licznik, gdy taki wiersz istnieje', () => {
    const keys = Object.keys(REPORT_STATUS_META);
    const rows = keys.map((k) => docRow(k));
    const counts = countRowsByStatus(rows as never, 'outputs_documents');
    for (const key of keys) expect(counts[key]).toBe(1);
  });

  it('szablony i prezentacje dalej liczą po polu status (zero regresji)', () => {
    const templates = [{ status: 'approved' }, { status: 'approved' }, { status: 'draft' }];
    expect(countRowsByStatus(templates, 'templates')).toEqual({ approved: 2, draft: 1 });
    expect(countRowsByStatus([{ status: 'generated' }], 'presentations')).toEqual({
      generated: 1,
    });
  });

  it('pole źródłowe jest jawne per zakładka', () => {
    expect(statusFieldForScope('outputs_documents')).toBe('statusKey');
    expect(statusFieldForScope('templates')).toBe('status');
    expect(statusFieldForScope('presentations')).toBe('status');
  });

  it('puste/nieznane statusy nie tworzą chipa-śmiecia', () => {
    expect(countRowsByStatus([docRow(''), docRow('  ')] as never, 'outputs_documents')).toEqual({});
  });
});
