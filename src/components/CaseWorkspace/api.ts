/**
 * Zlecenia (Case Workspace) — warstwa dostępu do REALNEGO API.
 *
 * Plik ma DWIE części: ODCZYTY (na górze) i KOMENDY (na dole, od
 * „KOMENDY — mutacje na REALNYM backendzie"). Reguły komend — idempotencja,
 * wersje, 409/403/404, obowiązkowy odczyt kontrolny po zapisie — opisane są
 * przy tamtym nagłówku i obowiązują każdą z nich bez wyjątku.
 *
 * Odczyty idą przez `v8Get` (`src/services/api/v8/client.ts`), który:
 *  · dokleja `Authorization: Bearer` z `tokenService`, `X-Correlation-ID`
 *    i `x-org-context` (`baseClient.getHeaders`),
 *  · rozpakowuje kopertę `{ data }` — a backend Case Workspace odpowiada
 *    dokładnie `res.json({ data })` (`cases.routes.ts:70`), więc adapter
 *    nie jest potrzebny.
 *
 * ZERO danych zmyślonych. Gdy backend nie ma czego zwrócić, ekran pokazuje
 * jawny stan pusty — nigdy atrapy.
 *
 * `toFailure()` rozdziela stany, których właściciel wymaga osobno:
 *  · 401/403 → `blocked` (brak uprawnień — nie „błąd systemu"),
 *  · 404     → `notFound` (enumeration-safe: backend celowo zwraca 404 także
 *              dla cudzej organizacji — `_shared/errors.ts` SEC-009; UI NIE
 *              wolno tego rozróżniać, bo to przywróciłoby wyrocznię),
 *  · reszta  → `error`.
 */

import { fetchWithRetry, getHeaders, handleResponse } from '@/services/api/baseClient';
import { v8Get } from '@/services/api/v8/client';

import type {
  ApprovalDecisionRecord,
  ApprovalDecisionType,
  CanonicalGraph,
  CaseActionProposal,
  CaseApiFailure,
  CaseArtifactLink,
  CaseCommandFailure,
  CaseCommandResult,
  CaseCoreView,
  CaseHistoryEvent,
  CaseIntakeSummary,
  CasePlanVersion,
  CaseStatus,
  CaseWait,
  ConfirmedWorkOrderRecord,
  PlanGraphEnvelope,
  PlanValidationResult,
  ValueMeasurement,
} from './types';

const BASE = '/case-workspace';

export function toFailure(error: unknown): CaseApiFailure {
  const anyError = error as {
    status?: number;
    message?: string;
    data?: { error?: { code?: string } };
  };
  const status = typeof anyError?.status === 'number' ? anyError.status : undefined;
  const code = anyError?.data?.error?.code;
  const message = String(anyError?.message || '').trim();

  if (status === 401 || status === 403) {
    return {
      kind: 'blocked',
      status,
      code,
      message: message || 'Brak uprawnień do tego zlecenia.',
    };
  }
  if (status === 404) {
    return {
      kind: 'notFound',
      status,
      code,
      message: message || 'Nie znaleziono zlecenia.',
    };
  }
  return {
    kind: 'error',
    status,
    code,
    message: message || 'Nie udało się wczytać danych.',
  };
}

export interface ListCasesParams {
  caseStatus?: string;
  caseProfile?: string;
  governanceTier?: string;
}

export function listCases(params?: ListCasesParams): Promise<CaseCoreView[]> {
  const query: Record<string, string> = {};
  if (params?.caseStatus) query.caseStatus = params.caseStatus;
  if (params?.caseProfile) query.caseProfile = params.caseProfile;
  if (params?.governanceTier) query.governanceTier = params.governanceTier;
  return v8Get<CaseCoreView[]>(`${BASE}/cases`, Object.keys(query).length ? query : undefined);
}

export function getCase(caseId: string): Promise<CaseCoreView> {
  return v8Get<CaseCoreView>(`${BASE}/cases/${encodeURIComponent(caseId)}`);
}

export function listPlanVersions(caseId: string): Promise<CasePlanVersion[]> {
  return v8Get<CasePlanVersion[]>(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-versions`);
}

/**
 * Graf planu — trasa zwraca KOPERTĘ `{ graphId, graphDigest, semanticGraph }`,
 * NIE goły `CanonicalGraph` (patrz `PlanGraphEnvelope` w `types.ts` po pełny
 * dowód z handlera i serwisu). Kto chce węzłów, sięga po `.semanticGraph`.
 */
export function getPlanGraph(planVersionId: string): Promise<PlanGraphEnvelope> {
  return v8Get<PlanGraphEnvelope>(`${BASE}/plan-versions/${encodeURIComponent(planVersionId)}/graph`);
}

export function validatePlanVersion(planVersionId: string): Promise<PlanValidationResult> {
  return v8Get<PlanValidationResult>(
    `${BASE}/plan-versions/${encodeURIComponent(planVersionId)}/validate`
  );
}

export function listWaits(caseId: string): Promise<CaseWait[]> {
  return v8Get<CaseWait[]>(`${BASE}/cases/${encodeURIComponent(caseId)}/waits`);
}

export function listProposals(caseId: string): Promise<CaseActionProposal[]> {
  return v8Get<CaseActionProposal[]>(`${BASE}/cases/${encodeURIComponent(caseId)}/proposals`);
}

export function listValueMeasurements(caseId: string): Promise<ValueMeasurement[]> {
  return v8Get<ValueMeasurement[]>(
    `${BASE}/cases/${encodeURIComponent(caseId)}/value-measurements`
  );
}

export function listArtifactLinks(caseId: string): Promise<CaseArtifactLink[]> {
  return v8Get<CaseArtifactLink[]>(`${BASE}/cases/${encodeURIComponent(caseId)}/artifact-links`);
}

export function listHistoryEvents(caseId: string, limit = 50): Promise<CaseHistoryEvent[]> {
  return v8Get<CaseHistoryEvent[]>(`${BASE}/cases/${encodeURIComponent(caseId)}/history-events`, {
    limit: String(limit),
  });
}

export function listConfirmedWorkOrders(caseId: string): Promise<ConfirmedWorkOrderRecord[]> {
  return v8Get<ConfirmedWorkOrderRecord[]>(
    `${BASE}/case-intake/cases/${encodeURIComponent(caseId)}/work-orders`
  );
}

function tekstAlboNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Cel i oczekiwany rezultat zlecenia, odczytane z POTWIERDZONEGO work ordera.
 *
 * ★ DLACZEGO STĄD, a nie z `case_core`: tabela sprawy nie ma kolumny na nazwę
 * ani cel (sprawdzone w `caseCoreService.ts` — `CaseCoreRow` ich nie zna).
 * Cel i oczekiwany rezultat są zapisywane wyłącznie w ładunku zdarzenia intake
 * (`caseIntakeService.ts:538-540`), a jedyną trasą, która ten ładunek oddaje
 * klientowi, jest `GET /case-intake/cases/:caseId/work-orders`.
 *
 * Bierzemy NAJPÓŹNIEJ potwierdzony work order (sprawa może być potwierdzana
 * ponownie), a każde pole normalizujemy jawnie: pusty string to brak danych,
 * nie „nazwa, która jest pusta". Gdy sprawa powstała z pominięciem intake,
 * funkcja zwraca `null` — i to jest UCZCIWE „nie ma czego pokazać", a nie
 * wymyślona nazwa.
 */
export async function getCaseIntakeSummary(caseId: string): Promise<CaseIntakeSummary | null> {
  const records = await listConfirmedWorkOrders(caseId);
  if (!Array.isArray(records) || records.length === 0) return null;

  const latest = [...records].sort((a, b) =>
    String(a.confirmedAt ?? '').localeCompare(String(b.confirmedAt ?? ''))
  )[records.length - 1];
  const summary = (latest?.summary ?? {}) as Record<string, unknown>;

  const scope = Array.isArray(summary.scope)
    ? (summary.scope as unknown[]).map((s) => tekstAlboNull(s)).filter((s): s is string => !!s)
    : [];

  return {
    goal: tekstAlboNull(summary.goal),
    expectedOutcome: tekstAlboNull(summary.expectedOutcome),
    scope,
    confirmedAt: tekstAlboNull(latest?.confirmedAt),
  };
}

/**
 * Wynik częściowy: część źródeł odpowiedziała, część nie.
 *
 * Właściciel wymaga, żeby „częściowy" był OSOBNYM, jawnym stanem — nie cichą
 * pustką i nie całkowitym błędem. `settleAll` zwraca to, co się udało, plus
 * listę nazw sekcji, które padły, żeby ekran mógł to napisać wprost.
 */
export interface PartialLoad<T> {
  value: T;
  failedSections: string[];
  blocked: boolean;
}

export async function settleSection<T>(
  label: string,
  promise: Promise<T>,
  fallback: T,
  failures: string[],
  blockedFlag: { blocked: boolean }
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    const failure = toFailure(error);
    if (failure.kind === 'blocked') blockedFlag.blocked = true;
    failures.push(label);
    return fallback;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * KOMENDY — mutacje na REALNYM backendzie.
 *
 * Do 2026-08-10 ten moduł importował wyłącznie `v8Get`: ekran umiał wyłącznie
 * PATRZEĆ. Poniższa warstwa dokłada wysyłanie komend, z czterema regułami,
 * które obowiązują KAŻDĄ z nich bez wyjątku.
 *
 * 1. IDEMPOTENCJA. Każda komenda niesie nagłówek `Idempotency-Key`
 *    (`routes/caseWorkspace/_shared/handler.ts:56` — `readIdempotencyKeyHeader`).
 *    Klucz powstaje RAZ, przed wysłaniem, i wraca w wyniku — powtórzenie tej
 *    samej intencji (przycisk „Spróbuj ponownie") ma użyć TEGO SAMEGO klucza,
 *    inaczej idempotencja niczego nie chroni.
 *    ★ UCZCIWIE: dziś klucz KONSUMUJĄ cztery trasy — utworzenie propozycji i
 *    decyzja (`actionProposals.routes.ts:93,210`), utworzenie oczekiwania
 *    (jako `correlationKey`, `waitSubscriptions.routes.ts:71`) i podpięcie
 *    artefaktu (jako `dedupeKey`, `artifactLinks.routes.ts:73`). Pozostałe
 *    trasy nagłówek dziś IGNORUJĄ; wysyłamy go mimo to, żeby korelacja
 *    istniała w logu i żeby wpięcie deduplikacji po stronie serwera nie
 *    wymagało zmiany klienta. Nie udajemy, że chroni tam, gdzie nie chroni.
 *
 * 2. WERSJA (optimistic concurrency). Trasy planu, propozycji i oczekiwań
 *    wymagają `expectedVersion` w ciele; decyzja o propozycji dodatkowo
 *    `proposalVersion` i `payloadDigest`. Komendy NIE zgadują tych wartości —
 *    biorą je z obiektu odczytanego z serwera (patrz `decideProposal`).
 *    Trasy statusu zlecenia (`/cases/:id/status`, `/cases/:id/cancel`) OCC nie
 *    przyjmują — serwis liczy wersję sam pod `FOR UPDATE`
 *    (`caseCoreService.ts:485`), a konflikt zgłasza jako niedozwolone
 *    przejście stanu. Nie dokładamy tam pola, którego zod odrzuci.
 *
 * 3. STATUSY. 409 = stan inny niż na ekranie (nic nie zmieniono, odśwież).
 *    403 = brak uprawnień. 404 = nie ma ALBO nie masz dostępu — SEC-009,
 *    nierozróżnialne z założenia; komunikat NIE może sugerować, że obiekt
 *    istnieje.
 *
 * 4. AUTHORITATIVE READBACK. Po każdej udanej komendzie obiekt jest czytany
 *    PONOWNIE z serwera i to jego stan wraca do UI. Odpowiedź 200 na mutację
 *    nie jest dowodem, że zapis wygląda tak, jak myślimy.
 * ═════════════════════════════════════════════════════════════════════════ */

const V8_PREFIX = '/api/v8';

/** Nowy klucz idempotencji. Powtórzenie tej samej intencji ma go REUŻYĆ. */
export function newIdempotencyKey(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `cw-ui-${cryptoRef.randomUUID()}`;
  }
  return `cw-ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Rozdziela odpowiedź na komendę na stany, które UI musi obsłużyć osobno.
 *
 * Uwaga na 401: `baseClient.fetchWithRetry` sam próbuje odświeżyć token i
 * powtarza żądanie raz; jeżeli mimo to wraca 401, dla użytkownika znaczy to
 * to samo co 403 — „nie wolno" — więc trafia do `blocked`.
 */
export function toCommandFailure(error: unknown): CaseCommandFailure {
  const anyError = error as {
    status?: number;
    code?: string;
    message?: string;
    data?: { error?: { code?: string } };
  };
  const status = typeof anyError?.status === 'number' ? anyError.status : undefined;
  const code = anyError?.data?.error?.code;

  if (status === 409) {
    return {
      kind: 'conflict',
      status,
      code,
      refreshSuggested: true,
      message:
        'Stan na serwerze jest inny niż na ekranie — ktoś zmienił to w międzyczasie albo obiekt jest w innym stanie. Nic nie zostało zmienione. Odśwież dane i zdecyduj ponownie.',
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: 'blocked',
      status,
      code,
      refreshSuggested: false,
      message: 'Nie masz uprawnień do tej operacji. Nic nie zostało zmienione.',
    };
  }
  if (status === 404) {
    // SEC-009: ten sam komunikat dla „nie istnieje" i „cudza organizacja".
    // ŻADNEGO sformułowania sugerującego, że obiekt istnieje.
    return {
      kind: 'notFound',
      status,
      code,
      refreshSuggested: true,
      message:
        'Nie znaleźliśmy tego obiektu albo nie masz do niego dostępu. Nic nie zostało zmienione. Wróć do listy i odśwież dane.',
    };
  }
  if (status === 400 || status === 422) {
    return {
      kind: 'invalid',
      status,
      code,
      refreshSuggested: true,
      message:
        'Serwer odrzucił tę operację — dane, na których pracuje ekran, nie zgadzają się z tym, czego wymaga. Nic nie zostało zmienione. Odśwież dane i spróbuj ponownie.',
    };
  }
  if (anyError?.code === 'REQUEST_TIMEOUT') {
    return {
      kind: 'error',
      status,
      code: 'REQUEST_TIMEOUT',
      refreshSuggested: true,
      message:
        'Serwer nie odpowiedział na czas. NIE WIEMY, czy operacja przeszła — odśwież dane i sprawdź stan, zanim powtórzysz.',
    };
  }
  return {
    kind: 'error',
    status,
    code,
    refreshSuggested: true,
    message:
      'Operacja nie doszła do skutku. Odśwież dane i sprawdź stan przed ponowieniem.',
  };
}

interface SendOptions {
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  idempotencyKey: string;
}

async function send<T>({ method, path, body, idempotencyKey }: SendOptions): Promise<T> {
  const res = await fetchWithRetry(`${V8_PREFIX}${BASE}${path}`, {
    method,
    // `getHeaders()` niesie Bearer + `X-Correlation-ID` + `x-org-context`;
    // `Idempotency-Key` dokładamy tutaj, bo `v8Put`/`v8Delete` nie mają
    // parametru na dodatkowe nagłówki, a PUT planu też musi go nieść.
    headers: { ...getHeaders(), 'Idempotency-Key': idempotencyKey },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await handleResponse<{ data: T }>(res, `V8 ${method} ${path}`);
  return json.data;
}

/**
 * Jedyna droga wykonania komendy: wyślij → przeczytaj obiekt PONOWNIE →
 * zwróć stan z odczytu.
 *
 * `readback` musi być funkcją, a nie gotową obietnicą, bo wolno ją wykonać
 * DOPIERO po udanej mutacji (inaczej czytalibyśmy stan sprzed zmiany).
 */
async function runCommand<TMutation, TReadback>(
  mutate: (idempotencyKey: string) => Promise<TMutation>,
  readback: (mutated: TMutation) => Promise<TReadback>,
  fallback: (mutated: TMutation) => TReadback,
  idempotencyKey: string = newIdempotencyKey()
): Promise<CaseCommandResult<TReadback>> {
  let mutated: TMutation;
  try {
    mutated = await mutate(idempotencyKey);
  } catch (error) {
    return { ok: false, failure: toCommandFailure(error), idempotencyKey };
  }
  try {
    const confirmed = await readback(mutated);
    return { ok: true, value: confirmed, readback: 'confirmed', idempotencyKey };
  } catch (error) {
    // Mutacja przeszła, ale kontrolny odczyt nie — UI ma to POWIEDZIEĆ,
    // a nie pokazać odpowiedzi mutacji jako potwierdzonego stanu.
    return {
      ok: true,
      value: fallback(mutated),
      readback: 'unconfirmed',
      readbackFailure: toCommandFailure(error),
      idempotencyKey,
    };
  }
}

export interface CommandOptions {
  /** Ten sam klucz przy ponowieniu tej samej intencji. */
  idempotencyKey?: string;
}

// ── Odczyty pojedynczych obiektów (używane też jako readback) ────────────────

export function getPlanVersion(planVersionId: string): Promise<CasePlanVersion> {
  return v8Get<CasePlanVersion>(`${BASE}/plan-versions/${encodeURIComponent(planVersionId)}`);
}

export function getProposal(actionProposalId: string): Promise<CaseActionProposal> {
  return v8Get<CaseActionProposal>(`${BASE}/proposals/${encodeURIComponent(actionProposalId)}`);
}

export function getWait(waitId: string): Promise<CaseWait> {
  return v8Get<CaseWait>(`${BASE}/waits/${encodeURIComponent(waitId)}`);
}

export function getArtifactLink(linkId: string): Promise<CaseArtifactLink> {
  return v8Get<CaseArtifactLink>(`${BASE}/artifact-links/${encodeURIComponent(linkId)}`);
}

// ── PLAN ────────────────────────────────────────────────────────────────────

export interface CreatePlanDraftInput {
  semanticGraph: CanonicalGraph;
  changeReason?: string | null;
  sourceProcessVersionId?: string | null;
  supersedesPlanVersionId?: string | null;
}

/** POST /cases/:caseId/plan-versions → 201. Readback: GET /plan-versions/:id. */
export function createPlanDraft(
  caseId: string,
  input: CreatePlanDraftInput,
  options?: CommandOptions
): Promise<CaseCommandResult<CasePlanVersion>> {
  return runCommand<CasePlanVersion, CasePlanVersion>(
    (key) =>
      send({
        method: 'POST',
        path: `/cases/${encodeURIComponent(caseId)}/plan-versions`,
        body: input,
        idempotencyKey: key,
      }),
    (created) => getPlanVersion(created.casePlanVersionId),
    (created) => created,
    options?.idempotencyKey
  );
}

/**
 * PUT /plan-versions/:planVersionId — zapis szkicu planu.
 * `expectedVersion` to `version` planu odczytanego z serwera; rozjazd =
 * `case_plan_version_version_conflict` → 409.
 */
export function updatePlanDraft(
  planVersionId: string,
  input: { semanticGraph: CanonicalGraph; expectedVersion: number },
  options?: CommandOptions
): Promise<CaseCommandResult<CasePlanVersion>> {
  return runCommand<CasePlanVersion, CasePlanVersion>(
    (key) =>
      send({
        method: 'PUT',
        path: `/plan-versions/${encodeURIComponent(planVersionId)}`,
        body: input,
        idempotencyKey: key,
      }),
    () => getPlanVersion(planVersionId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

function planVersionCommand(
  planVersionId: string,
  action: 'propose' | 'publish' | 'request-changes' | 'withdraw',
  body: Record<string, unknown>,
  options?: CommandOptions
): Promise<CaseCommandResult<CasePlanVersion>> {
  return runCommand<CasePlanVersion, CasePlanVersion>(
    (key) =>
      send({
        method: 'POST',
        path: `/plan-versions/${encodeURIComponent(planVersionId)}/${action}`,
        body,
        idempotencyKey: key,
      }),
    () => getPlanVersion(planVersionId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

/** POST /plan-versions/:id/propose — szkic → do uzgodnienia. */
export function proposePlanVersion(
  planVersionId: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CasePlanVersion>> {
  return planVersionCommand(planVersionId, 'propose', { expectedVersion }, options);
}

/** POST /plan-versions/:id/publish — zatwierdzenie planu. */
export function publishPlanVersion(
  planVersionId: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CasePlanVersion>> {
  return planVersionCommand(planVersionId, 'publish', { expectedVersion }, options);
}

/** POST /plan-versions/:id/request-changes — odesłanie planu do poprawek. */
export function requestChangesOnPlanVersion(
  planVersionId: string,
  reason: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CasePlanVersion>> {
  return planVersionCommand(planVersionId, 'request-changes', { reason, expectedVersion }, options);
}

/** POST /plan-versions/:id/withdraw — wycofanie planu. */
export function withdrawPlanVersion(
  planVersionId: string,
  reason: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CasePlanVersion>> {
  return planVersionCommand(planVersionId, 'withdraw', { reason, expectedVersion }, options);
}

// ── ZLECENIE: rozpocznij / wstrzymaj / wznów / anuluj ────────────────────────

/**
 * POST /cases/:caseId/status. Readback: GET /cases/:caseId.
 *
 * Dozwolone krawędzie (`caseCoreService.ts:168`): DRAFT→ACTIVE, ACTIVE↔BLOCKED,
 * każde z nich → CLOSED/FAILED/CANCELLED; CLOSED/FAILED/CANCELLED są
 * TERMINALNE. Próba innej krawędzi to `case_status_transition_not_allowed`
 * → 409 (`_shared/errors.ts:100`) — i to jest realny konflikt, nie „błąd
 * systemu": ekran pokazywał stan sprzed cudzej zmiany.
 */
export function transitionCaseStatus(
  caseId: string,
  targetStatus: CaseStatus,
  reason?: string,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseCoreView>> {
  return runCommand<CaseCoreView, CaseCoreView>(
    (key) =>
      send({
        method: 'POST',
        path: `/cases/${encodeURIComponent(caseId)}/status`,
        body: reason ? { targetStatus, reason } : { targetStatus },
        idempotencyKey: key,
      }),
    () => getCase(caseId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

/** Rozpocznij zlecenie (DRAFT → ACTIVE). */
export function startCase(
  caseId: string,
  reason?: string,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseCoreView>> {
  return transitionCaseStatus(caseId, 'ACTIVE', reason, options);
}

/** Wstrzymaj zlecenie (ACTIVE → BLOCKED). */
export function pauseCase(
  caseId: string,
  reason: string,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseCoreView>> {
  return transitionCaseStatus(caseId, 'BLOCKED', reason, options);
}

/** Wznów zlecenie (BLOCKED → ACTIVE). To jest jedyna „recovery" na poziomie zlecenia. */
export function resumeCase(
  caseId: string,
  reason?: string,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseCoreView>> {
  return transitionCaseStatus(caseId, 'ACTIVE', reason, options);
}

/** POST /cases/:caseId/cancel — anulowanie z obowiązkowym powodem. */
export function cancelCase(
  caseId: string,
  reason: string,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseCoreView>> {
  return runCommand<CaseCoreView, CaseCoreView>(
    (key) =>
      send({
        method: 'POST',
        path: `/cases/${encodeURIComponent(caseId)}/cancel`,
        body: { reason },
        idempotencyKey: key,
      }),
    () => getCase(caseId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

// ── PROPOZYCJE: zatwierdź / odrzuć / poproś o zmiany / odłóż ─────────────────

/**
 * Fakty o KANALE decyzji, zapisywane razem z decyzją.
 *
 * `proposalApprovalService.ts:165` mówi wprost: `authenticationAssurance` i
 * `approvalChannelPolicy` NIE mają w kanonie słownika wartości i lądują w
 * bazie jako wolny tekst. Zamiast wymyślać ładnie brzmiący żargon, zapisujemy
 * to, co jest PRAWDĄ o tym wywołaniu: decyzja padła przyciskiem w aplikacji,
 * na sesji uwierzytelnionej tokenem Bearer. Gdy produkt ustali słownik, to
 * jedyne miejsce do zmiany.
 */
const DECISION_CHANNEL = {
  source: 'BUTTON' as const,
  authenticationAssurance: 'SESSION_BEARER_TOKEN',
  approvalChannelPolicy: 'CONSULTIFY_WEB_UI',
};

export interface DecideProposalOptions extends CommandOptions {
  reason?: string | null;
}

/**
 * POST /proposals/:id/decision — jedna trasa dla czterech decyzji
 * (`APPROVE` · `REJECT` · `REQUEST_CHANGES` · `DEFER`).
 *
 * Trzy rzeczy, których ta funkcja NIE robi:
 *  · nie zgaduje `payloadDigest` — czyta propozycję z serwera tuż przed
 *    decyzją, bo serwis porównuje skrót z wierszem w bazie
 *    (`proposalApprovalService.ts:1034`) i rozjazd zgłasza jako
 *    `proposal_stale` → 409;
 *  · nie zgaduje `proposalVersion` ani `expectedVersion` — obie biorą się z
 *    tego samego odczytu (to DWIE różne osie: wersja treści i wersja agregatu);
 *  · nie wymyśla `policyVersion` — używa `policySnapshotRef` z samej
 *    propozycji, czyli polityki, pod którą propozycja powstała.
 *
 * Gdy serwer nie przysłał tych pól, komenda NIE leci — zwracamy `invalid`
 * z jawnym powodem, zamiast wysłać zmyśloną wartość i dostać 409, którego
 * nikt nie umie wytłumaczyć.
 */
export async function decideProposal(
  actionProposalId: string,
  decision: ApprovalDecisionType,
  options?: DecideProposalOptions
): Promise<CaseCommandResult<{ proposal: CaseActionProposal; decision: ApprovalDecisionRecord }>> {
  const idempotencyKey = options?.idempotencyKey ?? newIdempotencyKey();

  let current: CaseActionProposal;
  try {
    current = await getProposal(actionProposalId);
  } catch (error) {
    return { ok: false, failure: toCommandFailure(error), idempotencyKey };
  }

  if (
    typeof current.proposalVersion !== 'number' ||
    !current.payloadDigest ||
    !current.policySnapshotRef
  ) {
    return {
      ok: false,
      idempotencyKey,
      failure: {
        kind: 'invalid',
        refreshSuggested: true,
        code: 'PROPOSAL_DECISION_FIELDS_MISSING',
        message:
          'Nie możemy zapisać decyzji: serwer nie przysłał wersji treści i skrótu ładunku propozycji, a bez nich decyzja byłaby zapisana „w ciemno". Odśwież dane i spróbuj ponownie.',
      },
    };
  }

  return runCommand<
    { proposal: CaseActionProposal; decision: ApprovalDecisionRecord },
    { proposal: CaseActionProposal; decision: ApprovalDecisionRecord }
  >(
    (key) =>
      send({
        method: 'POST',
        path: `/proposals/${encodeURIComponent(actionProposalId)}/decision`,
        body: {
          decision,
          proposalVersion: current.proposalVersion,
          payloadDigest: current.payloadDigest,
          policyVersion: current.policySnapshotRef,
          expectedVersion: current.version,
          reason: options?.reason ?? null,
          ...DECISION_CHANNEL,
        },
        idempotencyKey: key,
      }),
    async (result) => ({ proposal: await getProposal(actionProposalId), decision: result.decision }),
    (result) => result,
    idempotencyKey
  );
}

export const approveProposal = (id: string, options?: DecideProposalOptions) =>
  decideProposal(id, 'APPROVE', options);
export const rejectProposal = (id: string, options?: DecideProposalOptions) =>
  decideProposal(id, 'REJECT', options);
export const requestChangesOnProposal = (id: string, options?: DecideProposalOptions) =>
  decideProposal(id, 'REQUEST_CHANGES', options);
export const deferProposal = (id: string, options?: DecideProposalOptions) =>
  decideProposal(id, 'DEFER', options);

function proposalCommand(
  actionProposalId: string,
  action: 'submit-for-review' | 'retry' | 'revoke' | 'transition-to-failed' | 'audit',
  body: Record<string, unknown>,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseActionProposal>> {
  return runCommand<CaseActionProposal, CaseActionProposal>(
    (key) =>
      send({
        method: 'POST',
        path: `/proposals/${encodeURIComponent(actionProposalId)}/${action}`,
        body,
        idempotencyKey: key,
      }),
    () => getProposal(actionProposalId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

/** POST /proposals/:id/submit-for-review. */
export function submitProposalForReview(
  actionProposalId: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseActionProposal>> {
  return proposalCommand(actionProposalId, 'submit-for-review', { expectedVersion }, options);
}

/**
 * PONÓW — POST /proposals/:id/retry (`retryProposalFromFailed`).
 *
 * Serwis wraca FAILED → APPROVED, ale dopiero po ponownym sprawdzeniu, czy cel
 * nie zwietrzał (`proposal_target_stale` → 409). Ponowienie NIE jest „kliknij
 * jeszcze raz to samo": to osobne przejście stanu z własnym warunkiem.
 */
export function retryProposal(
  actionProposalId: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseActionProposal>> {
  return proposalCommand(actionProposalId, 'retry', { expectedVersion }, options);
}

/** POST /proposals/:id/transition-to-failed — oznaczenie nieudanej akcji. */
export function markProposalFailed(
  actionProposalId: string,
  reason: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseActionProposal>> {
  return proposalCommand(
    actionProposalId,
    'transition-to-failed',
    { reason, expectedVersion },
    options
  );
}

/** POST /proposals/:id/revoke — cofnięcie zatwierdzenia przed wykonaniem. */
export function revokeProposal(
  actionProposalId: string,
  reason: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseActionProposal>> {
  return proposalCommand(actionProposalId, 'revoke', { reason, expectedVersion }, options);
}

// ── OCZEKIWANIA: podaj dane człowieka / anuluj oczekiwanie ───────────────────

/**
 * POST /waits/:waitId/human-input — „system czeka na Ciebie".
 *
 * `inputRef` to WSKAŹNIK do dostarczonej treści (serwer trzyma referencję, nie
 * treść), `expectedVersion` to `version` oczekiwania odczytanego z serwera.
 */
export function provideHumanInput(
  waitId: string,
  inputRef: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseWait>> {
  return runCommand<CaseWait, CaseWait>(
    (key) =>
      send({
        method: 'POST',
        path: `/waits/${encodeURIComponent(waitId)}/human-input`,
        body: { inputRef, expectedVersion },
        idempotencyKey: key,
      }),
    () => getWait(waitId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

/** POST /waits/:waitId/cancel — rezygnacja z oczekiwania. */
export function cancelWait(
  waitId: string,
  reason: string,
  expectedVersion: number,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseWait>> {
  return runCommand<CaseWait, CaseWait>(
    (key) =>
      send({
        method: 'POST',
        path: `/waits/${encodeURIComponent(waitId)}/cancel`,
        body: { reason, expectedVersion },
        idempotencyKey: key,
      }),
    () => getWait(waitId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

// ── ARTEFAKTY ───────────────────────────────────────────────────────────────

/**
 * OTWÓRZ ARTEFAKT.
 *
 * Nie ma trasy „otwórz" i nie udajemy, że jest. Otwarcie artefaktu z poziomu
 * zlecenia to najpierw AUTORYTATYWNY odczyt powiązania — dopiero on
 * rozstrzyga, czy użytkownik ma do niego dostęp (404 SEC-009), czy artefakt
 * nadal istnieje (`linkStatus`) i czy przypięta wersja nie zwietrzała
 * (`isStale`). Nawigacja jest sprawą ekranu; ta funkcja daje mu fakty, na
 * podstawie których wolno ją wykonać.
 */
export async function openArtifactLink(
  linkId: string
): Promise<CaseCommandResult<CaseArtifactLink>> {
  const idempotencyKey = newIdempotencyKey();
  try {
    const link = await getArtifactLink(linkId);
    return { ok: true, value: link, readback: 'confirmed', idempotencyKey };
  } catch (error) {
    return { ok: false, failure: toCommandFailure(error), idempotencyKey };
  }
}

export interface LinkArtifactInput {
  artifactType: string;
  artifactId: string;
  relation: CaseArtifactLink['relation'];
  artifactRevision?: string | null;
  pinReason?: string | null;
}

/**
 * POST /cases/:caseId/artifact-links → 201.
 * Klucz idempotencji trafia tu na `dedupeKey` (`artifactLinks.routes.ts:73`),
 * więc dwukrotne kliknięcie NIE tworzy dwóch powiązań.
 */
export function linkArtifactToCase(
  caseId: string,
  input: LinkArtifactInput,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseArtifactLink>> {
  return runCommand<CaseArtifactLink, CaseArtifactLink>(
    (key) =>
      send({
        method: 'POST',
        path: `/cases/${encodeURIComponent(caseId)}/artifact-links`,
        body: input,
        idempotencyKey: key,
      }),
    (created) => getArtifactLink(created.linkId),
    (created) => created,
    options?.idempotencyKey
  );
}

function artifactLinkCommand(
  linkId: string,
  action: 'pin' | 'mark-stale' | 'mark-unavailable',
  body: Record<string, unknown>,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseArtifactLink>> {
  return runCommand<CaseArtifactLink, CaseArtifactLink>(
    (key) =>
      send({
        method: 'POST',
        path: `/artifact-links/${encodeURIComponent(linkId)}/${action}`,
        body,
        idempotencyKey: key,
      }),
    () => getArtifactLink(linkId),
    (updated) => updated,
    options?.idempotencyKey
  );
}

/** POST /artifact-links/:linkId/pin — przypnij konkretną wersję artefaktu. */
export function pinArtifactRevision(
  linkId: string,
  revision: string,
  reason?: string | null,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseArtifactLink>> {
  return artifactLinkCommand(linkId, 'pin', { revision, reason: reason ?? null }, options);
}

/** POST /artifact-links/:linkId/mark-stale — oznacz powiązanie jako nieaktualne. */
export function markArtifactLinkStale(
  linkId: string,
  reason?: string | null,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseArtifactLink>> {
  return artifactLinkCommand(linkId, 'mark-stale', { reason: reason ?? null }, options);
}

/** POST /artifact-links/:linkId/mark-unavailable — artefaktu już nie ma. */
export function markArtifactLinkUnavailable(
  linkId: string,
  reason?: string | null,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseArtifactLink>> {
  return artifactLinkCommand(linkId, 'mark-unavailable', { reason: reason ?? null }, options);
}

/** DELETE /artifact-links/:linkId — odepnij artefakt od zlecenia. */
export function unlinkArtifactFromCase(
  linkId: string,
  reason?: string | null,
  options?: CommandOptions
): Promise<CaseCommandResult<CaseArtifactLink>> {
  return runCommand<CaseArtifactLink, CaseArtifactLink>(
    (key) =>
      send({
        method: 'DELETE',
        path: `/artifact-links/${encodeURIComponent(linkId)}`,
        body: { reason: reason ?? null },
        idempotencyKey: key,
      }),
    () => getArtifactLink(linkId),
    (updated) => updated,
    options?.idempotencyKey
  );
}
