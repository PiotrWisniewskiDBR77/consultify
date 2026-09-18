/** @vitest-environment node */

/**
 * MTG-2c (PLAN.md:272 „protokół z eksportem", DEC-607) — RealPG dowód trasy
 * `GET /api/meeting/:id/protocol/export.docx`.
 *
 * Warstwa HTTP (realny router + realny Postgres, harness 1:1 z
 * `meeting.mutations-authz.postgres.integration.test.ts`):
 *   - 200 ORGANIZATOR: bajty magiczne ZIP (`PK`), wpis `word/document.xml`,
 *     Content-Type DOCX, Content-Disposition `Meeting_protocol_<tytuł>_v1.0.docx`;
 *   - 200 PARTICIPANT: eksport jest CZYTANIEM (ten sam poziom dostępu co
 *     GET /:id/protocol) — uczestnik nie dostaje 403;
 *   - 404 FOREIGN TENANT: obca org nie widzi spotkania.
 * Warstwa SERWISU (na żywych danych z tej samej bazy):
 *   - `buildMeetingProtocolDocumentSchema` niesie etykiety źródła per blok
 *     („Source: decisions register" / „Source: follow-ups register") oraz
 *     wiersze rejestru (statement/owner z DANYCH, nie AI).
 *
 * MUTACJE, które muszą czerwienić (dowód w meldunku):
 *   - usunięcie trasy `/:id/protocol/export.docx` z meeting.routes.ts → 404 → RED (1-3);
 *   - podmiana `previewProtocol` na pusty content w trasie → brak sekcji Decisions → RED (4);
 *   - zamiana SOURCE_LABEL register↔approved_note w schemie → RED (4).
 *
 * Run (pula D, kontener qoder-d-pg-3, baza ze WSZYSTKIMI migracjami):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6632/consultify_mtg2_fresh \
 *     npx vitest run server/src/routes/__tests__/meeting.protocolExport.pg.test.ts
 */

import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Role-aware auth mock — identyczny jak w macierzy authz MTG-2b.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    const role = String(req.headers['x-test-role'] || 'member');
    req.user = { id, organizationId, role, email: `${id}@example.invalid` };
    req.userRole = role;
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

function localDatabaseUrl(): string {
  const value = process.env.DATABASE_URL || '';
  if (!/localhost|127\.0\.0\.1/.test(value)) {
    throw new Error('Local DATABASE_URL is required for the MTG-2c export proof');
  }
  return value;
}

const prefix = `mtg2c-${Date.now()}-${randomUUID().slice(0, 8)}`;
const ORG_A = `${prefix}-org-a`;
const ORG_B = `${prefix}-org-b`;
const ORGANIZER = `${prefix}-organizer`;
const PARTICIPANT = `${prefix}-participant`;
const FOREIGN = `${prefix}-foreign`;
const MEETING_A = `${prefix}-meeting-a`;
const DECISION_A = `${prefix}-decision-a`;
const FOLLOWUP_A = `${prefix}-followup-a`;

const asOrganizer = {
  'x-test-org-id': ORG_A,
  'x-test-user-id': ORGANIZER,
  'x-test-role': 'member',
};
const asParticipant = {
  'x-test-org-id': ORG_A,
  'x-test-user-id': PARTICIPANT,
  'x-test-role': 'member',
};
const asForeign = {
  'x-test-org-id': ORG_B,
  'x-test-user-id': FOREIGN,
  'x-test-role': 'member',
};

describe('MTG-2c protocol DOCX export (real router + real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: localDatabaseUrl() });

    await pool.query(
      `INSERT INTO organizations (id, name, created_at) VALUES ($1,'MTG2C A',now()),($2,'MTG2C B',now())
       ON CONFLICT (id) DO NOTHING`,
      [ORG_A, ORG_B]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status)
       VALUES ($1,$2,$3,'Org','Anizer','member','active'),
              ($4,$2,$5,'Part','Icipant','member','active'),
              ($6,$7,$8,'For','Eign','member','active')
       ON CONFLICT (id) DO NOTHING`,
      [
        ORGANIZER,
        ORG_A,
        `${ORGANIZER}@example.invalid`,
        PARTICIPANT,
        `${PARTICIPANT}@example.invalid`,
        FOREIGN,
        ORG_B,
        `${FOREIGN}@example.invalid`,
      ]
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1,$2,$3,'MEMBER','ACTIVE',now()),
              ($4,$2,$5,'MEMBER','ACTIVE',now()),
              ($6,$7,$8,'MEMBER','ACTIVE',now())
       ON CONFLICT (id) DO NOTHING`,
      [
        `${prefix}-om-org`,
        ORG_A,
        ORGANIZER,
        `${prefix}-om-part`,
        PARTICIPANT,
        `${prefix}-om-for`,
        ORG_B,
        FOREIGN,
      ]
    );
    await pool.query(
      `INSERT INTO meetings (id, organization_id, title, start_at, end_at, attendees_json, created_by, status, lifecycle_state)
       VALUES ($1,$2,'MTG2C export meeting','2026-09-22T09:00:00Z','2026-09-22T10:00:00Z',$3,$4,'scheduled','scheduled')`,
      [MEETING_A, ORG_A, JSON.stringify([PARTICIPANT, ORGANIZER]), ORGANIZER]
    );
    // Rejestrowe źródła bloków decisions/actions (etykieta „register").
    await pool.query(
      `INSERT INTO meeting_decisions
         (id, organization_id, meeting_id, statement, rationale, decided_by, decided_at, status,
          owner_user_id, decision_type, impact_text, rejected_alternative, created_by)
       VALUES ($1,$2,$3,'Adopt option B for the export pilot','Cheaper','Constance Chair',
          '2026-09-22T09:40:00Z','recorded',$4,'direction','High','Option A',$4)
       ON CONFLICT (id) DO NOTHING`,
      [DECISION_A, ORG_A, MEETING_A, ORGANIZER]
    );
    await pool.query(
      `INSERT INTO meeting_follow_ups
         (id, organization_id, meeting_id, title, owner, owner_user_id, due_at, status)
       VALUES ($1,$2,$3,'Send the exported protocol','Morgan Member',$4,'2026-09-25','open')
       ON CONFLICT (id) DO NOTHING`,
      [FOLLOWUP_A, ORG_A, MEETING_A, PARTICIPANT]
    );

    const { default: meetingRoutes } = await import('../meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool
      .query(`DELETE FROM meeting_decisions WHERE organization_id = $1`, [ORG_A])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM meeting_follow_ups WHERE organization_id = $1`, [ORG_A])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM meeting_protocols WHERE organization_id = $1`, [ORG_A])
      .catch(() => undefined);
    await pool.query(`DELETE FROM meetings WHERE organization_id = $1`, [ORG_A]).catch(() => undefined);
    await pool
      .query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await pool.end().catch(() => undefined);
  });

  function download(headers: Record<string, string>) {
    return request(app)
      .get(`/api/meeting/${MEETING_A}/protocol/export.docx`)
      .set(headers)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });
  }

  it('200 organizer: real DOCX bytes with a protocol filename', async () => {
    const res = await download(asOrganizer);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(res.headers['content-disposition']).toContain(
      'Meeting_protocol_MTG2C_export_meeting_v1.0.docx'
    );
    const body = Buffer.from(res.body);
    expect(body.subarray(0, 2).toString()).toBe('PK');
    expect(body.includes('word/document.xml')).toBe(true);
    expect(Number(res.headers['content-length'])).toBe(body.length);
  });

  it('200 participant: export is a READ — the attendee guard does not 403 it', async () => {
    const res = await download(asParticipant);
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).subarray(0, 2).toString()).toBe('PK');
  });

  it('404 foreign tenant cannot export org A protocol', async () => {
    const res = await download(asForeign);
    expect(res.status).toBe(404);
  });

  it('schema builder carries register-source labels and register rows from live data', async () => {
    const { previewProtocol } = await import(
      '../../services/meeting/meetingProtocolService.js'
    );
    const { buildMeetingProtocolDocumentSchema } = await import(
      '../../services/meeting/meetingProtocolDocxSchemaService.js'
    );
    const protocol = await previewProtocol({ organizationId: ORG_A, meetingId: MEETING_A });
    const schema = buildMeetingProtocolDocumentSchema({
      meetingId: MEETING_A,
      version: protocol.version,
      status: protocol.status,
      content: protocol.content,
    });

    expect(schema.documentType).toBe('workshop_summary');
    expect(schema.language).toBe('en');
    const sectionIds = schema.sections.map((s) => s.sectionId);
    expect(sectionIds).toEqual(
      expect.arrayContaining(['meeting', 'decisions', 'actions'])
    );

    const decisions = schema.sections.find((s) => s.sectionId === 'decisions')!;
    const decisionsTexts = decisions.blocks.map((b) => JSON.stringify(b.content));
    expect(decisionsTexts.some((t) => t.includes('Source: decisions register'))).toBe(true);
    expect(decisionsTexts.some((t) => t.includes('Adopt option B for the export pilot'))).toBe(true);

    const actions = schema.sections.find((s) => s.sectionId === 'actions')!;
    const actionsTexts = actions.blocks.map((b) => JSON.stringify(b.content));
    expect(actionsTexts.some((t) => t.includes('Source: follow-ups register'))).toBe(true);
    expect(actionsTexts.some((t) => t.includes('Send the exported protocol'))).toBe(true);
  });
});
