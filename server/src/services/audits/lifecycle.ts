/**
 * lifecycle — dozwolone przejścia stanu audytu i bramki wejścia w każdy etap.
 *
 * Lifecycle jest egzekwowany w serwisie, nie w UI. Powód jest praktyczny:
 * „zamknięte" musi znaczyć to samo niezależnie od tego, którym ekranem ktoś
 * doszedł do tej decyzji. Bramki (`gate`) opisują warunek merytoryczny, który
 * musi być spełniony, żeby wejść w etap — sprawdza je `programLifecycleService`
 * na żywych danych, a nie na deklaracji użytkownika.
 */

import { AuditStateError } from './auditsDb.js';
import type { AuditLifecycleState } from './types.js';

export const LIFECYCLE_ORDER: AuditLifecycleState[] = [
  'planning',
  'preparation',
  'fieldwork',
  'evidence_review',
  'findings_review',
  'management_response',
  'approval',
  'remediation',
  'effectiveness_verification',
  'closure',
  'closed',
];

/**
 * Przejścia do przodu są sekwencyjne. Cofnięcie jest dozwolone tylko tam, gdzie
 * ma sens audytowy (np. review odsyła ustalenia z powrotem w teren) i zawsze
 * wymaga powodu — bez tego nie dałoby się obronić, dlaczego stan się zmienił.
 */
const ALLOWED_TRANSITIONS: Record<AuditLifecycleState, AuditLifecycleState[]> = {
  planning: ['preparation'],
  preparation: ['fieldwork', 'planning'],
  fieldwork: ['evidence_review', 'preparation'],
  evidence_review: ['findings_review', 'fieldwork'],
  findings_review: ['management_response', 'evidence_review'],
  management_response: ['approval', 'findings_review'],
  approval: ['remediation', 'findings_review'],
  remediation: ['effectiveness_verification', 'approval'],
  effectiveness_verification: ['closure', 'remediation'],
  closure: ['closed', 'effectiveness_verification'],
  closed: [],
};

/** Przejścia wstecz — wymagają jawnego powodu. */
const BACKWARD_TRANSITIONS = new Set<string>(
  Object.entries(ALLOWED_TRANSITIONS).flatMap(([from, targets]) =>
    targets
      .filter(
        (to) => LIFECYCLE_ORDER.indexOf(to) < LIFECYCLE_ORDER.indexOf(from as AuditLifecycleState)
      )
      .map((to) => `${from}->${to}`)
  )
);

export function isBackwardTransition(from: AuditLifecycleState, to: AuditLifecycleState): boolean {
  return BACKWARD_TRANSITIONS.has(`${from}->${to}`);
}

export function assertTransitionAllowed(
  from: AuditLifecycleState,
  to: AuditLifecycleState,
  reason?: string | null
): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AuditStateError(
      `Przejście ${from} → ${to} jest niedozwolone. Dozwolone: ${allowed.join(', ') || 'brak'}`
    );
  }
  if (isBackwardTransition(from, to) && !String(reason || '').trim()) {
    throw new AuditStateError(`Cofnięcie audytu z ${from} do ${to} wymaga podania powodu`);
  }
}

export function nextStates(from: AuditLifecycleState): AuditLifecycleState[] {
  return ALLOWED_TRANSITIONS[from] ?? [];
}

// ---------------------------------------------------------------------------
// Bramki merytoryczne
// ---------------------------------------------------------------------------

export interface LifecycleGateFacts {
  /** Liczba kryteriów objętych zakresem (stosowalnych). */
  applicableCriteria: number;
  /** Kryteria z wyciągniętym wnioskiem audytora. */
  concludedCriteria: number;
  /** Kryteria oznaczone jako `evidence_insufficient`. */
  insufficientEvidenceCriteria: number;
  /** Ustalenia w statusie draft/in_review. */
  unreviewedFindings: number;
  /** Ustalenia wymagające odpowiedzi właściciela, które jej nie mają. */
  findingsWithoutResponse: number;
  /** Ustalenia niezgodności bez zatwierdzonego działania korygującego. */
  findingsWithoutApprovedAction: number;
  /** Działania wdrożone, ale bez weryfikacji skuteczności. */
  actionsWithoutEffectivenessVerification: number;
  /** Ustalenia nierozstrzygnięte (nie closed / nie risk_accepted). */
  unresolvedFindings: number;
  /** Czy program ma przypisanego lead auditora. */
  hasLeadAuditor: boolean;
  /** Czy kryteria zostały zrzucone z pakietu. */
  hasCriteriaSnapshot: boolean;
}

export interface GateResult {
  ok: boolean;
  blockers: string[];
}

/**
 * Sprawdza, czy wolno wejść w dany etap. Zwraca listę blokerów zamiast rzucać —
 * UI pokazuje je jako „co jeszcze zostało do zrobienia", a serwis zamienia na
 * błąd dopiero przy próbie przejścia.
 */
export function evaluateGate(target: AuditLifecycleState, facts: LifecycleGateFacts): GateResult {
  const blockers: string[] = [];

  switch (target) {
    case 'fieldwork':
      if (!facts.hasCriteriaSnapshot) {
        blockers.push('Program nie ma zrzuconych kryteriów z pakietu audytowego');
      }
      if (!facts.hasLeadAuditor) {
        blockers.push('Program nie ma przypisanego audytora wiodącego');
      }
      if (facts.applicableCriteria === 0) {
        blockers.push('Zakres audytu nie obejmuje żadnego stosowalnego kryterium');
      }
      break;

    case 'findings_review':
      if (facts.concludedCriteria === 0) {
        blockers.push('Żadne kryterium nie ma jeszcze wniosku audytora');
      }
      break;

    case 'management_response':
      if (facts.unreviewedFindings > 0) {
        blockers.push(`${facts.unreviewedFindings} ustaleń nie przeszło jeszcze przeglądu`);
      }
      break;

    case 'approval':
      if (facts.findingsWithoutResponse > 0) {
        blockers.push(
          `${facts.findingsWithoutResponse} ustaleń nie ma odpowiedzi właściciela obszaru`
        );
      }
      break;

    case 'remediation':
      if (facts.findingsWithoutApprovedAction > 0) {
        blockers.push(
          `${facts.findingsWithoutApprovedAction} niezgodności nie ma zatwierdzonego działania korygującego`
        );
      }
      break;

    case 'effectiveness_verification':
      // Wejście dozwolone, gdy istnieje cokolwiek do zweryfikowania.
      break;

    case 'closure':
      if (facts.actionsWithoutEffectivenessVerification > 0) {
        blockers.push(
          `${facts.actionsWithoutEffectivenessVerification} działań nie ma weryfikacji skuteczności`
        );
      }
      break;

    case 'closed':
      if (facts.unresolvedFindings > 0) {
        blockers.push(
          `${facts.unresolvedFindings} ustaleń pozostaje nierozstrzygniętych — zamknij je lub jawnie zaakceptuj ryzyko rezydualne`
        );
      }
      break;

    default:
      break;
  }

  return { ok: blockers.length === 0, blockers };
}

export function assertGate(target: AuditLifecycleState, facts: LifecycleGateFacts): void {
  const result = evaluateGate(target, facts);
  if (!result.ok) {
    throw new AuditStateError(
      `Nie można przejść do etapu „${target}": ${result.blockers.join('; ')}`
    );
  }
}
