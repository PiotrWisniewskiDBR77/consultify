import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import {
  API_BASE_URL,
  authHeaders,
  setupDocumentStudioSession,
} from '../documents/_document-studio-helpers';

const IDEAS_API = `${API_BASE_URL}/api/my-work/my-ideas`;

test('signed owner approves a real Process Flow once and cold-reopens its Initiative Candidate', async ({
  page,
}) => {
  const token = await setupDocumentStudioSession(page);
  const marker = `flow-candidate-${Date.now()}`;
  let ideaId = '';
  let foreignRunId = '';
  let candidateId = '';
  const cleanupRunIds = new Set<string>();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const created = await page.request.post(IDEAS_API, {
      headers: authHeaders(token),
      data: { title: `Process handoff ${marker}`, stage: 'developing' },
    });
    expect(created.status()).toBe(201);
    ideaId = String((await created.json()).id);
    const initial = await page.request.get(`${IDEAS_API}/${ideaId}/map`, {
      headers: authHeaders(token),
    });
    expect(initial.status()).toBe(200);
    const initialBody = await initial.json();
    const saved = await page.request.put(`${IDEAS_API}/${ideaId}/map`, {
      headers: authHeaders(token),
      data: {
        nodes: [
          {
            id: `start-${marker}`,
            type: 'process',
            data: { label: 'Receive request' },
            position: { x: 0, y: 0 },
          },
          {
            id: `finish-${marker}`,
            type: 'process',
            data: { label: 'Deliver outcome' },
            position: { x: 240, y: 0 },
          },
        ],
        edges: [{ id: `edge-${marker}`, source: `start-${marker}`, target: `finish-${marker}` }],
        preferredTool: 'process_flow',
        extensions: { processFlow: { lanes: [{ id: 'operations', name: 'Operations' }] } },
        baseVersion: initialBody.isDefault ? 0 : Number(initialBody.map.version),
      },
    });
    expect(saved.status()).toBe(200);

    await page.goto(`/my-work/ideas/${encodeURIComponent(ideaId)}/workspace/process-flow`);
    await expect(page.locator('[data-local-command-palette="idea-map"]')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId('approve-process-flow-candidate').click();
    await expect(page.getByTestId('process-flow-candidate-preview')).toBeVisible();
    const firstResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/my-ideas/${ideaId}/map/candidate/approve`) &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('confirm-process-flow-candidate').click();
    expect((await firstResponsePromise).status()).toBe(201);
    await expect(page.getByTestId('process-flow-candidate-readback')).toBeVisible({
      timeout: 20_000,
    });
    const first = await page.request.get(`${IDEAS_API}/${ideaId}/map/candidate`, {
      headers: authHeaders(token),
    });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.candidate_id).toBeTruthy();
    candidateId = String(firstBody.candidate_id);

    await page.getByTestId('process-flow-candidate-readback').click();
    await expect(page).toHaveURL(
      new RegExp(`candidateInbox=discovery.*candidateId=${candidateId}`),
      { timeout: 30_000 }
    );
    const candidateTitle = `Transform process: Process handoff ${marker}`;
    const candidateRow = page
      .getByText(candidateTitle, { exact: true })
      .locator('xpath=ancestor::*[self::tr or @role="row"][1]');
    await expect(candidateRow).toContainText(/pending/i);
    const candidateDrawer = page
      .locator('aside')
      .filter({ hasText: `Transform process: Process handoff ${marker}` });
    await expect(candidateDrawer).toContainText('idea_process_flow_snapshot');
    await page.reload();
    await expect(page).toHaveURL(
      new RegExp(`candidateInbox=discovery.*candidateId=${candidateId}`)
    );
    const coldCandidateRow = page
      .getByText(candidateTitle, { exact: true })
      .locator('xpath=ancestor::*[self::tr or @role="row"][1]');
    await expect(coldCandidateRow).toContainText(/pending/i);
    const coldCandidateDrawer = page
      .locator('aside')
      .filter({ hasText: `Transform process: Process handoff ${marker}` });
    await expect(coldCandidateDrawer).toContainText('idea_process_flow_snapshot');

    await page.goto(`/my-work/ideas/${encodeURIComponent(ideaId)}/workspace/process-flow`);
    await page.reload();
    await expect(page.getByTestId('process-flow-candidate-readback')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId('approve-process-flow-candidate').click();
    await expect(page.getByTestId('process-flow-candidate-preview')).toBeVisible();
    const replayResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/my-ideas/${ideaId}/map/candidate/approve`) &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('confirm-process-flow-candidate').click();
    expect((await replayResponsePromise).status()).toBe(200);
    const cold = await page.request.get(`${IDEAS_API}/${ideaId}/map/candidate`, {
      headers: authHeaders(token),
    });
    expect(cold.status()).toBe(200);
    expect((await cold.json()).candidate_id).toBe(firstBody.candidate_id);

    const owner = await pool.query<{ organization_id: string }>(
      `SELECT organization_id FROM my_ideas WHERE id=$1`,
      [ideaId]
    );
    const count = await pool.query<{ receipts: number; candidates: number }>(
      `SELECT
        (SELECT count(*)::int FROM idea_process_flow_candidate_handoffs WHERE organization_id=$1 AND idea_id=$2) receipts,
        (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$1 AND id=$3) candidates`,
      [owner.rows[0].organization_id, ideaId, firstBody.candidate_id]
    );
    expect(count.rows[0]).toEqual({ receipts: 1, candidates: 1 });

    const foreign = await page.request.post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: {
        'x-test-support-key': process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me',
      },
      data: { runId: (foreignRunId = `flow-candidate-foreign-${marker}`), role: 'ADMIN' },
    });
    expect(foreign.status()).toBe(200);
    const foreignToken = String((await foreign.json()).token);
    const foreignStatuses = [
      (
        await page.request.get(`${IDEAS_API}/${ideaId}/map/candidate/preview`, {
          headers: authHeaders(foreignToken),
        })
      ).status(),
      (
        await page.request.get(`${IDEAS_API}/${ideaId}/map/candidate`, {
          headers: authHeaders(foreignToken),
        })
      ).status(),
      (
        await page.request.post(`${IDEAS_API}/${ideaId}/map/candidate/approve`, {
          headers: authHeaders(foreignToken),
          data: { mapVersion: firstBody.map_version, projectionHash: firstBody.projection_hash },
        })
      ).status(),
    ];
    const nonexistentStatuses = [
      (
        await page.request.get(`${IDEAS_API}/missing-${marker}/map/candidate/preview`, {
          headers: authHeaders(token),
        })
      ).status(),
      (
        await page.request.get(`${IDEAS_API}/missing-${marker}/map/candidate`, {
          headers: authHeaders(token),
        })
      ).status(),
      (
        await page.request.post(`${IDEAS_API}/missing-${marker}/map/candidate/approve`, {
          headers: authHeaders(token),
          data: { mapVersion: firstBody.map_version, projectionHash: firstBody.projection_hash },
        })
      ).status(),
    ];
    expect(foreignStatuses).toEqual([404, 404, 404]);
    expect(foreignStatuses).toEqual(nonexistentStatuses);

    const identity = await pool.query<{ organization_id: string; user_id: string }>(
      `SELECT i.organization_id,i.user_id FROM my_ideas i WHERE i.id=$1`,
      [ideaId]
    );
    const primary = identity.rows[0];
    const beforeRevoked = await pool.query<{ receipts: number; candidates: number }>(
      `SELECT (SELECT count(*)::int FROM idea_process_flow_candidate_handoffs WHERE organization_id=$1 AND idea_id=$2) receipts,
              (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$1 AND id=$3) candidates`,
      [primary.organization_id, ideaId, firstBody.candidate_id]
    );
    await pool.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [primary.organization_id, primary.user_id]
    );
    try {
      const revokedPreview = await page.request.get(
        `${IDEAS_API}/${ideaId}/map/candidate/preview`,
        { headers: authHeaders(token) }
      );
      expect(revokedPreview.status()).toBe(403);
      const revokedRead = await page.request.get(`${IDEAS_API}/${ideaId}/map/candidate`, {
        headers: authHeaders(token),
      });
      expect(revokedRead.status()).toBe(403);
      const revokedApprove = await page.request.post(
        `${IDEAS_API}/${ideaId}/map/candidate/approve`,
        {
          headers: authHeaders(token),
          data: { mapVersion: firstBody.map_version, projectionHash: firstBody.projection_hash },
        }
      );
      expect(revokedApprove.status()).toBe(403);
      const afterRevoked = await pool.query<{ receipts: number; candidates: number }>(
        `SELECT (SELECT count(*)::int FROM idea_process_flow_candidate_handoffs WHERE organization_id=$1 AND idea_id=$2) receipts,
                (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$1 AND id=$3) candidates`,
        [primary.organization_id, ideaId, firstBody.candidate_id]
      );
      expect(afterRevoked.rows[0]).toEqual(beforeRevoked.rows[0]);
    } finally {
      await pool.query(
        `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
        [primary.organization_id, primary.user_id]
      );
    }
  } finally {
    if (ideaId) {
      const db = await pool.query<{ name: string }>('SELECT current_database() name');
      const prefix = process.env.FLOW_IDEA_DISPOSABLE_DB_PREFIX || '';
      expect(prefix).not.toBe('');
      expect(db.rows[0].name.startsWith(prefix)).toBe(true);
      const ownedRuns = await pool.query<{ run_id: string }>(
        `SELECT run_id FROM test_support_runs WHERE organization_id=(SELECT organization_id FROM my_ideas WHERE id=$1)`,
        [ideaId]
      );
      ownedRuns.rows.forEach((row) => cleanupRunIds.add(row.run_id));
      await pool.query('BEGIN');
      try {
        await pool.query(`SET LOCAL session_replication_role='replica'`);
        const org = await pool.query<{ organization_id: string }>(
          `SELECT organization_id FROM my_ideas WHERE id=$1`,
          [ideaId]
        );
        const orgId = org.rows[0]?.organization_id;
        if (orgId) {
          const receipts = await pool.query<{ candidate_id: string }>(
            `SELECT candidate_id FROM idea_process_flow_candidate_handoffs WHERE organization_id=$1 AND idea_id=$2`,
            [orgId, ideaId]
          );
          await pool.query(
            `DELETE FROM idea_process_flow_candidate_handoffs WHERE organization_id=$1 AND idea_id=$2`,
            [orgId, ideaId]
          );
          if (receipts.rows.length) {
            await pool.query(
              `DELETE FROM initiative_candidates WHERE organization_id=$1 AND id=ANY($2::text[])`,
              [orgId, receipts.rows.map((row) => row.candidate_id)]
            );
          }
        }
        await pool.query(`DELETE FROM my_ideas WHERE id=$1`, [ideaId]);
        await pool.query(`SET LOCAL session_replication_role='origin'`);
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }
    if (foreignRunId) cleanupRunIds.add(foreignRunId);
    for (const runId of cleanupRunIds) {
      const cleaned = await page.request.post(`${API_BASE_URL}/api/test-support/cleanup`, {
        headers: {
          'x-test-support-key': process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me',
        },
        data: { runId },
        timeout: 150_000,
      });
      expect(cleaned.status()).toBe(200);
    }
    const residue = await pool.query<{
      handoffs: number;
      candidates: number;
      maps: number;
      ideas: number;
      locks: number;
    }>(
      `SELECT
        (SELECT count(*)::int FROM idea_process_flow_candidate_handoffs WHERE idea_id=$1) handoffs,
        (SELECT count(*)::int FROM initiative_candidates WHERE id=$2) candidates,
        (SELECT count(*)::int FROM my_idea_maps WHERE idea_id=$1) maps,
        (SELECT count(*)::int FROM my_ideas WHERE id=$1) ideas,
        (SELECT count(*)::int FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()) locks`,
      [ideaId || '__none__', candidateId || '__none__']
    );
    expect(residue.rows[0]).toEqual({ handoffs: 0, candidates: 0, maps: 0, ideas: 0, locks: 0 });
    await pool.end();
  }
});
