/**
 * RG-1 v3 / DEC-572 (RAPORT-GEN, Wpis 89) — bliźniak legacy niesie snapshot
 * ZAMROŻONEJ sesji Method Core, a raport ma z niego realne liczby.
 *
 * DEFEKT (pomiar CTO, staging po wdrożeniu 25): `legacyTwinService` pisał
 * `answers_json='{}'`, `score_summary='{}'`, więc `reportBuilderService.
 * getAssessmentSourceData` (:468-507) zwracał `answers={}`/`scores={}`,
 * `getSourceDataForReport` (:2465) nie miał czego pogrupować po osiach,
 * a prompty (`reportGenerationService` :558/:612/:654 = `scores`, :626-634 =
 * `axisData`) i deterministyczna sekcja `matrix` (:1429-1478) dostawały pustkę —
 * 14 sekcji generowało się BEZ danych sesji (tekst ogólny).
 *
 * NAPRAWA: `buildLegacyTwinSnapshotFromSession` przepisuje `method_outputs.
 * current_json`/`target_json` (`{unitId: poziom}`) zamrożonego outputu na
 * kanoniczny kształt legacy `answers.drd.areas.<unitId> = {achievedLevel,
 * targetLevel}` i liczy `score_summary` WSPÓLNĄ arytmetyką osi
 * (`drdAxisAggregation.ts`, używa jej też czytelnik raportu). Adapter odczytu
 * jądra: `methodOutputService.listOutputsBySession` — zero nowego SQL.
 *
 * ŚRODOWISKO (pomiar 2026-09-18, kopia dumpu `staging-pre-wdrozenie25`,
 * `pg_restore` exit 0, kontener `qoder-b-pg-89` = pgvector/pgvector:pg17,
 * port 6612): obie zamrożone sesje DRD Northwind mają PO 1 outputcie,
 * 39 findingów, 104 zdarzenia `ANSWER_CONFIRMED` na 39 różnych `unit_id`,
 * a `current_json`/`target_json` mają po 39 kluczy. Bliźniaków w dumpie NIE MA
 * (wdrożenie 25 powstało później) — test tworzy je sam i sprząta.
 *
 * DOWÓD MUTACYJNY: `buildLegacyTwinSnapshotFromSession` zwracający
 * `EMPTY_SNAPSHOT` (czyli zachowanie v2) → testy 1-3 RED (`snapshotAreaCount`
 * 0 zamiast 39, `scores.axes` puste, sekcja `matrix` bez osi), test 4 zostaje
 * zielony (to bramka obcego wiersza, nie snapshotu).
 *
 * RUN:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6612/consultify_dump \
 *   npx vitest run server/src/services/assessment/__tests__/legacyTwinSnapshot.realpg.test.ts \
 *     --maxWorkers=1 --no-file-parallelism --retry=0
 *
 * Kolejność testów jest istotna (1 tworzy bliźniaka, 3 resetuje go do stanu
 * v2 i sprawdza dopisanie) — vitest wykonuje plik sekwencyjnie.
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { generateSectionContent } from '../../reportGenerationService.js';
import { createReport, getSourceDataForReport } from '../../reportBuilderService.js';
import { ensureLegacyAssessmentTwinForSession } from '../legacyTwinService.js';

const NW_ORG = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';
const NW_OWNER = '08c54d75-5260-57b1-9db6-a30aed89a587';
/** Zamrożona sesja DRD Northwind wskazana w zleceniu (`a9c8f477…`). */
const NW_SESSION = 'a9c8f477-8d8f-4d31-804d-a39700de4b0a';
/** Druga zamrożona sesja — do dowodu, że obcy wiersz nie zostanie nadpisany. */
const NW_SESSION_2 = '63aa51e1-8270-42f0-8f57-12742a66566e';
/** Szablon, którym właściciel generował raport na stagingu (14 sekcji). */
const DRD_TEMPLATE = 'tpl-drd-full-diagnostic-v2';
const MATRIX_SECTION_KEY = 'overall_maturity';

const twinId = (sessionId: string) => `${sessionId}--assessment--drd-twin`;

function requireRealPg(): void {
  const url = process.env.DATABASE_URL || '';
  const ok =
    process.env.RUN_DB_TESTS === '1' &&
    process.env.MOCK_DB === 'false' &&
    process.env.NODE_ENV === 'test' &&
    url.startsWith('postgres');
  if (!ok) {
    throw new Error(
      'Ten plik wymaga realnej Postgres: NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 ' +
        'MOCK_DB=false DATABASE_URL=postgresql://... (bez tego getDatabase() cicho ' +
        'zamockuje bazę i testy „przejdą" nic nie sprawdzając).'
    );
  }
}

async function db(): Promise<Client> {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const c = await db();
  try {
    const r = await c.query(sql, params);
    return r.rows[0] as T;
  } finally {
    await c.end();
  }
}

/** Poziomy zamrożonego outputu — niezależne źródło prawdy dla asercji. */
async function frozenLevels(sessionId: string): Promise<{
  outputId: string;
  current: Record<string, number | null>;
  target: Record<string, number | null>;
}> {
  const row = await one<{ id: string; current_json: unknown; target_json: unknown }>(
    `SELECT o.id, o.current_json, o.target_json
       FROM method_outputs o
       WHERE o.session_id = $1
       ORDER BY o.output_version DESC
       LIMIT 1`,
    [sessionId]
  );
  if (!row) throw new Error(`Brak method_outputs dla sesji ${sessionId} — zły dump?`);
  const parse = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);
  return {
    outputId: row.id,
    current: parse(row.current_json) as Record<string, number | null>,
    target: parse(row.target_json) as Record<string, number | null>,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Średnie osi liczone w TEŚCIE (nie przez kod produkcyjny) — kontrola niezależna. */
function expectedAxes(levels: { current: Record<string, number | null>; target: Record<string, number | null> }) {
  return [1, 2, 3, 4, 5, 6, 7].map((axis) => {
    const units = Object.keys(levels.current).filter((u) => u.startsWith(String(axis)));
    const cur = units.map((u) => Number(levels.current[u] ?? 0));
    const tgt = units.map((u) => Number(levels.target[u] ?? 0));
    const sumCur = cur.reduce((a, b) => a + b, 0);
    const sumTgt = tgt.reduce((a, b) => a + b, 0);
    return {
      axisId: String(axis),
      areaCount: units.length,
      score: round1(sumCur / units.length),
      target: round1(sumTgt / units.length),
      gap: round1((sumTgt - sumCur) / units.length),
    };
  });
}

describe('RG-1 v3 / DEC-572 — snapshot bliźniaka z zamrożonej sesji (REAL Postgres)', () => {
  let levels: Awaited<ReturnType<typeof frozenLevels>>;
  let answeredUnits = 0;
  let axes: ReturnType<typeof expectedAxes> = [];
  let reportId: string | null = null;

  beforeAll(async () => {
    requireRealPg();
    const session = await one<{ state: string } | undefined>(
      `SELECT state FROM method_sessions WHERE id = $1 AND organization_id = $2`,
      [NW_SESSION, NW_ORG]
    );
    if (!session) throw new Error(`Sesja ${NW_SESSION} nie istnieje w tej bazie — zły dump?`);
    if (session.state !== 'frozen') throw new Error(`Sesja ${NW_SESSION} nie jest frozen`);

    levels = await frozenLevels(NW_SESSION);
    answeredUnits = (
      await one<{ n: number }>(
        `SELECT count(DISTINCT unit_id)::int AS n FROM method_events
          WHERE session_id = $1 AND type = 'ANSWER_CONFIRMED' AND unit_id IS NOT NULL`,
        [NW_SESSION]
      )
    ).n;
    axes = expectedAxes(levels);
    // Bramka środowiska: bez odpowiedzi w sesji test nie dowodzi niczego.
    expect(answeredUnits).toBeGreaterThan(0);
    expect(Object.keys(levels.current).length).toBe(answeredUnits);

    // Czystość przed biegiem (dump może już mieć bliźniaka z innego testu).
    const c = await db();
    try {
      await c.query(`DELETE FROM assessments WHERE id = ANY($1::text[])`, [
        [twinId(NW_SESSION), twinId(NW_SESSION_2)],
      ]);
    } finally {
      await c.end();
    }
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = await db();
    try {
      if (reportId) {
        await c.query(`DELETE FROM report_builder_activity WHERE report_id = $1`, [reportId]);
        await c.query(`DELETE FROM report_builder_sections WHERE report_id = $1`, [reportId]);
        await c.query(
          `DELETE FROM v8_output_artifacts WHERE artifact_id IN
             (SELECT artifact_id FROM v8_artifact_origin_links WHERE origin_record_id = $1)`,
          [reportId]
        );
        await c.query(`DELETE FROM v8_artifact_origin_links WHERE origin_record_id = $1`, [
          reportId,
        ]);
        await c.query(`DELETE FROM report_builder_reports WHERE id = $1`, [reportId]);
      }
      await c.query(`DELETE FROM assessments WHERE id = ANY($1::text[])`, [
        [twinId(NW_SESSION), twinId(NW_SESSION_2)],
      ]);
    } finally {
      await c.end();
    }
  });

  it('1. bliźniak niesie POZIOMY każdego odpowiedzianego obszaru sesji (nie {})', async () => {
    const result = await ensureLegacyAssessmentTwinForSession({
      organizationId: NW_ORG,
      sessionId: NW_SESSION,
      actorUserId: NW_OWNER,
    });
    expect(result.created).toBe(true);
    expect(result.assessmentId).toBe(twinId(NW_SESSION));
    // Liczba odpowiedzi w sesji == liczba obszarów w snapshocie (zlecenie (3)).
    expect(result.snapshotAreaCount).toBe(answeredUnits);

    const row = await one<{ answers_json: string; score_summary: string }>(
      `SELECT answers_json, score_summary FROM assessments WHERE id = $1`,
      [result.assessmentId]
    );
    const answers = JSON.parse(row.answers_json) as {
      drd: { areas: Record<string, { achievedLevel: number | null; targetLevel: number | null }> };
      methodCore?: { outputId?: string; mapping?: string };
    };
    const areas = answers.drd?.areas ?? {};
    expect(Object.keys(areas)).toHaveLength(answeredUnits);
    // Każdy poziom 1:1 z zamrożonego outputu — bez arytmetyki i bez domyślnych zer.
    for (const [unitId, area] of Object.entries(areas)) {
      expect(area.achievedLevel).toBe(levels.current[unitId]);
      expect(area.targetLevel).toBe(levels.target[unitId]);
    }
    expect(answers.methodCore?.outputId).toBe(levels.outputId);

    const scores = JSON.parse(row.score_summary) as {
      axes: Array<{ axisId: string; score: number; target: number; gap: number }>;
      overallScore: number;
    };
    expect(scores.axes).toHaveLength(7);
    for (const expected of axes) {
      const actual = scores.axes.find((a) => a.axisId === expected.axisId);
      expect(actual?.score).toBe(expected.score);
      expect(actual?.target).toBe(expected.target);
      expect(actual?.gap).toBe(expected.gap);
    }
    expect(scores.overallScore).toBe(
      round1(axes.reduce((s, a) => s + a.score, 0) / axes.length)
    );
  });

  it('2. raport z tego bliźniaka ma sekcję z REALNĄ liczbą sesji (nie tekst ogólny)', async () => {
    const created = await createReport({
      organizationId: NW_ORG,
      sourceType: 'ASSESSMENT',
      sourceId: twinId(NW_SESSION),
      title: 'RG-1 v3 RealPG proof',
      createdBy: NW_OWNER,
      templateId: DRD_TEMPLATE,
    });
    reportId = created.report.id;
    const matrixSection = created.sections.find((s) => s.sectionType === 'matrix');
    expect(matrixSection?.sectionKey).toBe(MATRIX_SECTION_KEY);

    const sourceData = await getSourceDataForReport(reportId, NW_ORG);
    const scoresAxes = (sourceData?.assessment?.scores as { axes?: unknown[] })?.axes ?? [];
    expect(scoresAxes).toHaveLength(7);
    expect(Object.keys(sourceData?.axesData ?? {})).toHaveLength(7);

    const generated = await generateSectionContent(
      reportId,
      MATRIX_SECTION_KEY,
      NW_ORG,
      NW_OWNER
    );
    const matrix = JSON.parse(generated.content) as {
      type: string;
      axes: Array<{ axisId: string; axisName: string; score: number; gap?: number }>;
    };
    expect(matrix.type).toBe('assessment_matrix');
    expect(matrix.axes).toHaveLength(7);
    const axis1 = matrix.axes.find((a) => a.axisId === '1');
    expect(axis1?.axisName).toBe('Digital Processes');
    expect(axis1?.score).toBe(axes[0].score);
    expect(axis1?.score).toBeGreaterThan(0);

    // Dokładnie to pole, które CTO zmierzył jako `{scores:{}, answers:{}}`.
    const persisted = await one<{ source_data_snapshot: string }>(
      `SELECT source_data_snapshot FROM report_builder_sections
        WHERE report_id = $1 AND section_key = $2`,
      [reportId, MATRIX_SECTION_KEY]
    );
    const snapshot = JSON.parse(persisted.source_data_snapshot) as {
      assessment?: { answers?: { drd?: { areas?: Record<string, unknown> } }; scores?: unknown };
      matrixData?: { axes?: unknown[] };
    };
    expect(Object.keys(snapshot.assessment?.answers?.drd?.areas ?? {})).toHaveLength(answeredUnits);
    expect(snapshot.assessment?.scores).not.toEqual({});
    expect((snapshot.matrixData?.axes ?? []).length).toBe(7);
  });

  it('3. bliźniak z v2 (pusty snapshot) zostaje DOPISANY, nie ominięty', async () => {
    // Symulacja stanu z wdrożenia 25: wiersz istnieje, treść pusta.
    const c = await db();
    try {
      await c.query(
        `UPDATE assessments SET answers_json = '{}', score_summary = '{}' WHERE id = $1`,
        [twinId(NW_SESSION)]
      );
    } finally {
      await c.end();
    }

    const result = await ensureLegacyAssessmentTwinForSession({
      organizationId: NW_ORG,
      sessionId: NW_SESSION,
      actorUserId: NW_OWNER,
    });
    expect(result.created).toBe(false);
    expect(result.snapshotBackfilled).toBe(true);
    expect(result.snapshotAreaCount).toBe(answeredUnits);

    const row = await one<{ answers_json: string }>(
      `SELECT answers_json FROM assessments WHERE id = $1`,
      [twinId(NW_SESSION)]
    );
    const areas = (JSON.parse(row.answers_json) as { drd?: { areas?: Record<string, unknown> } })
      .drd?.areas;
    expect(Object.keys(areas ?? {})).toHaveLength(answeredUnits);
  });

  it('4. NIE nadpisuje wiersza, który nie jest bliźniakiem tego serwisu', async () => {
    const foreignId = twinId(NW_SESSION_2);
    const c = await db();
    try {
      // Ten sam deterministyczny PK, ale `source_type` cudzy i treść pusta:
      // bramka backfillu (`source_type='method_core_session'`) musi go pominąć.
      await c.query(
        `INSERT INTO assessments (
           id, organization_id, project_id, assessment_type, framework, framework_type,
           name, status, completion_percent, answers_json, score_summary, context_snapshot,
           source_type, created_by, updated_by, created_at, updated_at, approved_at
         ) VALUES ($1,$2,NULL,'DRD','DRD','DRD','Foreign row','APPROVED','100','{}','{}','{}',
                   'imported',$3,$3, now(), now(), now())`,
        [foreignId, NW_ORG, NW_OWNER]
      );
    } finally {
      await c.end();
    }

    const result = await ensureLegacyAssessmentTwinForSession({
      organizationId: NW_ORG,
      sessionId: NW_SESSION_2,
      actorUserId: NW_OWNER,
    });
    expect(result.created).toBe(false);
    expect(result.snapshotBackfilled).toBe(false);

    const row = await one<{ answers_json: string; source_type: string }>(
      `SELECT answers_json, source_type FROM assessments WHERE id = $1`,
      [foreignId]
    );
    expect(row.source_type).toBe('imported');
    expect(row.answers_json).toBe('{}');
  });
});
