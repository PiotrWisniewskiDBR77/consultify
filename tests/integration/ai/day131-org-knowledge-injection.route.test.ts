/**
 * Day 131 — naprawa po odrzuceniu (N1 + N3).
 *
 * Ten test mierzy ZACHOWANIE, nie tekst źródłowy: uruchamia realny handler
 * POST /api/ai/chat/stream i przechwytuje żądanie przekazane do
 * `aiPipeline.process`. Jeżeli wstrzyknięcie bloku wiedzy organizacji zostanie
 * odcięte (np. zamiana `pipelineRequest = {` na martwą zmienną), ten test
 * MUSI zrobić się czerwony.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const pipelineCalls = vi.hoisted(() => [] as any[]);
const retrievalCalls = vi.hoisted(() => [] as any[]);

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { id: 'day131-user', organizationId: 'day131-org', role: 'ADMIN' };
      req.userId = 'day131-user';
      req.organizationId = 'day131-org';
      next();
    },
  };
});

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return { ...actual, aiRateLimiter: (_req: any, _res: any, next: any) => next() };
});

vi.mock('../../../server/src/middleware/auditsStrictMembership.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auditsStrictMembership.middleware.js'
  )) as any;
  return { ...actual, requireActiveTenantMembership: (_req: any, _res: any, next: any) => next() };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(async () => []),
  get: vi.fn(async (sql: string) => {
    const text = String(sql);
    if (/FROM organization_members/i.test(text)) return { status: 'ACTIVE' };
    // A configured LLM provider is a precondition of the chat handler; the pipeline
    // itself is mocked below, so no provider is ever contacted.
    if (/FROM llm_providers/i.test(text)) return { ok: 1 };
    return undefined;
  }),
  run: vi.fn(async () => ({})),
  default: {},
}));

// The access-policy gate resolves a real organization row; this suite is about the
// knowledge-injection behaviour that happens AFTER the gate, so the gate is opened.
vi.mock('../../../server/src/services/accessPolicyService.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/services/accessPolicyService.js'
  )) as any;
  const base = actual.default || actual;
  const patched = new Proxy(base, {
    get(target: any, prop: string | symbol) {
      if (prop === 'checkAccess') return async () => ({ allowed: true });
      return target[prop];
    },
  });
  return { ...actual, default: patched };
});

vi.mock('../../../server/src/services/organizationContext/ContextRetrievalService.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/services/organizationContext/ContextRetrievalService.js'
  )) as any;
  const retrieveContext = vi.fn(async (input: any) => {
    retrievalCalls.push(input);
    return {
      workflowMode: input.workflowMode,
      requestedDocumentIds: input.selectedDocumentIds || [],
      selectedDocumentIds: [],
      excludedDocumentIds: [],
      excludedReasons: [],
      documents: [],
      chunks: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-allowed',
          filename: 'strategia.pdf',
          content: 'ALLOWED-ORG-FACT-131',
          chunkIndex: 3,
          modality: 'document',
          sourceLocator: null,
          nativeSourceLocator: null,
          qualityFlags: [],
          confidence: null,
          relevance: 1,
        },
      ],
      degraded: false,
      degradedReasons: [],
      retrievalQuery: input.retrievalQuery || '',
      retrievalReason: input.retrievalReason || '',
      generatedAt: new Date().toISOString(),
    };
  });
  const recordContextRetrievalLineage = vi.fn(async () => undefined);
  const api = {
    ...actual,
    retrieveContext,
    recordContextRetrievalLineage,
    default: {
      ...(actual.default || {}),
      retrieveContext,
      recordContextRetrievalLineage,
      isValidContextWorkflowMode: actual.isValidContextWorkflowMode,
      normalizeContextWorkflowMode: actual.normalizeContextWorkflowMode,
      CONTEXT_WORKFLOW_MODES: actual.CONTEXT_WORKFLOW_MODES,
    },
  };
  return api;
});

vi.mock('../../../server/src/services/ai/AIPipeline.js', () => {
  class AIPipeline {
    async process(pipelineRequest: any) {
      pipelineCalls.push(pipelineRequest);
      return { success: true, content: 'ok', metadata: {} };
    }
  }
  return { AIPipeline, default: { AIPipeline } };
});

const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.ts');

const ORIGINAL_FLAG = process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL;
const ORIGINAL_E2E = process.env.E2E_MODE;

function makeApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/ai', aiRouter);
  return app;
}

async function callStream(context: Record<string, unknown>) {
  return request(makeApp())
    .post('/api/ai/chat/stream')
    .send({ message: 'Jaka jest nasza strategia?', history: [], context });
}

function lastSystemInstruction(): string {
  expect(pipelineCalls.length).toBeGreaterThan(0);
  const last = pipelineCalls[pipelineCalls.length - 1];
  return String(last?.options?.systemInstruction || '');
}

describe('Day 131 organization knowledge injection (behavioural)', () => {
  beforeEach(() => {
    pipelineCalls.length = 0;
    retrievalCalls.length = 0;
    delete process.env.E2E_MODE;
  });

  afterAll(() => {
    if (ORIGINAL_FLAG === undefined) delete process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL;
    else process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL = ORIGINAL_FLAG;
    if (ORIGINAL_E2E === undefined) delete process.env.E2E_MODE;
    else process.env.E2E_MODE = ORIGINAL_E2E;
  });

  it('N1: with the flag on, retrieved organization knowledge reaches options.systemInstruction', async () => {
    process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL = 'true';

    await callStream({});

    const systemInstruction = lastSystemInstruction();
    expect(systemInstruction).toContain('## ORGANIZATION KNOWLEDGE');
    expect(systemInstruction).toContain('ALLOWED-ORG-FACT-131');
    expect(systemInstruction).toContain('strategia.pdf');
  });

  it('N1: with the flag off, no organization knowledge block is injected', async () => {
    process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL = 'false';

    await callStream({});

    expect(lastSystemInstruction()).not.toContain('## ORGANIZATION KNOWLEDGE');
    expect(
      retrievalCalls.some((call) => call.retrievalReason === 'ai_chat_organization_knowledge')
    ).toBe(false);
  });

  it('N3: an explicit selected_material_only choice is not widened by the flag (attachment path)', async () => {
    process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL = 'true';

    await callStream({
      attachmentDocIds: ['doc-attached'],
      contextWorkflowMode: 'selected_material_only',
    });

    const groundingCalls = retrievalCalls.filter(
      (call) => call.retrievalReason === 'ai_chat_attachment_grounding'
    );
    expect(groundingCalls.length).toBeGreaterThan(0);
    for (const call of groundingCalls) {
      expect(call.workflowMode).toBe('selected_material_only');
    }
    expect(lastSystemInstruction()).not.toContain('## ORGANIZATION KNOWLEDGE');
  });

  it('N3: with no explicit choice the flag may still supply the broader default (attachment path)', async () => {
    process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL = 'true';

    await callStream({ attachmentDocIds: ['doc-attached'] });

    const groundingCalls = retrievalCalls.filter(
      (call) => call.retrievalReason === 'ai_chat_attachment_grounding'
    );
    expect(groundingCalls.length).toBeGreaterThan(0);
    for (const call of groundingCalls) {
      expect(call.workflowMode).toBe('selected_material_plus_approved_org_context');
    }
    expect(lastSystemInstruction()).toContain('## ORGANIZATION KNOWLEDGE');
  });

  it('N3: an explicit narrowing choice also suppresses the attachment-free org sweep', async () => {
    process.env.ENABLE_ORG_KNOWLEDGE_RETRIEVAL = 'true';

    await callStream({ contextWorkflowMode: 'selected_material_only' });

    expect(
      retrievalCalls.some((call) => call.workflowMode === 'org_context_research_mode')
    ).toBe(false);
    expect(lastSystemInstruction()).not.toContain('## ORGANIZATION KNOWLEDGE');
  });
});
