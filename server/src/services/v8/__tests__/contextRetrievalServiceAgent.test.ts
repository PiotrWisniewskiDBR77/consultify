import { beforeEach, describe, expect, it, vi } from 'vitest';

const { allMock, hybridMock } = vi.hoisted(() => ({ allMock: vi.fn(), hybridMock: vi.fn() }));
vi.mock('../../../utils/DbPromise.js', () => ({ all: allMock, get: vi.fn(), run: vi.fn() }));
vi.mock('../../ragService.js', () => ({ default: { hybridSearch: hybridMock }, hybridSearch: hybridMock }));

import { retrieveContext } from '../../organizationContext/ContextRetrievalService.js';

describe('ContextRetrievalService Agent hardening', () => {
  beforeEach(() => { allMock.mockReset(); hybridMock.mockReset(); });

  it('requires a project for the Agent workflow before querying', async () => {
    await expect(retrieveContext({ organizationId: 'org-1', userId: 'user-1', workflow: 'agent_execution', workflowMode: 'selected_material_plus_selected_context', selectedDocumentIds: ['doc-1'] })).rejects.toThrow('agent_context_project_required');
    expect(allMock).not.toHaveBeenCalled();
  });

  it('enforces project membership in SQL and preserves hybrid relevance', async () => {
    allMock.mockResolvedValueOnce([{ id: 'doc-1', filename: 'Policy.pdf', status: 'ready', scope: 'project', project_id: 'project-1', owner_id: null, version: 1, created_at: '2026-08-08T00:00:00Z' }]);
    hybridMock.mockResolvedValue([{ id: 'chunk-1', filename: 'Policy.pdf', content: 'approved fact', chunkIndex: 1, hybridScore: 0.87, metadata: { nativeSourceLocator: { page: 2 } } }]);
    const result = await retrieveContext({ organizationId: 'org-1', userId: 'user-1', projectId: 'project-1', workflow: 'agent_execution', workflowMode: 'selected_material_plus_selected_context', selectedDocumentIds: ['doc-1'], retrievalQuery: 'policy' });
    expect(String(allMock.mock.calls[0][0])).toContain('EXISTS');
    expect(String(allMock.mock.calls[0][0])).toContain('project_members');
    expect(String(allMock.mock.calls[0][0])).toContain('deleted_at IS NULL');
    expect(String(allMock.mock.calls[0][0])).not.toContain("deleted_at = ''");
    expect(allMock.mock.calls[0][1]).toEqual(['doc-1', 'org-1', 'user-1', 'project-1', 'user-1']);
    expect(result.chunks[0]).toEqual(expect.objectContaining({ documentId: 'doc-1', relevance: 0.87, nativeSourceLocator: { page: 2 } }));
  });

  it('uses PostgreSQL-safe timestamp semantics for approved-context lookup', async () => {
    allMock.mockResolvedValueOnce([]);
    await retrieveContext({ organizationId: 'org-1', userId: 'user-1', workflow: 'chat', workflowMode: 'org_context_research_mode', retrievalQuery: 'policy' });
    expect(String(allMock.mock.calls[0][0])).toContain('deleted_at IS NULL');
    expect(String(allMock.mock.calls[0][0])).not.toContain("deleted_at = ''");
  });

  it('returns no candidate for an inaccessible project document', async () => {
    allMock.mockResolvedValueOnce([]);
    const result = await retrieveContext({ organizationId: 'org-1', userId: 'user-1', projectId: 'project-1', workflow: 'agent_execution', workflowMode: 'selected_material_plus_selected_context', selectedDocumentIds: ['foreign-doc'], retrievalQuery: 'secret' });
    expect(result.chunks).toEqual([]);
    expect(result.excludedReasons).toContainEqual({ documentId: 'foreign-doc', reason: 'document_not_accessible' });
    expect(hybridMock).not.toHaveBeenCalled();
  });
});
