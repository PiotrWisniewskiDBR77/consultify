import { beforeEach, describe, expect, it, vi } from 'vitest';

const filterDocumentsByVisibility = vi.fn();

vi.mock('../documentGovernance.js', () => ({ filterDocumentsByVisibility }));

describe('Day 132 R4 — AIContextBuilder governance failure', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    filterDocumentsByVisibility.mockRejectedValue(new Error('day132 forced governance failure'));
    const { AIContextBuilder } = await import('../../aiContextBuilder.js');
    AIContextBuilder.setDependencies({
      db: {
        get: vi.fn(async (sql: string) => {
          if (sql.includes('SELECT organization_id FROM projects')) {
            return { organization_id: 'day132-org' };
          }
          if (sql.includes('SELECT rag_enabled FROM projects')) return { rag_enabled: 1 };
          if (sql.includes('SELECT phase_history FROM projects')) return { phase_history: '[]' };
          return null;
        }),
        all: vi.fn(async () => []),
      },
      KnowledgeService: {
        getActiveStrategies: vi.fn(async () => []),
        getApprovedIdeas: vi.fn(async () => []),
        getDocuments: vi.fn(async () => [
          {
            id: 'day132_r4_confidential_proof',
            filename: 'day132-secret-plan.txt',
            sensitivity: 'confidential',
            tags: [],
          },
        ]),
      },
    });
  });

  it('drops every document when the shared governance guard throws', async () => {
    const { AIContextBuilder } = await import('../../aiContextBuilder.js');
    const result = await AIContextBuilder._buildKnowledgeContext(
      'day132-project',
      'all',
      'day132-conversation'
    );

    expect(filterDocumentsByVisibility).toHaveBeenCalledWith(
      ['day132_r4_confidential_proof'],
      'day132-project',
      'day132-conversation'
    );
    expect(result.projectDocuments).toEqual([]);
  });
});
