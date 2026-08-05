/** @vitest-environment node */

import { randomUUID } from 'crypto';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { dbGet } from '../../../database/db.js';

const SUFFIX = randomUUID().slice(0, 8);
const ORG = `org-m10-freeze-${SUFFIX}`;
const USER = `user-m10-freeze-${SUFFIX}`;
const APPROVED_ID = `assessment-approved-${SUFFIX}`;
const DRAFT_ID = `assessment-draft-${SUFFIX}`;

const run = async (sql: string, params: unknown[] = []) => {
  const { getDatabaseAsync } = await import('../../../database/Database.js');
  const db: any = await getDatabaseAsync();
  return db.run(sql, params);
};

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: () => ({ organizationId: ORG, userId: USER, userRole: 'ADMIN' }),
}));

vi.mock('../../../controllers/AssessmentController.js', () => ({
  ensureAssessmentSchema: vi.fn().mockResolvedValue(undefined),
  normalizeStatus: (status: string | null | undefined) => String(status || 'DRAFT').toUpperCase(),
}));

vi.mock('../../../services/assessmentPermissionService.js', () => ({
  default: {
    getUserRole: vi.fn().mockResolvedValue({
      role: 'editor',
      permissions: { canView: true, canEdit: true },
      assignedAreas: [],
      isOwner: false,
    }),
    getDefaultPermissions: vi.fn().mockReturnValue({ canView: true, canEdit: true }),
  },
}));

vi.mock('../../../utils/AssessmentAuditLogger.js', () => ({
  assessmentAuditLogger: {
    logCreation: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('M10 accepted assessment freeze — real PostgreSQL', () => {
  let app: express.Express;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 and a real DATABASE_URL.');
    }

    await run(`INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'M10 freeze test',
    ]);
    await run(
      `INSERT INTO assessments
         (id, organization_id, name, assessment_type, status, answers_json,
          context_snapshot, score_summary, completion_percent, confidence_avg,
          navigation_json, created_at, updated_at)
       VALUES (?, ?, ?, 'DRD', ?, ?, '{}', '{}', 100, 1, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [APPROVED_ID, ORG, 'Accepted baseline', 'APPROVED', '{"baseline":true}']
    );
    await run(
      `INSERT INTO assessments
         (id, organization_id, name, assessment_type, status, answers_json,
          context_snapshot, score_summary, completion_percent, confidence_avg,
          navigation_json, created_at, updated_at)
       VALUES (?, ?, ?, 'DRD', ?, ?, '{}', '{}', 10, 0.5, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [DRAFT_ID, ORG, 'Draft baseline', 'DRAFT', '{"baseline":true}']
    );

    const { default: assessmentRoutes } = await import('../assessment.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/v8/assessment', assessmentRoutes);
  });

  afterAll(async () => {
    await run(`DELETE FROM assessments WHERE id IN (?, ?)`, [APPROVED_ID, DRAFT_ID]);
    await run(`DELETE FROM organizations WHERE id = ?`, [ORG]);
  });

  it('rejects an APPROVED edit and leaves the persisted row unchanged', async () => {
    const response = await request(app)
      .put(`/api/v8/assessment/${APPROVED_ID}`)
      .send({ name: 'MUTATED', answers: { baseline: false } });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('ASSESSMENT_ALREADY_ACCEPTED');

    const row = await dbGet<{ name: string; answers_json: string }>(
      `SELECT name, answers_json FROM assessments WHERE id = ? AND organization_id = ?`,
      [APPROVED_ID, ORG]
    );
    expect(row?.name).toBe('Accepted baseline');
    expect(JSON.parse(row?.answers_json || '{}')).toEqual({ baseline: true });
  });

  it('negative control: the same write persists after reviewer-style reopen to DRAFT', async () => {
    const response = await request(app)
      .put(`/api/v8/assessment/${DRAFT_ID}`)
      .send({ name: 'Draft edited', answers: { baseline: false } });

    expect(response.status).toBe(200);

    const row = await dbGet<{ name: string; answers_json: string }>(
      `SELECT name, answers_json FROM assessments WHERE id = ? AND organization_id = ?`,
      [DRAFT_ID, ORG]
    );
    expect(row?.name).toBe('Draft edited');
    expect(JSON.parse(row?.answers_json || '{}')).toEqual({ baseline: false });
  });
});
