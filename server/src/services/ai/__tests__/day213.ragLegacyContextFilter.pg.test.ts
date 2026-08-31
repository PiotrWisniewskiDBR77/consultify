/**
 * FIX-213-3: `RagService.getContext`/`getContextKeyword` used to carry their
 * OWN inline access rule (`d.scope IS NULL OR d.scope != 'user'`) instead of
 * the shared `buildKnowledgeDocAccessFilter` the rest of FIX-213 unified
 * everything else onto. That old rule had two problems:
 *   1. No `ai_visibility`/`sensitivity` governance check at all.
 *   2. Fail-OPEN for `scope='project'` docs — `'project' != 'user'` is true,
 *      so a project-scoped document was waved through with ZERO
 *      project-membership check whenever these functions ran (which happens
 *      with no `userId`/`projectIds` available to them at all).
 *
 * ODBIÓR_213.md measured this as having "zero external callers" and
 * therefore harmless today. Re-measuring for this fix turned up an internal
 * reachable path the audit's phrasing didn't call out explicitly:
 * `RagService.searchRelevantChunks` (which DOES have real external callers —
 * annaKnowledgeService, virtualWorkerKnowledgeService, the search_knowledge_base
 * tool, ai.routes.ts) falls back to `getContext` whenever
 * `embeddingService.search()` returns zero rows, and `getContext` itself
 * falls back to `getContextKeyword` whenever embedding generation is
 * unavailable. Neither fallback threads `userId`/`projectIds`. This test
 * proves the fix directly on the two functions (still the most precise way
 * to pin the exact rule), the same way the audit measured them directly on
 * `buildKnowledgeDocAccessFilter` in ODBIÓR_213.md's "Asymetria fail-open"
 * section.
 */
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import RagService from '../../ragService.js';

const vector = Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0));

class FakeOpenAI {
  embeddings = {
    create: async () => ({ data: [{ embedding: vector }] }),
  };
  constructor(_opts: unknown) {
    void _opts;
  }
}

describe('Day 213 legacy RagService.getContext/getContextKeyword access rule', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = 'day213-legacy-org';
  const projectId = 'day213-legacy-project';
  const orgDocId = 'day213-legacy-org-doc';
  const projectDocId = 'day213-legacy-project-doc';
  // No hyphens: getContextKeyword() strips `[^\w\s]` before building its LIKE
  // pattern, so a hyphenated marker would never match its own stored content.
  const orgMarker = 'DAY213LEGACYORG9b6f1a4e83c05d7fa2916e04ecb9481f';
  const projectMarker = 'DAY213LEGACYPROJECT7fd821a936c4be0592e1a7bc4d038efc';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');

    RagService.setDependencies({ OpenAI: FakeOpenAI as any });

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [organizationId, 'Day 213 legacy-filter org']
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, organizationId, 'Day 213 legacy-filter project']
    );

    // Control: organization-scope doc, no project involved — must remain
    // visible with no context (this is the case the old rule got right).
    await pool.query(
      `INSERT INTO knowledge_docs
         (id, filename, filepath, organization_id, scope, status, ai_visibility, sensitivity)
       VALUES ($1, 'org.txt', '/day213/org.txt', $2, 'organization', 'indexed', 'allowed', 'internal')`,
      [orgDocId, organizationId]
    );
    // Regression target: project-scope doc — with NO userId/projectIds
    // context available to getContext/getContextKeyword, this must be
    // excluded (fail-closed), not waved through by 'project' != 'user'.
    await pool.query(
      `INSERT INTO knowledge_docs
         (id, filename, filepath, organization_id, project_id, scope, status, ai_visibility, sensitivity)
       VALUES ($1, 'project.txt', '/day213/project.txt', $2, $3, 'project', 'indexed', 'allowed', 'internal')`,
      [projectDocId, organizationId, projectId]
    );

    await pool.query(
      `INSERT INTO knowledge_chunks (id, doc_id, chunk_index, content, embedding, created_at)
       VALUES ($1, $2, 0, $3, $4, NOW())`,
      [`${orgDocId}-chk-0`, orgDocId, orgMarker, JSON.stringify(vector)]
    );
    await pool.query(
      `INSERT INTO knowledge_chunks (id, doc_id, chunk_index, content, embedding, created_at)
       VALUES ($1, $2, 0, $3, $4, NOW())`,
      [`${projectDocId}-chk-0`, projectDocId, projectMarker, JSON.stringify(vector)]
    );
  });

  afterAll(async () => {
    RagService.setDependencies({ OpenAI: undefined as any });
    await pool.query(`DELETE FROM knowledge_chunks WHERE doc_id = ANY($1::text[])`, [
      [orgDocId, projectDocId],
    ]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id = ANY($1::text[])`, [
      [orgDocId, projectDocId],
    ]);
    await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    await pool.end();
  });

  it('getContextKeyword includes the organization doc and excludes the project doc with no context', async () => {
    const orgResult = await RagService.getContextKeyword(orgMarker, 5, organizationId);
    expect(orgResult, 'organization-scope doc missing from getContextKeyword').toContain(orgMarker);

    const projectResult = await RagService.getContextKeyword(projectMarker, 5, organizationId);
    expect(
      projectResult,
      `project-scope doc leaked into getContextKeyword with no project context: ${projectResult}`
    ).not.toContain(projectMarker);
  });

  it('getContext (embedding path) includes the organization doc and excludes the project doc with no context', async () => {
    const orgResult = await RagService.getContext(orgMarker, 5, { organizationId });
    expect(orgResult, 'organization-scope doc missing from getContext').toContain(orgMarker);

    const projectResult = await RagService.getContext(projectMarker, 5, { organizationId });
    expect(
      projectResult,
      `project-scope doc leaked into getContext with no project context: ${projectResult}`
    ).not.toContain(projectMarker);
  });
});
