/**
 * Day 131 — granice wiedzy organizacji dla Teresy (po naprawie odrzucenia).
 *
 * Ten plik mierzy WYŁĄCZNIE zachowanie. Poprzednia wersja czytała pliki źródłowe
 * i sprawdzała `toContain` na literałach — odcięcie wstrzyknięcia wiedzy w
 * ai.routes.ts zostawiało ją 4/4 zieloną. Testy tekstowe zostały usunięte;
 * ich twierdzenia pokrywa test behawioralny trasy
 * (tests/integration/ai/day131-org-knowledge-injection.route.test.ts) oraz
 * suita real-PG (tests/integration/ai/day131-teresa-knowledge-boundaries.realpg.test.ts).
 */
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

// Wymuszamy ścieżkę fallbackową (knowledge_chunks) — wektorowy hybridSearch nie
// jest przedmiotem tego testu.
vi.mock('../../../../server/src/services/ragService.js', () => ({
  default: {
    hybridSearch: vi.fn(async () => {
      throw new Error('rag disabled in this unit test');
    }),
  },
}));

import { filterDocumentsByVisibility } from '../../../../server/src/services/ai/documentGovernance.js';
import { retrieveContext } from '../../../../server/src/services/organizationContext/ContextRetrievalService.js';

const ORG = 'org-day131';
const DOC_ALLOWED = 'doc-allowed';
const DOC_BLOCKED = 'doc-blocked';
const DOC_CONFIDENTIAL = 'doc-confidential';

function docRow(id: string) {
  return {
    id,
    filename: `${id}.pdf`,
    status: 'ready',
    scope: 'project',
    project_id: 'project-1',
    owner_id: null,
    version: 1,
    created_at: '2026-08-29T00:00:00.000Z',
  };
}

/** Magazyn chunków celowo oddaje fragmenty WSZYSTKICH dokumentów, także zakazanych. */
function chunkRowsForAllDocs() {
  return [DOC_ALLOWED, DOC_BLOCKED, DOC_CONFIDENTIAL].map((id, index) => ({
    id: `chunk-${id}`,
    document_ref: id,
    doc_id: id,
    content: `TRESC-${id.toUpperCase()}`,
    chunk_index: index,
    metadata: '{}',
    filename: `${id}.pdf`,
  }));
}

function installOrgCorpusDb(options: { governanceFails?: boolean } = {}) {
  dbGet.mockResolvedValue(undefined);
  dbRun.mockResolvedValue(undefined);
  dbAll.mockImplementation(async (sql: string) => {
    const text = String(sql);
    if (/SELECT id, ai_visibility, sensitivity FROM knowledge_docs/i.test(text)) {
      if (options.governanceFails) throw new Error('governance table unavailable');
      return [
        { id: DOC_ALLOWED, ai_visibility: 'allowed', sensitivity: 'internal' },
        { id: DOC_BLOCKED, ai_visibility: 'blocked', sensitivity: 'internal' },
        { id: DOC_CONFIDENTIAL, ai_visibility: 'allowed', sensitivity: 'confidential' },
      ];
    }
    if (/FROM knowledge_docs/i.test(text) && /scope = 'project'/i.test(text)) {
      return [docRow(DOC_ALLOWED), docRow(DOC_BLOCKED), docRow(DOC_CONFIDENTIAL)];
    }
    if (/FROM knowledge_chunks/i.test(text)) {
      return chunkRowsForAllDocs();
    }
    return [];
  });
}

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

  it('org research retrieval drops blocked and confidential documents and keeps the allowed one', async () => {
    installOrgCorpusDb();

    const result = await retrieveContext({
      organizationId: ORG,
      userId: 'user-1',
      workflow: 'ai_chat',
      workflowMode: 'org_context_research_mode',
      retrievalQuery: 'strategia',
      retrievalReason: 'ai_chat_organization_knowledge',
      selectedDocumentIds: [],
      perDocumentChunkLimit: 5,
      totalChunkLimit: 12,
    });

    const documentIds = result.documents.map((doc) => doc.id);
    expect(documentIds).toEqual([DOC_ALLOWED]);

    const chunkDocumentIds = result.chunks.map((chunk) => chunk.documentId);
    expect(chunkDocumentIds).toEqual([DOC_ALLOWED]);

    const contents = result.chunks.map((chunk) => chunk.content).join('\n');
    expect(contents).toContain('TRESC-DOC-ALLOWED');
    expect(contents).not.toContain('TRESC-DOC-BLOCKED');
    expect(contents).not.toContain('TRESC-DOC-CONFIDENTIAL');
  });

  it('approved-org augmentation of the attachment path is governed by the same guard', async () => {
    installOrgCorpusDb();

    const result = await retrieveContext({
      organizationId: ORG,
      userId: 'user-1',
      workflow: 'ai_chat',
      workflowMode: 'selected_material_plus_approved_org_context',
      retrievalQuery: 'strategia',
      retrievalReason: 'ai_chat_attachment_grounding',
      selectedDocumentIds: [],
      perDocumentChunkLimit: 5,
      totalChunkLimit: 12,
    });

    const chunkDocumentIds = result.chunks.map((chunk) => chunk.documentId);
    expect(chunkDocumentIds).not.toContain(DOC_BLOCKED);
    expect(chunkDocumentIds).not.toContain(DOC_CONFIDENTIAL);
    expect(chunkDocumentIds).toContain(DOC_ALLOWED);
  });

  it('a failing confidentiality guard yields no organization context at all (fail-closed)', async () => {
    installOrgCorpusDb({ governanceFails: true });

    const result = await retrieveContext({
      organizationId: ORG,
      userId: 'user-1',
      workflow: 'ai_chat',
      workflowMode: 'org_context_research_mode',
      retrievalQuery: 'strategia',
      retrievalReason: 'ai_chat_organization_knowledge',
      selectedDocumentIds: [],
      perDocumentChunkLimit: 5,
      totalChunkLimit: 12,
    });

    expect(result.chunks).toEqual([]);
    expect(result.documents).toEqual([]);
  });
});
