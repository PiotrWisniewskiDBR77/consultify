/**
 * L4 Smoke — Tier-0 initiative create (API)
 *
 * Goal: ensure core CRUD path works without UI brittleness.
 */

import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

test.describe('L4 Smoke — Tier-0 initiative create [@module:initiatives]', () => {
  test.setTimeout(60000);

  test('creates project and initiative via API', async ({ request }) => {
    const { token, userId } = readTestSupportState();
    const headers = authHeaders(token);

    const createProject = await request.post(`${API_BASE_URL}/api/projects`, {
      headers,
      data: { name: `Tier0 Project ${Date.now()}`, description: 'tier0 smoke seed' },
    });
    expect(createProject.ok()).toBeTruthy();
    const projBody = await createProject.json().catch(() => null);
    const projectId = projBody?.id || projBody?.data?.id || projBody?.project?.id || null;

    const createInitiative = await request.post(`${API_BASE_URL}/api/initiatives`, {
      headers,
      data: {
        title: `Tier0 Initiative ${Date.now()}`,
        summary: 'tier0 smoke',
        status: 'PLANNING',
        projectId: projectId || undefined,
        ownerBusinessId: userId,
        ownerExecutionId: userId,
      },
    });
    expect(createInitiative.ok()).toBeTruthy();
    const ini = await createInitiative.json().catch(() => null);
    const initiativeId = ini?.id || ini?.data?.id || ini?.initiative?.id || null;
    expect(String(initiativeId || '')).toBeTruthy();

    const getIni = await request.get(`${API_BASE_URL}/api/initiatives/${initiativeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getIni.ok()).toBeTruthy();
  });
});
