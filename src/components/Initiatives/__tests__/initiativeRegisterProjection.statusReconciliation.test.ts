import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '@/types';
import type {
  LegacyInitiativeApiRow,
  RegisteredInitiativeReadModel,
} from '@/services/initiatives-execution/runtimeApi';

import {
  mergeLegacyInitiativesIntoRegister,
  toCanonicalInitiativeRegisterItem,
  toCanonicalInitiativeRegisterItemFromLegacyRow,
} from '../initiativeRegisterProjection';

/**
 * N2 (odbiór adwersaryjny 20260910, WAŻNY) — zmierzone na org DBR77
 * (`consultify_kopia_e1a`, JOIN `initiatives` × `ie_aggregate_state`):
 * "IoT Sensor Network Deployment" ma `initiatives.status = PENDING_APPROVAL`
 * (to samo pokazuje karta), ale runtime-v1 `lifecycleState = APPROVED_BACKLOG`
 * (przestarzały zapis) → `mergeLegacyInitiativesIntoRegister` wybierał
 * kanoniczny (runtime) wiersz w całości, więc rejestr pokazywał "Zatwierdzona"
 * zamiast "Do zatwierdzenia". Ten test odtwarza DOKŁADNIE ten rekord.
 */
describe('mergeLegacyInitiativesIntoRegister — status reconciliation on id collision (N2)', () => {
  const SHARED_ID = 'e3b0a66a-dc86-4730-84e0-cdffb66cbed6'; // "IoT Sensor Network Deployment" (DBR77)

  const runtimeRecord: RegisteredInitiativeReadModel = {
    version: 2,
    updatedAt: '2026-09-01T00:00:00.000Z',
    initiative: {
      initiativeId: SHARED_ID,
      lifecycleState: 'APPROVED_BACKLOG',
      title: 'IoT Sensor Network Deployment',
      problem: 'Legacy sensors report failures late.',
      proposedOutcome: 'Real-time fault detection.',
      priority: 'HIGH',
      projectId: 'proj-dbr77-1',
      readiness: 'NOT_EVALUATED',
    },
  };

  const legacyRow: LegacyInitiativeApiRow = {
    id: SHARED_ID,
    name: 'IoT Sensor Network Deployment',
    title: 'IoT Sensor Network Deployment',
    status: 'PENDING_APPROVAL',
  };

  it('canonical row alone (pre-fix shape) would carry the stale APPROVED status', () => {
    const canonicalRow = toCanonicalInitiativeRegisterItem(runtimeRecord);
    expect(canonicalRow.status).toBe(InitiativeStatus.APPROVED);
  });

  it('legacy row carries the true PENDING_APPROVAL status', () => {
    const legacyCanonicalRow = toCanonicalInitiativeRegisterItemFromLegacyRow(legacyRow);
    expect(legacyCanonicalRow.status).toBe(InitiativeStatus.PENDING_APPROVAL);
  });

  it(
    'register STATUS = the same status the card shows (classic-table truth), ' +
      'not the possibly-stale runtime-v1 lifecycle — fixture PENDING_APPROVAL ' +
      'with lifecycleState APPROVED_* must yield "Do zatwierdzenia", not "Zatwierdzona"',
    () => {
      const canonicalRow = toCanonicalInitiativeRegisterItem(runtimeRecord);
      const legacyCanonicalRow = toCanonicalInitiativeRegisterItemFromLegacyRow(legacyRow);

      const merged = mergeLegacyInitiativesIntoRegister([canonicalRow], [legacyCanonicalRow]);

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe(SHARED_ID);
      // MUTATION GUARD: this is the exact assertion that fails (APPROVED) if
      // the reconciliation in mergeLegacyInitiativesIntoRegister is removed.
      expect(merged[0].status).toBe(InitiativeStatus.PENDING_APPROVAL);
      expect(merged[0].displayStatus).toBe(legacyCanonicalRow.displayStatus);
    }
  );

  it('leaves the canonical row untouched when both sides already agree on status', () => {
    const agreeingLegacyRow: LegacyInitiativeApiRow = { ...legacyRow, status: 'APPROVED' };
    const canonicalRow = toCanonicalInitiativeRegisterItem(runtimeRecord); // APPROVED
    const legacyCanonicalRow = toCanonicalInitiativeRegisterItemFromLegacyRow(agreeingLegacyRow);

    const merged = mergeLegacyInitiativesIntoRegister([canonicalRow], [legacyCanonicalRow]);

    expect(merged[0].status).toBe(InitiativeStatus.APPROVED);
  });

  it('is a no-op (same reference) when there are no legacy rows at all', () => {
    const canonicalRows = [toCanonicalInitiativeRegisterItem(runtimeRecord)];
    expect(mergeLegacyInitiativesIntoRegister(canonicalRows, [])).toBe(canonicalRows);
  });
});
