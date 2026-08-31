import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const retrieveContext = vi.fn();
const ragSearch = vi.fn();
const processPipeline = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({ all: dbAll, get: dbGet, run: dbRun }));
vi.mock('../../services/organizationContext/ContextRetrievalService.js', () => ({
  isValidContextWorkflowMode: () => true,
  retrieveContext,
  recordContextRetrievalLineage: vi.fn(),
}));
vi.mock('../../services/ragService.js', () => ({
  default: { searchRelevantChunks: ragSearch },
  searchRelevantChunks: ragSearch,
}));
vi.mock('../../services/ai/AIPipeline.js', () => ({
  AIPipeline: class {
    process = processPipeline;
  },
}));
vi.mock('../../services/accessPolicyService.js', () => ({
  default: {
    getAIAccessContext: vi.fn(async () => ({ allowed: true })),
    checkAccess: vi.fn(async () => ({ allowed: true })),
    incrementUsage: vi.fn(async () => undefined),
  },
}));

const CONFIDENTIAL_DOC_ID = 'day132_r23_confidential_proof';
const CONFIDENTIAL_CONTENT = 'DAY132 ROUTE CONFIDENTIAL CONTENT';
const CONFIDENTIAL_FILENAME = 'day132-secret-acquisition-target.txt';

async function invokeChatStream() {
  const { default: router } = await import('../ai.routes.js');
  const layer = (router as any).stack.find((entry: any) => entry.route?.path === '/chat/stream');
  const handler = layer.route.stack[layer.route.stack.length - 1].handle;
  const writes: string[] = [];
  const req: any = {
    body: {
      message: 'Summarize the attachment',
      history: [],
      conversationId: 'day132-conversation',
      context: {
        attachmentDocIds: [CONFIDENTIAL_DOC_ID],
        attachments: [
          {
            docId: CONFIDENTIAL_DOC_ID,
            filename: CONFIDENTIAL_FILENAME,
            sensitivity: 'confidential',
          },
        ],
      },
      aiModes: {},
      knowledgeSources: {},
    },
    userId: 'day132-user',
    organizationId: 'day132-org',
    user: { id: 'day132-user', role: 'MEMBER', organizationId: 'day132-org' },
    userRole: 'MEMBER',
    headers: {},
    protocol: 'http',
    socket: {
      remoteAddress: '127.0.0.1',
      setTimeout: vi.fn(),
      setNoDelay: vi.fn(),
      setKeepAlive: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    get: () => undefined,
    on: vi.fn(),
    removeListener: vi.fn(),
  };
  const res: any = {
    destroyed: false,
    headersSent: false,
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    write: vi.fn((value: unknown) => {
      writes.push(String(value));
      return true;
    }),
    end: vi.fn(() => res),
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  const next = vi.fn((error?: unknown) => {
    if (error) throw error;
  });

  await handler(req, res, next);
  if (processPipeline.mock.calls.length !== 1) {
    throw new Error(
      JSON.stringify({
        pipelineCalls: processPipeline.mock.calls.length,
        writes,
        statusCalls: res.status.mock.calls,
        jsonCalls: res.json.mock.calls,
        nextCalls: next.mock.calls,
      })
    );
  }
  return { request: processPipeline.mock.calls[0][0], writes };
}

describe('Day 132 R2/R3 — AI chat attachment confidentiality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGet.mockImplementation(async (sql: string) =>
      sql.includes('FROM llm_providers') ? { ok: 1 } : null
    );
    dbRun.mockResolvedValue({ changes: 0 });
    dbAll.mockResolvedValue([]);
    processPipeline.mockResolvedValue({
      success: false,
      error: { code: 'DAY132_CAPTURE_ONLY', message: 'captured before provider start' },
    });
  });

  it('R2 keeps confidential raw fallback content out when E1 fails', async () => {
    retrieveContext.mockRejectedValue(new Error('day132 forced E1 failure'));
    ragSearch.mockResolvedValue([
      { source: CONFIDENTIAL_FILENAME, content: CONFIDENTIAL_CONTENT, chunkIndex: 0 },
    ]);
    dbAll.mockImplementation(async (sql: string) =>
      sql.includes('FROM knowledge_chunks')
        ? [{ filename: CONFIDENTIAL_FILENAME, content: CONFIDENTIAL_CONTENT }]
        : []
    );

    const { request, writes } = await invokeChatStream();
    const instruction = String(request?.options?.systemInstruction || '');
    expect(instruction).not.toContain(CONFIDENTIAL_CONTENT);
    expect(JSON.stringify(request)).not.toContain(CONFIDENTIAL_CONTENT);
    expect(writes.join('\n')).not.toContain(CONFIDENTIAL_CONTENT);
    expect(ragSearch).not.toHaveBeenCalled();
  });

  it('R3 omits confidential metadata names when governance allows no attachment', async () => {
    retrieveContext.mockResolvedValue({
      selectedDocumentIds: [],
      excludedReasons: [
        {
          documentId: CONFIDENTIAL_DOC_ID,
          reason: 'document_confidentiality_governance_blocked',
        },
      ],
      chunks: [],
    });
    ragSearch.mockResolvedValue([]);

    const { request, writes } = await invokeChatStream();
    const instruction = String(request?.options?.systemInstruction || '');
    expect(instruction).not.toContain(CONFIDENTIAL_FILENAME);
    expect(writes.join('\n')).not.toContain(CONFIDENTIAL_FILENAME);
    expect(instruction).not.toContain('## ATTACHMENTS (metadata only)');
  });
});
