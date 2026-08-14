/**
 * Test kontraktowy adaptera Audits ↔ wspólny kernel metodyczny.
 *
 * Contract SHA: e3b8be6cd706e2b563c84d0b5980f91d0eb8de5c
 *
 * Adapter jest rozcięty na dwie połowy, bo `server/tsconfig.json` ma
 * `rootDir: "server"` i kod serwera nie może zaimportować kontraktu z `src/`.
 * Ten test jest jedynym miejscem, w którym obie połowy spotykają się z samym
 * kontraktem — bez niego rozjazd nazw byłby niewykrywalny do czasu awarii na
 * produkcji.
 */
import { describe, expect, it } from 'vitest';

import {
  METHOD_EVENT_TYPES,
  METHOD_PROCESS_ROLES,
  METHOD_SESSION_STATES,
  TERESA_CAPABILITIES,
  canTransition,
} from '@/method-core/contracts';
import {
  AUDIT_EVENT_TO_KERNEL_EVENT,
  AUDIT_INTENT_TO_TERESA_CAPABILITY,
  AUDIT_ROLE_TO_KERNEL_ROLE,
  KERNEL_EVENT_GAPS,
  LIFECYCLE_TO_KERNEL_STATE,
  TERESA_CAPABILITY_GAPS,
  aggregate,
  computeScore,
  isKernelLegalTransition,
  resolveOpenLevels,
  toKernelEvent,
  toKernelRole,
  toKernelState,
  type AuditLifecycleState,
} from '../auditsKernelAdapter';
import {
  AUDIT_TO_KERNEL_EVENT,
  KERNEL_EVENT_TYPES,
} from '../../../../server/src/services/audits/kernelEventMap';

describe('adapter ↔ kontrakt: zgodność powierzchni', () => {
  it('serwerowa lista zdarzeń jest identyczna z kontraktem', () => {
    expect([...KERNEL_EVENT_TYPES]).toEqual([...METHOD_EVENT_TYPES]);
  });

  it('obie połowy mapy zdarzeń są identyczne', () => {
    expect(AUDIT_TO_KERNEL_EVENT).toEqual(AUDIT_EVENT_TO_KERNEL_EVENT);
  });

  it('każde zmapowane zdarzenie audytu celuje w istniejący typ kernela', () => {
    for (const [auditEvent, kernelEvent] of Object.entries(AUDIT_EVENT_TO_KERNEL_EVENT)) {
      expect(
        (METHOD_EVENT_TYPES as readonly string[]).includes(kernelEvent),
        `${auditEvent} → ${kernelEvent} nie istnieje w kontrakcie`,
      ).toBe(true);
    }
  });

  it('adapter nie wymyśla własnych typów zdarzeń', () => {
    const used = new Set(Object.values(AUDIT_EVENT_TO_KERNEL_EVENT));
    for (const type of used) {
      expect(METHOD_EVENT_TYPES as readonly string[]).toContain(type);
    }
  });

  it('nieznane zdarzenie domenowe daje null, a nie zgadnięty typ', () => {
    expect(toKernelEvent('cos.czego.nie.ma')).toBeNull();
  });
});

describe('adapter ↔ kontrakt: stany sesji', () => {
  it('wszystkie 11 etapów audytu mapuje się na stany kernela', () => {
    const stages = Object.keys(LIFECYCLE_TO_KERNEL_STATE) as AuditLifecycleState[];
    expect(stages).toHaveLength(11);
    for (const stage of stages) {
      expect(METHOD_SESSION_STATES as readonly string[]).toContain(toKernelState(stage));
    }
  });

  it('adapter nie rozszerza zamkniętego zbioru stanów kernela', () => {
    const mapped = new Set(Object.values(LIFECYCLE_TO_KERNEL_STATE));
    for (const state of mapped) {
      expect(METHOD_SESSION_STATES as readonly string[]).toContain(state);
    }
  });

  it('naprawa i weryfikacja skuteczności są sub-etapami stanu frozen', () => {
    // Po zatwierdzeniu raportu wynik audytu jest zamrożony; zmienia się status
    // działań, a nie ustalenia. Gdyby naprawa wracała audyt do `active`,
    // zatwierdzone ustalenia znów byłyby edytowalne.
    expect(toKernelState('remediation')).toBe('frozen');
    expect(toKernelState('effectiveness_verification')).toBe('frozen');
    expect(toKernelState('closure')).toBe('frozen');
  });

  it('przejścia domenowe w obrębie jednego stanu kernela są legalne', () => {
    expect(isKernelLegalTransition('remediation', 'effectiveness_verification')).toBe(true);
    expect(isKernelLegalTransition('fieldwork', 'evidence_review')).toBe(true);
  });

  it('przejście do frozen nie omija przeglądu — zgodnie z kontraktem', () => {
    // Kontrakt: nie ma ścieżki do `frozen` z pominięciem `in_review`.
    expect(canTransition('active', 'frozen')).toBe(false);
    expect(canTransition('in_review', 'frozen')).toBe(true);
    // Domenowo: z terenu nie da się wskoczyć w naprawę.
    expect(isKernelLegalTransition('fieldwork', 'remediation')).toBe(false);
  });

  it('frozen nie jest terminalny — ponowne otwarcie jest legalne', () => {
    expect(canTransition('frozen', 'active')).toBe(true);
  });
});

describe('adapter ↔ kontrakt: role', () => {
  it('każda rola audytowa mapuje się na istniejącą rolę procesu', () => {
    for (const [auditRole, kernelRole] of Object.entries(AUDIT_ROLE_TO_KERNEL_ROLE)) {
      expect(
        (METHOD_PROCESS_ROLES as readonly string[]).includes(kernelRole),
        `${auditRole} → ${kernelRole} nie istnieje w kontrakcie`,
      ).toBe(true);
    }
  });

  it('nieznana rola degraduje do obserwatora, nie do właściciela', () => {
    // Kierunek błędu ma znaczenie: nieznana rola nie może dostać uprawnień.
    expect(toKernelRole('cos_nieznanego' as never)).toBe('observer');
  });
});

describe('adapter ↔ kontrakt: Teresa', () => {
  it('zmapowane intencje celują w istniejące capabilities kernela', () => {
    for (const [intent, capability] of Object.entries(AUDIT_INTENT_TO_TERESA_CAPABILITY)) {
      if (capability === null) continue;
      expect(
        (TERESA_CAPABILITIES as readonly string[]).includes(capability),
        `${intent} → ${capability} nie istnieje w kontrakcie`,
      ).toBe(true);
    }
  });

  it('luki są zadeklarowane jawnie, nie naciągane na cudze znaczenia', () => {
    for (const gap of TERESA_CAPABILITY_GAPS) {
      expect(AUDIT_INTENT_TO_TERESA_CAPABILITY[gap]).toBeNull();
    }
    // Lista luk nie rośnie po cichu — zmiana wymaga świadomej edycji testu.
    expect([...TERESA_CAPABILITY_GAPS]).toEqual([
      'propose_corrective_options',
      'draft_auditor_note',
    ]);
  });
});

describe('adapter: audyt nie udaje metody z poziomami', () => {
  it('resolveOpenLevels zwraca uczciwe „brak poziomów", nie zgadniętą liczbę', () => {
    const result = resolveOpenLevels({
      unitId: 'c1',
      confirmedLevels: [],
      evidenceByLevel: {},
    });
    expect(result.currentLevel).toBeNull();
    expect(result.openLevels).toEqual([]);
    expect(result.aboveGapLevels).toEqual([]);
  });

  it('brak dowodu daje needs_evidence, nigdy zera', () => {
    const result = computeScore({
      unitId: 'c1',
      answers: { conformityStatus: 'evidence_insufficient' },
      evidence: {},
    });
    expect(result.verdict).toBe('needs_evidence');
    expect(result.proposedLevel).toBeNull();
    expect(result.missingEvidence).toContain('c1');
  });

  it('kryterium nieprzetestowane jest unknown, nie niezgodne', () => {
    const result = computeScore({
      unitId: 'c1',
      answers: { conformityStatus: 'not_tested' },
      evidence: {},
    });
    expect(result.verdict).toBe('unknown');
    expect(result.unsatisfiedAttributes).toEqual([]);
  });

  it('niezgodność jest raportowana jako niespełniony atrybut', () => {
    const result = computeScore({
      unitId: 'c1',
      answers: { conformityStatus: 'nonconforming' },
      evidence: {},
    });
    expect(result.verdict).toBe('scored');
    expect(result.unsatisfiedAttributes).toContain('c1');
  });
});

describe('adapter: agregacja zgodności', () => {
  it('zwraca wersjonowaną, opisaną regułę — nie nieopisaną średnią', () => {
    const result = aggregate({
      unitLevels: { 'obszar-a/c1': 1, 'obszar-a/c2': 0 },
      mappingVersion: 'audits-conformity-v1',
    });
    expect(result.mappingVersion).toBe('audits-conformity-v1');
    expect(result.rule).toContain('conformity_ratio_v1');
    expect(result.byGroup['obszar-a']).toBe(50);
  });

  it('kryteria nieocenione są wyłączone z mianownika i wykazane', () => {
    // Audyt w połowie drogi nie może wyglądać na audyt z niskim wynikiem.
    const result = aggregate({
      unitLevels: { 'obszar-a/c1': 1, 'obszar-a/c2': null, 'obszar-a/c3': null },
      mappingVersion: 'v1',
    });
    expect(result.byGroup['obszar-a']).toBe(100);
    expect(Object.keys(result.excluded)).toHaveLength(2);
  });

  it('obszar bez ocenionych kryteriów daje null, nie zero', () => {
    const result = aggregate({
      unitLevels: { 'obszar-b/c1': null },
      mappingVersion: 'v1',
    });
    expect(result.byGroup['obszar-b']).toBeNull();
  });
});

describe('adapter: luki zdarzeń zgłoszone do koordynacji', () => {
  it('pojęcia bez własnego typu w kernelu są wypisane jako dane', () => {
    expect([...KERNEL_EVENT_GAPS]).toEqual([
      'action.proposed',
      'action.approved',
      'action.implemented',
      'verification.planned',
      'verification.performed',
    ]);
    // Wszystkie jadą jako ARTIFACT_UPDATED z rozróżnieniem w payload.
    for (const gap of KERNEL_EVENT_GAPS) {
      expect(AUDIT_EVENT_TO_KERNEL_EVENT[gap]).toBe('ARTIFACT_UPDATED');
    }
  });
});
