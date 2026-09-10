import type { NextFunction, Response } from 'express';

import {
  evaluateEffectiveCapability,
  hasEffectiveCapability,
  resolveEffectiveAccess,
  type CapabilityDecisionReason,
} from '../services/effectiveAccessService.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type { AuthRequest } from './auth.middleware.js';

type ProjectResolver = (
  req: AuthRequest
) => Promise<string | null | undefined> | string | null | undefined;

type CapabilityOptions = {
  reason?: string;
  allowWithoutProject?: boolean;
  /**
   * SHADOW ENFORCEMENT (2026-07-10) — opt a caller into the capability
   * enforcement rollout governed by the `CAPABILITY_ENFORCE` env flag.
   *
   * When `shadow: true` and `CAPABILITY_ENFORCE` is unset or `shadow`
   * (the default), the middleware NEVER blocks: it resolves effective access,
   * logs `{ userId, capability, route, method, projectId, wouldAllow }` and
   * always calls `next()`. This is pure telemetry — we collect "who WOULD get a
   * 403" so the switch to real enforcement can be made from data, not a guess.
   *
   * When `CAPABILITY_ENFORCE=enforce`, the same shadow-tagged gates start
   * returning real 401/400/403/503 responses. The legacy `EFFECTIVE_ACCESS_*`
   * flags are untouched (kept for the pre-existing, still-unwired callers).
   */
  shadow?: boolean;
  /**
   * TRYB PER BRAMKA [ODMROZENIE 07_MY_WORK_AGENT DEC-453]. Globalne
   * `CAPABILITY_ENFORCE` przelacza NARAZ 142 bramki w 8 plikach — masowe
   * wlaczanie jest zakazane (CLAUDE.md regula 9). Ta opcja pozwala postawic
   * JEDNA trase na realne 403, nie ruszajac pozostalych.
   */
  enforceMode?: 'shadow' | 'enforce';
  /**
   * PREDYKAT WLASNOSCI. Gdy podany (albo gdy `objectScoped: true`), zdolnosci
   * z sufiksem `.own/.assigned/.delegated` spelniaja bramke TYLKO wtedy, gdy
   * predykat potwierdzi zwiazek wolajacego z tym konkretnym obiektem. Brak
   * predykatu przy takim sufiksie = odmowa (fail-closed).
   */
  ownerPredicate?: OwnerPredicate;
  /** Wymusza sprawdzanie wlasnosci nawet bez predykatu (= fail-closed). */
  objectScoped?: boolean;
  /**
   * SCIEZKA WLASCICIELA [ODMROZENIE 05_INITIATIVES DEC-453].
   *
   * Domyslnie (`false`) brak zdolnosci w szablonie roli = odmowa i predykat nie
   * jest nawet pytany — dokladnie jak w E2 (zadania). Dla INICJATYW model
   * wlasnosci jest inny i pochodzi z DEC-453 (`evaluateInitiativeAuthorOnly`):
   * o prawie do edycji decyduje ZWIAZEK CZLOWIEKA Z OBIEKTEM (twórca, wlasciciel
   * wykonawczy/biznesowy, sponsor), a nie szablon roli projektowej — MEMBER o
   * roli projektowej TASK_ASSIGNEE nie ma w szablonie ZADNEJ zdolnosci
   * `initiative.update*`, a mimo to musi moc edytowac inicjatywe, ktora sam
   * zalozyl.
   *
   * `ownerGrantsAccess: true` wlacza wiec DRUGA sciezke zgody: gdy zdolnosci
   * brak, predykat wlasnosci moze ja przyznac. To zawezenie, nie rozszerzenie —
   * dzis (bez `enforceMode`) te bramki przepuszczaja KAZDEGO czlonka organizacji.
   * Bez tej opcji semantyka nie zmienia sie o jotę dla zadnej innej bramki.
   */
  ownerGrantsAccess?: boolean;
};

export type OwnerPredicateContext = {
  userId: string;
  organizationId: string;
  projectId: string | null;
};

export type OwnerPredicate = (
  req: AuthRequest,
  ctx: OwnerPredicateContext
) => boolean | Promise<boolean>;

const shouldEnforceEffectiveAccess = () =>
  (process.env.EFFECTIVE_ACCESS_ENFORCE ?? '').trim().toLowerCase() === 'true';
const shouldShadowEffectiveAccess = () =>
  (process.env.EFFECTIVE_ACCESS_SHADOW ?? '').trim().toLowerCase() === 'true';

// Governs the shadow-tagged capability gates (options.shadow === true).
// Default = 'shadow' (log-only, zero blocking). Set CAPABILITY_ENFORCE=enforce
// to turn the collected shadow signals into real 403s.
const capabilityEnforceMode = (): 'shadow' | 'enforce' =>
  (process.env.CAPABILITY_ENFORCE ?? 'shadow').trim().toLowerCase() === 'enforce'
    ? 'enforce'
    : 'shadow';

type ShadowVerdict =
  | { status: 'no_auth' }
  | { status: 'no_project' }
  | { status: 'error' }
  | {
      status: 'evaluated';
      wouldAllow: boolean;
      reason: CapabilityDecisionReason;
      projectId: string | null;
      projectRole: string | null;
    };

/**
 * Resolve effective access and compute whether the caller WOULD pass the
 * capability check — without ever writing a response or throwing. Used by the
 * shadow branch of the capability middlewares. `capabilities` is an array so a
 * single implementation serves both the single- and any-of- variants
 * (wouldAllow = at least one capability granted).
 */
async function runCapabilityShadow(
  req: AuthRequest,
  capabilities: string[],
  resolveProjectId: ProjectResolver,
  options: CapabilityOptions
): Promise<ShadowVerdict> {
  try {
    const { userId, organizationId, applicationRole, isImpersonating } = getUserContext(req);
    if (!userId || !organizationId) return { status: 'no_auth' };

    let projectId: string | null = null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch {
      projectId = null;
    }
    if (!projectId && !options.allowWithoutProject) return { status: 'no_project' };

    const access = await resolveEffectiveAccess({
      userId,
      organizationId,
      applicationRole,
      projectId,
      isImpersonating,
    });
    // Sprawdzanie wlasnosci jest OPT-IN: bez `ownerPredicate`/`objectScoped`
    // decyzja jest identyczna z `hasEffectiveCapability`, wiec telemetria
    // pozostalych 141 bramek nie zmienia ani jednej wartosci `wouldAllow`.
    const requireOwnership =
      options.objectScoped === true || typeof options.ownerPredicate === 'function';
    const ownerPredicate =
      typeof options.ownerPredicate === 'function'
        ? () => options.ownerPredicate!(req, { userId, organizationId, projectId })
        : undefined;

    let wouldAllow = false;
    let reason: CapabilityDecisionReason = 'missing';
    for (const cap of capabilities) {
      const decision = await evaluateEffectiveCapability(access, cap, {
        requireOwnership,
        ownerPredicate,
      });
      if (decision.allowed) {
        wouldAllow = true;
        reason = decision.reason;
        break;
      }
      reason = mocniejszyPowod(reason, decision.reason);
    }

    // SCIEZKA WLASCICIELA (opt-in per bramka, patrz `ownerGrantsAccess`).
    // Wchodzi TYLKO gdy zadna zdolnosc nie wystarczyla i tylko dla powodu
    // `missing` — decyzji `ownership_denied` (predykat juz powiedzial NIE)
    // nie wolno odwracac, bo to byloby obejscie kontroli z E2.
    if (!wouldAllow && options.ownerGrantsAccess === true && reason === 'missing') {
      if (!ownerPredicate) {
        reason = 'ownership_predicate_missing';
      } else {
        try {
          if ((await ownerPredicate()) === true) {
            wouldAllow = true;
            reason = 'ownership_confirmed';
          } else {
            reason = 'ownership_denied';
          }
        } catch {
          // Brak pomiaru nie jest wynikiem pozytywnym.
          reason = 'ownership_check_failed';
        }
      }
    }

    return {
      status: 'evaluated',
      wouldAllow,
      reason,
      projectId,
      projectRole: (access as { projectRole?: string | null }).projectRole ?? null,
    };
  } catch {
    return { status: 'error' };
  }
}

/**
 * Shadow-branch handler shared by both capability middlewares. In `shadow`
 * mode it ALWAYS calls next() (guaranteed zero blocking) after logging the
 * verdict. In `enforce` mode it converts the verdict into the same
 * 401/400/403/503 responses the legacy enforce path would produce.
 *
 * Returns true if it fully handled the request (caller must return).
 */
async function handleShadowCapability(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  capabilities: string[],
  resolveProjectId: ProjectResolver,
  options: CapabilityOptions
): Promise<void> {
  const mode = options.enforceMode ?? capabilityEnforceMode();
  const verdict = await runCapabilityShadow(req, capabilities, resolveProjectId, options);
  const capLabel = capabilities.length === 1 ? capabilities[0] : capabilities;
  const route = safePath(req);
  const method = (() => {
    try {
      return (req as AuthRequest & { method?: string }).method ?? '';
    } catch {
      return '';
    }
  })();
  const userId = firstString(req.user?.id, req.userId);

  // Always emit the telemetry line (log-only doctrine).
  logger.info('[capabilityShadow]', {
    mode,
    capability: capLabel,
    route,
    method,
    userId,
    status: verdict.status,
    wouldAllow: verdict.status === 'evaluated' ? verdict.wouldAllow : null,
    reason: verdict.status === 'evaluated' ? verdict.reason : null,
    projectId: verdict.status === 'evaluated' ? verdict.projectId : null,
    projectRole: verdict.status === 'evaluated' ? verdict.projectRole : null,
  });

  if (mode === 'shadow') {
    // ZERO blocking — collect data only, never touch the response.
    safeNext(next, 'shadow', capLabel);
    return;
  }

  // enforce mode: turn verdict into real responses.
  if (verdict.status === 'no_auth') {
    safeWriteJson(
      res,
      401,
      { error: 'Authentication required', code: 'AUTH_REQUIRED' },
      'auth',
      {}
    );
    return;
  }
  if (verdict.status === 'no_project') {
    safeWriteJson(
      res,
      400,
      {
        error: 'Project context is required',
        code: 'PROJECT_CONTEXT_REQUIRED',
        required: capLabel,
        reason: options.reason || 'missing_project_context',
      },
      'deny',
      { capability: capLabel }
    );
    return;
  }
  if (verdict.status === 'error') {
    safeWriteJson(
      res,
      503,
      { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
      'error',
      { capability: capLabel }
    );
    return;
  }
  if (!verdict.wouldAllow) {
    safeWriteJson(
      res,
      403,
      {
        error: 'Capability required',
        code: kodOdmowy(verdict.reason),
        required: capLabel,
        projectId: verdict.projectId,
        reason: options.reason || powodOdmowy(verdict.reason),
      },
      'deny',
      { capability: capLabel, path: route, verdictReason: verdict.reason }
    );
    return;
  }
  (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = undefined;
  safeNext(next, 'allow', capLabel);
}

/**
 * Powod odmowy dla wielu zdolnosci (wariant "any-of"): najbardziej konkretny
 * wygrywa, zeby wolajacy dostal kod mowiacy CO poszlo nie tak, a nie zawsze
 * najogolniejsze "brak zdolnosci".
 */
const RANGA_POWODU: Record<string, number> = {
  missing: 0,
  ownership_predicate_missing: 1,
  ownership_check_failed: 2,
  ownership_denied: 3,
};

function mocniejszyPowod(
  a: CapabilityDecisionReason,
  b: CapabilityDecisionReason
): CapabilityDecisionReason {
  return (RANGA_POWODU[b] ?? 0) > (RANGA_POWODU[a] ?? 0) ? b : a;
}

/**
 * Rozroznienie niesie KOD (maszynowy, tlumaczony we froncie), nie tresc.
 * Zdanie w odpowiedzi zostaje jedno i to samo, zeby nie dokladac angielskich
 * napisow do interfejsu (bramka jezykowa J0).
 */
function kodOdmowy(powod: CapabilityDecisionReason): string {
  switch (powod) {
    case 'ownership_denied':
      return 'CAPABILITY_OBJECT_OWNERSHIP_REQUIRED';
    case 'ownership_predicate_missing':
      return 'CAPABILITY_OWNERSHIP_PREDICATE_MISSING';
    case 'ownership_check_failed':
      return 'CAPABILITY_OWNERSHIP_CHECK_FAILED';
    default:
      return 'CAPABILITY_REQUIRED';
  }
}

function powodOdmowy(powod: CapabilityDecisionReason): string {
  switch (powod) {
    case 'ownership_denied':
      return 'object_not_owned_by_caller';
    case 'ownership_predicate_missing':
      return 'ownership_predicate_missing';
    case 'ownership_check_failed':
      return 'ownership_check_failed';
    default:
      return 'missing_capability_or_scope';
  }
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function safePath(req: AuthRequest): string {
  try {
    return req.path ?? '';
  } catch {
    return '';
  }
}

function isResponseCommitted(res: Response): boolean {
  try {
    if ((res as any).headersSent) return true;
    if ((res as any).writableFinished) return true;
    if ((res as any).finished) return true;
    return false;
  } catch {
    return true;
  }
}

function safeWriteJson(
  res: Response,
  status: number,
  body: object,
  phase: string,
  extra: Record<string, unknown>
): void {
  if (isResponseCommitted(res)) {
    logger.warn('[effectiveCapability] response already committed; skipping json write', {
      status,
      phase,
      ...extra,
    });
    return;
  }
  if (isResponseCommitted(res)) {
    logger.warn('[effectiveCapability] response committed before json write; skipping', {
      status,
      phase,
      ...extra,
    });
    return;
  }
  if (typeof (res as any).status !== 'function' || typeof (res as any).json !== 'function') {
    logger.error('[effectiveCapability] response object missing status/json handlers', {
      status,
      phase,
      ...extra,
    });
    return;
  }
  try {
    res.status(status).json(body);
  } catch (writeErr) {
    logger.error('[effectiveCapability] failed to write json response', {
      status,
      phase,
      error: (writeErr as Error).message,
      ...extra,
    });
  }
}

function safeNext(next: NextFunction, phase: string, capability: string | string[]): void {
  let result: unknown;
  try {
    result = next();
  } catch (syncErr) {
    logger.error('[effectiveCapability] next() threw synchronously', { phase, capability });
    next(syncErr as Error);
    return;
  }
  if (result instanceof Promise) {
    result.catch((asyncErr: unknown) => {
      logger.error('[effectiveCapability] next() returned rejected promise', { phase, capability });
      next(asyncErr as Error);
    });
  }
}

function getUserContext(req: AuthRequest) {
  return {
    userId: firstString(req.user?.id, req.userId),
    organizationId: firstString(req.user?.organizationId, req.organizationId),
    applicationRole: firstString(req.userRole, req.user?.role),
    isImpersonating: Boolean(req.user?.impersonatorId),
  };
}

export async function resolveProjectIdFromRequest(req: AuthRequest): Promise<string | null> {
  try {
    return firstString(
      req.params?.projectId,
      req.params?.id,
      req.body?.projectId,
      req.body?.project_id,
      req.query?.projectId,
      req.query?.project_id
    );
  } catch {
    return null;
  }
}

export async function resolveTaskProjectId(req: AuthRequest): Promise<string | null> {
  const taskId = firstString(
    req.params?.taskId,
    req.params?.id,
    req.body?.taskId,
    req.body?.task_id
  );
  if (!taskId || taskId.length > 128) return await resolveProjectIdFromRequest(req);
  const row = await queryHelpers
    .queryOne<{
      project_id?: string;
    }>(`SELECT project_id FROM tasks WHERE id = ? LIMIT 1`, [taskId])
    .catch(() => null);
  return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
}

/**
 * PREDYKAT WLASNOSCI ZADANIA [ODMROZENIE 07_MY_WORK_AGENT DEC-453].
 *
 * Kolumny zmierzone na kopii `consultify_kopia_e2` (2026-09-10) — tabela
 * `tasks` ma `assignee_id`, `owner_id`, `created_by`, `reporter_id`. Kazda z
 * nich opisuje realny zwiazek czlowieka z zadaniem, wiec kazda spelnia sufiks
 * `.assigned/.own/.delegated`. Wszystko inne = cudze zadanie.
 *
 * FAIL-CLOSED: brak identyfikatora, brak wiersza, obca organizacja albo blad
 * odczytu => `false`. Brak pomiaru nie jest wynikiem pozytywnym.
 */
export async function isTaskOwnedByCaller(
  req: AuthRequest,
  ctx: OwnerPredicateContext
): Promise<boolean> {
  const taskId = firstString(
    req.params?.taskId,
    req.params?.id,
    req.body?.taskId,
    req.body?.task_id
  );
  if (!taskId || taskId.length > 128) return false;
  if (!ctx.userId) return false;

  const row = await queryHelpers.queryOne<{
    assignee_id?: string | null;
    owner_id?: string | null;
    created_by?: string | null;
    reporter_id?: string | null;
    organization_id?: string | null;
  }>(
    `SELECT assignee_id, owner_id, created_by, reporter_id, organization_id
       FROM tasks WHERE id = ? LIMIT 1`,
    [taskId]
  );
  if (!row) return false;
  if (row.organization_id && ctx.organizationId && row.organization_id !== ctx.organizationId)
    return false;

  return [row.assignee_id, row.owner_id, row.created_by, row.reporter_id].some(
    (wartosc) => typeof wartosc === 'string' && wartosc.trim() !== '' && wartosc === ctx.userId
  );
}

export async function resolveInitiativeProjectId(req: AuthRequest): Promise<string | null> {
  const initiativeId = firstString(
    req.params?.initiativeId,
    req.params?.id,
    req.body?.initiativeId,
    req.body?.initiative_id
  );
  if (!initiativeId) return await resolveProjectIdFromRequest(req);
  const row = await queryHelpers
    .queryOne<{
      project_id?: string;
    }>(`SELECT project_id FROM initiatives WHERE id = ? LIMIT 1`, [initiativeId])
    .catch(() => null);
  return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
}

/**
 * PREDYKAT WLASNOSCI INICJATYWY [ODMROZENIE 05_INITIATIVES DEC-453].
 *
 * Kolumny ZMIERZONE na kopii `consultify_kopia_e2b` (2026-09-10) — tabela
 * `initiatives` ma dokladnie cztery kolumny opisujace zwiazek czlowieka z
 * inicjatywa: `created_by` (twórca), `owner_execution_id` (wlasciciel
 * wykonawczy), `owner_business_id` (wlasciciel biznesowy) i `sponsor_id`
 * (sponsor). `updated_by` NIE jest wlasnoscia — ktokolwiek zapisal rekord
 * ostatni raz nie staje sie przez to jego wlascicielem, wiec ta kolumna jest
 * swiadomie pominieta (inaczej pierwszy udany wlam nadawalby prawo do
 * kolejnych).
 *
 * Model zgodny z DEC-453 (`evaluateInitiativeAuthorOnly` w
 * `services/initiative/initiativeTransitionConditions.ts`): o prawie do edycji
 * decyduje autorstwo/wlasnosc obiektu, a ADMIN/OWNER organizacji przechodzi
 * wczesniej — na zdolnosci (`*` / sentinel admina), zanim predykat zostanie
 * zapytany.
 *
 * FAIL-CLOSED: brak identyfikatora, brak wiersza, obca organizacja albo blad
 * odczytu => `false`. Brak pomiaru nie jest wynikiem pozytywnym.
 */
export async function isInitiativeOwnedByCaller(
  req: AuthRequest,
  ctx: OwnerPredicateContext
): Promise<boolean> {
  const initiativeId = firstString(
    req.params?.initiativeId,
    req.params?.id,
    req.body?.initiativeId,
    req.body?.initiative_id
  );
  if (!initiativeId || initiativeId.length > 128) return false;
  if (!ctx.userId) return false;

  const row = await queryHelpers.queryOne<{
    created_by?: string | null;
    owner_execution_id?: string | null;
    owner_business_id?: string | null;
    sponsor_id?: string | null;
    organization_id?: string | null;
  }>(
    `SELECT created_by, owner_execution_id, owner_business_id, sponsor_id, organization_id
       FROM initiatives WHERE id = ? LIMIT 1`,
    [initiativeId]
  );
  if (!row) return false;
  if (row.organization_id && ctx.organizationId && row.organization_id !== ctx.organizationId)
    return false;

  return [row.created_by, row.owner_execution_id, row.owner_business_id, row.sponsor_id].some(
    (wartosc) => typeof wartosc === 'string' && wartosc.trim() !== '' && wartosc === ctx.userId
  );
}

export async function resolveInterviewProjectId(req: AuthRequest): Promise<string | null> {
  const assignmentId = firstString(req.params?.assignmentId, req.params?.id);
  if (assignmentId) {
    const row = await queryHelpers
      .queryOne<{ project_id?: string; session_project_id?: string }>(
        `SELECT ia.project_id, s.project_id as session_project_id
         FROM interview_assignments ia
         LEFT JOIN interview_sessions s ON s.id = ia.session_id
         WHERE ia.id = ?
         LIMIT 1`,
        [assignmentId]
      )
      .catch(() => null);
    const projectId = firstString(row?.project_id, row?.session_project_id);
    if (projectId) return projectId;
  }

  const sessionId = firstString(req.params?.sessionId, req.body?.sessionId, req.query?.sessionId);
  if (sessionId) {
    const row = await queryHelpers
      .queryOne<{
        project_id?: string;
      }>(`SELECT project_id FROM interview_sessions WHERE id = ? LIMIT 1`, [sessionId])
      .catch(() => null);
    return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
  }

  const insightId = firstString(req.params?.insightId, req.params?.id, req.body?.insightId);
  if (insightId) {
    const row = await queryHelpers
      .queryOne<{
        project_id?: string;
      }>(`SELECT project_id FROM interview_insights WHERE id = ? LIMIT 1`, [insightId])
      .catch(() => null);
    return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
  }

  return await resolveProjectIdFromRequest(req);
}

export async function resolveDecisionProjectId(req: AuthRequest): Promise<string | null> {
  const decisionId = firstString(
    req.params?.decisionId,
    req.params?.id,
    req.body?.decisionId,
    req.body?.decision_id
  );
  if (!decisionId || decisionId.length > 128) return await resolveProjectIdFromRequest(req);
  const row = await queryHelpers
    .queryOne<{
      project_id?: string;
    }>(`SELECT project_id FROM decisions WHERE id = ? LIMIT 1`, [decisionId])
    .catch(() => null);
  return firstString(row?.project_id, await resolveProjectIdFromRequest(req));
}

export function requireProjectCapability(
  capability: string,
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!capability || !capability.trim()) {
      safeWriteJson(
        res,
        400,
        { error: 'Capability name is required', code: 'CAPABILITY_INVALID' },
        'validate',
        {}
      );
      return;
    }

    // Shadow-enforcement rollout: log-only by default, never blocks.
    if (options.shadow) {
      await handleShadowCapability(req, res, next, [capability], resolveProjectId, options);
      return;
    }

    let userId: string | null,
      organizationId: string | null,
      applicationRole: string | null,
      isImpersonating: boolean;
    try {
      ({ userId, organizationId, applicationRole, isImpersonating } = getUserContext(req));
    } catch {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!userId || !organizationId) {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!shouldEnforceEffectiveAccess() && !shouldShadowEffectiveAccess()) {
      safeNext(next, 'allow', capability);
      return;
    }

    let projectId: string | null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch (err) {
      logger.error('[effectiveCapability] resolveProjectId failed', {
        capability,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capability }
      );
      return;
    }
    if (!projectId && !options.allowWithoutProject) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capability,
          path: safePath(req),
        });
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        400,
        {
          error: 'Project context is required',
          code: 'PROJECT_CONTEXT_REQUIRED',
          required: capability,
          reason: options.reason || 'missing_project_context',
        },
        'deny',
        { capability }
      );
      return;
    }

    let access: Awaited<ReturnType<typeof resolveEffectiveAccess>> | undefined;
    try {
      access = await resolveEffectiveAccess({
        userId,
        organizationId,
        applicationRole,
        projectId,
        isImpersonating,
      });
    } catch (err) {
      logger.error('[effectiveCapability] resolveEffectiveAccess failed', {
        capability,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capability }
      );
      return;
    }

    let capable: boolean;
    try {
      capable = hasEffectiveCapability(access, capability);
    } catch (err) {
      logger.error('[effectiveCapability] capability evaluator failed', {
        capability,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capability }
      );
      return;
    }

    if (!capable) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capability,
          projectId,
          path: safePath(req),
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        safeNext(next, 'allow', capability);
        return;
      }
      safeWriteJson(
        res,
        403,
        {
          error: 'Capability required',
          code: 'CAPABILITY_REQUIRED',
          required: capability,
          projectId,
          reason: options.reason || 'missing_capability_or_scope',
        },
        'deny',
        { capability, path: safePath(req) }
      );
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    safeNext(next, 'allow', capability);
  };
}

export function requireAnyProjectCapability(
  capabilities: string[],
  resolveProjectId: ProjectResolver = resolveProjectIdFromRequest,
  options: CapabilityOptions = {}
) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!capabilities.length) {
      safeWriteJson(
        res,
        400,
        { error: 'At least one capability is required', code: 'CAPABILITY_LIST_INVALID' },
        'validate',
        {}
      );
      return;
    }

    // Shadow-enforcement rollout: log-only by default, never blocks.
    if (options.shadow) {
      await handleShadowCapability(req, res, next, capabilities, resolveProjectId, options);
      return;
    }

    let userId: string | null,
      organizationId: string | null,
      applicationRole: string | null,
      isImpersonating: boolean;
    try {
      ({ userId, organizationId, applicationRole, isImpersonating } = getUserContext(req));
    } catch {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!userId || !organizationId) {
      safeWriteJson(
        res,
        401,
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        'auth',
        {}
      );
      return;
    }
    if (!shouldEnforceEffectiveAccess() && !shouldShadowEffectiveAccess()) {
      safeNext(next, 'allow', capabilities);
      return;
    }

    let projectId: string | null;
    try {
      projectId = firstString(await resolveProjectId(req));
    } catch (err) {
      logger.error('[effectiveCapability] resolveProjectId failed', {
        capabilities,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capabilities }
      );
      return;
    }
    if (!projectId && !options.allowWithoutProject) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow missing project context', {
          capabilities,
          path: safePath(req),
        });
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        400,
        {
          error: 'Project context is required',
          code: 'PROJECT_CONTEXT_REQUIRED',
          required: capabilities,
          reason: options.reason || 'missing_project_context',
        },
        'deny',
        { capabilities }
      );
      return;
    }

    let access: Awaited<ReturnType<typeof resolveEffectiveAccess>> | undefined;
    try {
      access = await resolveEffectiveAccess({
        userId,
        organizationId,
        applicationRole,
        projectId,
        isImpersonating,
      });
    } catch (err) {
      logger.error('[effectiveCapability] resolveEffectiveAccess failed', {
        capabilities,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capabilities }
      );
      return;
    }

    let capable: boolean;
    try {
      capable = capabilities.some((cap) => hasEffectiveCapability(access, cap));
    } catch (err) {
      logger.error('[effectiveCapability] capability evaluator failed', {
        capabilities,
        error: (err as Error).message,
      });
      if (!shouldEnforceEffectiveAccess()) {
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        503,
        { error: 'Capability check failed', code: 'EFFECTIVE_ACCESS_CHECK_FAILED' },
        'error',
        { capabilities }
      );
      return;
    }

    if (!capable) {
      if (!shouldEnforceEffectiveAccess()) {
        logger.warn('[effectiveCapability] shadow capability mismatch', {
          capabilities,
          projectId,
          path: safePath(req),
        });
        (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
        safeNext(next, 'allow', capabilities);
        return;
      }
      safeWriteJson(
        res,
        403,
        {
          error: 'Capability required',
          code: 'CAPABILITY_REQUIRED',
          required: capabilities,
          projectId,
          reason: options.reason || 'missing_capability_or_scope',
        },
        'deny',
        { capabilities }
      );
      return;
    }

    (req as AuthRequest & { effectiveAccess?: unknown }).effectiveAccess = access;
    safeNext(next, 'allow', capabilities);
  };
}

export const requireTaskCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveTaskProjectId, options);

export const requireInterviewCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveInterviewProjectId, options);

export const requireAnyInterviewCapability = (
  capabilities: string[],
  options?: CapabilityOptions
) => requireAnyProjectCapability(capabilities, resolveInterviewProjectId, options);

export const requireInitiativeCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveInitiativeProjectId, options);

export const requireDecisionCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, resolveDecisionProjectId, options);

export const requireAnyInitiativeCapability = (
  capabilities: string[],
  options?: CapabilityOptions
) => requireAnyProjectCapability(capabilities, resolveInitiativeProjectId, options);

export const requireSupportCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, async () => null, { ...options, allowWithoutProject: true });

export const requireBillingCapability = (capability: string, options?: CapabilityOptions) =>
  requireProjectCapability(capability, async () => null, { ...options, allowWithoutProject: true });
