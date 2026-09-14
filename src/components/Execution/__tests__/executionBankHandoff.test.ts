/**
 * H2 (DEC-453 pkt b) — ślad przekazania inicjatywy do Realizacji.
 *
 * Sedno testu to SANITIZER: wiersz ze statusem wykonawczym, pod którym nie ma
 * przyjętej paczki przekazania, musi zostać WIDOCZNY i oznaczony, a nie
 * ukryty. Reguła z pamięci nadzorcy: rejestr wygrywa ze statusem wiersza —
 * niezgodność ma być widać, nie zamieść.
 */
import { describe, expect, it } from 'vitest';

import { buildExecutionBankHandoff, buildExecutionBankRows } from '../executionBankModel';

describe('buildExecutionBankHandoff', () => {
  it('przyjęta paczka z datą to pełny ślad', () => {
    const handoff = buildExecutionBankHandoff('IN_EXECUTION', {
      handoffPackageId: 'pkg-1',
      handoffPackageVersion: 2,
      acceptedAt: '2026-09-12T10:00:00.000Z',
    });
    expect(handoff.status).toBe('ACCEPTED');
    expect(handoff.acceptedAt).toBe('2026-09-12T10:00:00.000Z');
    expect(handoff.packageVersion).toBe(2);
    expect(handoff.missingForInExecution).toBe(false);
  });

  it('paczka bez daty to ślad NIEPEŁNY, nie brak', () => {
    const handoff = buildExecutionBankHandoff('APPROVED', {
      handoffPackageId: 'pkg-1',
      acceptedAt: null,
    });
    expect(handoff.status).toBe('LINKED_WITHOUT_DATE');
  });

  it('niepoprawna data nie udaje przyjęcia', () => {
    const handoff = buildExecutionBankHandoff('APPROVED', {
      handoffPackageId: 'pkg-1',
      acceptedAt: 'wczoraj',
    });
    expect(handoff.status).toBe('LINKED_WITHOUT_DATE');
    expect(handoff.acceptedAt).toBeNull();
  });

  it.each(['IN_EXECUTION', 'EXECUTING', 'in_execution'])(
    'SANITIZER: status %s bez przekazania podnosi ostrzeżenie',
    (status) => {
      expect(buildExecutionBankHandoff(status, null).missingForInExecution).toBe(true);
    }
  );

  it('status nie-wykonawczy bez przekazania to normalny stan, nie ostrzeżenie', () => {
    expect(buildExecutionBankHandoff('APPROVED', null).missingForInExecution).toBe(false);
    expect(buildExecutionBankHandoff('DRAFT', null).missingForInExecution).toBe(false);
  });
});

describe('buildExecutionBankRows — przekazanie na wierszu', () => {
  const asOf = '2026-09-14T00:00:00.000Z';

  it('wiersz z realizacją niesie datę przekazania', () => {
    const rows = buildExecutionBankRows(
      [{ id: 'ini-1', name: 'Alpha', lifecycleStatus: 'IN_EXECUTION' }],
      [
        {
          executionCaseId: 'case-1',
          initiativeId: 'ini-1',
          state: 'ACTIVE',
          handoffPackageId: 'pkg-1',
          acceptedAt: '2026-09-10T08:00:00.000Z',
        },
      ],
      { asOf }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].handoff.status).toBe('ACCEPTED');
    expect(rows[0].handoff.missingForInExecution).toBe(false);
  });

  it('inicjatywa w toku BEZ realizacji zostaje w banku z ostrzeżeniem', () => {
    const rows = buildExecutionBankRows(
      [{ id: 'ini-2', name: 'Beta', lifecycleStatus: 'IN_EXECUTION' }],
      [],
      { asOf }
    );
    // Nie ukrywamy — wiersz jest, a niezgodność jest nazwana.
    expect(rows).toHaveLength(1);
    expect(rows[0].handoff.status).toBe('ABSENT');
    expect(rows[0].handoff.missingForInExecution).toBe(true);
  });
});
