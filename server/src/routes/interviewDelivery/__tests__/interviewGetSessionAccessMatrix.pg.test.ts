/**
 * INT-BVP-001 (5) — `getSession` (`GET /interview/sessions/:id`) access matrix,
 * proved against a REAL PostgreSQL.
 *
 * BEFORE THE FIX: `getSession` called neither `canUserAccessSession` nor
 * `assertSessionAccessibleOrThrow` — only `loadInterviewSessionForOrganization`,
 * which filters by ORGANIZATION ONLY. `buildSessionResponse` returns
 * `summaryFacts/summaryGaps/summaryConstraints/summaryPainPoints` — exactly the
 * content the sibling `getSummary` endpoint gates behind both the access
 * matrix AND the D18-A anonymity wall. So any authenticated org member could
 * read another user's session summary — including anonymous-session content
 * the anonymity wall exists to hide — just by knowing the session id.
 *
 * AFTER THE FIX: `getSession` reuses the same `assertSessionAccessibleOrThrow`
 * helper the four other read endpoints already use, and applies the same
 * D18-A redaction as `getSummary` for anonymous sessions.
 *
 * BONUS FINDING (fixed in the same file, see InterviewController.ts
 * `getSummary`): `getSummary`'s own access check omitted `userRole`, so it
 * denied elevated org roles even on NON-anonymous sessions — inconsistent
 * with its four siblings. Fixed to keep the parity test below meaningful.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

vi.mock('../../../services/ai/ingestionPipeline.js', () => ({
  IngestionPipeline: class {},
  ingestInterviewTextArtifact: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../services/ai/llmService.js', () => ({ llmService: { call: vi.fn() } }));
vi.mock('../../../services/notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue('notif-mock') },
}));
vi.mock('../../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewEvidence: vi.fn(), recordInterviewAnswer: vi.fn() },
}));
vi.mock('../../../services/pdfParserService.js', () => ({ default: {} }));
vi.mock('../../../services/workflow/gatePolicy.js', () => ({ evaluateGatePolicy: vi.fn() }));

type Persona = { id: string; organizationId: string; role: string };

function makeApp(InterviewController: any): { app: Express; setUser: (p: Persona) => void } {
  let current: Persona = { id: '', organizationId: '', role: 'MEMBER' };
  const app = express();
  app.use(express.json());
  app.use((req: express.Request & { user?: unknown }, _res, next) => {
    req.user = current;
    next();
  });
  app.get('/api/interview/sessions/:id', InterviewController.getSession);
  app.get('/api/interview/sessions/:sessionId/summary', InterviewController.getSummary);
  return { app, setUser: (p: Persona) => (current = p) };
}

describe.skipIf(!REAL_DB)('getSession access matrix — real PostgreSQL', () => {
  let pool: Pool;
  let app: Express;
  let setUser: (p: Persona) => void;

  const tag = randomUUID();
  const orgA = `org-a-${tag}`;
  const orgB = `org-b-${tag}`;
  const owner = { id: `owner-${tag}`, organizationId: orgA, role: 'MEMBER' };
  const assignee = { id: `assignee-${tag}`, organizationId: orgA, role: 'MEMBER' };
  const teamMember = { id: `team-${tag}`, organizationId: orgA, role: 'MEMBER' };
  const elevatedAdmin = { id: `admin-${tag}`, organizationId: orgA, role: 'ADMIN' };
  const plainMember = { id: `plain-${tag}`, organizationId: orgA, role: 'MEMBER' };
  const crossOrgUser = { id: `cross-${tag}`, organizationId: orgB, role: 'ADMIN' };

  const sessionIdentified = `session-identified-${tag}`;
  const sessionAnonymous = `session-anonymous-${tag}`;
  const assignmentIdentified = `assignment-identified-${tag}`;
  const assignmentAnonymous = `assignment-anonymous-${tag}`;

  beforeAll(async () => {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [
      orgA,
      orgB,
    ]);
    for (const u of [owner, assignee, teamMember, elevatedAdmin, plainMember, crossOrgUser]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4)`,
        [u.id, u.organizationId, `${u.id}@example.test`, u.role]
      );
    }

    const summaryFacts = JSON.stringify(['Real fact about the respondent']);
    await pool.query(
      `INSERT INTO interview_sessions
         (id, organization_id, owner_id, status, is_anonymous, assignment_id, summary_facts)
       VALUES ($1, $2, $3, 'in_progress', false, $4, $5)`,
      [sessionIdentified, orgA, owner.id, assignmentIdentified, summaryFacts]
    );
    await pool.query(
      `INSERT INTO interview_sessions
         (id, organization_id, owner_id, status, is_anonymous, assignment_id, summary_facts)
       VALUES ($1, $2, $3, 'in_progress', true, $4, $5)`,
      [sessionAnonymous, orgA, owner.id, assignmentAnonymous, summaryFacts]
    );

    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, session_id)
       VALUES ($1, $2, $3, 'tmpl-x', $4)`,
      [assignmentIdentified, orgA, assignee.id, sessionIdentified]
    );
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, session_id)
       VALUES ($1, $2, $3, 'tmpl-x', $4)`,
      [assignmentAnonymous, orgA, assignee.id, sessionAnonymous]
    );
    await pool.query(
      `INSERT INTO interview_assignment_members (id, assignment_id, user_id)
       VALUES ($1, $2, $3), ($4, $5, $6)`,
      [
        `member-id-${tag}`,
        assignmentIdentified,
        teamMember.id,
        `member-an-${tag}`,
        assignmentAnonymous,
        teamMember.id,
      ]
    );

    const { InterviewController } = await import('../../../controllers/InterviewController.js');
    const built = makeApp(InterviewController as any);
    app = built.app;
    setUser = built.setUser;
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM interview_assignment_members WHERE assignment_id = ANY($1)`, [
      [assignmentIdentified, assignmentAnonymous],
    ]);
    await pool.query(`DELETE FROM interview_assignments WHERE id = ANY($1)`, [
      [assignmentIdentified, assignmentAnonymous],
    ]);
    await pool.query(`DELETE FROM interview_sessions WHERE id = ANY($1)`, [
      [sessionIdentified, sessionAnonymous],
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('session owner is ALLOWED and sees real summary content', async () => {
    setUser(owner);
    const res = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
    expect(res.status).toBe(200);
    expect(res.body.summaryFacts).toEqual(['Real fact about the respondent']);
    expect(res.body.anonymized).toBeUndefined();
  });

  it('direct assignee is ALLOWED', async () => {
    setUser(assignee);
    const res = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sessionIdentified);
  });

  it('team-member assignee is ALLOWED on an identified session', async () => {
    setUser(teamMember);
    const res = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
    expect(res.status).toBe(200);
    expect(res.body.summaryFacts).toEqual(['Real fact about the respondent']);
  });

  it('elevated org role is ALLOWED for a non-anonymous session', async () => {
    setUser(elevatedAdmin);
    const res = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
    expect(res.status).toBe(200);
    expect(res.body.summaryFacts).toEqual(['Real fact about the respondent']);
  });

  it('HEADLINE: elevated org role with no other relation is DENIED on an anonymous session', async () => {
    setUser(elevatedAdmin);
    const res = await request(app).get(`/api/interview/sessions/${sessionAnonymous}`);
    expect(res.status).toBe(403);
  });

  it('HEADLINE: a legitimate participant (team member) on an anonymous session is ALLOWED but REDACTED', async () => {
    setUser(teamMember);
    const res = await request(app).get(`/api/interview/sessions/${sessionAnonymous}`);
    expect(res.status).toBe(200);
    expect(res.body.anonymized).toBe(true);
    expect(res.body.summaryFacts).toEqual([]);
    expect(res.body.summaryGaps).toEqual([]);
    expect(res.body.summaryConstraints).toEqual([]);
    expect(res.body.summaryPainPoints).toEqual([]);
  });

  it('the respondent themself still sees full content on their own anonymous session', async () => {
    setUser(owner);
    const res = await request(app).get(`/api/interview/sessions/${sessionAnonymous}`);
    expect(res.status).toBe(200);
    expect(res.body.anonymized).toBeUndefined();
    expect(res.body.summaryFacts).toEqual(['Real fact about the respondent']);
  });

  it('plain org member with no relation to the session is DENIED', async () => {
    setUser(plainMember);
    const res = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
    expect(res.status).toBe(403);
  });

  it('tenant negative: cross-org access is refused as not-found (IDOR-safe)', async () => {
    setUser(crossOrgUser);
    const res = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
    expect(res.status).toBe(404);
  });

  describe('getSession vs getSummary parity (the asymmetry that was the actual bug)', () => {
    it('the same unauthorised (plain member) user is denied by BOTH endpoints', async () => {
      setUser(plainMember);
      const sessionRes = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
      const summaryRes = await request(app).get(
        `/api/interview/sessions/${sessionIdentified}/summary`
      );
      expect(sessionRes.status).toBe(403);
      expect(summaryRes.status).toBe(403);
    });

    it('the same legitimate-but-non-respondent (team member) user gets an identically REDACTED outcome from BOTH endpoints on an anonymous session', async () => {
      setUser(teamMember);
      const sessionRes = await request(app).get(`/api/interview/sessions/${sessionAnonymous}`);
      const summaryRes = await request(app).get(
        `/api/interview/sessions/${sessionAnonymous}/summary`
      );
      expect(sessionRes.status).toBe(200);
      expect(summaryRes.status).toBe(200);
      expect(sessionRes.body.summaryFacts).toEqual([]);
      expect(summaryRes.body.facts).toEqual([]);
      expect(sessionRes.body.anonymized).toBe(true);
      expect(summaryRes.body.anonymized).toBe(true);
    });

    it('elevated org role gets the SAME allow outcome from both endpoints on a non-anonymous session (parity fix)', async () => {
      setUser(elevatedAdmin);
      const sessionRes = await request(app).get(`/api/interview/sessions/${sessionIdentified}`);
      const summaryRes = await request(app).get(
        `/api/interview/sessions/${sessionIdentified}/summary`
      );
      expect(sessionRes.status).toBe(200);
      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.facts).toEqual(['Real fact about the respondent']);
    });
  });
});
