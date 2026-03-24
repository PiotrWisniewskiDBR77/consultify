/**
 * F02 — Knowledge retrieval with trust flow integration test
 *
 * Flow: createRetrievalRequest() → assignTrustClass() →
 *       createWorkingMemoryEntry() → orchestrateRetrieval() →
 *       verify orchestrated result combines retrieval + memory + trust
 *
 * Services: governedRetrievalService, trustAuditService, knowledgeRetrievalService
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { createRetrievalRequest } from '../../../governedRetrievalService.js';
import { assignTrustClass } from '../../../trustAuditService.js';
import {
  createWorkingMemoryEntry,
  orchestrateRetrieval,
} from '../../../knowledgeRetrievalService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const CONVERSATION_ID = '00000000-0000-4000-8000-000000000020';

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ success: true });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

describe('F02 — Knowledge retrieval with trust flow', () => {
  it('canonical flow completes end-to-end', async () => {
    // Step 1: Create a governed retrieval request
    const retrievalRequest = await createRetrievalRequest({
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      consumerClass: 'chat',
      query: 'What are the Q4 revenue targets?',
      searchPreset: 'workspace_broad',
    });
    expect(retrievalRequest.requestId).toBeDefined();
    expect(retrievalRequest.organizationId).toBe(ORG_ID);
    expect(retrievalRequest.status).toBe('pending');
    expect(retrievalRequest.consumerClass).toBe('chat');

    // Step 2: Assign trust class based on evidence
    const trustClassWithEvidence = await assignTrustClass({
      evidenceRefs: [
        {
          evidenceRefId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
          sourceId: 'doc-001',
          sourceType: 'knowledge_base',
          confidence: 0.95,
          retrievalMethod: 'vector_search',
          bindingStrength: 'strong',
          verificationState: 'verified',
        },
      ],
      modelDeclaredClass: 'grounded_fact',
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(trustClassWithEvidence).toBe('grounded_fact');

    const trustClassNoEvidence = await assignTrustClass({
      evidenceRefs: [],
      modelDeclaredClass: null,
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(trustClassNoEvidence).toBe('uncertain_inference');

    // Step 3: Create working memory entry for the conversation
    const memoryEntry = await createWorkingMemoryEntry({
      conversationId: CONVERSATION_ID,
      organizationId: ORG_ID,
      memoryType: 'ephemeral',
      content: 'User asked about Q4 revenue targets. Context: finance review.',
    });
    expect(memoryEntry.entryId).toBeDefined();
    expect(memoryEntry.conversationId).toBe(CONVERSATION_ID);
    expect(memoryEntry.memoryType).toBe('ephemeral');

    // Step 4: Orchestrate retrieval — combines governed retrieval + working memory + trust
    // Mock getWorkingMemory to return our entry
    mockDbAll.mockImplementation(
      (sql: string) => {
        if (typeof sql === 'string' && sql.includes('v8_working_memory_entries')) {
          return Promise.resolve([
            {
              entry_id: memoryEntry.entryId,
              conversation_id: CONVERSATION_ID,
              organization_id: ORG_ID,
              memory_type: 'ephemeral',
              content: memoryEntry.content,
              source_ref: null,
              created_at: memoryEntry.createdAt,
              expires_at: null,
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const orchestrated = await orchestrateRetrieval({
      conversationId: CONVERSATION_ID,
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      consumerClass: 'chat',
      query: 'What are the Q4 revenue targets?',
      searchPreset: 'workspace_broad',
    });

    expect(orchestrated.requestId).toBeDefined();
    expect(orchestrated.organizationId).toBe(ORG_ID);
    expect(orchestrated.workingMemoryResults).toHaveLength(1);
    expect(orchestrated.workingMemoryResults[0].entryId).toBe(memoryEntry.entryId);
    expect(orchestrated.mergedTrustClass).toBeDefined();
    expect(['grounded_fact', 'synthesis', 'uncertain_inference', 'degraded']).toContain(
      orchestrated.mergedTrustClass,
    );

    // Verify the chain: retrieval request → trust class → working memory → orchestrated result
    expect(orchestrated.workingMemoryResults[0].conversationId).toBe(CONVERSATION_ID);
  });

  it('intermediate outputs satisfy downstream contracts', async () => {
    // createRetrievalRequest output has requestId needed by orchestrateRetrieval
    const request = await createRetrievalRequest({
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      consumerClass: 'chat',
      query: 'Test query',
      searchPreset: 'workspace_broad',
    });
    expect(request).toHaveProperty('requestId');
    expect(request).toHaveProperty('organizationId');
    expect(request).toHaveProperty('status');
    expect(request).toHaveProperty('consumerClass');
    expect(typeof request.requestId).toBe('string');

    // assignTrustClass returns a valid TrustClass string
    const trustClass = await assignTrustClass({
      evidenceRefs: [
        {
          evidenceRefId: '00000000-0000-4000-8000-bbbbbbbbbbbb',
          sourceId: 'src-1',
          sourceType: 'document',
          confidence: 0.7,
          retrievalMethod: 'keyword_search',
          bindingStrength: 'moderate',
          verificationState: 'unverified',
        },
        {
          evidenceRefId: '00000000-0000-4000-8000-cccccccccccc',
          sourceId: 'src-2',
          sourceType: 'document',
          confidence: 0.65,
          retrievalMethod: 'hybrid_search',
          bindingStrength: 'moderate',
          verificationState: 'unverified',
        },
      ],
      modelDeclaredClass: 'synthesis',
      degradedModeFlag: false,
      uncertaintyClass: null,
    });
    expect(typeof trustClass).toBe('string');
    expect(['grounded_fact', 'synthesis', 'uncertain_inference', 'degraded']).toContain(trustClass);

    // createWorkingMemoryEntry output has entryId and conversationId
    const entry = await createWorkingMemoryEntry({
      conversationId: CONVERSATION_ID,
      organizationId: ORG_ID,
      memoryType: 'session',
      content: 'Test memory content',
    });
    expect(entry).toHaveProperty('entryId');
    expect(entry).toHaveProperty('conversationId');
    expect(entry).toHaveProperty('organizationId');
    expect(entry).toHaveProperty('memoryType');
    expect(entry.entryId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // orchestrateRetrieval output has combined fields
    mockDbAll.mockResolvedValue([]);
    const result = await orchestrateRetrieval({
      conversationId: CONVERSATION_ID,
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      consumerClass: 'chat',
      query: 'Test',
      searchPreset: 'workspace_broad',
    });
    expect(result).toHaveProperty('requestId');
    expect(result).toHaveProperty('retrievalResults');
    expect(result).toHaveProperty('workingMemoryResults');
    expect(result).toHaveProperty('mergedTrustClass');
    expect(result).toHaveProperty('budgetUsed');
    expect(Array.isArray(result.retrievalResults)).toBe(true);
    expect(Array.isArray(result.workingMemoryResults)).toBe(true);
  });
});
