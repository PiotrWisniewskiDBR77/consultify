/**
 * Acceptance E2E — HP-8 artifact approval status bar, 3 NEW artifact types.
 *
 * HP-8 dziś obsługuje 2 typy artefaktów w pasku stanu draft→review→approved:
 * Decision + Insight. Ta praca dokłada 3 kolejne — Initiative, Report, Deck —
 * po stronie FE (pasek `ArtifactApprovalStatusBar` wpięty w widok szczegółu /
 * header, za flagą `ff_artifactApprovalUi`, już domyślnie ON).
 *
 * Backend jest z założenia TYPE-AGNOSTYCZNY: `artifact_type` to wolne pole
 * TEXT bez CHECK constraint (migracja 20260714_workflow_artifact_approvals.sql
 * — świadomie „katalog artifact_type otwarty… bez CHECK constraint, żeby nowy
 * archetyp SPEC-A nie wymagał migracji schematu"). Ten test DOWODZI tego na
 * REALNYM routerze + REALNYM auth (verifyToken) + REALNEJ bazie Postgres:
 * pełny cykl create→submit→approve dla `initiative` (typ wymagany), plus
 * reject→resubmit dla `report` i approve dla `deck` — wszystkie 3 nowe typy
 * przechodzą tą samą maszyną stanów co Decision/Insight, bez zmiany schematu.
 *
 * ZERO mocków logiki biznesowej. Prefiks izolacji: `odbior--hp8--`.
 * Reużywa harness.ts (mintToken/pgClient) + seed.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// App: REAL artifact-approvals router behind its OWN verifyToken (the router
// self-mounts `router.use(verifyToken)`). Nie bootujemy całego serwera
// (46 self-rezolwujących wrapperów w services/ai/* potrafi zawiesić import —
// MEMORY lazyloader_46_self_resolving_hang). Montujemy WĄSKI router.
// ---------------------------------------------------------------------------
async function buildApp(): Promise<Express> {
  const artifactApprovalsRouter = (
    await import('../../server/src/routes/artifactApprovals.routes.js')
  ).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/artifact-approvals', artifactApprovalsRouter);
  return app;
}

/**
 * Zapewnij kolumny workflow (assignment_kind/artifact_type/artifact_id) na
 * tabeli approval_assignments — migracja 20260714, idempotentna
 * (ADD COLUMN IF NOT EXISTS). No-op tam gdzie już zastosowana (parity ma pełny
 * schemat z schema.mjs). Wzór: harvey.e2e.test.ts ensureEvidenceTable.
 */
async function ensureWorkflowColumns(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const sqlPath = path.resolve(
      __dirname,
      '../../server/migrations/20260714_workflow_artifact_approvals.sql'
    );
    const ddl = fs.readFileSync(sqlPath, 'utf8');
    await client.query(ddl);
  } finally {
    await client.end();
  }
}

let app: Express;
let token: string;
const createdArtifactIds: string[] = [];

beforeAll(async () => {
  await seed(); // idempotent
  await ensureWorkflowColumns();
  app = await buildApp();
  token = mintToken();
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdArtifactIds.length) {
      // Sprzątamy WYŁĄCZNIE wiersze workflow-artefaktów tego testu.
      await client.query(
        `DELETE FROM approval_assignments
          WHERE assignment_kind = 'artifact' AND artifact_id = ANY($1)`,
        [createdArtifactIds]
      );
    }
  } finally {
    await client.end();
  }
}, 30_000);

/** DB proof helper: latest artifact row for (type,id). */
async function readLatestRow(artifactType: string, artifactId: string) {
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, org_id, assignment_kind, artifact_type, artifact_id, status
         FROM approval_assignments
        WHERE assignment_kind = 'artifact' AND artifact_type = $1 AND artifact_id = $2
        ORDER BY created_at DESC LIMIT 1`,
      [artifactType, artifactId]
    );
    return rows[0] ?? null;
  } finally {
    await client.end();
  }
}

// ===========================================================================
// INITIATIVE — typ wymagany: create(draft) → submit → approve, GET widzi stan
// ===========================================================================
describe('Acceptance HP-8 · Initiative approval (real router + auth + DB)', () => {
  const artifactType = 'initiative';
  const artifactId = `odbior--hp8--initiative-${Date.now()}`;

  it('unauthenticated read is rejected (real auth enforced by the router)', async () => {
    const res = await request(app).get(
      `/api/artifact-approvals/${artifactType}/${artifactId}/approval-state`
    );
    expect(res.status).toBe(401);
  });

  it('drives create(draft) → submit(review) → approve(approved); GET reflects each state', async () => {
    createdArtifactIds.push(artifactId);

    // 1) DRAFT — brak wiersza => stan draft.
    const draftRes = await request(app)
      .get(`/api/artifact-approvals/${artifactType}/${artifactId}/approval-state`)
      .set('Authorization', `Bearer ${token}`);
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.state).toBe('draft');
    expect(draftRes.body.assignment).toBeNull();

    // 2) SUBMIT draft -> review (assignedTo = self; brak reviewer-pickera w MVP).
    const submitRes = await request(app)
      .post(`/api/artifact-approvals/${artifactType}/${artifactId}/approval/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignedToUserId: SEED.USER_ID });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.state).toBe('review');
    expect(submitRes.body.assignment.artifact_type).toBe('initiative');

    // GET widzi review.
    const reviewRes = await request(app)
      .get(`/api/artifact-approvals/${artifactType}/${artifactId}/approval-state`)
      .set('Authorization', `Bearer ${token}`);
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.state).toBe('review');

    // 3) APPROVE review -> approved.
    const approveRes = await request(app)
      .post(`/api/artifact-approvals/${artifactType}/${artifactId}/approval/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.state).toBe('approved');

    // GET widzi approved.
    const approvedRes = await request(app)
      .get(`/api/artifact-approvals/${artifactType}/${artifactId}/approval-state`)
      .set('Authorization', `Bearer ${token}`);
    expect(approvedRes.status).toBe(200);
    expect(approvedRes.body.state).toBe('approved');

    // HARD PROOF: realny wiersz w bazie, org-scoped, status DONE.
    const row = await readLatestRow(artifactType, artifactId);
    expect(row).toBeTruthy();
    expect(row.org_id).toBe(SEED.ORG_ID);
    expect(row.assignment_kind).toBe('artifact');
    expect(row.status).toBe('DONE');
  }, 30_000);
});

// ===========================================================================
// REPORT — reject -> resubmit (reject nie blokuje artefaktu na stałe)
// ===========================================================================
describe('Acceptance HP-8 · Report approval (real router + auth + DB)', () => {
  const artifactType = 'report';
  const artifactId = `odbior--hp8--report-${Date.now()}`;

  it('submit -> reject(rejected) -> resubmit(review): the 3rd type flows through the same state machine', async () => {
    createdArtifactIds.push(artifactId);

    const submitRes = await request(app)
      .post(`/api/artifact-approvals/${artifactType}/${artifactId}/approval/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignedToUserId: SEED.USER_ID });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.state).toBe('review');

    const rejectRes = await request(app)
      .post(`/api/artifact-approvals/${artifactType}/${artifactId}/approval/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'odbior--hp8-- brak dowodów' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.state).toBe('rejected');

    // GET widzi rejected.
    const rejectedRes = await request(app)
      .get(`/api/artifact-approvals/${artifactType}/${artifactId}/approval-state`)
      .set('Authorization', `Bearer ${token}`);
    expect(rejectedRes.body.state).toBe('rejected');

    // Resubmit — rejected NIE jest statusem aktywnym, więc nowy cykl startuje.
    const resubmitRes = await request(app)
      .post(`/api/artifact-approvals/${artifactType}/${artifactId}/approval/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignedToUserId: SEED.USER_ID });
    expect(resubmitRes.status).toBe(201);
    expect(resubmitRes.body.state).toBe('review');
  }, 30_000);
});

// ===========================================================================
// DECK — submit -> approve (3. z nowych typów, ta sama maszyna stanów)
// ===========================================================================
describe('Acceptance HP-8 · Deck approval (real router + auth + DB)', () => {
  const artifactType = 'deck';
  const artifactId = `odbior--hp8--deck-${Date.now()}`;

  it('submit(review) -> approve(approved); DB row carries artifact_type=deck', async () => {
    createdArtifactIds.push(artifactId);

    const submitRes = await request(app)
      .post(`/api/artifact-approvals/${artifactType}/${artifactId}/approval/submit`)
      .set('Authorization', `Bearer ${token}`)
      .send({ assignedToUserId: SEED.USER_ID });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.state).toBe('review');

    const approveRes = await request(app)
      .post(`/api/artifact-approvals/${artifactType}/${artifactId}/approval/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.state).toBe('approved');

    const row = await readLatestRow(artifactType, artifactId);
    expect(row).toBeTruthy();
    expect(row.artifact_type).toBe('deck');
    expect(row.status).toBe('DONE');
  }, 30_000);
});
