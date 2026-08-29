import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbGet, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: dbAll,
  get: dbGet,
  run: dbRun,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { filterDocumentsByVisibility } from '../../../../server/src/services/ai/documentGovernance.js';

const routeSource = readFileSync(`${process.cwd()}/server/src/routes/ai.routes.ts`, 'utf8');
const embeddingSource = readFileSync(
  `${process.cwd()}/server/src/services/ai/embeddingService.ts`,
  'utf8'
);
const migrationSource = readFileSync(
  `${process.cwd()}/server/migrations/20261720_day131_teresa_knowledge_boundaries.sql`,
  'utf8'
);

describe('Day 131 Teresa organization knowledge boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('document governance reads the upload table and denies an unknown id', async () => {
    dbAll.mockResolvedValue([]);

    const result = await filterDocumentsByVisibility(['missing-doc']);

    expect(dbAll).toHaveBeenCalledWith(
      expect.stringContaining('FROM knowledge_docs'),
      ['missing-doc']
    );
    expect(result).toEqual({
      allowed: [],
      blocked: ['missing-doc'],
      requiresApproval: [],
      approvedViaConversation: [],
    });
  });

  it('document governance denies every requested id when its query fails', async () => {
    dbAll.mockRejectedValue(new Error('database unavailable'));

    const result = await filterDocumentsByVisibility(['doc-a', 'doc-b']);

    expect(result).toEqual({
      allowed: [],
      blocked: ['doc-a', 'doc-b'],
      requiresApproval: [],
    });
  });

  it('keeps organization retrieval default-off and injects hits or an explicit no-hit result', () => {
    expect(routeSource).toContain(
      "process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL === 'true'"
    );
    expect(routeSource).toContain("workflowMode: 'org_context_research_mode'");
    expect(routeSource).toContain('## ORGANIZATION KNOWLEDGE');
    expect(routeSource).toContain(
      'No matching organization knowledge was found for this question.'
    );
    expect(routeSource).toContain('fragmentIndex:');
  });

  it('uses first-class tenant ownership and only explicit global source types', () => {
    expect(migrationSource).toContain('ADD COLUMN IF NOT EXISTS organization_id TEXT');
    expect(migrationSource).toContain("NULLIF(metadata->>'organization_id', '')");
    expect(migrationSource).toContain('idx_ai_embeddings_org_source');
    expect(embeddingSource).toContain(
      "organization_id IS NULL AND source_type IN ('tool_pack', 'methodology', 'product_pill')"
    );
    expect(embeddingSource).not.toContain("metadata->>'organization_id' IS NULL");
  });
});
