import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL || '';
const prefix = `int-ui-public-${Date.now()}`;
const orgId = `${prefix}-org`;
const ownerId = `${prefix}-owner`;
const sessionId = `${prefix}-session`;
const questionId = `${prefix}-question`;
const activeDistributionId = `${prefix}-active`;
const revokedDistributionId = `${prefix}-revoked`;
const activeToken = 'a'.repeat(56) + Date.now().toString(16).padStart(8, '0').slice(-8);
const revokedToken = 'b'.repeat(56) + Date.now().toString(16).padStart(8, '0').slice(-8);

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!/localhost|127\.0\.0\.1/.test(databaseUrl)) {
    throw new Error(
      `INT UI browser proof requires local PostgreSQL, got ${databaseUrl || 'unset'}`
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
  await withClient(async (client) => {
    await client.query(`INSERT INTO organizations (id,name) VALUES ($1,'INT UI public')`, [orgId]);
    await client.query(
      `INSERT INTO users (id,organization_id,email,role) VALUES ($1,$2,$3,'OWNER')`,
      [ownerId, orgId, `${ownerId}@example.test`]
    );
    await client.query(
      `INSERT INTO interview_sessions (id,organization_id,owner_id,status,is_anonymous)
       VALUES ($1,$2,$3,'in_progress',true)`,
      [sessionId, orgId, ownerId]
    );
    await client.query(
      `INSERT INTO interview_questions
         (id,session_id,organization_id,category,question_text,status,is_required,sort_order)
       VALUES ($1,$2,$3,'strategy','What should change first?','pending',1,1)`,
      [questionId, sessionId, orgId]
    );
    await client.query(
      `INSERT INTO interview_distributions
         (id,organization_id,session_id,channel,public_token,status,anonymity_mode,expires_at,revoked_at,revoked_by)
       VALUES
         ($1,$3,$4,'link',$5,'pending','anonymous',NOW()+INTERVAL '1 day',NULL,NULL),
         ($2,$3,$4,'link',$6,'revoked','anonymous',NOW()+INTERVAL '1 day',NOW(),$7)`,
      [
        activeDistributionId,
        revokedDistributionId,
        orgId,
        sessionId,
        activeToken,
        revokedToken,
        ownerId,
      ]
    );
  });
});

test.afterAll(async () => {
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      // This suite owns a disposable database. Temporarily suspend the
      // append-only guard only inside fixture teardown, then restore it before
      // committing; production/runtime code never receives this privilege.
      await client.query(
        `ALTER TABLE interview_public_answer_receipts
         DISABLE TRIGGER trg_interview_public_answer_receipt_guard`
      );
      await client.query(`DELETE FROM interview_public_answer_receipts WHERE organization_id=$1`, [
        orgId,
      ]);
      await client.query(
        `ALTER TABLE interview_public_answer_receipts
         ENABLE TRIGGER trg_interview_public_answer_receipt_guard`
      );
      await client.query(`DELETE FROM interview_distributions WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM interview_questions WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM interview_sessions WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM users WHERE id=$1`, [ownerId]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
});

test('anonymous token-only respondent saves with CAS, reloads cold and completes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'pl');
    document.documentElement.classList.add('dark');
  });
  await page.goto(`/interview/respond/${activeToken}`);

  await expect(page.getByRole('heading', { name: 'Wywiad' })).toBeVisible();
  await expect(page.getByLabel(/What should change first/)).toBeFocused();
  await page.getByLabel(/What should change first/).fill('Start with the customer handoff.');
  await page.getByRole('button', { name: 'Zapisz odpowiedź' }).click();
  await expect(page.getByText('Odpowiedź zapisana')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(/What should change first/)).toHaveValue(
    'Start with the customer handoff.'
  );
  await page.getByRole('button', { name: 'Wyślij wywiad' }).click();
  await expect(page.getByRole('heading', { name: /Dziękujemy/ })).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact || ''))
  ).toEqual([]);

  const row = await withClient((client) =>
    client.query(
      `SELECT q.answer_text,d.status,
            (SELECT count(*)::int FROM interview_public_answer_receipts r WHERE r.distribution_id=d.id) AS receipts
       FROM interview_questions q
       JOIN interview_distributions d ON d.session_id=q.session_id AND d.id=$2
      WHERE q.id=$1`,
      [questionId, activeDistributionId]
    )
  );
  expect(row.rows[0]).toMatchObject({
    answer_text: 'Start with the customer handoff.',
    status: 'completed',
    receipts: 1,
  });
});

test('revoked token is a credential-free terminal wall with no interview content', async ({
  page,
}) => {
  await page.goto(`/interview/respond/${revokedToken}`);
  await expect(
    page.getByRole('heading', { name: /expired or was revoked|wygasł albo został cofnięty/i })
  ).toBeVisible();
  await expect(page.getByText('What should change first?')).toHaveCount(0);
});
