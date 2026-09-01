/** @vitest-environment node */
//
// FIX-4 (ODBIOR_231, P1) — `generateKnowledgeOutline` took `projectId` from the
// request body and handed it straight to the executor without confirming it
// belongs to the caller's organization (same defect shape FIX-206 (P0)
// already fixed once in ai.routes.ts:4944-4961: verify ownership BEFORE the
// projectId reaches the tool loop). This proves the fix: a claimed projectId
// owned by a DIFFERENT organization never reaches `executeToolCall`.

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const executeToolCallMock = vi.fn(async () =>
  JSON.stringify({ source: 'knowledge_base', results: [] })
);
vi.mock('../ai/toolDefinitions.js', () => ({
  executeToolCall: (...args: unknown[]) => executeToolCallMock(...args),
}));

let capturedRequest: any = null;
const processMock = vi.fn(async (request: any) => {
  capturedRequest = request;
  await request.options.readTools.context.executeReadTool('search_knowledge_base', {
    query: 'x',
  });
  const content = JSON.stringify({
    outline: [{ tytul: 'T', teza: 'Teza.', archetyp: 'single_insight', zrodla: [] }],
  });
  return {
    success: true,
    stream: (async function* () {
      yield content;
    })(),
    metadata: { provider: 'mock', model: 'mock' },
  };
});
vi.mock('../ai/AIPipeline.js', () => ({
  AIPipeline: { getInstance: () => ({ process: (...args: unknown[]) => processMock(...args) }) },
}));

vi.mock('../../config/FeatureFlags.js', () => ({
  default: { ENABLE_TERESA_TOOL_LOOP: true },
}));

const { generateKnowledgeOutline } = await import('../presentationKnowledgeOutlineService.js');

describe('Day231 FIX-4 — projectId ownership verified before reaching the executor', { retry: 0 }, () => {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const projectOwnedByOrgA = randomUUID();
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`, [orgA, 'FIX-4 org A']);
    await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`, [orgB, 'FIX-4 org B']);
    await pool.query(`INSERT INTO projects(id,organization_id,name,status) VALUES($1,$2,$3,'active')`, [projectOwnedByOrgA, orgA, 'Org A project']);
  }, 30_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM projects WHERE id=$1', [projectOwnedByOrgA]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgA]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgB]);
    await pool.end();
  });

  beforeEach(() => {
    capturedRequest = null;
    executeToolCallMock.mockClear();
    processMock.mockClear();
  });

  it('GRANTED: caller from org A citing its own project -> projectId reaches the executor', async () => {
    await generateKnowledgeOutline({
      organizationId: orgA,
      userId: 'user-a',
      projectId: projectOwnedByOrgA,
      title: 'T',
      audience: 'executive',
      goal: 'decide',
      language: 'pl',
    });
    expect(capturedRequest.projectId).toBe(projectOwnedByOrgA);
    expect(executeToolCallMock).toHaveBeenCalledTimes(1);
    expect(executeToolCallMock.mock.calls[0][2].projectId).toBe(projectOwnedByOrgA);
  }, 30_000);

  it('DENIED: caller from org B citing org A\'s project -> projectId never reaches the executor', async () => {
    await generateKnowledgeOutline({
      organizationId: orgB,
      userId: 'user-b',
      projectId: projectOwnedByOrgA,
      title: 'T',
      audience: 'executive',
      goal: 'decide',
      language: 'pl',
    });
    expect(capturedRequest.projectId).toBeUndefined();
    expect(executeToolCallMock).toHaveBeenCalledTimes(1);
    expect(executeToolCallMock.mock.calls[0][2].projectId).toBeUndefined();
  }, 30_000);
});
