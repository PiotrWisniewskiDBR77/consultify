/**
 * Zlecenia (Case Workspace) — warstwa dostępu do REALNEGO API.
 *
 * Wszystko idzie przez `v8Get` (`src/services/api/v8/client.ts`), który:
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

import { v8Get } from '@/services/api/v8/client';

import type {
  CanonicalGraph,
  CaseActionProposal,
  CaseApiFailure,
  CaseArtifactLink,
  CaseCoreView,
  CaseHistoryEvent,
  CasePlanVersion,
  CaseWait,
  PlanValidationResult,
  ValueMeasurement,
} from './types';

const BASE = '/case-workspace';

export function toFailure(error: unknown): CaseApiFailure {
  const anyError = error as { status?: number; message?: string; data?: { error?: { code?: string } } };
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

export function getPlanGraph(planVersionId: string): Promise<CanonicalGraph> {
  return v8Get<CanonicalGraph>(`${BASE}/plan-versions/${encodeURIComponent(planVersionId)}/graph`);
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
