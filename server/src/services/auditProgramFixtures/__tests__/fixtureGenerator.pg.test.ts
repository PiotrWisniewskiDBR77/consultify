/**
 * fixtureGenerator — testy przeciw REALNEJ Postgres (AUD-MVP-DATA-001, DoD).
 *
 * URUCHOMIENIE (z korzenia worktree):
 *   NODE_ENV=test DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:34911/consultinity" \
 *   npx vitest run server/src/services/auditProgramFixtures/__tests__/fixtureGenerator.pg.test.ts --retry=0
 *
 * Pokrywa DoD zadania: SCALE, GRAPH INTEGRITY, TENANT NEGATIVE, ROLE NEGATIVE,
 * PERFORMANCE, COLD REOPEN, IDEMPOTENCY, CLEANUP.
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditAll, auditGet, AuditPermissionError } from '../../audits/auditsDb.js';
import {
  EXPECTED_LEAF_CRITERIA,
  FIXTURE_ACTOR_OUTSIDER_ID,
  FIXTURE_ACTOR_VIEWER_ID,
  FIXTURE_ID_PREFIX,
  FIXTURE_ORG_B_ID,
  FIXTURE_ORG_ID,
  FIXTURE_PACK_KEY,
  FIXTURE_SOURCE_KEY,
  FORBIDDEN_STANDARD_PATTERNS,
  cleanupFixture,
  fixtureActorFor,
  generateFixture,
  measureCounts,
  requireCapability,
  resolveProgramAccess,
  type GenerateFixtureResult,
} from '../fixtureGenerator.js';
import { submitEvidence } from '../../audits/evidenceService.js';
import { listCriteria } from '../../audits/criterionService.js';
import { getProgram } from '../../audits/programService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) {
  process.env.DB_TYPE = 'postgres';
}

const suite = REAL_PG ? describe : describe.skip;

if (!REAL_PG) {
  // eslint-disable-next-line no-console
  console.warn(
    '[fixtureGenerator.pg.test.ts SKIPPED — clean skip, not a failure] wymaga NODE_ENV=test DB_TYPE=postgres ' +
      'CI=true RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... (patrz komentarz na górze pliku)',
  );
}

const MIN = {
  criteria: 150,
  evidence: 400,
  findings: 60,
  correctiveActions: 40,
  initiativeProposals: 12,
};

suite('auditProgramFixtures — fixture skali Audits (Postgres realny — AUD-MVP-DATA-001)', () => {
  let result: GenerateFixtureResult;

  beforeAll(async () => {
    // Czyste otoczenie: gdyby poprzedni przebieg zostawił rezydua (przerwany test),
    // usuń je zanim zmierzymy cokolwiek — inaczej test SCALE mierzyłby cudzy stan.
    await cleanupFixture();
    result = await generateFixture();
    // eslint-disable-next-line no-console
    console.log('[AUD-MVP-DATA-001] Generation wall-clock ms:', result.wallClockMs, 'reused:', result.reused);
  }, 180_000);

  afterAll(async () => {
    await cleanupFixture();
  }, 60_000);

  it('SCALE: generacja produkuje realne wolumeny (mierzone SELECT count(*), nie księgowaniem generatora)', async () => {
    const counts = await measureCounts(FIXTURE_ORG_ID);

    // eslint-disable-next-line no-console
    console.log('[AUD-MVP-DATA-001] LITERALNE liczniki po generacji:', JSON.stringify(counts));

    expect(counts.criteria).toBeGreaterThanOrEqual(MIN.criteria);
    expect(counts.criteria).toBe(EXPECTED_LEAF_CRITERIA);
    expect(counts.evidence).toBeGreaterThanOrEqual(MIN.evidence);
    expect(counts.findings).toBeGreaterThanOrEqual(MIN.findings);
    expect(counts.correctiveActions).toBeGreaterThanOrEqual(MIN.correctiveActions);
    expect(counts.initiativeProposals).toBeGreaterThanOrEqual(MIN.initiativeProposals);

    // Liczniki zwrócone przez generateFixture() muszą zgadzać się z pomiarem SELECT.
    expect(result.counts).toEqual(counts);
  });

  it('SCALE: wszystkie id pięciu mierzonych encji + programu + członków niosą prefiks claude_a_', async () => {
    const tables: Array<[string, string]> = [
      ['audit_programs', 'id'],
      ['audit_program_members', 'id'],
      ['audit_program_criteria', 'id'],
      ['audit_evidence', 'id'],
      ['audit_program_findings', 'id'],
      ['audit_corrective_actions', 'id'],
      ['audit_initiative_proposals', 'id'],
    ];
    for (const [table, col] of tables) {
      const row = await auditGet<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM ${table} WHERE organization_id = $1 AND ${col} NOT LIKE $2`,
        [FIXTURE_ORG_ID, `${FIXTURE_ID_PREFIX}%`],
      );
      expect(Number(row?.c ?? -1)).toBe(0);
    }
  });

  it('GRAPH INTEGRITY: zero sierot — dowód/ustalenie -> kryterium, działanie -> ustalenie, kandydat -> propozycja', async () => {
    const orphanEvidence = await auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_evidence e
        LEFT JOIN audit_program_criteria c ON c.id = e.criterion_id AND c.organization_id = e.organization_id
       WHERE e.organization_id = $1 AND (e.criterion_id IS NULL OR c.id IS NULL)`,
      [FIXTURE_ORG_ID],
    );
    expect(Number(orphanEvidence?.c ?? -1)).toBe(0);

    const orphanFindings = await auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_program_findings f
        LEFT JOIN audit_program_criteria c ON c.id = f.criterion_id AND c.organization_id = f.organization_id
       WHERE f.organization_id = $1 AND (f.criterion_id IS NULL OR c.id IS NULL)`,
      [FIXTURE_ORG_ID],
    );
    expect(Number(orphanFindings?.c ?? -1)).toBe(0);

    const orphanActions = await auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_corrective_actions a
        LEFT JOIN audit_program_findings f ON f.id = a.finding_id AND f.organization_id = a.organization_id
       WHERE a.organization_id = $1 AND (a.finding_id IS NULL OR f.id IS NULL)`,
      [FIXTURE_ORG_ID],
    );
    expect(Number(orphanActions?.c ?? -1)).toBe(0);

    // Kandydat = wiersz audit_initiative_proposals; jego "graf" to sourceFindingIds —
    // KAŻDY element tablicy musi wskazywać na realny wiersz audit_program_findings.
    const orphanCandidateRefs = await auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c
         FROM audit_initiative_proposals p
         CROSS JOIN LATERAL jsonb_array_elements_text(p.source_finding_ids::jsonb) AS ref(finding_id)
         LEFT JOIN audit_program_findings f
               ON f.id = ref.finding_id AND f.organization_id = p.organization_id
        WHERE p.organization_id = $1 AND f.id IS NULL`,
      [FIXTURE_ORG_ID],
    );
    expect(Number(orphanCandidateRefs?.c ?? -1)).toBe(0);

    // I odwrotnie: żadna propozycja nie ma pustej listy źródłowych ustaleń.
    const emptySource = await auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_initiative_proposals
        WHERE organization_id = $1 AND jsonb_array_length(source_finding_ids::jsonb) = 0`,
      [FIXTURE_ORG_ID],
    );
    expect(Number(emptySource?.c ?? -1)).toBe(0);
  });

  it('CONTENT: żadna wygenerowana treść nie nazywa/parafrazuje zewnętrznej normy', async () => {
    const rows = await auditAll<{ title: string | null; requirement_text: string | null; audit_question: string | null; audit_procedure: string | null; source_reference: string | null }>(
      `SELECT title, requirement_text, audit_question, audit_procedure, source_reference
         FROM audit_program_criteria WHERE organization_id = $1`,
      [FIXTURE_ORG_ID],
    );
    const findingRows = await auditAll<{ statement: string | null; requirement_text: string | null; gap_text: string | null; recommendation: string | null }>(
      `SELECT statement, requirement_text, gap_text, recommendation FROM audit_program_findings WHERE organization_id = $1`,
      [FIXTURE_ORG_ID],
    );
    const evidenceRows = await auditAll<{ title: string | null; description: string | null; content_snapshot: string | null }>(
      `SELECT title, description, content_snapshot FROM audit_evidence WHERE organization_id = $1`,
      [FIXTURE_ORG_ID],
    );
    const packRow = await auditGet<{ title: string; summary: string | null; purpose: string | null }>(
      `SELECT title, summary, purpose FROM audit_packs WHERE pack_key = $1`,
      [FIXTURE_PACK_KEY],
    );

    const allText = [
      ...rows.flatMap((r) => [r.title, r.requirement_text, r.audit_question, r.audit_procedure, r.source_reference]),
      ...findingRows.flatMap((r) => [r.statement, r.requirement_text, r.gap_text, r.recommendation]),
      ...evidenceRows.flatMap((r) => [r.title, r.description, r.content_snapshot]),
      packRow?.title,
      packRow?.summary,
      packRow?.purpose,
    ].filter((v): v is string => typeof v === 'string' && v.length > 0);

    expect(allText.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const text of allText) {
      for (const pattern of FORBIDDEN_STANDARD_PATTERNS) {
        if (pattern.test(text)) violations.push(`${pattern} matched: "${text}"`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('TENANT NEGATIVE: druga organizacja widzi zero wierszy fixture we wszystkich pięciu tabelach', async () => {
    const counts = await measureCounts(FIXTURE_ORG_B_ID);
    expect(counts).toEqual({
      criteria: 0,
      criteriaAllNodes: 0,
      evidence: 0,
      findings: 0,
      correctiveActions: 0,
      initiativeProposals: 0,
    });
  });

  it('ROLE NEGATIVE (odczyt): aktor bez ŻADNEJ roli w programie nie ma capability program.read', async () => {
    const outsider = fixtureActorFor(FIXTURE_ACTOR_OUTSIDER_ID);
    const access = await resolveProgramAccess(outsider, result.identity.programId);
    expect(access.capabilities.has('program.read')).toBe(false);
    await expect(requireCapability(outsider, result.identity.programId, 'program.read')).rejects.toBeInstanceOf(
      AuditPermissionError,
    );
  });

  it('ROLE NEGATIVE (zapis): rola viewer nie może złożyć dowodu (evidence.submit)', async () => {
    const viewer = fixtureActorFor(FIXTURE_ACTOR_VIEWER_ID);
    const access = await resolveProgramAccess(viewer, result.identity.programId);
    expect(access.roles).toContain('viewer');
    expect(access.capabilities.has('evidence.submit')).toBe(false);

    const anyCriterion = await auditGet<{ id: string }>(
      `SELECT id FROM audit_program_criteria WHERE organization_id = $1 AND node_kind = 'criterion' LIMIT 1`,
      [FIXTURE_ORG_ID],
    );
    expect(anyCriterion).not.toBeNull();

    await expect(
      submitEvidence(FIXTURE_ORG_ID, viewer, {
        programId: result.identity.programId,
        criterionId: anyCriterion!.id,
        kind: 'document',
        title: 'Próba zapisu przez rolę viewer — MUSI zostać odrzucona',
      }),
    ).rejects.toBeInstanceOf(AuditPermissionError);

    // Kontrola negatywna nie zostawia śladu: liczba dowodów się nie zmienia.
    const after = await measureCounts(FIXTURE_ORG_ID);
    expect(after.evidence).toBe(result.counts.evidence);
  });

  it('PERFORMANCE: mierzy i raportuje czas listy kryteriów programu + rollup ustaleń (bez wymyślonego progu)', async () => {
    const criteriaTimings: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const t0 = performance.now();
      const tree = await listCriteria(FIXTURE_ORG_ID, result.identity.programId);
      const t1 = performance.now();
      criteriaTimings.push(t1 - t0);
      if (i === 0) {
        const leafCount = tree.reduce(function countLeaves(sum: number, node): number {
          return sum + (node.children.length ? node.children.reduce(countLeaves, 0) : 1);
        }, 0);
        expect(leafCount).toBeGreaterThanOrEqual(MIN.criteria);
      }
    }

    const programTimings: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const t0 = performance.now();
      const detail = await getProgram(FIXTURE_ORG_ID, result.identity.programId);
      const t1 = performance.now();
      programTimings.push(t1 - t0);
      expect(detail?.stats.evidenceTotal).toBeGreaterThanOrEqual(MIN.evidence);
      expect(detail?.stats.findingsOpen).toBeGreaterThan(0);
    }

    // eslint-disable-next-line no-console
    console.log(
      '[AUD-MVP-DATA-001] PERFORMANCE listCriteria ms:',
      JSON.stringify(criteriaTimings),
      'getProgram ms:',
      JSON.stringify(programTimings),
    );

    // Nie zgadujemy progu (właścicielskie progi to propozycje, nie bramki) —
    // zapisujemy w evidence dosłowne wartości. Jedyna asercja strukturalna: te
    // zapytania faktycznie wróciły (nie zawisły) w rozsądnym oknie testu.
    expect(Math.max(...criteriaTimings)).toBeLessThan(60_000);
    expect(Math.max(...programTimings)).toBeLessThan(60_000);
  }, 90_000);

  it('COLD REOPEN: świeży, niezależny Pool widzi te same liczniki i te same id', async () => {
    const freshPool = new Pool({ connectionString: CONNECTION_STRING });
    try {
      const r = await freshPool.query(
        `SELECT
           (SELECT COUNT(*) FROM audit_program_criteria WHERE organization_id = $1 AND node_kind = 'criterion') AS criteria,
           (SELECT COUNT(*) FROM audit_evidence WHERE organization_id = $1) AS evidence,
           (SELECT COUNT(*) FROM audit_program_findings WHERE organization_id = $1) AS findings,
           (SELECT COUNT(*) FROM audit_corrective_actions WHERE organization_id = $1) AS actions,
           (SELECT COUNT(*) FROM audit_initiative_proposals WHERE organization_id = $1) AS proposals,
           (SELECT id FROM audit_programs WHERE organization_id = $1 LIMIT 1) AS program_id`,
        [FIXTURE_ORG_ID],
      );
      const row = r.rows[0];
      expect(Number(row.criteria)).toBe(result.counts.criteria);
      expect(Number(row.evidence)).toBe(result.counts.evidence);
      expect(Number(row.findings)).toBe(result.counts.findings);
      expect(Number(row.actions)).toBe(result.counts.correctiveActions);
      expect(Number(row.proposals)).toBe(result.counts.initiativeProposals);
      expect(row.program_id).toBe(result.identity.programId);
    } finally {
      await freshPool.end();
    }
  });

  it('IDEMPOTENCY: druga generacja nie podwaja żadnego licznika', async () => {
    const before = await measureCounts(FIXTURE_ORG_ID);
    const second = await generateFixture();
    const after = await measureCounts(FIXTURE_ORG_ID);

    expect(second.reused).toBe(true);
    expect(second.identity.programId).toBe(result.identity.programId);
    expect(after).toEqual(before);
  }, 60_000);

  it('CLEANUP: po sprzątaniu wszystkie pięć liczników wraca do zera, zero wierszy claude_a_ pozostaje', async () => {
    await cleanupFixture();
    const after = await measureCounts(FIXTURE_ORG_ID);
    expect(after).toEqual({
      criteria: 0,
      criteriaAllNodes: 0,
      evidence: 0,
      findings: 0,
      correctiveActions: 0,
      initiativeProposals: 0,
    });

    const packRow = await auditGet<{ id: string }>(`SELECT id FROM audit_packs WHERE pack_key = $1`, [
      FIXTURE_PACK_KEY,
    ]);
    expect(packRow).toBeNull();
    const sourceRow = await auditGet<{ id: string }>(`SELECT id FROM audit_norm_sources WHERE source_key = $1`, [
      FIXTURE_SOURCE_KEY,
    ]);
    expect(sourceRow).toBeNull();

    const membersRow = await auditGet<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM audit_program_members WHERE organization_id = $1`,
      [FIXTURE_ORG_ID],
    );
    expect(Number(membersRow?.c ?? -1)).toBe(0);

    // Regeneruj, żeby afterAll (który sprząta ponownie) i kolejne testy pliku
    // nie zależały od tego, że ten test biegnie jako ostatni w danej kolejności.
    result = await generateFixture();
  }, 60_000);
});
