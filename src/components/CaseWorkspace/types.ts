/**
 * Zlecenia (Case Workspace) — kształty danych czytane z REALNEGO API
 * `/api/v8/case-workspace/*`.
 *
 * Każdy typ poniżej jest przepisany z serwisu domenowego, który go zwraca
 * (`server/src/services/caseWorkspace/*.ts`) — nie z dokumentacji, bo audyty
 * w tym repo starzeją się w ~3 dni. Źródła:
 *   CaseCoreView               ← caseCoreService.ts
 *   CasePlanVersion / graf     ← casePlanVersionService.ts
 *   CaseActionProposal         ← proposalApprovalService.ts
 *   CaseWait                   ← waitSubscriptionService.ts
 *   ValueMeasurement / historia← caseHistoryService.ts
 *   CaseArtifactLink           ← artifactLinkService.ts
 */

export type CaseProfile = 'LIGHT' | 'STANDARD' | 'TRANSFORMATION' | 'MONITORING';
export type GovernanceTier = 'LIGHTWEIGHT' | 'STANDARD' | 'CONTROLLED';
export type AutonomyPolicy = 'ASK_EACH_ACTION' | 'ASK_MATERIAL_ACTIONS' | 'EXECUTE_APPROVED_PLAN';
export type CaseStatus = 'DRAFT' | 'ACTIVE' | 'BLOCKED' | 'CLOSED' | 'FAILED' | 'CANCELLED';
export type ClosureType =
  | 'DELIVERY_COMPLETED'
  | 'DECISION_COMPLETED'
  | 'IMPLEMENTATION_COMPLETED'
  | 'OUTCOME_VALIDATED'
  | 'COMPLETED_PARTIAL';
export type ClosureAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'COMPLETED';
export type OutcomeAxisStatus = 'NOT_APPLICABLE' | 'PENDING' | 'VALIDATED';

export interface CaseCoreView {
  caseId: string;
  projectId: string;
  organizationId: string;
  caseProfile: CaseProfile;
  governanceTier: GovernanceTier;
  autonomyPolicy: AutonomyPolicy;
  autonomyPolicyRef: string | null;
  caseStatus: CaseStatus;
  contractedClosureType: ClosureType;
  deliveryStatus: ClosureAxisStatus;
  decisionStatus: ClosureAxisStatus;
  implementationStatus: ClosureAxisStatus;
  outcomeStatus: OutcomeAxisStatus;
  closureType: ClosureType | null;
  closedAt: string | null;
  closedByActorId: string | null;
  closureEvidenceRef: string | null;
  sponsorUserId: string | null;
  acceptanceCriteriaRef: string | null;
  budgetPolicyRef: string | null;
  currentPlanVersionId: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  projectName: string | null;
  projectDescription: string | null;
  projectOwnerId: string | null;
}

export interface GraphNode {
  nodeId: string;
  type?: string;
  effectClass?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GraphEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType?: string;
  type?: string;
  label?: string;
  conditionExpression?: string;
  [key: string]: unknown;
}

export interface CanonicalGraph {
  schemaVersion?: string;
  graphId?: string;
  entryNodeIds: string[];
  terminalNodeIds: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  variables?: Array<{ name: string; [key: string]: unknown }>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Odpowiedź trasy `GET /plan-versions/:id/graph` — KOPERTA, nie goły graf.
 *
 * ★ ZMIERZONE NA ŻYWYM BACKENDZIE, nie założone. Handler
 * (`server/src/routes/caseWorkspace/casePlanVersions.routes.ts:163-168`) woła
 * `svc.getGraph`, a ten zwraca
 * `{ graphId, graphDigest, semanticGraph }`
 * (`server/src/services/caseWorkspace/casePlanVersionService.ts:1382-1393`) —
 * po czym trasa pakuje to w `{ data }`. Klient rozpakowuje `{ data }`, więc
 * dostaje DOKŁADNIE tę kopertę, a nie `CanonicalGraph`.
 *
 * Do 2026-08-10 `api.ts` deklarował tu `Promise<CanonicalGraph>` — deklaracja
 * kłamała, a `graph.nodes` było `undefined`, więc opublikowany plan z dwoma
 * krokami wyświetlał się jako „Ten plan nie ma jeszcze kroków". Typ jest teraz
 * dopasowany do RZECZYWISTEJ odpowiedzi trasy, nie odwrotnie.
 */
export interface PlanGraphEnvelope {
  graphId: string;
  graphDigest: string;
  semanticGraph: CanonicalGraph;
}

export type PlanVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'SUPERSEDED' | 'WITHDRAWN';

export interface CasePlanVersion {
  casePlanVersionId: string;
  caseId: string;
  planNumber: number;
  status: PlanVersionStatus;
  semanticGraph: CanonicalGraph;
  graphDigest: string;
  changeReason: string | null;
  publishedAt: string | null;
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanValidationBlocker {
  code: string;
  detail: string;
  severity: 'BLOCKING' | 'DEFERRED_EXTERNAL';
}

export interface PlanValidationResult {
  valid: boolean;
  blockers: PlanValidationBlocker[];
}

export type ActionProposalStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'AUDITED'
  | 'REJECTED'
  | 'REQUESTED_CHANGES'
  | 'REVOKED'
  | 'FAILED';

export interface CaseActionProposal {
  actionProposalId: string;
  caseId: string;
  runId: string;
  nodeRunId: string;
  status: ActionProposalStatus;
  effectClass: string;
  previewRef: string;
  expiresAt: string | null;
  proposerType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  createdByActorId: string;
  version: number;
  createdAt: string;
  updatedAt: string;

  /*
   * Pola wymagane przez KOMENDĘ decyzji (`POST /proposals/:id/decision`).
   *
   * Serwis zwraca je ZAWSZE (`proposalApprovalService.ts:261` — `mapRow`),
   * ale zadeklarowane są jako opcjonalne, bo harness zrzutowy
   * (`podglad/daneProbne.ts`) tworzy własne obiekty tego typu i nie jest w
   * zakresie tej zmiany. `decideProposal()` NIE zgaduje ich wartości: czyta
   * propozycję z serwera tuż przed decyzją i odmawia wysłania komendy, gdy
   * serwer ich nie przysłał (zamiast wymyślić `payloadDigest`, który
   * `recordApprovalDecision` porównuje z wierszem w bazie —
   * `proposalApprovalService.ts:1034` → `proposal_stale` → 409).
   */
  /** Wersja TREŚCI propozycji (inna oś niż `version` — OCC agregatu). */
  proposalVersion?: number;
  /** Skrót ładunku; serwer porównuje go z wierszem w bazie. */
  payloadDigest?: string;
  /** Migawka polityki, pod którą propozycja powstała. */
  policySnapshotRef?: string;
  targetExpectedVersion?: number | null;
  casePlanVersionId?: string | null;
  capabilityRegistryId?: string | null;
  organizationId?: string;
}

export type ApprovalDecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DEFER';

export interface ApprovalDecisionRecord {
  decisionId: string;
  actionProposalId: string;
  proposalVersion: number;
  payloadDigest: string;
  decision: ApprovalDecisionType;
  decidedByActorId: string;
  decidedAt: string;
  reason: string | null;
  [key: string]: unknown;
}

export type CaseWaitType = 'HUMAN' | 'TIMER' | 'DOMAIN_EVENT' | 'EXTERNAL_CALLBACK';
export type CaseWaitStatus = 'ACTIVE' | 'SATISFIED' | 'EXPIRED' | 'CANCELLED';

export interface CaseWait {
  waitId: string;
  caseId: string;
  runId: string | null;
  nodeRunId: string | null;
  actionProposalId: string | null;
  waitType: CaseWaitType;
  status: CaseWaitStatus;
  correlationKey: string;
  expectedEventType: string | null;
  dueAt: string | null;
  timeoutAt: string | null;
  satisfiedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ValueMeasurementStatus =
  | 'UNMEASURED'
  | 'PARTIAL'
  | 'CONFIRMED'
  | 'NOT_ACHIEVED'
  | 'EVIDENCE_MISSING';

export interface ValueMeasurement {
  measurementId: string;
  caseId: string;
  metricKey: string;
  metricName: string;
  baselineValue: number | null;
  baselineUnit: string | null;
  targetValue: number | null;
  targetUnit: string | null;
  actualValue: number | null;
  actualUnit: string | null;
  measurementStatus: ValueMeasurementStatus;
  measurementDate: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  attribution: string;
  nextMeasurementDueAt: string | null;
  evidenceRef: string | null;
  createdAt: string;
}

export type ArtifactLinkRelation =
  | 'INPUT'
  | 'OUTPUT'
  | 'EVIDENCE'
  | 'DECISION_BASIS'
  | 'DELIVERABLE'
  | 'OUTCOME_MEASUREMENT';

export interface CaseArtifactLink {
  linkId: string;
  caseId: string;
  artifactType: string;
  artifactId: string;
  artifactRevision: string | null;
  relation: ArtifactLinkRelation;
  linkStatus: 'ACTIVE' | 'UNLINKED' | 'UNAVAILABLE';
  isStale: boolean;
  staleReason: string | null;
  linkedAt: string;
  updatedAt: string;
}

export interface CaseHistoryEvent {
  eventId: string;
  caseId: string;
  eventType: string;
  actorId: string;
  occurredAt: string;
  summary: string;
  /**
   * Ładunek zdarzenia — trasa `GET /cases/:id/history-events` ZWRACA to pole
   * (`caseHistoryService.ts:206`), tylko UI go dotąd nie deklarowało. Potrzebne,
   * żeby zdanie po polsku dało się ZŁOŻYĆ z danych, a nie tłumaczyć angielski
   * napis na ślepo. Opcjonalne, bo starsze wiersze mogą go nie mieć.
   */
  payload?: Record<string, unknown> | null;
  globalSeq: number;
}

/**
 * Potwierdzone zlecenie robocze (work order) stojące za sprawą — REALNY kształt
 * `GET /case-intake/cases/:caseId/work-orders`
 * (`server/src/routes/caseWorkspace/intake.routes.ts:126-133`, serwis
 * `caseIntakeService.getConfirmedWorkOrders` → `ConfirmedWorkOrderRecord[]`,
 * `caseIntakeService.ts:343-351`).
 *
 * `summary` jest po stronie serwera przepuszczone przez `redact()`, więc jest
 * luźno typowanym workiem — dlatego `Record<string, unknown>`, a odczyt pól
 * idzie przez jawną normalizację (`api.ts` → `getCaseIntakeSummary`), nigdy
 * przez rzutowanie na wygodny typ.
 */
export interface ConfirmedWorkOrderRecord {
  eventId: string;
  caseId: string;
  workOrderId: string;
  workOrderDigest: string;
  confirmedByActorId: string;
  confirmedAt: string;
  summary: Record<string, unknown>;
}

/**
 * Cel i oczekiwany rezultat zlecenia — JEDYNE realne źródło nazwy sprawy
 * dostępne dzisiaj przez API.
 *
 * `case_core` nie ma kolumny na nazwę ani cel; goal/expectedOutcome żyją
 * wyłącznie w ładunku zdarzenia intake, a to zdarzenie wystawia trasa
 * work-orders. Pola są `null`, gdy sprawa powstała z pominięciem intake
 * (`POST /cases`) — wtedy ekran musi sięgnąć po nazwę projektu, a na końcu po
 * uczciwy identyfikator. Nic tu nie jest zmyślane.
 */
export interface CaseIntakeSummary {
  goal: string | null;
  expectedOutcome: string | null;
  scope: string[];
  confirmedAt: string | null;
}

/**
 * Jednolity opis nieudanego wywołania API dla warstwy widoku.
 *
 * `kind` rozdziela stany, których właściciel wymaga jawnie: „zablokowany"
 * (403/uprawnienia) NIE jest tym samym co „błąd" (500) ani „nie znaleziono"
 * (404 — enumeration-safe, ten sam ekran dla braku dostępu i braku obiektu).
 */
export type CaseApiFailureKind = 'blocked' | 'notFound' | 'error';

export interface CaseApiFailure {
  kind: CaseApiFailureKind;
  message: string;
  status?: number;
  code?: string;
}

/*
 * ── KOMENDY (mutacje) ──────────────────────────────────────────────────────
 *
 * Odczyt i komenda mają ROZŁĄCZNE typy błędu, świadomie.
 *
 * `CaseApiFailure` (wyżej) opisuje „nie udało się WCZYTAĆ" i zna trzy stany.
 * Komenda ma czwarty, którego odczyt mieć nie może: KONFLIKT (409) — obiekt
 * istnieje, mam do niego dostęp, ale jego stan na serwerze różni się od tego,
 * co widzę na ekranie (inna wersja / inny status / inny skrót ładunku). To
 * jedyny stan, w którym uczciwa odpowiedź brzmi „odśwież i zobacz, co jest
 * naprawdę", a nie „spróbuj ponownie".
 *
 * Osobny typ zamiast dopisania `'conflict'` do `CaseApiFailureKind` — bo
 * `CaseApiFailure` czytają ekrany pisane RÓWNOLEGLE w tej fali; nowy wariant
 * w istniejącej unii cicho zmieniłby ich `switch`.
 */
export type CaseCommandFailureKind =
  /** 409 — stan na serwerze inny niż na ekranie. Nic nie zostało zmienione. */
  | 'conflict'
  /** 401/403 — brak uprawnień do TEJ operacji. */
  | 'blocked'
  /**
   * 404 — SEC-009. Backend celowo zwraca to samo dla „nie istnieje" i „cudza
   * organizacja" (`routes/caseWorkspace/_shared/errors.ts:150`). UI NIE wolno
   * tego rozróżniać ani sugerować, że obiekt istnieje.
   */
  | 'notFound'
  /** 400/422 — serwer odrzucił dane komendy. */
  | 'invalid'
  /** Reszta: 5xx, sieć, przerwane połączenie. */
  | 'error';

export interface CaseCommandFailure {
  kind: CaseCommandFailureKind;
  /** Gotowy komunikat po polsku — do pokazania użytkownikowi wprost. */
  message: string;
  status?: number;
  code?: string;
  /** Czy UI ma zaproponować odświeżenie danych (konflikt / stan nieznany). */
  refreshSuggested: boolean;
}

/**
 * Sukces komendy.
 *
 * `value` to stan odczytany PONOWNIE z serwera po mutacji (authoritative
 * readback), a nie treść odpowiedzi na samą mutację. Gdy odczyt kontrolny nie
 * doszedł do skutku, `readback` mówi o tym wprost — UI ma wtedy powiedzieć
 * „operacja przyjęta, ale nie potwierdziliśmy stanu", zamiast malować sukces.
 */
export interface CaseCommandSuccess<T> {
  ok: true;
  value: T;
  readback: 'confirmed' | 'unconfirmed';
  readbackFailure?: CaseCommandFailure;
  /** Klucz idempotencji użyty w tym wywołaniu (do powtórzenia BEZ dublowania). */
  idempotencyKey: string;
}

export interface CaseCommandRejected {
  ok: false;
  failure: CaseCommandFailure;
  idempotencyKey: string;
}

export type CaseCommandResult<T> = CaseCommandSuccess<T> | CaseCommandRejected;
