/**
 * U-25 v2 / DEC-572 (RAPORT-GEN, Wpis 72) — materializacja legacy bliźniaka
 * `assessments` dla ZAMROŻONEJ sesji Method Core, która go nie ma.
 *
 * DLACZEGO (pomiar CTO na kopii stagingu, 2026-09-17): 20/20 sesji DRD (w tym 2
 * zamrożone/APPROVED) NIE MA bliźniaka `assessments`. Ścieżka `freeze`
 * (`method-core.routes.ts:1829`) pisze wyłącznie `method_outputs`/`method_findings`/
 * `method_report_snapshots`/`method_initiative_drafts` — NIGDY `assessments`
 * (grep po `server/src/method-core/**` trafiał tylko komentarze). Tymczasem
 * `reportBuilderService.createReport` dla `sourceType='ASSESSMENT'` WYMAGA
 * istniejącego wiersza `assessments` ze `status='APPROVED'`
 * (`reportBuilderService.ts:983-996`, `getAssessmentSourceData` :468). Bez
 * bliźniaka każdy użytkownik dostawał „freeze it first" i nigdy nie generował
 * raportu — bloker pilotażu.
 *
 * JAK: jeden eksportowany pisarz (`ensureLegacyAssessmentTwinForSession`),
 * idempotentny DWOMA kluczami zgodnymi z zamówieniem („klucz po
 * method_session_id/project_id"):
 *   1. najpierw wyszukiwanie istniejącego bliźniaka DRD po `project_id`
 *      (dokładnie ten klucz, po którym łączy `AssessmentHub.tsx:755-775`) —
 *      drugi klik zwraca TEN SAM wiersz, `created=false`;
 *   2. deterministyczne PK `<sessionId>--assessment--drd-twin` + `ON CONFLICT
 *      (id) DO NOTHING` — zabezpieczenie na wyścig równoległych kliknięć.
 *
 * Bliznak dostaje `status='APPROVED'`, bo sesja jest zamrożona (frontend mapuje
 * `frozen -> APPROVED`, `AssessmentHub.tsx:323`), a `createReport` odrzuca
 * wszystko co nie jest APPROVED. Pola treściowe (answers/score/context) zostają
 * puste — kanoniczna treść DRD żyje w `method_outputs`, a ogon generowania
 * raportu (AI) czyta ją osobno; ten pisarz domyka TYLKO brakujące źródło.
 *
 * NIE duplikuje SQL „z pamięci": zestaw kolumn odwzorowuje kanoniczny INSERT
 * `routes/v8/assessment.routes.ts:602-628` (plus `status='APPROVED'` i pola
 * provenance), a wzór idempotencji — `transformationCaseService.ts:3578-3625`.
 */
import * as queryHelpers from '../../utils/queryHelpers.js';
import logger from '../../utils/Logger.js';

export type LegacyTwinErrorCode = 'SESSION_NOT_FOUND' | 'SESSION_NOT_FROZEN';

/** Błąd domenowy pisarza — trasa mapuje go na 404/409, modal na czytelny komunikat. */
export class LegacyTwinError extends Error {
  constructor(
    public readonly code: LegacyTwinErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'LegacyTwinError';
  }
}

/** Stany sesji, które frontend traktuje jako zatwierdzone (`frozen -> APPROVED`). */
const FROZEN_STATES = new Set(['frozen', 'closed', 'archived']);

export interface EnsureLegacyTwinResult {
  /** Id wiersza `assessments` (bliźniaka) — `sourceId` dla `/report-builder`. */
  assessmentId: string;
  /** `true` = wiersz utworzony teraz; `false` = istniejący bliźniak (idempotentnie). */
  created: boolean;
}

export interface EnsureLegacyTwinParams {
  organizationId: string;
  sessionId: string;
  actorUserId: string;
}

/**
 * Zwraca id legacy bliźniaka `assessments` dla zamrożonej sesji Method Core,
 * tworząc go idempotentnie, gdy nie istnieje. Rzuca {@link LegacyTwinError}
 * `SESSION_NOT_FOUND` (sesja spoza org / nie istnieje) albo `SESSION_NOT_FROZEN`
 * (sesja niezamrożona — modal pokaże prawdziwą radę „zamroź sesję").
 */
export async function ensureLegacyAssessmentTwinForSession(
  params: EnsureLegacyTwinParams
): Promise<EnsureLegacyTwinResult> {
  const { organizationId, sessionId, actorUserId } = params;

  const session = await queryHelpers.queryOne<{
    id: string;
    organization_id: string;
    project_id: string | null;
    name: string | null;
    state: string;
    owner_user_id: string | null;
  }>(
    `SELECT id, organization_id, project_id, name, state, owner_user_id
       FROM method_sessions
      WHERE id = ? AND organization_id = ?`,
    [sessionId, organizationId]
  );

  if (!session) {
    throw new LegacyTwinError('SESSION_NOT_FOUND', 'Method session not found');
  }
  if (!FROZEN_STATES.has(String(session.state || '').toLowerCase())) {
    throw new LegacyTwinError('SESSION_NOT_FROZEN', 'Session is not frozen');
  }

  const sessionProjectId = session.project_id || null;

  // `assessments.project_id` ma FK do `projects(id)`. Na kopii dumpu stagingu
  // OBYDWIE zamrożone sesje DRD Northwind niosą `project_id` będący slugiem
  // (`northwind-drd-2027-q`/`-v2`) BEZ wiersza w `projects` — zapis gołęgo
  // sluga złamałby FK dokładnie dla sesji, które ten pisarz ma odblokować.
  // Dlatego project_id kopiujemy TYLKO gdy projekt naprawdę istnieje; inaczej
  // bliźniak ma `project_id=NULL` (kolumna nullable). Report gate
  // (`reportBuilderService.getAssessmentSourceData`/`createReport:983-986`)
  // wymaga jedynie istniejącego wiersza ze `status='APPROVED'`, a idempotencję
  // per-sesja gwarantuje deterministyczne PK (#2) — więc NULL nic nie psuje.
  let twinProjectId: string | null = null;
  if (sessionProjectId) {
    const project = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? LIMIT 1`,
      [sessionProjectId]
    );
    if (project) twinProjectId = sessionProjectId;
  }

  // Idempotencja #1 — klucz project_id (ten sam, po którym łączy AssessmentHub).
  if (twinProjectId) {
    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM assessments
        WHERE organization_id = ? AND project_id = ? AND upper(assessment_type) = 'DRD'
        ORDER BY created_at ASC LIMIT 1`,
      [organizationId, twinProjectId]
    );
    if (existing) {
      return { assessmentId: existing.id, created: false };
    }
  }

  // Idempotencja #2 — deterministyczne PK + ON CONFLICT (wyścig równoległych kliknięć).
  const id = `${sessionId}--assessment--drd-twin`;
  const now = new Date().toISOString();
  const name = (session.name && session.name.trim()) || `DRD · ${sessionId.slice(0, 8)}`;
  const createdBy = session.owner_user_id || actorUserId;

  const insert = await queryHelpers.queryRun(
    `INSERT INTO assessments (
       id, organization_id, project_id, assessment_type, framework, framework_type,
       name, status, completion_percent, answers_json, score_summary, context_snapshot,
       source_type, source_reference, created_by, updated_by, created_at, updated_at, approved_at
     ) VALUES (
       ?, ?, ?, 'DRD', 'DRD', 'DRD',
       ?, 'APPROVED', '100', '{}', '{}', '{}',
       'method_core_session', ?, ?, ?, ?, ?, ?
     )
     ON CONFLICT (id) DO NOTHING`,
    [id, organizationId, twinProjectId, name, sessionId, createdBy, actorUserId, now, now, now]
  );

  const created = (insert?.changes ?? 0) > 0;
  logger.info(
    `[legacyTwinService] session=${sessionId} org=${organizationId} ` +
      `sessionProject=${sessionProjectId ?? '<null>'} twinProject=${twinProjectId ?? '<null>'} ` +
      `twin=${id} created=${created ? 'YES' : 'NO (idempotent)'} state=${session.state}`
  );

  return { assessmentId: id, created };
}
