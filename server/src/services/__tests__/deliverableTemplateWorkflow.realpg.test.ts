import fs from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const databaseUrl = process.env.DATABASE_URL || '';

const { approveTemplateProvenance, getDeliverableTemplate } = vi.hoisted(() => ({
  approveTemplateProvenance: vi.fn(),
  getDeliverableTemplate: vi.fn(),
}));

vi.mock('../deliverableTemplateService.js', () => ({
  approveTemplateProvenance,
  getDeliverableTemplate,
}));

describe.runIf(enabled)('TPL-1b governed lifecycle on real PostgreSQL', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = 'tpl1b-real-org';
  const templateId = 'tpl1b-real-template';
  const authorUserId = 'tpl1b-author';
  const approverUserId = 'tpl1b-approver';

  beforeAll(async () => {
    const migration = await fs.readFile(
      path.resolve(process.cwd(), 'server/migrations/20262273_deliverable_template_workflow.sql'),
      'utf8'
    );
    await pool.query(migration);
    await pool.query(migration);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT
      )
    `);
    await pool.query(
      `INSERT INTO initiatives (id, organization_id, name)
       VALUES ($1, $2, 'Live initiative') ON CONFLICT (id) DO NOTHING`,
      ['tpl1b-live-object', organizationId]
    );
    getDeliverableTemplate.mockResolvedValue({
      id: templateId,
      type: 'deck',
      name: 'Board deck',
      description: 'Live governed template',
      isSystem: false,
      isBlank: false,
      organizationId,
      meta: {
        outline_json: Array.from({ length: 8 }, (_, index) => ({
          title: `Slide ${index + 1}`,
          source: index === 7 ? 'Decisions' : 'DRD',
        })),
      },
    });
    approveTemplateProvenance.mockResolvedValue({ replayed: false });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('requires live PASS, rejects self approval and approves 1.0 with one default', async () => {
    const {
      approveTemplateWorkflow,
      registerTemplateDraftWorkflow,
      runTemplateLiveTest,
      submitTemplateForApproval,
    } = await import('../deliverableTemplateWorkflowService.js');

    const workflow = await registerTemplateDraftWorkflow({
      organizationId,
      authorUserId,
      template: await getDeliverableTemplate(),
      baseKind: 'archetype',
      language: 'en',
      documentType: 'board',
      sourceBindings: Object.fromEntries(
        Array.from({ length: 8 }, (_, index) => [`slide-${index + 1}`, 'DRD'])
      ),
    });
    expect(workflow.status).toBe('draft');

    const testRun = await runTemplateLiveTest({
      organizationId,
      actorUserId: authorUserId,
      templateId,
      objectType: 'initiative',
      objectId: 'tpl1b-live-object',
    });
    expect(testRun.status).toBe('pass');
    expect(testRun.exportFormat).toBe('pptx');
    expect(testRun.exportByteSize).toBeGreaterThan(100);

    const submitted = await submitTemplateForApproval({
      organizationId,
      actorUserId: authorUserId,
      templateId,
    });
    expect(submitted.status).toBe('submitted');

    await expect(
      approveTemplateWorkflow({ organizationId, actorUserId: authorUserId, templateId })
    ).rejects.toMatchObject({ code: 'AUTHOR_CANNOT_APPROVE' });

    const approved = await approveTemplateWorkflow({
      organizationId,
      actorUserId: approverUserId,
      templateId,
      setAsDefault: true,
    });
    expect(approved).toMatchObject({ status: 'approved', version: '1.0', isDefault: true });

    const rows = await pool.query(
      `SELECT count(*)::int AS count FROM deliverable_template_workflows
        WHERE organization_id = $1 AND document_type = 'board'
          AND template_type = 'deck' AND status = 'approved' AND is_default = TRUE`,
      [organizationId]
    );
    expect(rows.rows[0].count).toBe(1);
  });
});
