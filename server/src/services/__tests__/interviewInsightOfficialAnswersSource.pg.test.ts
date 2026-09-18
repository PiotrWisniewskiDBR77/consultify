/**
 * IS-3b (Wpis 95, U-08, DEC-510) — „OFFICIAL ANSWERS 0" przy 6/6 zatwierdzonych.
 * [ODMROZENIE 02_INTERVIEW DEC-607]
 *
 * Defekt: licznik „Official answers" w kafelku Insights czytał INNY rejestr niż
 * lista odpowiedzi. Stary rejestr = `interview_sessions.summary_facts` (tablica
 * JSON), która jest PUSTA, dopóki nie przejdzie `generateSummary` — więc kafel
 * pokazywał 0, choć sesja miała 10 realnie odpowiedzianych pytań
 * (`interview_questions WHERE status='answered'`).
 *
 * Naprawa = JEDNO źródło: to samo, co lista — realna liczba odpowiedziionych
 * pytań, którą serwer utrwala w
 * `interview_insights.generation_context_json.sourceMaterial.includedAnswerCount`
 * przez czystą funkcję `buildInsightSourceMaterialSummary`.
 *
 * Czego NIE da się zmierzyć bez realnej bazy: rozjazdu między rejestrami na
 * ZRÓWNANYCH zrzutem stagingu danych, gdzie `summary_facts` realnie jest puste
 * przy niezerowej liczbie odpowiedzi. Atrapa tego nie odtworzy.
 *
 * URUCHOMIENIE (bez tych zmiennych plik jest POMIJANY — `describe.skipIf` —
 * i nigdy nie daje fałszywej zieleni):
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgres://postgres:qoder@127.0.0.1:6601/consultify_is3b \
 *   npx vitest run server/src/services/__tests__/interviewInsightOfficialAnswersSource.pg.test.ts
 *
 * Baza = jednorazowa KOPIA zrzutu (kontener `qoder-a-dump-is3b`). Test tylko
 * CZYTA; zero INSERT/UPDATE/DROP/TRUNCATE.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildInsightSourceMaterialSummary } from '../InterviewInsightService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) process.env.DB_TYPE = 'postgres';

interface DivergingRow {
  insight_id: string;
  ctx_count: number | null;
  facts_total: number;
  real_answered: number;
  session_ct: number;
}

/** CTE znajduje wiersz „OFFICIAL ANSWERS 0": realnie odpowiedzi > 0, stary rejestr rozjechany. */
const DISCOVERY_SQL = `
  WITH src AS (
    SELECT i.id AS insight_id,
           (NULLIF(i.generation_context_json,'')::jsonb->'sourceMaterial'->>'includedAnswerCount')::int AS ctx_count,
           jsonb_array_elements_text(NULLIF(i.source_session_ids,'')::jsonb) AS sid
    FROM interview_insights i
    WHERE NULLIF(i.source_session_ids,'') IS NOT NULL
  ), agg AS (
    SELECT s.insight_id,
           max(s.ctx_count)::int AS ctx_count,
           count(DISTINCT s.sid)::int AS session_ct,
           (SELECT COALESCE(SUM(jsonb_array_length(NULLIF(iss.summary_facts,'')::jsonb)),0)::int
              FROM interview_sessions iss
              WHERE iss.id IN (SELECT sid FROM src WHERE insight_id = s.insight_id)) AS facts_total,
           (SELECT count(*)::int FROM interview_questions q
              WHERE q.status = 'answered'
                AND q.session_id IN (SELECT sid FROM src WHERE insight_id = s.insight_id)) AS real_answered
    FROM src s GROUP BY s.insight_id
  )
  SELECT insight_id, ctx_count, facts_total, real_answered, session_ct
  FROM agg
  WHERE real_answered > 0
    AND (ctx_count IS DISTINCT FROM real_answered OR facts_total IS DISTINCT FROM real_answered)
  ORDER BY (ctx_count IS NULL), facts_total ASC, real_answered DESC
  LIMIT 1`;

describe.skipIf(!REAL_PG)('IS-3b · OFFICIAL ANSWERS single source · RealPG (dump copy)', () => {
  let pool: any;
  let target: DivergingRow | undefined;

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const { rows } = await pool.query(DISCOVERY_SQL);
    target = rows[0] as DivergingRow | undefined;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('znajduje na zrzucie wiersz „OFFICIAL ANSWERS 0" (stary rejestr pusty, realne odpowiedzi > 0)', () => {
    expect(target, 'brak rozjechanego wiersza w kopii zrzutu — zły dump?').toBeTruthy();
    expect(target!.real_answered).toBeGreaterThan(0);
    // Stary rejestr (summary_facts) NIE równa się realnej liczbie odpowiedzi — to jest defekt.
    expect(target!.facts_total).not.toBe(target!.real_answered);
  });

  it('stary rejestr summary_facts czyta 0 mimo realnych odpowiedzi (dosłowny „OFFICIAL ANSWERS 0")', () => {
    expect(target!.facts_total).toBe(0);
    expect(target!.real_answered).toBeGreaterThan(0);
  });

  it('JEDNO źródło: buildInsightSourceMaterialSummary(realne odpowiedzi) === liczba z listy', async () => {
    // Sesje źródłowe wiersza.
    const { rows: srcRows } = await pool.query(
      `SELECT jsonb_array_elements_text(NULLIF(source_session_ids,'')::jsonb) AS sid
         FROM interview_insights WHERE id = $1`,
      [target!.insight_id]
    );
    const sessionIds: string[] = srcRows.map((r: any) => r.sid);
    expect(sessionIds.length).toBe(target!.session_ct);

    // Dokładnie ten sam rejestr, co lista: interview_questions WHERE status='answered'.
    const sessionData = await Promise.all(
      sessionIds.map(async (sid) => {
        const { rows: answers } = await pool.query(
          `SELECT id FROM interview_questions WHERE session_id = $1 AND status = 'answered'`,
          [sid]
        );
        const { rows: factsRows } = await pool.query(
          `SELECT NULLIF(summary_facts,'')::jsonb AS facts FROM interview_sessions WHERE id = $1`,
          [sid]
        );
        const facts = factsRows[0]?.facts;
        return {
          id: sid,
          answers,
          // Stary rejestr — obecny w sessionData TYLKO po to, by mutacja miała co czytać.
          summary_facts: Array.isArray(facts) ? facts : [],
        };
      })
    );

    const summary = buildInsightSourceMaterialSummary({
      requestedSessionIds: sessionIds,
      sessionData,
      analysisScope: {
        source_session_ids: sessionIds,
        source_scope_status: 'approved_only',
        respondent_filters: [],
        role_filters: [],
        department_filters: [],
        template_filters: [],
        topic_focus: [],
        analysis_mode: 'general_consulting_synthesis',
        context_mode: 'selected_interview_material_only',
      } as any,
    });

    // Naprawa: licznik = realna liczba odpowiedzi (to samo, co lista), NIE summary_facts.
    expect(summary.includedAnswerCount).toBe(target!.real_answered);
    expect(summary.includedAnswerCount).toBeGreaterThan(0);
  });

  it('utrwalone generation_context.sourceMaterial.includedAnswerCount === realna liczba odpowiedzi', () => {
    expect(target!.ctx_count).toBe(target!.real_answered);
  });
});
