/**
 * U-25 v2 / DEC-572 (RAPORT-GEN, Wpis 72) — `ensureLegacyAssessmentTwinForSession`
 * dowiedzione na REALNEJ Postgres (bez mocków bazy, bez mocków queryHelpers).
 *
 * POMIAR (kopia dumpu stagingu, 2026-09-17): 20/20 sesji DRD (w tym 2
 * zamrożone = APPROVED) NIE MA legacy bliźniaka `assessments`, a ścieżka
 * `freeze` (`method-core.routes.ts`) go nie tworzy. `reportBuilderService`
 * dla `sourceType='ASSESSMENT'` WYMAGA istniejącego wiersza `assessments` ze
 * `status='APPROVED'` — bez bliźniaka raport nie powstaje (bloker pilotażu).
 * Pisarz materializuje bliźniaka IDEMPOTENTNIE dwoma kluczami:
 *   #1 `project_id` (dokładnie ten, po którym łączy `AssessmentHub.tsx:755-775`)
 *   #2 deterministyczne PK `<sessionId>--assessment--drd-twin` + `ON CONFLICT`.
 *
 * Ten test ćwiczy PRAWDZIWĄ ścieżkę produkcyjną (eksportowaną funkcję, która
 * idzie przez `queryHelpers`/`getDatabase`), a fixture'y i asercje liczbowe
 * czyta bezpośrednio driverem `pg` (jawne `$n`, zero wątpliwości co do translacji
 * placeholderów).
 *
 * Kluczowy dowód idempotencji = test 2: dwie RÓŻNE zamrożone sesje dzielące
 * jeden `project_id` muszą zwrócić TEN SAM wiersz (1 bliźniak na projekt).
 *
 * DOWÓD MUTACYJNY: usunięcie bloku idempotencji #1 (SELECT po `project_id`)
 * → test 2 RED (sesja B tworzy WŁASNY wiersz o innym deterministycznym PK:
 * 2 wiersze na projekt, `created=true`, inne id). Testy 1/3/4 zostają zielone,
 * bo same-sesja chroni `ON CONFLICT (id)`, a 3/4 to bramki stanu/istnienia.
 *
 * RUN:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6611/consultify_dump \
 *   npx vitest run server/src/services/assessment/__tests__/legacyTwinService.realdb.test.ts \
 *     --maxWorkers=1 --no-file-parallelism --retry=0
 *
 * Każdy wiersz ma per-run token w `organization_id` i jest sprzątany w
 * `afterAll` (CLAUDE.md: „probe'y sprzątają po sobie, zero rekordów testowych").
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ensureLegacyAssessmentTwinForSession,
  LegacyTwinError,
} from '../legacyTwinService.js';

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

const P = `lts-${Date.now()}-`;
const ORG = `${P}org`;
const ACTOR = `${P}actor`;
const PROJECT_1 = `${P}proj1`;
const PROJECT_2 = `${P}proj2`;
const SESS_A = `${P}sessA`; // frozen, PROJECT_1
const SESS_C = `${P}sessC`; // frozen, PROJECT_2
const SESS_D = `${P}sessD`; // frozen, PROJECT_2 (shares project with C)
const SESS_DRAFT = `${P}draft`; // NOT frozen
const SESS_NOPROJ = `${P}sessNoProj`; // frozen, project_id absent from projects (FK-missing)
const GHOST_PROJECT = `${P}ghost-project`; // deliberately NOT seeded into projects

async function db(): Promise<Client> {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  return c;
}

async function seedSession(id: string, projectId: string | null, state: string): Promise<void> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO method_sessions
         (id, organization_id, project_id, module, method_pack_id, method_pack_version,
          mode, owner_user_id, state, created_at, updated_at)
       VALUES ($1,$2,$3,'assessment',$4,'1','guided_manual',$5,$6, now(), now())`,
      [id, ORG, projectId, `${P}pack`, ACTOR, state]
    );
  } finally {
    await c.end();
  }
}

// assessments.project_id → projects(id) FK: bliźniak potrzebuje wiersza projektu.
async function seedProject(id: string): Promise<void> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO projects (id, organization_id) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
      [id, ORG]
    );
  } finally {
    await c.end();
  }
}

async function countDrdTwins(projectId: string): Promise<number> {
  const c = await db();
  try {
    const r = await c.query(
      `SELECT count(*)::int AS n FROM assessments
        WHERE organization_id = $1 AND project_id = $2 AND upper(assessment_type) = 'DRD'`,
      [ORG, projectId]
    );
    return r.rows[0].n as number;
  } finally {
    await c.end();
  }
}

async function twinStatus(assessmentId: string): Promise<string | null> {
  const c = await db();
  try {
    const r = await c.query(`SELECT status FROM assessments WHERE id = $1`, [assessmentId]);
    return (r.rows[0]?.status as string) ?? null;
  } finally {
    await c.end();
  }
}

async function twinProjectId(assessmentId: string): Promise<string | null> {
  const c = await db();
  try {
    const r = await c.query(`SELECT project_id FROM assessments WHERE id = $1`, [assessmentId]);
    return (r.rows[0]?.project_id as string) ?? null;
  } finally {
    await c.end();
  }
}

describe('U-25 v2 / DEC-572 — ensureLegacyAssessmentTwinForSession (REAL Postgres)', () => {
  beforeAll(async () => {
    requireRealPg();
    const c = await db();
    try {
      await c.query(
        `INSERT INTO organizations (id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
        [ORG, ORG]
      );
    } finally {
      await c.end();
    }
    await seedProject(PROJECT_1);
    await seedProject(PROJECT_2);
    await seedSession(SESS_A, PROJECT_1, 'frozen');
    await seedSession(SESS_C, PROJECT_2, 'frozen');
    await seedSession(SESS_D, PROJECT_2, 'frozen');
    await seedSession(SESS_DRAFT, PROJECT_1, 'draft');
    await seedSession(SESS_NOPROJ, GHOST_PROJECT, 'frozen');
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const c = await db();
    try {
      await c.query(`DELETE FROM assessments WHERE organization_id = $1`, [ORG]);
      await c.query(`DELETE FROM method_sessions WHERE organization_id = $1`, [ORG]);
      await c.query(`DELETE FROM projects WHERE organization_id = $1`, [ORG]);
      await c.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    } finally {
      await c.end();
    }
  });

  it('creates the twin once and is idempotent for the SAME frozen session', async () => {
    const first = await ensureLegacyAssessmentTwinForSession({
      organizationId: ORG,
      sessionId: SESS_A,
      actorUserId: ACTOR,
    });
    expect(first.created).toBe(true);
    expect(first.assessmentId).toBe(`${SESS_A}--assessment--drd-twin`);
    // Bliźniak musi być APPROVED — inaczej reportBuilderService go odrzuci.
    expect(await twinStatus(first.assessmentId)).toBe('APPROVED');

    const second = await ensureLegacyAssessmentTwinForSession({
      organizationId: ORG,
      sessionId: SESS_A,
      actorUserId: ACTOR,
    });
    expect(second.created).toBe(false);
    expect(second.assessmentId).toBe(first.assessmentId);

    expect(await countDrdTwins(PROJECT_1)).toBe(1);
  });

  it('reuses ONE twin across DIFFERENT sessions sharing a project_id (AssessmentHub join key)', async () => {
    const fromC = await ensureLegacyAssessmentTwinForSession({
      organizationId: ORG,
      sessionId: SESS_C,
      actorUserId: ACTOR,
    });
    const fromD = await ensureLegacyAssessmentTwinForSession({
      organizationId: ORG,
      sessionId: SESS_D,
      actorUserId: ACTOR,
    });

    // Klucz idempotencji #1 (project_id): sesja D zastaje bliźniaka sesji C.
    expect(fromD.assessmentId).toBe(fromC.assessmentId);
    expect(fromD.created).toBe(false);
    expect(await countDrdTwins(PROJECT_2)).toBe(1);
  });

  it('stores project_id=NULL (not the FK-missing slug) and stays idempotent via PK', async () => {
    // Dokładnie przypadek produkcyjny z dumpu: zamrożona sesja Northwind DRD ma
    // `project_id` będący slugiem bez wiersza w `projects`. Zapis sluga złamałby
    // `assessments_project_id_fkey`, więc pisarz musi opuścić project_id do NULL.
    const first = await ensureLegacyAssessmentTwinForSession({
      organizationId: ORG,
      sessionId: SESS_NOPROJ,
      actorUserId: ACTOR,
    });
    expect(first.created).toBe(true);
    expect(first.assessmentId).toBe(`${SESS_NOPROJ}--assessment--drd-twin`);
    expect(await twinStatus(first.assessmentId)).toBe('APPROVED');
    // Kluczowe: project_id NULL, NIE gołęcy slug (inaczej FK by odrzucił INSERT).
    expect(await twinProjectId(first.assessmentId)).toBeNull();

    // Bez project_id idempotencja #1 nie działa — musi wystarczyć deterministyczne PK (#2).
    const second = await ensureLegacyAssessmentTwinForSession({
      organizationId: ORG,
      sessionId: SESS_NOPROJ,
      actorUserId: ACTOR,
    });
    expect(second.created).toBe(false);
    expect(second.assessmentId).toBe(first.assessmentId);
  });

  it('throws SESSION_NOT_FROZEN for a non-frozen session and writes nothing', async () => {
    await expect(
      ensureLegacyAssessmentTwinForSession({
        organizationId: ORG,
        sessionId: SESS_DRAFT,
        actorUserId: ACTOR,
      })
    ).rejects.toBeInstanceOf(LegacyTwinError);

    //PROJECT_1 nadal ma dokładnie 1 bliźniaka (z testu 1) — draft nic nie dopisał.
    expect(await countDrdTwins(PROJECT_1)).toBe(1);
  });

  it('throws SESSION_NOT_FOUND for an unknown / cross-org session', async () => {
    await expect(
      ensureLegacyAssessmentTwinForSession({
        organizationId: ORG,
        sessionId: `${P}does-not-exist`,
        actorUserId: ACTOR,
      })
    ).rejects.toBeInstanceOf(LegacyTwinError);
  });
});
