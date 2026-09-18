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
 * wszystko co nie jest APPROVED.
 *
 * ★ RG-1 v3 (Wpis 89): pola treściowe NIE są już puste. Wersja v2 pisała
 * `'{}'` do `answers_json`/`score_summary`, więc `reportBuilderService.
 * getAssessmentSourceData` (:468-507) zwracał `answers={}` i `scores={}`,
 * a generatory (`reportGenerationService` :558/:612/:654 — `scores`,
 * :626-634 — `axisData`) dostawały pusty kontekst i lały tekst ogólny.
 * Teraz bliźniak niesie poziomy per obszar ZAMROŻONEGO outputu jądra
 * (`method_outputs.current_json`/`target_json` = `{unitId: poziom}`, pomiar na
 * kopii dumpu stagingu: 39 obszarów w obu zamrożonych sesjach NW) przepisane
 * 1:1 na kanoniczny kształt legacy `answers.drd.areas.<unitId> =
 * {achievedLevel, targetLevel}` — ten sam, który czyta
 * `assessmentLegacyReportContractService.odczytajObszaryZastane` (:77-119).
 * `score_summary` liczy WSPÓLNA arytmetyka osi (`drdAxisAggregation.ts`),
 * więc bliźniak i raport nie mogą się rozjechać. Adapter odczytu jądra:
 * `methodOutputService.listOutputsBySession` — zero nowego SQL.
 *
 * NIE duplikuje SQL „z pamięci": zestaw kolumn odwzorowuje kanoniczny INSERT
 * `routes/v8/assessment.routes.ts:602-628` (plus `status='APPROVED'` i pola
 * provenance), a wzór idempotencji — `transformationCaseService.ts:3578-3625`.
 */
import { methodOutputService } from '../../method-core/outputs/MethodOutputService.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import logger from '../../utils/Logger.js';
import { buildDrdAxesData, deriveAssessmentScores } from './drdAxisAggregation.js';

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
  /** RG-1 v3: ile obszarów DRD niesie snapshot (0 = jądro nie ma zamrożonego outputu). */
  snapshotAreaCount: number;
  /** RG-1 v3: `true` = istniejący bliźniak miał PUSTY snapshot i został dopisany teraz. */
  snapshotBackfilled: boolean;
}

export interface EnsureLegacyTwinParams {
  organizationId: string;
  sessionId: string;
  actorUserId: string;
}

/** Treść bliźniaka w kształcie legacy — `assessments.answers_json`/`score_summary`. */
export interface LegacyTwinSnapshot {
  answersJson: string;
  scoreSummaryJson: string;
  areaCount: number;
  outputId: string | null;
}

const EMPTY_SNAPSHOT: LegacyTwinSnapshot = {
  answersJson: '{}',
  scoreSummaryJson: '{}',
  areaCount: 0,
  outputId: null,
};

/**
 * Poziom 0/brak = BRAK POMIARU, nie zmierzone zero — ta sama konwencja co
 * `assessmentLegacyReportContractService.poziom` (:60-62) i bramka pokrycia
 * warsztatu DRD (`assessment.routes.test.ts:1029`).
 */
function measuredLevel(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * RG-1 v3 (Wpis 89) — snapshot legacy z ZAMROŻONEJ sesji Method Core.
 *
 * Źródło: najnowsza rewizja outputu (`listOutputsBySession` sortuje
 * `output_version DESC`, `MethodOutputService.ts:546-548`) — dokładnie ten sam
 * wybór, który robi `assessmentReportContractService.build` (:236-239), więc
 * bliźniak i raport DOCX jądra mówią o tej samej rewizji. Mapowanie jest
 * przepisywaniem kluczy (`current_json`/`target_json` = `{unitId: poziom}` →
 * `answers.drd.areas.<unitId> = {achievedLevel, targetLevel}`), bez arytmetyki;
 * jedyną liczoną wartością są średnie osi w `score_summary` i te pochodzą ze
 * WSPÓLNEGO modułu `drdAxisAggregation.ts`, którego używa też czytelnik raportu.
 *
 * Brak outputu (sesja zamrożona bez freeze'a jądra / starszy ślad) → snapshot
 * PUSTY i `areaCount=0`: bliźniak wtedy nie udaje, że coś zmierzono, a raport
 * zachowuje dotychczasowe zachowanie (tekst ogólny) zamiast wymyślonych zer.
 */
export async function buildLegacyTwinSnapshotFromSession(
  organizationId: string,
  sessionId: string
): Promise<LegacyTwinSnapshot> {
  const outputs = await methodOutputService.listOutputsBySession(organizationId, sessionId);
  const output = outputs[0] ?? null;
  if (!output) return EMPTY_SNAPSHOT;

  const areas: Record<string, { achievedLevel: number | null; targetLevel: number | null }> = {};
  const unitIds = [...new Set([...Object.keys(output.current), ...Object.keys(output.target)])].sort();
  for (const unitId of unitIds) {
    const achievedLevel = measuredLevel(output.current[unitId]);
    const targetLevel = measuredLevel(output.target[unitId]);
    if (achievedLevel === null && targetLevel === null) continue;
    areas[unitId] = { achievedLevel, targetLevel };
  }
  const areaCount = Object.keys(areas).length;
  if (areaCount === 0) return { ...EMPTY_SNAPSHOT, outputId: output.id };

  const answers = {
    drd: { areas },
    // Proweniencja obok `drd` (nie wewnątrz) — oba czytniki legacy patrzą
    // wyłącznie na `drd.areas`, a ten blok mówi, skąd pochodzą liczby.
    methodCore: {
      mapping: 'method-core-frozen-output-v1',
      sessionId,
      outputId: output.id,
      outputVersion: output.outputVersion,
      methodPackVersion: output.methodPackVersion,
      frozenAt: output.frozenAt,
    },
  };
  const scores = deriveAssessmentScores(buildDrdAxesData(answers), 'DRD');

  return {
    answersJson: JSON.stringify(answers),
    scoreSummaryJson: JSON.stringify(scores ?? {}),
    areaCount,
    outputId: output.id,
  };
}

/**
 * Dopisuje snapshot istniejącemu bliźniakowi, który powstał PRZED v3 (wdrożenie
 * 25 na stagingu: `answers_json='{}'`) — bez tego naprawa nie dotarłaby do
 * klikniętych już sesji, bo oba klucze idempotencji zwracają istniejący wiersz.
 * Warunki są wąskie z premedytacją: dotykamy TYLKO wiersza o
 * `source_type='method_core_session'` (pisze go wyłącznie ten serwis) i TYLKO
 * gdy jego `answers_json` jest pusty — ręcznie prowadzona ocena legacy z realną
 * treścią nigdy nie zostanie nadpisana.
 */
async function backfillTwinSnapshotIfEmpty(
  assessmentId: string,
  snapshot: LegacyTwinSnapshot
): Promise<boolean> {
  if (snapshot.areaCount === 0) return false;
  const update = await queryHelpers.queryRun(
    `UPDATE assessments
        SET answers_json = ?, score_summary = ?, updated_at = ?
      WHERE id = ?
        AND source_type = 'method_core_session'
        AND (answers_json IS NULL OR answers_json = '' OR answers_json = '{}')`,
    [snapshot.answersJson, snapshot.scoreSummaryJson, new Date().toISOString(), assessmentId]
  );
  const backfilled = (update?.changes ?? 0) > 0;
  if (backfilled) {
    logger.info(
      `[legacyTwinService] twin=${assessmentId} snapshot BACKFILLED areas=${snapshot.areaCount} ` +
        `output=${snapshot.outputId ?? '<null>'}`
    );
  }
  return backfilled;
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

  // RG-1 v3 (Wpis 89) — treść bliźniaka z zamrożonego outputu jądra. Liczona
  // PRZED gałęziami idempotencji, bo dopisanie snapshotu istniejącemu (pustemu)
  // bliźniakowi jest częścią tego samego zamówienia, co jego utworzenie.
  const snapshot = await buildLegacyTwinSnapshotFromSession(organizationId, sessionId);

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
      const snapshotBackfilled = await backfillTwinSnapshotIfEmpty(existing.id, snapshot);
      return {
        assessmentId: existing.id,
        created: false,
        snapshotAreaCount: snapshot.areaCount,
        snapshotBackfilled,
      };
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
       ?, 'APPROVED', '100', ?, ?, '{}',
       'method_core_session', ?, ?, ?, ?, ?, ?
     )
     ON CONFLICT (id) DO NOTHING`,
    [
      id,
      organizationId,
      twinProjectId,
      name,
      snapshot.answersJson,
      snapshot.scoreSummaryJson,
      sessionId,
      createdBy,
      actorUserId,
      now,
      now,
      now,
    ]
  );

  const created = (insert?.changes ?? 0) > 0;
  // Wyścig równoległych kliknięć: wiersz już był (ON CONFLICT), więc snapshot
  // z tego INSERT-u nie został zapisany — dopisujemy go, jeśli jest pusty.
  const snapshotBackfilled = created
    ? false
    : await backfillTwinSnapshotIfEmpty(id, snapshot);
  logger.info(
    `[legacyTwinService] session=${sessionId} org=${organizationId} ` +
      `sessionProject=${sessionProjectId ?? '<null>'} twinProject=${twinProjectId ?? '<null>'} ` +
      `twin=${id} created=${created ? 'YES' : 'NO (idempotent)'} state=${session.state} ` +
      `snapshotAreas=${snapshot.areaCount} output=${snapshot.outputId ?? '<null>'} ` +
      `backfilled=${snapshotBackfilled ? 'YES' : 'NO'}`
  );

  return {
    assessmentId: id,
    created,
    snapshotAreaCount: snapshot.areaCount,
    snapshotBackfilled,
  };
}
