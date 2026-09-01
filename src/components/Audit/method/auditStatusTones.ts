/**
 * auditStatusTones — mapowanie statusów domeny Audits (typ źródła + status
 * weryfikacji pakietu, status publikacji, etap lifecycle programu, status
 * raportu/proposala) na `StatusTone` + etykietę PL/EN.
 *
 * Wymóg prawny (P0 2026-08-13, patrz `server/src/services/audits/types.ts`):
 * DWIE NIEZALEŻNE OSIE. `sourceType` (czym jest źródło) i `verificationStatus`
 * (czy je sprawdzono) NIGDY nie mieszają się w jedną etykietę ani jeden ton —
 * to był dokładnie ten błąd kategorii, który renderował procedurę QMS klienta
 * jako „Zweryfikowana norma". Reguły egzekwowane tutaj:
 *
 *   1. Słowo „norma" wolno pokazać WYŁĄCZNIE dla `LICENSED_STANDARD` i
 *      `REGULATION` (`packSourceTypeLabel`) — żadna wartość `verificationStatus`
 *      tego nie zmienia, bo `packSourceTypeLabel` nawet nie przyjmuje tego
 *      argumentu.
 *   2. Ton `success` przysługuje WYŁĄCZNIE `VERIFIED` na osi weryfikacji
 *      (`packVerificationTone`). Oś typu źródła (`packSourceTypeTone`) nigdy
 *      nie zwraca `success` — typ nie jest „dobry" ani „zły".
 *   3. `DEMONSTRATION` (warning) i `LEGACY` (neutral, etykieta wprost mówi
 *      „wycofany") muszą być wizualnie odróżnialne od normy i od siebie —
 *      patrz `__tests__/auditStatusTones.test.ts`.
 */

import type { StatusTone } from '@/components/ui/primitives/chips';

import type {
  AuditActionKind,
  AuditActionStatus,
  AuditFindingSeverity,
  AuditFindingStatus,
  AuditLifecycleState,
  AuditProposalStatus,
  AuditReportStatus,
  AuditSourceType,
  AuditVerificationState,
  PackPublicationStatus,
} from './auditsMethodApi';

// ---------------------------------------------------------------------------
// Typ źródła pakietu (Library) — oś 1: CZYM jest źródło
// ---------------------------------------------------------------------------

// Celowo BEZ `success` w żadnej wartości — typ źródła nie jest „dobry"/„zły",
// to `verificationStatus` niesie osąd (patrz nagłówek pliku, reguła 2).
const SOURCE_TYPE_TONE: Record<AuditSourceType, StatusTone> = {
  INTERNAL_PROCEDURE: 'neutral',
  INTERNAL_FRAMEWORK: 'info',
  REGULATION: 'info',
  LICENSED_STANDARD: 'info',
  // Wyjątek świadomy (reguła 3): nigdy nie jest podstawą audytu u klienta —
  // to realne ostrzeżenie, nie tylko opis.
  DEMONSTRATION: 'warning',
  // Neutralny = brak wypełnienia koloru (patrz StatusChip) — nie czyta się
  // jako "aktywny/aktualny", co jest tu celem (reguła 3).
  LEGACY: 'neutral',
};

// Słowo „norma"/„normative" WYŁĄCZNIE dla LICENSED_STANDARD i REGULATION
// (reguła 1) — sprawdzane też testem po renderowanym tekście, nie po kluczu.
const SOURCE_TYPE_LABEL: Record<AuditSourceType, { pl: string; en: string }> = {
  INTERNAL_PROCEDURE: { pl: 'Procedura wewnętrzna', en: 'Internal procedure' },
  INTERNAL_FRAMEWORK: { pl: 'Framework wewnętrzny', en: 'Internal framework' },
  REGULATION: { pl: 'Regulacja / akt prawny', en: 'Regulation' },
  LICENSED_STANDARD: { pl: 'Norma licencjonowana', en: 'Licensed standard' },
  DEMONSTRATION: { pl: 'Demonstracja', en: 'Demonstration' },
  LEGACY: { pl: 'Wycofany (historyczny)', en: 'Legacy (retired)' },
};

export function packSourceTypeTone(sourceType: AuditSourceType): StatusTone {
  return SOURCE_TYPE_TONE[sourceType] ?? 'neutral';
}

export function packSourceTypeLabel(sourceType: AuditSourceType, isPolish = false): string {
  const entry = SOURCE_TYPE_LABEL[sourceType];
  if (!entry) return sourceType;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Status weryfikacji pakietu (Library) — oś 2: CZY sprawdzono
// ---------------------------------------------------------------------------

const VERIFICATION_TONE: Record<AuditVerificationState, StatusTone> = {
  // Jedyna wartość tej osi (i jedyna z obu osi razem), która wolno mieć `success`.
  VERIFIED: 'success',
  PENDING_REVIEW: 'warning',
  UNVERIFIED: 'neutral',
  // Brak dowodu źródła — najpoważniejszy przypadek, ale wciąż NIE "success".
  EVIDENCE_MISSING: 'danger',
};

const VERIFICATION_LABEL: Record<AuditVerificationState, { pl: string; en: string }> = {
  VERIFIED: { pl: 'Zweryfikowane', en: 'Verified' },
  PENDING_REVIEW: { pl: 'W przeglądzie', en: 'Pending review' },
  UNVERIFIED: { pl: 'Niezweryfikowane', en: 'Unverified' },
  EVIDENCE_MISSING: { pl: 'Brak dowodu źródła', en: 'Evidence missing' },
};

export function packVerificationTone(status: AuditVerificationState): StatusTone {
  return VERIFICATION_TONE[status] ?? 'neutral';
}

export function packVerificationLabel(status: AuditVerificationState, isPolish = false): string {
  const entry = VERIFICATION_LABEL[status];
  if (!entry) return status;
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

// ---------------------------------------------------------------------------
// Status ustalenia (Findings — U4 rejestr niezgodności i CAPA)
// ---------------------------------------------------------------------------

const FINDING_STATUS_TONE: Record<AuditFindingStatus, StatusTone> = {
  draft: 'neutral',
  in_review: 'warning',
  confirmed: 'info',
  response_pending: 'warning',
  remediation_in_progress: 'warning',
  verification_pending: 'info',
  closed: 'success',
  risk_accepted: 'info',
  rejected: 'neutral',
};

const FINDING_STATUS_LABEL: Record<AuditFindingStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  in_review: { pl: 'W przeglądzie', en: 'In review' },
  confirmed: { pl: 'Potwierdzone', en: 'Confirmed' },
  response_pending: { pl: 'Czeka na odpowiedź', en: 'Response pending' },
  remediation_in_progress: { pl: 'Naprawa w toku', en: 'Remediation in progress' },
  verification_pending: { pl: 'Czeka na weryfikację', en: 'Verification pending' },
  closed: { pl: 'Zamknięte', en: 'Closed' },
  risk_accepted: { pl: 'Ryzyko zaakceptowane', en: 'Risk accepted' },
  rejected: { pl: 'Odrzucone', en: 'Rejected' },
};

export function findingStatusTone(status: AuditFindingStatus): StatusTone {
  return FINDING_STATUS_TONE[status] ?? 'neutral';
}

export function findingStatusLabel(status: AuditFindingStatus, isPolish = false): string {
  const entry = FINDING_STATUS_LABEL[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Istotność ustalenia (severity)
// ---------------------------------------------------------------------------

const FINDING_SEVERITY_TONE: Record<AuditFindingSeverity, StatusTone> = {
  informational: 'neutral',
  low: 'info',
  medium: 'warning',
  high: 'warning',
  critical: 'danger',
};

const FINDING_SEVERITY_LABEL: Record<AuditFindingSeverity, { pl: string; en: string }> = {
  informational: { pl: 'Informacyjna', en: 'Informational' },
  low: { pl: 'Niska', en: 'Low' },
  medium: { pl: 'Średnia', en: 'Medium' },
  high: { pl: 'Wysoka', en: 'High' },
  critical: { pl: 'Krytyczna', en: 'Critical' },
};

export function findingSeverityTone(severity: AuditFindingSeverity | null): StatusTone {
  if (!severity) return 'neutral';
  return FINDING_SEVERITY_TONE[severity] ?? 'neutral';
}

export function findingSeverityLabel(
  severity: AuditFindingSeverity | null,
  isPolish = false
): string {
  if (!severity) return isPolish ? 'Nieokreślona' : 'Unspecified';
  const entry = FINDING_SEVERITY_LABEL[severity];
  if (!entry) return severity;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Klasyfikacja ustalenia — klucz z taksonomii PAKIETU (nie jest zamkniętym
// enumem kernela), więc mapa niżej pokrywa wyłącznie wartości najczęstsze z
// kernela (`findingService.NEVER_NONCONFORMING` + domyślne `nonconforming`);
// wartość spoza mapy (własna taksonomia pakietu) renderuje się wprost —
// UCZCIWIE, nie jako "nieznana", bo pakiet ma prawo definiować własne klucze.
// ---------------------------------------------------------------------------

const FINDING_CLASSIFICATION_TONE: Record<string, StatusTone> = {
  nonconforming: 'danger',
  observation: 'neutral',
  opportunity_for_improvement: 'info',
  evidence_insufficient: 'warning',
  conforming: 'success',
  not_applicable: 'neutral',
};

const FINDING_CLASSIFICATION_LABEL: Record<string, { pl: string; en: string }> = {
  nonconforming: { pl: 'Niezgodność', en: 'Nonconforming' },
  observation: { pl: 'Obserwacja', en: 'Observation' },
  opportunity_for_improvement: { pl: 'Szansa na usprawnienie', en: 'Opportunity for improvement' },
  evidence_insufficient: { pl: 'Niewystarczający dowód', en: 'Evidence insufficient' },
  conforming: { pl: 'Zgodność', en: 'Conforming' },
  not_applicable: { pl: 'Nie dotyczy', en: 'Not applicable' },
};

export function findingClassificationTone(classification: string): StatusTone {
  return FINDING_CLASSIFICATION_TONE[classification] ?? 'neutral';
}

/** Wpis spoza kernelowej mapy (własny klucz taksonomii pakietu) renderuje się jako podany klucz — nigdy "unknown". */
export function findingClassificationLabel(classification: string, isPolish = false): string {
  const entry = FINDING_CLASSIFICATION_LABEL[classification];
  if (!entry) return classification;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Status działania korygującego/naprawczego (Actions — U4 CAPA)
// ---------------------------------------------------------------------------

const ACTION_STATUS_TONE: Record<AuditActionStatus, StatusTone> = {
  proposed: 'neutral',
  approved: 'info',
  in_progress: 'warning',
  implemented: 'info',
  verified: 'success',
  rejected: 'neutral',
  cancelled: 'neutral',
  overdue: 'danger',
};

const ACTION_STATUS_LABEL: Record<AuditActionStatus, { pl: string; en: string }> = {
  proposed: { pl: 'Zaproponowane', en: 'Proposed' },
  approved: { pl: 'Zatwierdzone', en: 'Approved' },
  in_progress: { pl: 'W toku', en: 'In progress' },
  implemented: { pl: 'Wdrożone', en: 'Implemented' },
  verified: { pl: 'Zweryfikowane', en: 'Verified' },
  rejected: { pl: 'Odrzucone', en: 'Rejected' },
  cancelled: { pl: 'Anulowane', en: 'Cancelled' },
  overdue: { pl: 'Przeterminowane', en: 'Overdue' },
};

export function actionStatusTone(status: AuditActionStatus): StatusTone {
  return ACTION_STATUS_TONE[status] ?? 'neutral';
}

export function actionStatusLabel(status: AuditActionStatus, isPolish = false): string {
  const entry = ACTION_STATUS_LABEL[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Rodzaj działania — korekcja/działanie doraźne usuwa SKUTEK; działanie
// korygujące/prewencyjne usuwa PRZYCZYNĘ (patrz `findingService.closeFinding`
// dla merytorycznego uzasadnienia rozróżnienia).
// ---------------------------------------------------------------------------

const ACTION_KIND_LABEL: Record<AuditActionKind, { pl: string; en: string }> = {
  correction: { pl: 'Korekcja', en: 'Correction' },
  containment: { pl: 'Działanie doraźne', en: 'Containment' },
  corrective_action: { pl: 'Działanie korygujące', en: 'Corrective action' },
  preventive_action: { pl: 'Działanie zapobiegawcze', en: 'Preventive action' },
};

export function actionKindLabel(kind: AuditActionKind, isPolish = false): string {
  const entry = ACTION_KIND_LABEL[kind];
  if (!entry) return kind;
  return isPolish ? entry.pl : entry.en;
}

// ---------------------------------------------------------------------------
// Kryterium — status roboczy (`CriterionWorkStatus` server-side,
// `server/src/services/audits/types.ts` CRITERION_WORK_STATUSES). Etykiety
// zgodne z lokalną mapą w `workspace/v2/CriterionWorkspaceV2.tsx` (nie
// eksportowaną stamtąd) — jedno źródło dla ekranów spoza warsztatu
// (np. `AuditCriteriaBrowser`, gap pack 2026-08-26 punkt 2).
// ---------------------------------------------------------------------------

const CRITERION_WORK_STATUS_LABEL: Record<string, { pl: string; en: string }> = {
  open: { pl: 'Otwarte', en: 'Open' },
  evidence_requested: { pl: 'Poproszono o dowód', en: 'Evidence requested' },
  evidence_received: { pl: 'Dowód dostarczony', en: 'Evidence received' },
  tested: { pl: 'Przetestowane', en: 'Tested' },
  concluded: { pl: 'Zakończone wnioskiem', en: 'Concluded' },
};

const CRITERION_WORK_STATUS_TONE: Record<string, StatusTone> = {
  open: 'neutral',
  evidence_requested: 'info',
  evidence_received: 'info',
  tested: 'warning',
  concluded: 'success',
};

export function criterionWorkStatusTone(status: string): StatusTone {
  return CRITERION_WORK_STATUS_TONE[status] ?? 'neutral';
}

export function criterionWorkStatusLabel(status: string, isPolish = false): string {
  const entry = CRITERION_WORK_STATUS_LABEL[status];
  if (!entry) return status;
  return isPolish ? entry.pl : entry.en;
}
