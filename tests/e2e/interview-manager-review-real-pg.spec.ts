import { expect, test } from '@playwright/test';
import pg from 'pg';

import { readTestSupportState } from './_helpers/testSupportState';

const databaseUrl = process.env.DATABASE_URL || '';
const prefix = `e2e-int06-${Date.now()}`;
const sendBackTemplateId = `${prefix}-tpl-return`;
const approveTemplateId = `${prefix}-tpl-approve`;
const sendBackSessionId = `${prefix}-session-return`;
const approveSessionId = `${prefix}-session-approve`;
const sendBackAssignmentId = `${prefix}-assignment-return`;
const approveAssignmentId = `${prefix}-assignment-approve`;
const sendBackQuestionId = `${prefix}-question-return`;
const approveQuestionId = `${prefix}-question-approve`;
const sendBackTitle = `INT06 Return ${prefix}`;
const approveTitle = `INT06 Approve ${prefix}`;

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!/localhost|127\.0\.0\.1/.test(databaseUrl)) {
    throw new Error(
      `INT-06 browser proof requires local PostgreSQL, got ${databaseUrl || 'unset'}`
    );
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

test.beforeAll(async () => {
  const { organizationId, userId } = readTestSupportState();
  const now = new Date().toISOString();
  await withClient(async (client) => {
    for (const [templateId, title] of [
      [sendBackTemplateId, sendBackTitle],
      [approveTemplateId, approveTitle],
    ]) {
      await client.query(
        `INSERT INTO interview_library_templates
           (id, organization_id, name, description, category, is_active, version, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, 'INT-06 browser acceptance', 'strategy', TRUE, 1, $4, $5, $5)`,
        [templateId, organizationId, title, userId, now]
      );
    }

    for (const [sessionId, assignmentId, templateId] of [
      [sendBackSessionId, sendBackAssignmentId, sendBackTemplateId],
      [approveSessionId, approveAssignmentId, approveTemplateId],
    ]) {
      await client.query(
        `INSERT INTO interview_sessions
           (id, organization_id, name, owner_id, status, total_questions, answered_questions,
            template_id, assignment_id, started_at, last_activity_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'submitted', 1, 1, $5, $6, $7, $7, $7, $7)`,
        [sessionId, organizationId, `Session ${templateId}`, userId, templateId, assignmentId, now]
      );
      await client.query(
        `INSERT INTO interview_assignments
           (id, organization_id, assignee_user_id, template_id, template_version, status,
            session_id, submitted_at, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, 'submitted', $5, $6, $3, $6, $6)`,
        [assignmentId, organizationId, userId, templateId, sessionId, now]
      );
    }

    for (const [questionId, sessionId] of [
      [sendBackQuestionId, sendBackSessionId],
      [approveQuestionId, approveSessionId],
    ]) {
      await client.query(
        `INSERT INTO interview_questions
           (id, session_id, organization_id, category, question_text, answer_text, status,
            answered_by, answered_at, sort_order, is_required, created_at, updated_at)
         VALUES ($1, $2, $3, 'strategy', 'Browser acceptance question',
                 'Complete browser acceptance answer', 'answered', $4, $5, 1, 1, $5, $5)`,
        [questionId, sessionId, organizationId, userId, now]
      );
    }
  });
});

test.afterAll(async () => {
  await withClient(async (client) => {
    await client.query('DELETE FROM interview_answer_history WHERE assignment_id = ANY($1)', [
      [sendBackAssignmentId, approveAssignmentId],
    ]);
    await client.query('DELETE FROM interview_questions WHERE id = ANY($1)', [
      [sendBackQuestionId, approveQuestionId],
    ]);
    await client.query('DELETE FROM interview_assignments WHERE id = ANY($1)', [
      [sendBackAssignmentId, approveAssignmentId],
    ]);
    await client.query('DELETE FROM interview_sessions WHERE id = ANY($1)', [
      [sendBackSessionId, approveSessionId],
    ]);
    await client.query('DELETE FROM interview_library_templates WHERE id = ANY($1)', [
      [sendBackTemplateId, approveTemplateId],
    ]);
  });
});

test('INT-06: manager sends one submitted interview back and approves another in UI', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/discovery');

  const skipOnboarding = page.getByRole('button', { name: /Skip for now|Pomiń/i });
  await skipOnboarding
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(async () => {
      await skipOnboarding.click();
      await page.goto('/discovery');
    })
    .catch(() => {});

  const assignedTab = page.getByText(/Assigned|Przydzielone/i).first();
  await expect(assignedTab).toBeVisible({ timeout: 30_000 });
  await assignedTab.click();

  await expect(page.getByText(sendBackTitle, { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByText(sendBackTitle, { exact: true }).click();
  const sendBackAction = page
    .getByRole('button', { name: /Send back|Odeślij do poprawy/i })
    .first();
  await expect(sendBackAction).toBeVisible();
  await sendBackAction.click();
  await expect(
    page.getByRole('heading', { name: /Send Back for Revision|Odeślij/i })
  ).toBeVisible();
  await page.getByRole('textbox').fill('Please add one concrete example.');
  await page
    .getByRole('button', { name: /Send Back|Odeślij/i })
    .last()
    .click();

  await expect
    .poll(
      () =>
        withClient(async (client) => {
          const row = await client.query('SELECT status FROM interview_assignments WHERE id = $1', [
            sendBackAssignmentId,
          ]);
          return row.rows[0]?.status;
        }),
      { timeout: 20_000 }
    )
    .toBe('in_progress');

  await expect(page.getByText(approveTitle, { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByText(approveTitle, { exact: true }).click();
  const approveAction = page.getByRole('button', { name: /^(Approve|Zatwierdź) A$/i });
  await expect(approveAction).toBeVisible();
  await approveAction.click();
  await expect(page.getByRole('heading', { name: /Approve Interview|Zatwierdź/i })).toBeVisible();
  await page
    .getByRole('button', { name: /Approve|Zatwierdź/i })
    .last()
    .click();

  await expect
    .poll(
      () =>
        withClient(async (client) => {
          const row = await client.query(
            `SELECT a.status AS assignment_status, s.status AS session_status
             FROM interview_assignments a JOIN interview_sessions s ON s.id = a.session_id
             WHERE a.id = $1`,
            [approveAssignmentId]
          );
          return row.rows[0];
        }),
      { timeout: 20_000 }
    )
    .toMatchObject({ assignment_status: 'approved', session_status: 'completed' });
});
