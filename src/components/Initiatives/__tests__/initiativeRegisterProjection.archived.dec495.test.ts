import { describe, expect, it } from 'vitest';

import {
  isArchivedInitiative,
  rowMatchesRegisterScope,
  toCanonicalInitiativeRegisterItemFromLegacyRow,
} from '../initiativeRegisterProjection';

/**
 * DEC-495 — „wszystko co zarchiwizowane jest z zalozenia ukryte, ale mozna
 * archiwalne przywolac".
 *
 * O archiwum decyduje FLAGA `archived`, nie status: migracja P12 skasowala
 * status 'ARCHIVED' ze slownika 12 etapow, a `/archive` zapisuje
 * `initiatives.archived = TRUE` zostawiajac status CLOSED albo REJECTED.
 */
describe('DEC-495 — zakres rejestru Inicjatyw', () => {
  const row = (over: Record<string, unknown> = {}) =>
    ({ id: 'i1', status: 'CLOSED', archived: false, ...over }) as {
      archived?: boolean | null;
      status?: unknown;
    };

  it('przewodzi flage `archived` z wiersza legacy do modelu rejestru', () => {
    expect(
      toCanonicalInitiativeRegisterItemFromLegacyRow({
        id: 'i-arch',
        status: 'CLOSED',
        archived: true,
      } as any).archived
    ).toBe(true);
    expect(
      toCanonicalInitiativeRegisterItemFromLegacyRow({ id: 'i-live', status: 'APPROVED' } as any)
        .archived
    ).toBe(false);
  });

  it('archiwalna inicjatywa jest ukryta w „Aktywne" I w „Wszystkie"', () => {
    const archived = row({ archived: true, status: 'CLOSED' });
    expect(rowMatchesRegisterScope(archived, 'active')).toBe(false);
    expect(rowMatchesRegisterScope(archived, 'all')).toBe(false);
  });

  it('„Archiwalne" pokazuje WYLACZNIE zarchiwizowane', () => {
    expect(rowMatchesRegisterScope(row({ archived: true }), 'archived')).toBe(true);
    expect(rowMatchesRegisterScope(row({ archived: false, status: 'APPROVED' }), 'archived')).toBe(
      false
    );
    // Zamknieta, ale NIE zarchiwizowana — nalezy do „Wszystkie", nie do archiwum.
    expect(rowMatchesRegisterScope(row({ archived: false, status: 'CLOSED' }), 'archived')).toBe(
      false
    );
  });

  it('status CLOSED/REJECTED sam w sobie NIE oznacza archiwum', () => {
    const closed = row({ archived: false, status: 'CLOSED' });
    expect(isArchivedInitiative(closed)).toBe(false);
    expect(rowMatchesRegisterScope(closed, 'all')).toBe(true);
    // „Aktywne" nadal je odcina — to odrebna, wczesniejsza regula.
    expect(rowMatchesRegisterScope(closed, 'active')).toBe(false);
  });

  it('wiersz bez flagi (projekcja runtime-v1) liczy sie jako aktualny', () => {
    const unknownFlag = { id: 'rt1', status: 'IN_EXECUTION' } as { archived?: boolean | null };
    expect(rowMatchesRegisterScope(unknownFlag, 'active')).toBe(true);
    expect(rowMatchesRegisterScope(unknownFlag, 'archived')).toBe(false);
  });
});
