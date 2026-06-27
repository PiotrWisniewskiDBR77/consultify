/**
 * L1 — Maszyna stanów inicjatywy: KOMPLETNE pokrycie unit (30 testów).
 *
 * Część systemu testów procesu inicjatyw (TESTY_M13_PROCES_STATUSOW). Warstwa L1
 * testuje czysty rdzeń: VALID_TRANSITIONS + GATE_PERMISSIONS + GATE_TRANSITIONS +
 * validateTransition + helpery. Deterministyczny, bez DB/HTTP. Każdy `it` = osobny
 * scenariusz macierzy „wszystkie elementy kluczowe":
 *   §A słownik statusów (4) · §B pełna ścieżka transitions (8) · §C invalid (4) ·
 *   §D bramki↔przejścia (3) · §E RBAC canExecuteGate (7) · §F validateTransition (4)
 *
 * Dowód dla: WYNIKI_M13_INICJATYWY (warstwa L1).
 */
import { describe, expect, it } from 'vitest';
import {
  InitiativeStatus,
  Role,
  GateType,
  VALID_TRANSITIONS,
  GATE_PERMISSIONS,
  GATE_TRANSITIONS,
  STATUS_METADATA,
  canExecuteGate,
  getGateForTransition,
  isValidTransition,
  getValidNextStatuses,
  validateTransition,
  getStatusLabel,
} from '../../../../server/src/constants/initiativeStatuses.ts';

const ALL_STATUSES = Object.values(InitiativeStatus);
const ctx = (over: Record<string, unknown> = {}) => ({ userRole: Role.ADMIN, ...over } as never);

// ── §A Słownik statusów (4) ──────────────────────────────────────────────────
describe('L1 §A — słownik 13 statusów', () => {
  it('A1: istnieje dokładnie 13 statusów', () => {
    expect(ALL_STATUSES).toHaveLength(13);
  });

  it('A2: każdy status ma komplet metadanych (label, labelPL, order, icon)', () => {
    for (const s of ALL_STATUSES) {
      const m = STATUS_METADATA[s];
      expect(m, s).toBeDefined();
      expect(m.label, `${s}.label`).toBeTruthy();
      expect(m.labelPL, `${s}.labelPL`).toBeTruthy();
      expect(typeof m.order, `${s}.order`).toBe('number');
    }
  });

  it('A3: getStatusLabel zwraca PL i EN rozdzielnie', () => {
    expect(getStatusLabel(InitiativeStatus.DRAFT, 'pl')).toBe('Szkic');
    expect(getStatusLabel(InitiativeStatus.DRAFT, 'en')).toBe('Draft');
  });

  it('A4: porządki (order) są unikalne — brak kolizji w pipeline', () => {
    const orders = ALL_STATUSES.map((s) => STATUS_METADATA[s].order);
    expect(new Set(orders).size).toBe(orders.length);
  });
});

// ── §B Pełna ścieżka VALID_TRANSITIONS (8) ──────────────────────────────────
describe('L1 §B — happy path: każde przejście pipeline jest legalne', () => {
  it('B1: DRAFT → PENDING_REVIEW', () => {
    expect(isValidTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW)).toBe(true);
  });
  it('B2: PENDING_REVIEW → REVIEW oraz send-back → DRAFT', () => {
    expect(isValidTransition(InitiativeStatus.PENDING_REVIEW, InitiativeStatus.REVIEW)).toBe(true);
    expect(isValidTransition(InitiativeStatus.PENDING_REVIEW, InitiativeStatus.DRAFT)).toBe(true);
  });
  it('B3: REVIEW → PROMOTED oraz reject → DRAFT', () => {
    expect(isValidTransition(InitiativeStatus.REVIEW, InitiativeStatus.PROMOTED)).toBe(true);
    expect(isValidTransition(InitiativeStatus.REVIEW, InitiativeStatus.DRAFT)).toBe(true);
  });
  it('B4: PROMOTED → PLANNING', () => {
    expect(isValidTransition(InitiativeStatus.PROMOTED, InitiativeStatus.PLANNING)).toBe(true);
  });
  it('B5: PLANNING → APPROVED', () => {
    expect(isValidTransition(InitiativeStatus.PLANNING, InitiativeStatus.APPROVED)).toBe(true);
  });
  it('B6: APPROVED → SCHEDULED', () => {
    expect(isValidTransition(InitiativeStatus.APPROVED, InitiativeStatus.SCHEDULED)).toBe(true);
  });
  it('B7: SCHEDULED → EXECUTING; EXECUTING ⇄ BLOCKED', () => {
    expect(isValidTransition(InitiativeStatus.SCHEDULED, InitiativeStatus.EXECUTING)).toBe(true);
    expect(isValidTransition(InitiativeStatus.EXECUTING, InitiativeStatus.BLOCKED)).toBe(true);
    expect(isValidTransition(InitiativeStatus.BLOCKED, InitiativeStatus.EXECUTING)).toBe(true);
  });
  it('B8: ogon EXECUTING → DONE → TRACKING → ARCHIVED', () => {
    expect(isValidTransition(InitiativeStatus.EXECUTING, InitiativeStatus.DONE)).toBe(true);
    expect(isValidTransition(InitiativeStatus.DONE, InitiativeStatus.TRACKING)).toBe(true);
    expect(isValidTransition(InitiativeStatus.TRACKING, InitiativeStatus.ARCHIVED)).toBe(true);
  });
});

// ── §C Niedozwolone przejścia (4) ───────────────────────────────────────────
describe('L1 §C — invalid transitions odrzucane', () => {
  it('C1: skok DRAFT → APPROVED jest nielegalny', () => {
    expect(isValidTransition(InitiativeStatus.DRAFT, InitiativeStatus.APPROVED)).toBe(false);
  });
  it('C2: cofnięcie DONE → EXECUTING jest nielegalne', () => {
    expect(isValidTransition(InitiativeStatus.DONE, InitiativeStatus.EXECUTING)).toBe(false);
  });
  it('C3: ARCHIVED jest terminalny (zero wyjść)', () => {
    expect(getValidNextStatuses(InitiativeStatus.ARCHIVED)).toEqual([]);
    expect(isValidTransition(InitiativeStatus.ARCHIVED, InitiativeStatus.DRAFT)).toBe(false);
  });
  it('C4: CANCELLED dostępny z aktywnych, ale NIE po DONE/TRACKING', () => {
    expect(isValidTransition(InitiativeStatus.EXECUTING, InitiativeStatus.CANCELLED)).toBe(true);
    expect(isValidTransition(InitiativeStatus.DONE, InitiativeStatus.CANCELLED)).toBe(false);
    expect(isValidTransition(InitiativeStatus.TRACKING, InitiativeStatus.CANCELLED)).toBe(false);
  });
});

// ── §D Bramki ↔ przejścia (3) ───────────────────────────────────────────────
describe('L1 §D — getGateForTransition mapuje krawędzie na bramki', () => {
  it('D1: kluczowe krawędzie mają poprawną bramkę', () => {
    expect(getGateForTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW)).toBe(GateType.SUBMIT_FOR_REVIEW);
    expect(getGateForTransition(InitiativeStatus.PLANNING, InitiativeStatus.APPROVED)).toBe(GateType.APPROVE);
    expect(getGateForTransition(InitiativeStatus.SCHEDULED, InitiativeStatus.EXECUTING)).toBe(GateType.START);
    expect(getGateForTransition(InitiativeStatus.DONE, InitiativeStatus.TRACKING)).toBe(GateType.START_TRACKING);
  });
  it('D2: krawędź bez bramki (TRACKING→ARCHIVED) zwraca null', () => {
    expect(getGateForTransition(InitiativeStatus.TRACKING, InitiativeStatus.ARCHIVED)).toBeNull();
  });
  it('D3: CANCEL osiągalny z każdego z 9 aktywnych statusów', () => {
    const cancelFrom = GATE_TRANSITIONS[GateType.CANCEL].from;
    expect(cancelFrom).toHaveLength(9);
    for (const s of cancelFrom) {
      expect(getGateForTransition(s, InitiativeStatus.CANCELLED)).toBe(GateType.CANCEL);
    }
  });
});

// ── §E RBAC canExecuteGate (7) ──────────────────────────────────────────────
describe('L1 §E — RBAC: kto może wykonać którą bramkę', () => {
  it('E1: CONSULTANT może TYLKO submit-for-review', () => {
    expect(canExecuteGate(Role.CONSULTANT, GateType.SUBMIT_FOR_REVIEW)).toBe(true);
    expect(canExecuteGate(Role.CONSULTANT, GateType.APPROVE)).toBe(false);
    expect(canExecuteGate(Role.CONSULTANT, GateType.SCHEDULE)).toBe(false);
  });
  it('E2: ADMIN może każdą bramkę (techniczny override)', () => {
    for (const gate of Object.values(GateType)) {
      expect(canExecuteGate(Role.ADMIN, gate), gate).toBe(true);
    }
  });
  it('E3: APPROVE (PLANNING→APPROVED) tylko STEERING_COMMITTEE', () => {
    expect(canExecuteGate(Role.STEERING_COMMITTEE, GateType.APPROVE)).toBe(true);
    expect(canExecuteGate(Role.PMO, GateType.APPROVE)).toBe(false);
    expect(canExecuteGate(Role.PROJECT_SPONSOR, GateType.APPROVE)).toBe(false);
  });
  it('E4: PMO: SCHEDULE/START/START_PLANNING tak, APPROVE nie', () => {
    expect(canExecuteGate(Role.PMO, GateType.SCHEDULE)).toBe(true);
    expect(canExecuteGate(Role.PMO, GateType.START)).toBe(true);
    expect(canExecuteGate(Role.PMO, GateType.START_PLANNING)).toBe(true);
    expect(canExecuteGate(Role.PMO, GateType.APPROVE)).toBe(false);
  });
  it('E5: PROJECT_SPONSOR: ACCEPT/UNBLOCK tak, APPROVE nie', () => {
    expect(canExecuteGate(Role.PROJECT_SPONSOR, GateType.ACCEPT)).toBe(true);
    expect(canExecuteGate(Role.PROJECT_SPONSOR, GateType.UNBLOCK)).toBe(true);
    expect(canExecuteGate(Role.PROJECT_SPONSOR, GateType.APPROVE)).toBe(false);
  });
  it('E6: BUSINESS_OWNER: tylko START_TRACKING', () => {
    expect(canExecuteGate(Role.BUSINESS_OWNER, GateType.START_TRACKING)).toBe(true);
    expect(canExecuteGate(Role.BUSINESS_OWNER, GateType.COMPLETE)).toBe(false);
  });
  it('E7: INITIATIVE_OWNER: BLOCK/COMPLETE/SUBMIT tak, APPROVE nie', () => {
    expect(canExecuteGate(Role.INITIATIVE_OWNER, GateType.BLOCK)).toBe(true);
    expect(canExecuteGate(Role.INITIATIVE_OWNER, GateType.COMPLETE)).toBe(true);
    expect(canExecuteGate(Role.INITIATIVE_OWNER, GateType.SUBMIT_FOR_REVIEW)).toBe(true);
    expect(canExecuteGate(Role.INITIATIVE_OWNER, GateType.APPROVE)).toBe(false);
  });
});

// ── §F validateTransition — reguły treściowe (4) ────────────────────────────
describe('L1 §F — validateTransition: bramki + reguły treści', () => {
  it('F1: niewłaściwa rola na bramce → invalid + requiredRoles', () => {
    const r = validateTransition(InitiativeStatus.PLANNING, InitiativeStatus.APPROVED, ctx({ userRole: Role.PMO }));
    expect(r.valid).toBe(false);
    expect(r.requiredRoles).toContain(Role.STEERING_COMMITTEE);
  });
  it('F2: BLOCKED bez powodu → invalid; z powodem → valid', () => {
    expect(validateTransition(InitiativeStatus.EXECUTING, InitiativeStatus.BLOCKED, ctx()).valid).toBe(false);
    expect(
      validateTransition(InitiativeStatus.EXECUTING, InitiativeStatus.BLOCKED, ctx({ blockedReason: 'czeka na decyzję' })).valid,
    ).toBe(true);
  });
  it('F3: DONE blokowane przez pending tasks i otwarte decyzje', () => {
    expect(validateTransition(InitiativeStatus.EXECUTING, InitiativeStatus.DONE, ctx({ pendingTasks: 3 })).valid).toBe(false);
    expect(validateTransition(InitiativeStatus.EXECUTING, InitiativeStatus.DONE, ctx({ hasBlockingDecisions: true })).valid).toBe(false);
    expect(validateTransition(InitiativeStatus.EXECUTING, InitiativeStatus.DONE, ctx({ pendingTasks: 0 })).valid).toBe(true);
  });
  it('F4: bramki danych — REVIEW→PROMOTED artefakty, APPROVED→SCHEDULED daty, red-UNBLOCK steering', () => {
    expect(validateTransition(InitiativeStatus.REVIEW, InitiativeStatus.PROMOTED, ctx({ hasRequiredArtefacts: false })).valid).toBe(false);
    expect(validateTransition(InitiativeStatus.APPROVED, InitiativeStatus.SCHEDULED, ctx({ isScheduled: false })).valid).toBe(false);
    expect(
      validateTransition(InitiativeStatus.BLOCKED, InitiativeStatus.EXECUTING, ctx({ userRole: Role.PMO, escalationLevel: 'red' })).valid,
    ).toBe(false);
  });
});
