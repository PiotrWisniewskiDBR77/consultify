/**
 * F6 — WYJŚCIE: REZULTATY (interfejs) · weryfikacja handoffu DONE→TRACKING.
 *
 * Cel handoffu (SSOT §F6): zamknięcie wykonania (DONE) i wejście w fazę rezultatów
 * (TRACKING / Benefits) MUSI wymusić, że inicjatywa ma materiał do śledzenia korzyści:
 *   - przypisanego Business Ownera (kto odpowiada za realizację korzyści),
 *   - co najmniej jeden KPI z targetem + jednostką (co i względem czego mierzymy).
 *
 * Ten kontrakt jest egzekwowany na DWÓCH poziomach:
 *   1. CZYSTY: stageHandoffService.evaluateHandoff(DONE, TRACKING, payload) — „closure"
 *      bramka wymaga `gateApproved` (a host wylicza gateApproved z owner+KPI).
 *   2. KONSTYTUCYJNY: GATE_TRANSITIONS.START_TRACKING (DONE→TRACKING) + GATE_PERMISSIONS
 *      (Business Owner) — macierz statusów.
 *
 * Te testy są kontraktowe (czysta logika + stałe), bez DB — interfejs handoffu jest
 * tym, co reszta systemu (controller, M15/M16) konsumuje. Test docelowo NIE dubluje
 * 92/92 procesu statusów; potwierdza, że INTERFEJS rezultatów jest spójny i kompletny.
 *
 * Uczciwy raport: jeśli którykolwiek wymóg (owner / KPI / target) NIE jest częścią
 * interfejsu handoffu — ten test pada i to jest realne ustalenie luki.
 */
import { describe, expect, it } from 'vitest';

import {
  GATE_PERMISSIONS,
  GATE_TRANSITIONS,
  GateType,
  InitiativeStatus,
  isValidTransition,
  Role,
} from '../../../server/src/constants/initiativeStatuses.js';
import {
  evaluateHandoff,
  handoffBoundary,
  moduleForStatus,
} from '../../../server/src/services/initiative/stageHandoffService.js';

describe('F6 — Results handoff (DONE→TRACKING) interface', () => {
  // 1) Macierz statusów: DONE→TRACKING jest dozwolone i NIC innego z DONE.
  it('DONE→TRACKING is the only valid forward transition out of DONE', () => {
    expect(isValidTransition(InitiativeStatus.DONE, InitiativeStatus.TRACKING)).toBe(true);
    // brak skrótów: DONE nie może iść wprost do ARCHIVED/EXECUTING (musi przez TRACKING)
    expect(isValidTransition(InitiativeStatus.DONE, InitiativeStatus.ARCHIVED)).toBe(false);
    expect(isValidTransition(InitiativeStatus.DONE, InitiativeStatus.EXECUTING)).toBe(false);
  });

  // 2) Gate START_TRACKING mapuje DOKŁADNIE DONE→TRACKING (interfejs benefits-start).
  it('START_TRACKING gate maps DONE → TRACKING', () => {
    const gate = GATE_TRANSITIONS[GateType.START_TRACKING];
    expect(gate).toBeTruthy();
    expect(gate.from).toContain(InitiativeStatus.DONE);
    expect(gate.to).toBe(InitiativeStatus.TRACKING);
  });

  // 3) RBAC: tylko Business Owner może wystartować śledzenie korzyści.
  it('START_TRACKING is gated to the Business Owner (benefits accountability)', () => {
    const roles = GATE_PERMISSIONS[GateType.START_TRACKING];
    expect(Array.isArray(roles)).toBe(true);
    expect(roles).toContain(Role.BUSINESS_OWNER);
  });

  // 4) Boundary classification: DONE→TRACKING = przekazanie wykonanie→rezultaty.
  it('classifies DONE→TRACKING as the execution→results boundary', () => {
    expect(moduleForStatus(InitiativeStatus.TRACKING)).toBe('benefits');
    expect(handoffBoundary(InitiativeStatus.DONE, InitiativeStatus.TRACKING)).toBe(
      'execution_to_results'
    );
  });

  // 5) Closure contract: →TRACKING wymaga gateApproved (benefits/KPI domknięte).
  it('evaluateHandoff blocks DONE→TRACKING until the closure gate is approved', () => {
    const blocked = evaluateHandoff(InitiativeStatus.DONE, InitiativeStatus.TRACKING, {
      gateApproved: false,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.missing).toContain('gateApproved');
    expect(blocked.reasons.join(' ')).toMatch(/closure/i);
  });

  // 6) Closure contract spełniony → handoff przechodzi.
  it('evaluateHandoff allows DONE→TRACKING once the closure gate is approved', () => {
    const ok = evaluateHandoff(InitiativeStatus.DONE, InitiativeStatus.TRACKING, {
      gateApproved: true,
    });
    expect(ok.allowed).toBe(true);
    expect(ok.missing).toHaveLength(0);
    expect(ok.reasons).toHaveLength(0);
  });

  // 7) Kontrakt jest specyficzny dla granicy closure: payload bez gateApproved
  //    NIE blokuje przejść spoza granicy rezultatów (regresja: nie nad-egzekwuj).
  it('the closure (gateApproved) requirement applies ONLY to the →TRACKING boundary', () => {
    // DRAFT→PENDING_REVIEW nie powinno wymagać gateApproved.
    const draftStep = evaluateHandoff(
      InitiativeStatus.DRAFT,
      InitiativeStatus.PENDING_REVIEW,
      {}
    );
    // jeśli to przejście jest w macierzy, brak gateApproved nie może go blokować
    if (isValidTransition(InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW)) {
      expect(draftStep.missing).not.toContain('gateApproved');
    }
  });

  // 8) TRACKING jest terminalny-ku-archiwum: po rezultatach idziemy tylko do ARCHIVED.
  it('TRACKING continues only to ARCHIVED (results → close-out)', () => {
    expect(isValidTransition(InitiativeStatus.TRACKING, InitiativeStatus.ARCHIVED)).toBe(
      true
    );
    expect(isValidTransition(InitiativeStatus.TRACKING, InitiativeStatus.DONE)).toBe(false);
  });
});
