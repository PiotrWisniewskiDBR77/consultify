/**
 * kernelEventMap — serwerowa połowa adaptera kernela.
 *
 * DLACZEGO ISTNIEJE OSOBNO OD `auditsKernelAdapter.ts`:
 * `server/tsconfig.json` ma `rootDir: "server"`, więc kod serwera nie może
 * zaimportować niczego z `src/` — a kontrakt kernela żyje w
 * `src/method-core/contracts/`. Skopiowanie kernela do `server/` jest zabronione
 * wprost (SHARED_CONTRACT_MANIFEST §9: pliki wyłącznej własności zespołu Core).
 *
 * Rozwiązanie: adapter z pełnym typowaniem stoi po stronie `src/`, a tutaj
 * leży wyłącznie mapa nazw jako zwykłe stringi — bez importu kontraktu.
 * Zgodność obu stron nie opiera się na dobrej woli: pilnuje jej test
 * `src/method-core-adapters/audits/__tests__/auditsKernelAdapter.test.ts`,
 * który porównuje tę mapę z kontraktem i failuje przy każdym rozjeździe.
 *
 * Ta duplikacja jest świadoma i minimalna: dwie listy nazw, zero logiki.
 */

/** 18 zamkniętych typów zdarzeń kernela — kolejność jak w kontrakcie. */
export const KERNEL_EVENT_TYPES = [
  'ANSWER_DRAFTED',
  'ANSWER_CONFIRMED',
  'ANSWER_REVISED',
  'NOTE_ADDED',
  'EVIDENCE_ATTACHED',
  'EVIDENCE_VERIFIED',
  'TERESA_PROPOSAL_CREATED',
  'TERESA_PROPOSAL_ACCEPTED',
  'TERESA_PROPOSAL_REJECTED',
  'DECISION_PROPOSED',
  'DECISION_APPROVED',
  'DECISION_SENT_BACK',
  'ARTIFACT_UPDATED',
  'ARTIFACT_REORGANIZED',
  'OUTPUT_CREATED',
  'OUTPUT_APPROVED',
  'REPORT_REQUESTED',
  'INITIATIVE_PROPOSED',
] as const;

export type KernelEventType = (typeof KERNEL_EVENT_TYPES)[number];

/**
 * Zdarzenie domenowe Audits → zdarzenie kernela.
 *
 * Musi być identyczna z `AUDIT_EVENT_TO_KERNEL_EVENT` w adapterze po stronie
 * `src/`. Rozjazd wykrywa test kontraktowy.
 */
export const AUDIT_TO_KERNEL_EVENT: Readonly<Record<string, KernelEventType>> = {
  'criterion.auditee_responded': 'ANSWER_DRAFTED',
  'criterion.response_confirmed': 'ANSWER_CONFIRMED',
  'criterion.response_revised': 'ANSWER_REVISED',
  'criterion.auditor_note': 'NOTE_ADDED',

  'evidence.submitted': 'EVIDENCE_ATTACHED',
  'evidence.accepted': 'EVIDENCE_VERIFIED',
  'evidence.rejected': 'EVIDENCE_ATTACHED',
  'evidence_request.created': 'NOTE_ADDED',

  'criterion.concluded': 'DECISION_APPROVED',
  'finding.created': 'DECISION_PROPOSED',
  'finding.confirmed': 'DECISION_APPROVED',
  'finding.sent_back': 'DECISION_SENT_BACK',
  'finding.rejected': 'DECISION_SENT_BACK',
  'finding.closed': 'DECISION_APPROVED',
  'finding.risk_accepted': 'DECISION_APPROVED',
  'response.submitted': 'DECISION_PROPOSED',
  'response.reviewed': 'DECISION_APPROVED',

  'ai.proposal_created': 'TERESA_PROPOSAL_CREATED',
  'ai.proposal_accepted': 'TERESA_PROPOSAL_ACCEPTED',
  'ai.proposal_rejected': 'TERESA_PROPOSAL_REJECTED',

  'action.proposed': 'ARTIFACT_UPDATED',
  'action.approved': 'ARTIFACT_UPDATED',
  'action.implemented': 'ARTIFACT_UPDATED',
  'verification.planned': 'ARTIFACT_UPDATED',
  'verification.performed': 'ARTIFACT_UPDATED',
  'program.lifecycle_changed': 'ARTIFACT_REORGANIZED',
  'program.member_changed': 'ARTIFACT_REORGANIZED',

  'output.finalized': 'OUTPUT_CREATED',
  'output.approved': 'OUTPUT_APPROVED',
  'report.generated': 'REPORT_REQUESTED',
  'report.published': 'OUTPUT_APPROVED',
  'proposal.drafted': 'INITIATIVE_PROPOSED',
} as const;

export function toKernelEventType(auditEventType: string): KernelEventType | null {
  return AUDIT_TO_KERNEL_EVENT[auditEventType] ?? null;
}

/**
 * Aktor zdarzenia. Kontrakt wymaga rozdzielenia `actorKind` od `actorUserId`:
 * gdy człowiek akceptuje propozycję Teresy, aktorem jest człowiek, ale
 * autorstwo AI musi pozostać widoczne. Zlanie tych pól kasuje provenance.
 */
export type KernelActorKind = 'human' | 'teresa' | 'system';

export function normalizeActorKind(value: unknown): KernelActorKind {
  return value === 'teresa' || value === 'system' ? value : 'human';
}
