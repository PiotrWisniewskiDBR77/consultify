/**
 * auditStatusTones — mapowanie statusów domeny Audits (klasyfikacja pakietu,
 * status publikacji, etap lifecycle programu, status raportu/proposala) na
 * `StatusTone` + etykietę PL/EN.
 *
 * Wymóg prawny (brief U7, sekcja D): pakiet NIEZWERYFIKOWANY nie może wyglądać
 * jak norma. `packClassificationTone` jest jedynym miejscem, które decyduje o
 * tonie chipa klasyfikacji — `DEMONSTRATION`/`LEGACY`/`EVIDENCE_MISSING` nigdy
 * nie dostają tonu `success` (patrz test w `__tests__/auditStatusTones.test.ts`).
 */

import type { StatusTone } from '@/components/ui/primitives/chips';

import type {
  AuditLifecycleState,
  AuditProposalStatus,
  AuditReportStatus,
  PackClassification,
  PackPublicationStatus,
} from './auditsMethodApi';

// ---------------------------------------------------------------------------
// Klasyfikacja pakietu (Library)
// ---------------------------------------------------------------------------

const PACK_CLASSIFICATION_TONE: Record<PackClassification, StatusTone> = {
  // Jedyna klasyfikacja, która wolno wyglądać jak "zweryfikowana norma".
  VERIFIED_NORMATIVE: 'success',
  // Użyteczny wewnętrznie, ale NIE jest zweryfikowaną normą zewnętrzną.
  INTERNAL_FRAMEWORK: 'info',
  // Ostrzegawczy/neutralny, nigdy success (brief §D).
  DEMONSTRATION: 'warning',
  LEGACY: 'neutral',
  // Brak dowodu źródła — najpoważniejszy przypadek spośród niezweryfikowanych,
  // ale wciąż NIE "success". Danger, żeby odróżnić od zwykłego ostrzeżenia.
  EVIDENCE_MISSING: 'danger',
};

const PACK_CLASSIFICATION_LABEL: Record<PackClassification, { pl: string; en: string }> = {
  VERIFIED_NORMATIVE: { pl: 'Zweryfikowana norma', en: 'Verified normative' },
  INTERNAL_FRAMEWORK: { pl: 'Framework wewnętrzny', en: 'Internal framework' },
  DEMONSTRATION: { pl: 'Demonstracja', en: 'Demonstration' },
  LEGACY: { pl: 'Historyczny (niezweryfikowany)', en: 'Legacy (unverified)' },
  EVIDENCE_MISSING: { pl: 'Brak dowodu źródła', en: 'Evidence missing' },
};

export function packClassificationTone(classification: PackClassification): StatusTone {
  return PACK_CLASSIFICATION_TONE[classification] ?? 'neutral';
}

export function packClassificationLabel(
  classification: PackClassification,
  isPolish = false
): string {
  const entry = PACK_CLASSIFICATION_LABEL[classification];
  if (!entry) return classification;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Status publikacji pakietu
// ---------------------------------------------------------------------------

const PACK_PUBLICATION_TONE: Record<PackPublicationStatus, StatusTone> = {
  draft: 'neutral',
  in_review: 'warning',
  published: 'success',
  deprecated: 'neutral',
};

const PACK_PUBLICATION_LABEL: Record<PackPublicationStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  in_review: { pl: 'W przeglądzie', en: 'In review' },
  published: { pl: 'Opublikowany', en: 'Published' },
  deprecated: { pl: 'Wycofany', en: 'Deprecated' },
};

export function packPublicationTone(status: PackPublicationStatus): StatusTone {
  return PACK_PUBLICATION_TONE[status] ?? 'neutral';
}

export function packPublicationLabel(status: PackPublicationStatus, isPolish = false): string {
  const entry = PACK_PUBLICATION_LABEL[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Etap lifecycle programu (Processes)
// ---------------------------------------------------------------------------

const LIFECYCLE_LABEL: Record<AuditLifecycleState, { pl: string; en: string }> = {
  planning: { pl: 'Planowanie', en: 'Planning' },
  preparation: { pl: 'Przygotowanie', en: 'Preparation' },
  fieldwork: { pl: 'Praca w terenie', en: 'Fieldwork' },
  evidence_review: { pl: 'Przegląd dowodów', en: 'Evidence review' },
  findings_review: { pl: 'Przegląd ustaleń', en: 'Findings review' },
  management_response: { pl: 'Odpowiedź zarządzana', en: 'Management response' },
  approval: { pl: 'Zatwierdzenie', en: 'Approval' },
  remediation: { pl: 'Naprawa', en: 'Remediation' },
  effectiveness_verification: { pl: 'Weryfikacja skuteczności', en: 'Effectiveness verification' },
  closure: { pl: 'Zamykanie', en: 'Closure' },
  closed: { pl: 'Zamknięty', en: 'Closed' },
};

const LIFECYCLE_TONE: Record<AuditLifecycleState, StatusTone> = {
  planning: 'neutral',
  preparation: 'neutral',
  fieldwork: 'info',
  evidence_review: 'info',
  findings_review: 'warning',
  management_response: 'warning',
  approval: 'warning',
  remediation: 'warning',
  effectiveness_verification: 'info',
  closure: 'info',
  closed: 'success',
};

export function programLifecycleTone(state: AuditLifecycleState): StatusTone {
  return LIFECYCLE_TONE[state] ?? 'neutral';
}

export function programLifecycleLabel(state: AuditLifecycleState, isPolish = false): string {
  const entry = LIFECYCLE_LABEL[state];
  if (!entry) return state;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Status raportu (Reports)
// ---------------------------------------------------------------------------

const REPORT_STATUS_TONE: Record<AuditReportStatus, StatusTone> = {
  draft: 'neutral',
  in_review: 'warning',
  approved: 'info',
  published: 'success',
  superseded: 'neutral',
};

const REPORT_STATUS_LABEL: Record<AuditReportStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  in_review: { pl: 'W przeglądzie', en: 'In review' },
  approved: { pl: 'Zatwierdzony', en: 'Approved' },
  published: { pl: 'Opublikowany', en: 'Published' },
  superseded: { pl: 'Zastąpiony', en: 'Superseded' },
};

export function reportStatusTone(status: AuditReportStatus): StatusTone {
  return REPORT_STATUS_TONE[status] ?? 'neutral';
}

export function reportStatusLabel(status: AuditReportStatus, isPolish = false): string {
  const entry = REPORT_STATUS_LABEL[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Status Proposal Draftu (Initiatives)
// ---------------------------------------------------------------------------

const PROPOSAL_STATUS_TONE: Record<AuditProposalStatus, StatusTone> = {
  draft: 'neutral',
  sent_to_candidates: 'info',
  registered: 'success',
  deferred: 'warning',
  dismissed: 'neutral',
};

const PROPOSAL_STATUS_LABEL: Record<AuditProposalStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  sent_to_candidates: { pl: 'Wysłany do kandydatów', en: 'Sent to candidates' },
  registered: { pl: 'Zarejestrowany', en: 'Registered' },
  deferred: { pl: 'Odłożony', en: 'Deferred' },
  dismissed: { pl: 'Odrzucony', en: 'Dismissed' },
};

export function proposalStatusTone(status: AuditProposalStatus): StatusTone {
  return PROPOSAL_STATUS_TONE[status] ?? 'neutral';
}

export function proposalStatusLabel(status: AuditProposalStatus, isPolish = false): string {
  const entry = PROPOSAL_STATUS_LABEL[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}
