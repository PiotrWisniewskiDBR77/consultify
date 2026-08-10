/**
 * enumLabels — surowy enum / slug → CZYTELNA etykieta (PL/EN).
 *
 * POWÓD (2026-07-24): karty n-Type pokazywały właścicielowi wprost wartości
 * bazodanowe: „AI RISK DETECTED", „ai", „dynamic-swot", „TASK"/„DECISION".
 * To są identyfikatory deweloperskie, nie język produktu.
 *
 * ZASADA: NIE WYMYŚLAMY DANYCH. Mapy poniżej pokrywają wartości, które
 * naprawdę istnieją w kodzie (TYPE_ICONS w NotificationDetailView,
 * NotificationCategory w server/src/types/index.ts, LinkedItemType w
 * MyWork/shared/LinkedItemsSection). Dla wartości spoza mapy zwracamy
 * HUMANIZOWANY slug (podkreślenia/myślniki → spacje, pierwsza litera wielka) —
 * nigdy zmyśloną nazwę i nigdy surowego enuma w wersalikach.
 */

type Bilingual = { en: string; pl: string };

/** `AI_RISK_DETECTED` / `dynamic-swot` → `Ai risk detected` / `Dynamic swot`. */
export function humanizeEnum(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const words = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!words) return '';
  // Skróty pisane w całości wielkimi literami zostawiamy (AI, KPI, RAID, SWOT).
  const parts = words.split(' ').map((w) => {
    if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z0-9]+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
  return parts.join(' ');
}

function pick(map: Record<string, Bilingual>, key: string, isPolish: boolean): string | null {
  const hit = map[key];
  if (!hit) return null;
  return isPolish ? hit.pl : hit.en;
}

// ── Powiadomienia: typ ──────────────────────────────────────────────────────
// Klucze 1:1 z `TYPE_ICONS` (NotificationDetailView.tsx) — jeden zestaw typów.
const NOTIFICATION_TYPE_LABELS: Record<string, Bilingual> = {
  TASK_ASSIGNED: { en: 'Task assigned', pl: 'Przypisane zadanie' },
  TASK_OVERDUE: { en: 'Task overdue', pl: 'Zadanie po terminie' },
  TASK_BLOCKED: { en: 'Task blocked', pl: 'Zadanie zablokowane' },
  DECISION_REQUIRED: { en: 'Decision required', pl: 'Wymagana decyzja' },
  DECISION_OVERDUE: { en: 'Decision overdue', pl: 'Decyzja po terminie' },
  INITIATIVE_STARTED: { en: 'Initiative started', pl: 'Inicjatywa rozpoczęta' },
  INITIATIVE_STALLED: { en: 'Initiative stalled', pl: 'Inicjatywa wstrzymana' },
  INITIATIVE_COMPLETED: { en: 'Initiative completed', pl: 'Inicjatywa zakończona' },
  AI_RISK_DETECTED: { en: 'Risk detected (AI)', pl: 'Wykryte ryzyko (AI)' },
  AI_RECOMMENDATION: { en: 'AI recommendation', pl: 'Rekomendacja AI' },
  AI_OVERLOAD_DETECTED: { en: 'Overload detected (AI)', pl: 'Wykryte przeciążenie (AI)' },
  AI_DEPENDENCY_CONFLICT: { en: 'Dependency conflict (AI)', pl: 'Konflikt zależności (AI)' },
  SYSTEM_ALERT: { en: 'System alert', pl: 'Alert systemowy' },
  PAYMENT_FAILED: { en: 'Payment failed', pl: 'Nieudana płatność' },
  USAGE_ALERT: { en: 'Usage alert', pl: 'Alert zużycia' },
  SUBSCRIPTION_CHANGE: { en: 'Subscription change', pl: 'Zmiana subskrypcji' },
  BILLING_LIMIT_WARNING: { en: 'Billing limit warning', pl: 'Ostrzeżenie o limicie rozliczeń' },
  BILLING_LIMIT_REACHED: { en: 'Billing limit reached', pl: 'Osiągnięty limit rozliczeń' },
  INVOICE_READY: { en: 'Invoice ready', pl: 'Faktura gotowa' },
  DBR77_UPDATE: { en: 'DBR77 update', pl: 'Aktualizacja DBR77' },
  DBR77_RELEASE_NOTES: { en: 'DBR77 release notes', pl: 'Nowości w wersji DBR77' },
  DBR77_KB_NEW: { en: 'New DBR77 knowledge base entry', pl: 'Nowy wpis w bazie wiedzy DBR77' },
  DBR77_INSTRUCTION: { en: 'DBR77 instruction', pl: 'Instrukcja DBR77' },
};

export function notificationTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(NOTIFICATION_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

// ── Powiadomienia: kategoria ────────────────────────────────────────────────
// `NotificationCategory` = 'ai' | 'task' | 'system' | 'billing' | 'pmo'
// (server/src/types/index.ts) + wartości filtrów listy (decision, alert).
const NOTIFICATION_CATEGORY_LABELS: Record<string, Bilingual> = {
  ai: { en: 'Artificial intelligence', pl: 'Sztuczna inteligencja' },
  task: { en: 'Tasks', pl: 'Zadania' },
  decision: { en: 'Decisions', pl: 'Decyzje' },
  initiative: { en: 'Initiatives', pl: 'Inicjatywy' },
  system: { en: 'System', pl: 'System' },
  alert: { en: 'Alerts', pl: 'Alerty' },
  billing: { en: 'Billing', pl: 'Rozliczenia' },
  pmo: { en: 'PMO', pl: 'PMO' },
};

export function notificationCategoryLabel(
  raw: string | null | undefined,
  isPolish: boolean
): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return pick(NOTIFICATION_CATEGORY_LABELS, key, isPolish) ?? humanizeEnum(key);
}

// ── Powiązania: typ obiektu ─────────────────────────────────────────────────
// Zestaw = `LinkedItemType` (MyWork/shared/LinkedItemsSection.tsx) rozszerzony
// o typy, którymi karty realnie posługują się w sekcjach „Wynika z"/„Dotyczy".
const LINKED_TYPE_LABELS: Record<string, Bilingual> = {
  task: { en: 'Task', pl: 'Zadanie' },
  decision: { en: 'Decision', pl: 'Decyzja' },
  risk: { en: 'Risk', pl: 'Ryzyko' },
  initiative: { en: 'Initiative', pl: 'Inicjatywa' },
  project: { en: 'Project', pl: 'Projekt' },
  assessment: { en: 'Assessment', pl: 'Ocena' },
  report: { en: 'Report', pl: 'Raport' },
  tool: { en: 'Tool', pl: 'Narzędzie' },
  insight: { en: 'Insight', pl: 'Insight' },
  idea: { en: 'Idea', pl: 'Pomysł' },
  note: { en: 'Note', pl: 'Notatka' },
  notebook: { en: 'Note', pl: 'Notatka' },
  interview: { en: 'Interview', pl: 'Wywiad' },
  presentation: { en: 'Presentation', pl: 'Prezentacja' },
  document: { en: 'Document', pl: 'Dokument' },
  external: { en: 'External link', pl: 'Link zewnętrzny' },
  item: { en: 'Item', pl: 'Obiekt' },
};

export function linkedTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return pick(LINKED_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

// ═══════════════════════════════════════════════════════════════════════════
// ZLECENIA (Case Workspace) — enumy domenowe → język użytkownika
// ═══════════════════════════════════════════════════════════════════════════
//
// Klucze przepisane 1:1 z `server/src/services/caseWorkspace/*.ts`
// (caseCoreService, casePlanVersionService, proposalApprovalService,
// waitSubscriptionService, caseHistoryService, artifactLinkService,
// capabilityRegistryService) oraz z katalogu typów węzłów w
// `docs/product/case-workspace/05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md`.
//
// WARUNEK WŁAŚCICIELA (2026-08-10): `HUMAN_TASK`, `CAPABILITY`, `TIMER_WAIT`,
// `PARALLEL_JOIN`, `decision_basis`, `deliverable` itd. NIE MOGĄ być
// podstawową treścią dla użytkownika. Surowy identyfikator wolno pokazać
// wyłącznie w widoku eksperckim, OBOK polskiego wyjaśnienia — nigdy zamiast.

const CASE_STATUS_LABELS: Record<string, Bilingual> = {
  DRAFT: { en: 'Draft', pl: 'Szkic' },
  ACTIVE: { en: 'Active', pl: 'W toku' },
  BLOCKED: { en: 'Blocked', pl: 'Zablokowane' },
  CLOSED: { en: 'Closed', pl: 'Zakończone' },
  FAILED: { en: 'Failed', pl: 'Nieudane' },
  CANCELLED: { en: 'Cancelled', pl: 'Anulowane' },
};

export function caseStatusLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(CASE_STATUS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const CASE_PROFILE_LABELS: Record<string, Bilingual> = {
  LIGHT: { en: 'One step', pl: 'Jeden krok' },
  STANDARD: { en: 'Flow', pl: 'Przepływ' },
  TRANSFORMATION: { en: 'Transformation', pl: 'Transformacja' },
  MONITORING: { en: 'Monitoring', pl: 'Monitorowanie' },
};

export function caseProfileLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(CASE_PROFILE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const GOVERNANCE_TIER_LABELS: Record<string, Bilingual> = {
  LIGHTWEIGHT: { en: 'Light oversight', pl: 'Lekki nadzór' },
  STANDARD: { en: 'Standard oversight', pl: 'Standardowy nadzór' },
  CONTROLLED: { en: 'Controlled', pl: 'Ścisła kontrola' },
};

export function governanceTierLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(GOVERNANCE_TIER_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const AUTONOMY_POLICY_LABELS: Record<string, Bilingual> = {
  ASK_EACH_ACTION: { en: 'Ask before every action', pl: 'Pytaj przed każdą czynnością' },
  ASK_MATERIAL_ACTIONS: { en: 'Ask before important actions', pl: 'Pytaj przed ważnymi czynnościami' },
  EXECUTE_APPROVED_PLAN: { en: 'Run the approved plan', pl: 'Wykonuj zatwierdzony plan' },
};

export function autonomyPolicyLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(AUTONOMY_POLICY_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const CLOSURE_TYPE_LABELS: Record<string, Bilingual> = {
  DELIVERY_COMPLETED: { en: 'Delivery completed', pl: 'Dostarczenie zakończone' },
  DECISION_COMPLETED: { en: 'Decision made', pl: 'Decyzja podjęta' },
  IMPLEMENTATION_COMPLETED: { en: 'Implementation completed', pl: 'Wdrożenie zakończone' },
  OUTCOME_VALIDATED: { en: 'Outcome validated', pl: 'Efekt potwierdzony' },
  COMPLETED_PARTIAL: { en: 'Partially completed', pl: 'Zakończone częściowo' },
};

export function closureTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(CLOSURE_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const CLOSURE_AXIS_LABELS: Record<string, Bilingual> = {
  delivery: { en: 'Delivery', pl: 'Dostarczenie' },
  decision: { en: 'Decision', pl: 'Decyzja' },
  implementation: { en: 'Implementation', pl: 'Wdrożenie' },
  outcome: { en: 'Outcome', pl: 'Efekt' },
};

export function closureAxisLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return pick(CLOSURE_AXIS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const CLOSURE_AXIS_STATUS_LABELS: Record<string, Bilingual> = {
  NOT_APPLICABLE: { en: 'Not applicable', pl: 'Nie dotyczy' },
  PENDING: { en: 'Pending', pl: 'W trakcie' },
  COMPLETED: { en: 'Completed', pl: 'Zrobione' },
  VALIDATED: { en: 'Validated', pl: 'Potwierdzone' },
};

export function closureAxisStatusLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(CLOSURE_AXIS_STATUS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const PLAN_VERSION_STATUS_LABELS: Record<string, Bilingual> = {
  DRAFT: { en: 'Draft', pl: 'Szkic' },
  IN_REVIEW: { en: 'In review', pl: 'W recenzji' },
  PUBLISHED: { en: 'Approved', pl: 'Zatwierdzony' },
  SUPERSEDED: { en: 'Replaced', pl: 'Zastąpiony' },
  WITHDRAWN: { en: 'Withdrawn', pl: 'Wycofany' },
};

export function planVersionStatusLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(PLAN_VERSION_STATUS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

// Katalog typów węzłów grafu — `05_CANONICAL_GRAPH_CAPABILITIES_AND_APIS.md` §2.
const PLAN_NODE_TYPE_LABELS: Record<string, Bilingual> = {
  START: { en: 'Start', pl: 'Początek' },
  END: { en: 'End', pl: 'Koniec' },
  CAPABILITY: { en: 'System does it', pl: 'Robi to system' },
  HUMAN_TASK: { en: 'Person does it', pl: 'Robi to człowiek' },
  APPROVAL: { en: 'Approval needed', pl: 'Wymaga zatwierdzenia' },
  TIMER_WAIT: { en: 'Waiting for a date', pl: 'Czeka na termin' },
  EVENT_WAIT: { en: 'Waiting for a signal', pl: 'Czeka na sygnał' },
  DECISION_GATEWAY: { en: 'Path splits by decision', pl: 'Rozejście wg decyzji' },
  PARALLEL_SPLIT: { en: 'Paths run in parallel', pl: 'Ścieżki równoległe' },
  PARALLEL_JOIN: { en: 'Paths come back together', pl: 'Ścieżki się schodzą' },
  SUBFLOW: { en: 'Separate sub-plan', pl: 'Osobny podplan' },
  ANNOTATION: { en: 'Note on the plan', pl: 'Notatka na planie' },
  // Węzły wykonawcze (executionGraphService / CaseExecutionNodeType) — te same
  // pojęcia biznesowe pod innymi kluczami; mapujemy, żeby nie wyciekł surowiec.
  HUMAN: { en: 'Person does it', pl: 'Robi to człowiek' },
  TIMER: { en: 'Waiting for a date', pl: 'Czeka na termin' },
  JOIN: { en: 'Paths come back together', pl: 'Ścieżki się schodzą' },
  GATEWAY: { en: 'Path splits by decision', pl: 'Rozejście wg decyzji' },
};

export function planNodeTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(PLAN_NODE_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const PLAN_EDGE_TYPE_LABELS: Record<string, Bilingual> = {
  SEQUENCE: { en: 'Then', pl: 'Następnie' },
  CONDITIONAL: { en: 'If condition holds', pl: 'Gdy warunek spełniony' },
  ERROR: { en: 'On error', pl: 'Gdy błąd' },
  TIMEOUT: { en: 'On timeout', pl: 'Gdy minie termin' },
  COMPENSATION: { en: 'Rollback path', pl: 'Ścieżka wycofania' },
};

export function planEdgeTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(PLAN_EDGE_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const WAIT_TYPE_LABELS: Record<string, Bilingual> = {
  HUMAN: { en: 'Waiting for a person', pl: 'Czeka na człowieka' },
  TIMER: { en: 'Waiting for a date', pl: 'Czeka na termin' },
  DOMAIN_EVENT: { en: 'Waiting for an event in Consultify', pl: 'Czeka na zdarzenie w Consultify' },
  EXTERNAL_CALLBACK: { en: 'Waiting for an outside system', pl: 'Czeka na system zewnętrzny' },
};

export function caseWaitTypeLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(WAIT_TYPE_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const WAIT_STATUS_LABELS: Record<string, Bilingual> = {
  ACTIVE: { en: 'Still waiting', pl: 'Wciąż czeka' },
  SATISFIED: { en: 'Resolved', pl: 'Doczekało się' },
  EXPIRED: { en: 'Deadline passed', pl: 'Termin minął' },
  CANCELLED: { en: 'Cancelled', pl: 'Anulowane' },
};

export function caseWaitStatusLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(WAIT_STATUS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const PROPOSAL_STATUS_LABELS: Record<string, Bilingual> = {
  DRAFT: { en: 'Draft', pl: 'Szkic' },
  PENDING_REVIEW: { en: 'Waiting for your decision', pl: 'Czeka na Twoją decyzję' },
  APPROVED: { en: 'Approved', pl: 'Zatwierdzone' },
  EXECUTING: { en: 'Being done', pl: 'W trakcie wykonania' },
  EXECUTED: { en: 'Done', pl: 'Wykonane' },
  AUDITED: { en: 'Done and checked', pl: 'Wykonane i sprawdzone' },
  REJECTED: { en: 'Rejected', pl: 'Odrzucone' },
  REQUESTED_CHANGES: { en: 'Changes requested', pl: 'Odesłane do poprawy' },
  REVOKED: { en: 'Withdrawn', pl: 'Cofnięte' },
  FAILED: { en: 'Failed', pl: 'Nieudane' },
};

export function proposalStatusLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(PROPOSAL_STATUS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const EFFECT_CLASS_LABELS: Record<string, Bilingual> = {
  SAFE_ADDITIVE: { en: 'Only adds something new', pl: 'Tylko dodaje coś nowego' },
  SAFE_UPDATE: { en: 'Safe change', pl: 'Bezpieczna zmiana' },
  SENSITIVE_UPDATE: { en: 'Sensitive change', pl: 'Wrażliwa zmiana' },
  DESTRUCTIVE: { en: 'Removes or overwrites data', pl: 'Usuwa lub nadpisuje dane' },
  GOVERNANCE_TRANSITION: { en: 'Changes the rules of oversight', pl: 'Zmienia zasady nadzoru' },
};

export function effectClassLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(EFFECT_CLASS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const ARTIFACT_LINK_RELATION_LABELS: Record<string, Bilingual> = {
  INPUT: { en: 'Input', pl: 'Materiał wejściowy' },
  OUTPUT: { en: 'Output', pl: 'Wynik pracy' },
  EVIDENCE: { en: 'Evidence', pl: 'Dowód' },
  DECISION_BASIS: { en: 'Basis for a decision', pl: 'Podstawa decyzji' },
  DELIVERABLE: { en: 'Deliverable for the client', pl: 'Dostawa dla klienta' },
  OUTCOME_MEASUREMENT: { en: 'Effect measurement', pl: 'Pomiar efektu' },
};

export function artifactLinkRelationLabel(
  raw: string | null | undefined,
  isPolish: boolean
): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(ARTIFACT_LINK_RELATION_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const ARTIFACT_LINK_STATUS_LABELS: Record<string, Bilingual> = {
  ACTIVE: { en: 'Linked', pl: 'Powiązany' },
  UNLINKED: { en: 'Unlinked', pl: 'Odpięty' },
  UNAVAILABLE: { en: 'No longer available', pl: 'Niedostępny' },
};

export function artifactLinkStatusLabel(raw: string | null | undefined, isPolish: boolean): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(ARTIFACT_LINK_STATUS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const VALUE_MEASUREMENT_STATUS_LABELS: Record<string, Bilingual> = {
  UNMEASURED: { en: 'Not measured yet', pl: 'Jeszcze nie zmierzone' },
  PARTIAL: { en: 'Partly measured', pl: 'Zmierzone częściowo' },
  CONFIRMED: { en: 'Confirmed', pl: 'Potwierdzone' },
  NOT_ACHIEVED: { en: 'Not achieved', pl: 'Nieosiągnięte' },
  EVIDENCE_MISSING: { en: 'Evidence missing', pl: 'Brak dowodu' },
};

export function valueMeasurementStatusLabel(
  raw: string | null | undefined,
  isPolish: boolean
): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(VALUE_MEASUREMENT_STATUS_LABELS, key, isPolish) ?? humanizeEnum(key);
}

const MEASUREMENT_CONFIDENCE_LABELS: Record<string, Bilingual> = {
  LOW: { en: 'Low confidence', pl: 'Niska pewność' },
  MEDIUM: { en: 'Medium confidence', pl: 'Średnia pewność' },
  HIGH: { en: 'High confidence', pl: 'Wysoka pewność' },
};

export function measurementConfidenceLabel(
  raw: string | null | undefined,
  isPolish: boolean
): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (!key) return '';
  return pick(MEASUREMENT_CONFIDENCE_LABELS, key, isPolish) ?? humanizeEnum(key);
}
