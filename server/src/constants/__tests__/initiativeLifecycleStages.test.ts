/**
 * H1c / DEC-506 — test tabeli mapowania 12 etapów silnika → 7 kodów kolumny.
 *
 * Test pilnuje TRZECH rzeczy, każdej z innego powodu:
 *
 *  1. KOMPLETNOŚĆ — każdy z 12 etapów ma cel i ten cel jest jednym z 7 kodów
 *     przepuszczanych przez CHECK `initiatives_status_check_p12`. Bez tego
 *     wracamy dokładnie do blokera H1b (cel da się zaproponować, nie da się
 *     zapisać).
 *  2. PARYTET Z KONTRAKTEM KLIENTA — `src/contracts/initiatives-execution/
 *     statusMapping.ts` ma tę samą tabelę dla odczytu. Dwie tabele = dwie
 *     prawdy = „naprawa po jednej powierzchni". Ten test porównuje je
 *     pozycja po pozycji (wzorzec z `clientContractParity.integration.test.ts`).
 *  3. BRAK ZGADYWANIA — wartość spoza obu słowników daje `null`, nie „DRAFT
 *     na wszelki wypadek" (canon §5.5 wprost zakazuje zgadywania).
 */
import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '../initiativeStatuses.js';
import {
  INITIATIVE_LIFECYCLE_STAGES,
  INITIATIVE_STAGE_TO_STATUS,
  INITIATIVE_STATUS_TO_STAGES,
  LEGACY_TARGET_TO_STAGE,
  isValidInitiativeStageStep,
  resolveInitiativeLifecycleStage,
  resolveInitiativeStageWriteTarget,
} from '../initiativeLifecycleStages.js';

/** Dokładnie wartości `targetStatus` z `EarlyLifecycleProposalSchema`. */
const PROPOSABLE_TARGETS = ['PROMOTED', 'PLANNING', 'SCHEDULED', 'EXECUTING', 'DONE'] as const;

describe('H1c — mapowanie 12 etapów silnika na 7 kodów kolumny', () => {
  it('ma dokładnie 12 etapów w kolejności canonu §5.2', () => {
    expect(INITIATIVE_LIFECYCLE_STAGES).toHaveLength(12);
    expect(INITIATIVE_LIFECYCLE_STAGES[0]).toBe('REGISTERED_DRAFT');
    expect(INITIATIVE_LIFECYCLE_STAGES[11]).toBe('ARCHIVED');
  });

  it('KAŻDY z 12 etapów ma cel, i to cel zapisywalny w kolumnie (7 kodów P12)', () => {
    const writable = new Set<string>(Object.values(InitiativeStatus));
    for (const stage of INITIATIVE_LIFECYCLE_STAGES) {
      const target = INITIATIVE_STAGE_TO_STATUS[stage];
      expect(target, `etap ${stage} bez celu`).toBeTruthy();
      expect(writable.has(target), `etap ${stage} → ${target} nie przejdzie CHECK P12`).toBe(true);
    }
  });

  it('odwrotność jest spójna: każdy etap wraca w liście swojego kodu', () => {
    for (const stage of INITIATIVE_LIFECYCLE_STAGES) {
      const status = INITIATIVE_STAGE_TO_STATUS[stage];
      expect(INITIATIVE_STATUS_TO_STAGES[status]).toContain(stage);
    }
    // PROPOSED i REJECTED nie mają etapu-źródła (canon §5.1/§5.3) — to jest
    // świadoma pustka, nie przeoczenie.
    expect(INITIATIVE_STATUS_TO_STAGES.PROPOSED).toEqual([]);
    expect(INITIATIVE_STATUS_TO_STAGES.REJECTED).toEqual([]);
  });

  it('★ pięć celów z EarlyLifecycleProposalSchema JEST ZAPISYWALNYCH (bloker H1b zdjęty)', () => {
    const resolved = PROPOSABLE_TARGETS.map((t) => [t, resolveInitiativeStageWriteTarget(t)] as const);
    for (const [target, out] of resolved) {
      expect(out, `cel ${target} nadal bez mapowania`).not.toBeNull();
    }
    expect(Object.fromEntries(resolved.map(([t, o]) => [t, o!.stage]))).toEqual({
      PROMOTED: 'READY_FOR_DECISION',
      PLANNING: 'READY_FOR_DECISION',
      SCHEDULED: 'SCHEDULED',
      EXECUTING: 'IN_EXECUTION',
      DONE: 'CLOSED',
    });
    expect(Object.fromEntries(resolved.map(([t, o]) => [t, o!.status]))).toEqual({
      PROMOTED: InitiativeStatus.PENDING_APPROVAL,
      PLANNING: InitiativeStatus.PENDING_APPROVAL,
      SCHEDULED: InitiativeStatus.APPROVED,
      EXECUTING: InitiativeStatus.IN_EXECUTION,
      DONE: InitiativeStatus.CLOSED,
    });
  });

  it('ARCHIVED jest jedynym etapem podnoszącym flagę archived', () => {
    for (const stage of INITIATIVE_LIFECYCLE_STAGES) {
      expect(resolveInitiativeStageWriteTarget(stage)!.archived).toBe(stage === 'ARCHIVED');
    }
  });

  it('nie zgaduje: wartość spoza obu słowników daje null (canon §5.5)', () => {
    expect(resolveInitiativeLifecycleStage('NOT_A_REAL_STAGE')).toBeNull();
    expect(resolveInitiativeLifecycleStage('')).toBeNull();
    expect(resolveInitiativeLifecycleStage(null)).toBeNull();
    expect(resolveInitiativeStageWriteTarget('STEP3_REVIEW')).toBeNull();
  });

  it('łańcuch etapów jest liniowy i nie da się cofnąć po cichu', () => {
    expect(isValidInitiativeStageStep('APPROVED_BACKLOG', 'SCHEDULED')).toBe(true);
    expect(isValidInitiativeStageStep('SCHEDULED', 'IN_EXECUTION')).toBe(true);
    expect(isValidInitiativeStageStep('IN_EXECUTION', 'SCHEDULED')).toBe(false);
    expect(isValidInitiativeStageStep('ARCHIVED', 'CLOSED')).toBe(false);
  });
});

describe('H1c — parytet z kontraktem klienta (jedna tabela, nie dwie)', () => {
  it('runtime-to-status klienta == INITIATIVE_STAGE_TO_STATUS serwera', async () => {
    const { mapInitiativeStatus } = await import(
      '../../../../src/contracts/initiatives-execution/statusMapping'
    );
    for (const stage of INITIATIVE_LIFECYCLE_STAGES) {
      const client = mapInitiativeStatus({ direction: 'runtime-to-status', lifecycle: stage });
      expect(client.status, `rozjazd na etapie ${stage}`).toBe(INITIATIVE_STAGE_TO_STATUS[stage]);
      expect(client.archived, `rozjazd flagi archived na ${stage}`).toBe(
        resolveInitiativeStageWriteTarget(stage)!.archived
      );
    }
  });

  it('legacy-to-runtime klienta == LEGACY_TARGET_TO_STAGE serwera (19 kluczy)', async () => {
    const { mapInitiativeStatus } = await import(
      '../../../../src/contracts/initiatives-execution/statusMapping'
    );
    const keys = Object.keys(LEGACY_TARGET_TO_STAGE);
    expect(keys).toHaveLength(19);
    for (const key of keys) {
      expect(
        mapInitiativeStatus({ direction: 'legacy-to-runtime', status: key }),
        `rozjazd na kodzie zastanym ${key}`
      ).toBe(LEGACY_TARGET_TO_STAGE[key]);
    }
  });

  it('status-to-runtime klienta == INITIATIVE_STATUS_TO_STAGES serwera', async () => {
    const { mapInitiativeStatus } = await import(
      '../../../../src/contracts/initiatives-execution/statusMapping'
    );
    for (const status of Object.values(InitiativeStatus)) {
      expect(
        mapInitiativeStatus({ direction: 'status-to-runtime', status }),
        `rozjazd na kodzie ${status}`
      ).toEqual(INITIATIVE_STATUS_TO_STAGES[status]);
    }
  });

  it('7→12 wybiera kanoniczne etapy bez cofania PENDING_APPROVAL i CLOSED', async () => {
    const { mapInitiativeStatus } = await import(
      '../../../../src/contracts/initiatives-execution/statusMapping'
    );

    expect(
      mapInitiativeStatus({ direction: 'legacy-to-runtime', status: 'PENDING_APPROVAL' })
    ).toBe('READY_FOR_DECISION');
    expect(mapInitiativeStatus({ direction: 'legacy-to-runtime', status: 'CLOSED' })).toBe(
      'CLOSED'
    );
    expect(resolveInitiativeLifecycleStage('PENDING_APPROVAL')).toBe('READY_FOR_DECISION');
    expect(resolveInitiativeLifecycleStage('CLOSED')).toBe('CLOSED');
  });
});
