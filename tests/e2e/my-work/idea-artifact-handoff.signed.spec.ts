import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { readTestSupportState } from '../_helpers/testSupportState';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3411';
const WEB = process.env.E2E_BASE_URL || 'http://127.0.0.1:3410';

test('signed Idea approval creates real document, deck and workbook with stable cold receipts', async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const state = readTestSupportState();
  const runId = `idea-handoff-${randomUUID().slice(0, 8)}`;
  const marker = `Idea artifact handoff ${runId}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const headers = {
    Authorization: `Bearer ${state.token}`,
    'x-org-context': state.organizationId,
  };
  let ideaId = '';
  const proposalIds: string[] = [];
  const targetIds: string[] = [];

  try {
    const createdIdea = await request.post(`${API}/api/my-work/my-ideas`, {
      headers,
      data: { title: marker, body: `${marker} nonempty approved source`, tags: [runId] },
    });
    expect(createdIdea.status()).toBe(201);
    ideaId = String((await createdIdea.json()).id);

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(({ token, organizationId, userId }) => {
      const user = { id: userId, organizationId, role: 'ADMIN', isAuthenticated: true };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('consultinity-storage', JSON.stringify({
        state: { sessionMode: 'FULL', currentUser: user,
          currentOrganization: { id: organizationId, name: 'Idea handoff E2E' } }, version: 0,
      }));
    }, state);

    for (const targetKind of ['document', 'presentation', 'workbook'] as const) {
      await page.goto(`${WEB}/my-work/ideas`);
      const skipOnboarding = page.getByRole('button', { name: 'Skip for now' });
      if (await skipOnboarding.isVisible()) await skipOnboarding.click();
      await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
      await page.keyboard.press('p');
      await expect(page.getByText('Convert idea', { exact: true })).toBeVisible();
      const proposalResponsePromise = page.waitForResponse((response) =>
        response.request().method() === 'POST'
          && response.url().endsWith(`/api/idea-business-case/${ideaId}/artifact-proposals`)
      );
      await page.getByRole('button', {
        name: targetKind === 'document'
          ? /^Document Create governed proposal$/
          : targetKind === 'presentation'
            ? /^Presentation Create governed proposal$/
            : /^Workbook Create governed proposal$/,
      }).click();
      const proposalResponse = await proposalResponsePromise;
      expect(proposalResponse.status()).toBe(201);
      const proposal = (await proposalResponse.json()).proposal;
      proposalIds.push(proposal.proposalId);

      const approvedPromise = page.waitForResponse((response) =>
        response.request().method() === 'POST' && response.url().endsWith(
          `/api/idea-business-case/${ideaId}/artifact-proposals/${proposal.proposalId}/decision`
        )
      );
      const materializedPromise = page.waitForResponse((response) =>
        response.request().method() === 'POST' && response.url().endsWith(
          `/api/idea-business-case/${ideaId}/artifact-proposals/${proposal.proposalId}/materialize`
        )
      );
      await page.getByRole('button', { name: 'Approve and create' }).click();
      const approved = await approvedPromise;
      expect(approved.status()).toBe(200);
      const materialized = await materializedPromise;
      expect(materialized.status()).toBe(201);
      const createdCold = await request.get(
        `${API}/api/idea-business-case/${ideaId}/artifact-proposals/${proposal.proposalId}`,
        { headers }
      );
      expect(createdCold.status()).toBe(200);
      const receipt = (await createdCold.json()).receipt;
      targetIds.push(receipt.targetRecordId);

      const replay = await request.post(
        `${API}/api/idea-business-case/${ideaId}/artifact-proposals/${proposal.proposalId}/materialize`,
        { headers, data: {} }
      );
      expect(replay.status()).toBe(200);
      expect((await replay.json()).receipt.targetRecordId).toBe(receipt.targetRecordId);

      const cold = await request.get(
        `${API}/api/idea-business-case/${ideaId}/artifact-proposals/${proposal.proposalId}`,
        { headers }
      );
      expect(cold.status()).toBe(200);
      expect((await cold.json()).receipt.targetRecordId).toBe(receipt.targetRecordId);

      const deepLink = targetKind === 'document'
        ? `/document-studio/${receipt.targetRecordId}`
        : targetKind === 'presentation'
          ? `/presentations/builder/${receipt.targetRecordId}`
          : `/excele?artifactId=${encodeURIComponent(receipt.targetRecordId)}`;
      await page.goto(`${WEB}${deepLink}`);
      await expect(page.getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
      await page.reload();
      await expect(page.getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    }

    await context.close();

    expect(new Set(targetIds).size).toBe(3);
  } finally {
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE proposal_id = ANY($1::text[])`, [proposalIds]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE proposal_id = ANY($1::text[])`, [proposalIds]);
    await pool.query(`DELETE FROM artifact_evidence WHERE artifact_id = ANY($1::text[])`, [targetIds]);
    await pool.query(`DELETE FROM wave5_artifact_versions WHERE artifact_id = ANY($1::text[])`, [targetIds]);
    await pool.query(`DELETE FROM wave5_artifacts WHERE artifact_id = ANY($1::text[])`, [targetIds]);
    await pool.query(`DELETE FROM presentation_decks WHERE id = ANY($1::text[])`, [targetIds]);
    await pool.query(`DELETE FROM generated_workbooks WHERE id = ANY($1::text[])`, [targetIds]);
    if (ideaId) await pool.query(`DELETE FROM my_ideas WHERE id=$1`, [ideaId]);
    await pool.end();
  }
});
