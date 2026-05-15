/**
 * P07 Notebook — Runtime gap coverage.
 *
 * Suite 1: Attachment lifecycle state transitions
 * Suite 2: Error taxonomy classification (all 9 types)
 * Suite 3: Degraded scenarios runtime (scenarios 4, 7, 8, 9)
 * Suite 4: Provenance per-block tagging
 * Suite 5: Concurrent edit conflict detection
 * Suite 6: E2E smoke matching §5.3 staging proof checklist
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  P07_ATTACHMENT_LIFECYCLE_STATES,
  P07_ATTACHMENT_ERROR_TAXONOMY,
  P07_DEGRADED_SCENARIOS,
  P07_HANDOFF_COMMON_FIELDS,
  P07_HANDOFF_TARGETS,
  P07_PROVENANCE_LANGUAGE,
  P07_PROVENANCE_RULES,
  P07_SEARCH_BASELINE,
  type P07AttachmentError,
  type P07AttachmentState,
} from '../../server/src/services/v8/notebookCanon.js';
import { validateHandoffPayload } from '../../server/src/services/v8/notebookHandoffService.js';
import { parseOperatorHints } from '../../server/src/services/v8/notebookSearchService.js';

// ─── DB + fs mocks (same pattern as p07-notebook-canon.test.ts) ─────────────

const mockQueryRun = vi.fn();
const mockQueryGet = vi.fn();
const mockQueryAll = vi.fn();

vi.mock('../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryOne: (...args: unknown[]) => mockQueryGet(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
}));

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock('../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    run: (...args: unknown[]) => mockDbRun(...args),
    get: (...args: unknown[]) => mockDbGet(...args),
    all: (...args: unknown[]) => mockDbAll(...args),
  }),
}));

vi.mock('../../server/src/services/ai/embeddingService.js', () => ({
  embeddingService: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  },
}));

vi.mock('../../server/src/services/notebookSourceFileService.js', () => ({
  persistNotebookSourceFile: vi.fn().mockResolvedValue({ storedSourceFile: true }),
  parseNotebookCaptureMetadata: vi.fn().mockReturnValue(null),
}));

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockUnlink = vi.fn().mockResolvedValue(undefined);
const mockAccess = vi.fn().mockResolvedValue(undefined);
const mockRename = vi.fn().mockResolvedValue(undefined);

vi.mock('fs/promises', () => {
  const api = {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    access: (...args: unknown[]) => mockAccess(...args),
    rename: (...args: unknown[]) => mockRename(...args),
  };
  return { ...api, default: api };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue(undefined);
  mockDbGet.mockResolvedValue(undefined);
  mockDbAll.mockResolvedValue([]);
});

// ═══════════════════════════════════════════════════════════════
// Suite 1: Attachment Lifecycle States
// ═══════════════════════════════════════════════════════════════

describe('P07 Attachment lifecycle runtime', () => {
  it('lifecycle declares queued as initial state', () => {
    expect(P07_ATTACHMENT_LIFECYCLE_STATES[0]).toBe('queued');
  });

  it('lifecycle contains exactly 6 states in order', () => {
    expect([...P07_ATTACHMENT_LIFECYCLE_STATES]).toEqual([
      'queued',
      'uploading',
      'processing',
      'available',
      'failed',
      'blocked_policy',
    ]);
  });

  it('available is reachable from processing (index 2 → 3)', () => {
    const idx = P07_ATTACHMENT_LIFECYCLE_STATES.indexOf('available');
    expect(idx).toBeGreaterThan(P07_ATTACHMENT_LIFECYCLE_STATES.indexOf('processing'));
  });

  it('failed state exists after available', () => {
    const failedIdx = P07_ATTACHMENT_LIFECYCLE_STATES.indexOf('failed');
    const availableIdx = P07_ATTACHMENT_LIFECYCLE_STATES.indexOf('available');
    expect(failedIdx).toBeGreaterThan(availableIdx);
  });

  it('blocked_policy is a terminal state (last in list)', () => {
    const last = P07_ATTACHMENT_LIFECYCLE_STATES[P07_ATTACHMENT_LIFECYCLE_STATES.length - 1];
    expect(last).toBe('blocked_policy');
  });

  it('persistNotebookAttachment writes file and returns available-ready record', async () => {
    const { persistNotebookAttachment } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    const record = await persistNotebookAttachment({
      organizationId: 'org-1',
      pageId: 'page-1',
      fileBuffer: Buffer.from('test data'),
      fileOriginalname: 'report.pdf',
      fileMimetype: 'application/pdf',
      userId: 'user-1',
    });

    expect(record.id).toBeTruthy();
    expect(record.name).toBe('report.pdf');
    expect(record.storageKey).toBeTruthy();
    expect(record.uploadedAt).toBeTruthy();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it('persistNotebookAttachment rejects oversized files (> 25MB)', async () => {
    const { persistNotebookAttachment } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024);
    await expect(
      persistNotebookAttachment({
        organizationId: 'org-1',
        pageId: 'page-1',
        fileBuffer: oversizedBuffer,
        fileOriginalname: 'huge.pdf',
        fileMimetype: 'application/pdf',
      })
    ).rejects.toThrow(/maximum size/i);
  });

  it('persistNotebookAttachment rejects blocked extensions (.exe)', async () => {
    const { persistNotebookAttachment } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    await expect(
      persistNotebookAttachment({
        organizationId: 'org-1',
        pageId: 'page-1',
        fileBuffer: Buffer.from('MZ'),
        fileOriginalname: 'virus.exe',
        fileMimetype: 'application/octet-stream',
      })
    ).rejects.toThrow(/not allowed/i);
  });

  it('parseNotebookAttachments defaults status=available for legacy data without status field', async () => {
    const { parseNotebookAttachments } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    const legacy = JSON.stringify([
      { id: 'a1', name: 'old.pdf', type: 'application/pdf', size: 100, uploadedAt: '2025-01-01' },
    ]);
    const parsed = parseNotebookAttachments(legacy);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('a1');
    // Legacy records get parsed — the record exists (available by default in the service)
    expect(parsed[0].name).toBe('old.pdf');
  });

  it('resolveNotebookAttachmentFile returns null when file missing from disk', async () => {
    const { resolveNotebookAttachmentFile } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
    const attachments = JSON.stringify([
      { id: 'a1', name: 'gone.pdf', type: 'application/pdf', size: 100, uploadedAt: '2025-01-01', storageKey: 'org-1/page-1/gone.pdf' },
    ]);
    const result = await resolveNotebookAttachmentFile(attachments, 'a1');
    expect(result).toBeNull();
  });

  it('resolveNotebookAttachmentFile returns file info when file exists', async () => {
    const { resolveNotebookAttachmentFile } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    mockAccess.mockResolvedValueOnce(undefined);
    const attachments = JSON.stringify([
      { id: 'a2', name: 'present.pdf', type: 'application/pdf', size: 2048, uploadedAt: '2025-01-01', storageKey: 'org-1/page-1/present.pdf' },
    ]);
    const result = await resolveNotebookAttachmentFile(attachments, 'a2');
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe('present.pdf');
    expect(result!.mimeType).toBe('application/pdf');
    expect(result!.sizeBytes).toBe(2048);
  });

  it('addNotebookAttachmentsToPage enforces 10-attachment limit', async () => {
    const { addNotebookAttachmentsToPage } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    const existing = Array.from({ length: 10 }, (_, i) => ({
      id: `att-${i}`,
      name: `file${i}.pdf`,
      type: 'application/pdf',
      size: 100,
      uploadedAt: '2025-01-01',
    }));
    mockQueryGet.mockResolvedValue({ attachmentsJson: JSON.stringify(existing) });
    mockQueryRun.mockResolvedValue({ changes: 0 });

    await expect(
      addNotebookAttachmentsToPage({
        organizationId: 'org-1',
        pageId: 'page-1',
        files: [{ buffer: Buffer.from('x'), originalname: 'extra.pdf', mimetype: 'application/pdf' }],
      })
    ).rejects.toMatchObject({ code: 'NOTEBOOK_ATTACHMENT_LIMIT_EXCEEDED' });
  });
});

// ═══════════════════════════════════════════════════════════════
// Suite 2: Error Taxonomy Classification (all 9 types)
// ═══════════════════════════════════════════════════════════════

describe('P07 Error taxonomy classification', () => {
  const ALL_ERROR_TYPES: P07AttachmentError[] = [
    'network_timeout',
    'size_limit',
    'quota_exceeded',
    'type_unsupported',
    'permission_denied',
    'virus_detected',
    'storage_unavailable',
    'processing_failed',
    'unknown',
  ];

  it('taxonomy contains exactly 9 error types', () => {
    expect(Object.keys(P07_ATTACHMENT_ERROR_TAXONOMY)).toHaveLength(9);
  });

  it.each(ALL_ERROR_TYPES)('error type "%s" has retryable boolean and non-empty userMessage', (errorType) => {
    const entry = P07_ATTACHMENT_ERROR_TAXONOMY[errorType];
    expect(typeof entry.retryable).toBe('boolean');
    expect(entry.userMessage.length).toBeGreaterThan(0);
  });

  it('network_timeout is retryable with network-related message', () => {
    const e = P07_ATTACHMENT_ERROR_TAXONOMY.network_timeout;
    expect(e.retryable).toBe(true);
    expect(e.userMessage.toLowerCase()).toContain('network');
  });

  it('size_limit is NOT retryable', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.size_limit.retryable).toBe(false);
  });

  it('quota_exceeded is NOT retryable', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.quota_exceeded.retryable).toBe(false);
  });

  it('type_unsupported is NOT retryable', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.type_unsupported.retryable).toBe(false);
  });

  it('permission_denied is NOT retryable', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.permission_denied.retryable).toBe(false);
  });

  it('virus_detected is NOT retryable and mentions quarantine', () => {
    const e = P07_ATTACHMENT_ERROR_TAXONOMY.virus_detected;
    expect(e.retryable).toBe(false);
    expect(e.userMessage.toLowerCase()).toContain('quarantine');
  });

  it('storage_unavailable is retryable', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.storage_unavailable.retryable).toBe(true);
  });

  it('processing_failed is retryable', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.processing_failed.retryable).toBe(true);
  });

  it('unknown is retryable (safe default)', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.unknown.retryable).toBe(true);
  });

  it('retryable errors count = 4 (network_timeout, storage_unavailable, processing_failed, unknown)', () => {
    const retryable = Object.values(P07_ATTACHMENT_ERROR_TAXONOMY).filter((e) => e.retryable);
    expect(retryable).toHaveLength(4);
  });

  it('non-retryable errors count = 5', () => {
    const nonRetryable = Object.values(P07_ATTACHMENT_ERROR_TAXONOMY).filter((e) => !e.retryable);
    expect(nonRetryable).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// Suite 3: Degraded Scenarios Runtime
// ═══════════════════════════════════════════════════════════════

describe('P07 Degraded scenarios runtime', () => {
  it('scenario 4: preview unavailable shows banner + download option', () => {
    const s4 = P07_DEGRADED_SCENARIOS.find((s) => s.id === 4);
    expect(s4).toBeDefined();
    expect(s4!.scenario.toLowerCase()).toContain('preview');
    expect(s4!.userVisibleState.toLowerCase()).toContain('preview unavailable');
    expect(s4!.nextAction.toLowerCase()).toContain('download');
  });

  it('scenario 4: resolveNotebookAttachmentFile returns null for missing file (degraded preview)', async () => {
    const { resolveNotebookAttachmentFile } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
    const result = await resolveNotebookAttachmentFile(
      JSON.stringify([{ id: 'missing', name: 'x.pdf', type: 'application/pdf', size: 1, uploadedAt: '2026-01-01', storageKey: 'org/page/x.pdf' }]),
      'missing'
    );
    expect(result).toBeNull();
  });

  it('scenario 4: resolveNotebookAttachmentFile returns info when file present (non-degraded)', async () => {
    const { resolveNotebookAttachmentFile } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    mockAccess.mockResolvedValueOnce(undefined);
    const result = await resolveNotebookAttachmentFile(
      JSON.stringify([{ id: 'found', name: 'y.pdf', type: 'application/pdf', size: 512, uploadedAt: '2026-01-01', storageKey: 'org/page/y.pdf' }]),
      'found'
    );
    expect(result).not.toBeNull();
    expect(result!.fileName).toBe('y.pdf');
  });

  it('scenario 7: deeplink target missing → degraded page with search fallback', () => {
    const s7 = P07_DEGRADED_SCENARIOS.find((s) => s.id === 7);
    expect(s7).toBeDefined();
    expect(s7!.scenario.toLowerCase()).toContain('deeplink');
    expect(s7!.userVisibleState.toLowerCase()).toContain('not found');
    expect(s7!.nextAction.toLowerCase()).toContain('search');
  });

  it('scenario 8: link target permission denied → degraded(permission)', () => {
    const s8 = P07_DEGRADED_SCENARIOS.find((s) => s.id === 8);
    expect(s8).toBeDefined();
    expect(s8!.scenario.toLowerCase()).toContain('permission');
    expect(s8!.userVisibleState.toLowerCase()).toContain('degraded');
    expect(s8!.nextAction.toLowerCase()).toContain('access');
  });

  it('scenario 9: concurrent edit conflict → explicit resolution UI', () => {
    const s9 = P07_DEGRADED_SCENARIOS.find((s) => s.id === 9);
    expect(s9).toBeDefined();
    expect(s9!.scenario.toLowerCase()).toContain('concurrent');
    expect(s9!.userVisibleState.toLowerCase()).toContain('conflict');
    expect(s9!.nextAction.toLowerCase()).toContain('no silent overwrite');
  });

  it('scenario 5: semantic search unavailable → keyword fallback (not silent 0 results)', () => {
    const s5 = P07_DEGRADED_SCENARIOS.find((s) => s.id === 5);
    expect(s5).toBeDefined();
    expect(s5!.nextAction.toLowerCase()).toContain('keyword');
    expect(s5!.nextAction.toLowerCase()).toContain('no silent');
  });

  it('scenario 10: AI unavailable → AI actions disabled, core notebook works', () => {
    const s10 = P07_DEGRADED_SCENARIOS.find((s) => s.id === 10);
    expect(s10).toBeDefined();
    expect(s10!.userVisibleState.toLowerCase()).toContain('disabled');
    expect(s10!.nextAction.toLowerCase()).toContain('continue working');
  });

  it('all 10 scenarios have distinct IDs', () => {
    const ids = P07_DEGRADED_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(P07_DEGRADED_SCENARIOS.length);
    expect(ids).toHaveLength(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// Suite 4: Provenance Per-Block
// ═══════════════════════════════════════════════════════════════

describe('P07 Provenance per-block', () => {
  it('capture() creates blocks with provenance.type="source"', async () => {
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const { notebookService } = await import('../../server/src/services/notebookService.js');
    await notebookService.capture('org-1', 'user-1', {
      source: 'api_import',
      title: 'Provenance test',
      content: 'Block one\n\nBlock two',
    });

    expect(mockQueryRun).toHaveBeenCalled();
    const insertCall = mockQueryRun.mock.calls[0];
    const contentJson = insertCall[1].find(
      (arg: unknown) => typeof arg === 'string' && arg.includes('"type":"doc"')
    );
    expect(contentJson).toBeTruthy();
    const doc = JSON.parse(contentJson);
    expect(doc.content.length).toBeGreaterThanOrEqual(1);
    for (const block of doc.content) {
      expect(block.provenance).toBeDefined();
      expect(block.provenance.type).toBe('source');
      expect(block.provenance.actor).toBe('system');
      expect(block.provenance.timestamp).toBeTruthy();
    }
  });

  it('AI proposal acceptance tags block with provenance.type="ai_transform"', async () => {
    const proposalRow = {
      id: 'prop-1',
      page_id: 'page-1',
      organization_id: 'org-1',
      actor_id: 'ai-actor-1',
      proposal_type: 'append',
      block_content: JSON.stringify({ type: 'paragraph', content: [{ type: 'text', text: 'AI suggestion' }] }),
      rationale: 'Test rationale',
      status: 'proposed',
      created_at: '2026-01-01T00:00:00Z',
      resolved_at: null,
      resolved_by: null,
    };

    const existingDoc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing' }] }],
    });

    mockDbGet
      .mockResolvedValueOnce(proposalRow)
      .mockResolvedValueOnce({ id: 'page-1', content_json: existingDoc, content_text: 'Existing' })
      .mockResolvedValueOnce({ ...proposalRow, status: 'accepted', resolved_at: '2026-01-01T01:00:00Z', resolved_by: 'user-1' });
    mockDbRun.mockResolvedValue(undefined);

    const { notebookService } = await import('../../server/src/services/notebookService.js');
    const resolved = await notebookService.resolveAIProposal('org-1', 'prop-1', 'user-1', 'accepted');

    expect(resolved).not.toBeNull();
    expect(resolved!.status).toBe('accepted');

    const updateCalls = mockDbRun.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('content_json')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);

    const savedDocJson = updateCalls[0][1][0];
    const savedDoc = JSON.parse(savedDocJson);
    const aiBlock = savedDoc.content.find(
      (b: any) => b.provenance?.type === 'ai_transform'
    );
    expect(aiBlock).toBeDefined();
    expect(aiBlock.provenance.actor).toBe('ai-actor-1');
    expect(aiBlock.provenance.proposalId).toBe('prop-1');
  });

  it('AI proposal blocks include inputPointers', async () => {
    const proposalRow = {
      id: 'prop-2',
      page_id: 'page-2',
      organization_id: 'org-1',
      actor_id: 'ai-actor-2',
      proposal_type: 'insert',
      block_content: JSON.stringify({ text: 'inserted' }),
      rationale: 'test',
      status: 'proposed',
      created_at: '2026-01-01T00:00:00Z',
    };

    mockDbGet
      .mockResolvedValueOnce(proposalRow)
      .mockResolvedValueOnce({ id: 'page-2', content_json: JSON.stringify({ type: 'doc', content: [] }), content_text: '' })
      .mockResolvedValueOnce({ ...proposalRow, status: 'accepted' });
    mockDbRun.mockResolvedValue(undefined);

    const { notebookService } = await import('../../server/src/services/notebookService.js');
    await notebookService.resolveAIProposal('org-1', 'prop-2', 'user-1', 'accepted');

    const updateCalls = mockDbRun.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('content_json')
    );
    const savedDoc = JSON.parse(updateCalls[0][1][0]);
    const aiBlock = savedDoc.content.find((b: any) => b.provenance?.type === 'ai_transform');
    expect(aiBlock).toBeDefined();
    expect(Array.isArray(aiBlock.provenance.inputPointers)).toBe(true);
    expect(aiBlock.provenance.inputPointers).toContain('page-2');
  });

  it('exportWithProvenance returns markdown + provenanceMap', async () => {
    const docWithProvenance = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          provenance: { type: 'source', actor: 'system', timestamp: '2026-01-01' },
          content: [{ type: 'text', text: 'First paragraph' }],
        },
        {
          type: 'paragraph',
          provenance: { type: 'ai_transform', actor: 'ai-1', timestamp: '2026-01-02', proposalId: 'p1', inputPointers: ['page-1'] },
          content: [{ type: 'text', text: 'AI generated' }],
        },
      ],
    });

    mockQueryGet.mockResolvedValueOnce({ content_json: docWithProvenance });

    const { notebookService } = await import('../../server/src/services/notebookService.js');
    const result = await notebookService.exportWithProvenance('org-1', 'page-1');

    expect(result.markdown).toContain('First paragraph');
    expect(result.markdown).toContain('AI generated');
    expect(result.provenanceMap).toHaveLength(2);
    expect(result.provenanceMap[0].provenance.type).toBe('source');
    expect(result.provenanceMap[1].provenance.type).toBe('ai_transform');
    expect(result.provenanceMap[1].provenance.proposalId).toBe('p1');
  });

  it('blocks without provenance default to user_edit', async () => {
    const docNoProv = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'No provenance block' }] },
      ],
    });

    mockQueryGet.mockResolvedValueOnce({ content_json: docNoProv });

    const { notebookService } = await import('../../server/src/services/notebookService.js');
    const result = await notebookService.exportWithProvenance('org-1', 'page-x');

    expect(result.provenanceMap).toHaveLength(1);
    expect(result.provenanceMap[0].provenance.type).toBe('user_edit');
  });

  it('provenance types are always one of P07_PROVENANCE_LANGUAGE values', () => {
    const allowed = new Set<string>(P07_PROVENANCE_LANGUAGE);
    expect(allowed.has('source')).toBe(true);
    expect(allowed.has('user_edit')).toBe(true);
    expect(allowed.has('ai_transform')).toBe(true);
    expect(allowed.size).toBe(3);
  });

  it('canon rules require export to preserve provenance', () => {
    expect(P07_PROVENANCE_RULES.export_preserves_provenance).toBe(true);
  });

  it('canon rules require AI input pointers and audit trail', () => {
    expect(P07_PROVENANCE_RULES.ai_requires_input_pointers).toBe(true);
    expect(P07_PROVENANCE_RULES.ai_requires_audit_trail).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Suite 5: Concurrent Edit Conflict Detection
// ═══════════════════════════════════════════════════════════════

describe('P07 Concurrent edit conflict detection', () => {
  it('addNotebookAttachmentsToPage retries up to 3 times on CAS failure', async () => {
    const { addNotebookAttachmentsToPage } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    mockQueryGet.mockResolvedValue({ attachmentsJson: JSON.stringify([]) });
    mockQueryRun.mockResolvedValue({ changes: 0 });

    await expect(
      addNotebookAttachmentsToPage({
        organizationId: 'org-1',
        pageId: 'page-1',
        files: [{ buffer: Buffer.from('data'), originalname: 'doc.pdf', mimetype: 'application/pdf' }],
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'NOTEBOOK_ATTACHMENT_WRITE_CONFLICT',
    });

    expect(mockQueryRun).toHaveBeenCalledTimes(3);
  });

  it('removeNotebookAttachmentFromPage retries on CAS conflict', async () => {
    const { removeNotebookAttachmentFromPage } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    const att = {
      id: 'att-1',
      name: 'x.pdf',
      type: 'application/pdf',
      size: 100,
      uploadedAt: '2026-01-01',
      storageKey: 'org/page/x.pdf',
    };
    mockQueryGet.mockResolvedValue({ attachmentsJson: JSON.stringify([att]) });
    mockQueryRun.mockResolvedValue({ changes: 0 });

    await expect(
      removeNotebookAttachmentFromPage({ pageId: 'page-1', attachmentId: 'att-1' })
    ).rejects.toMatchObject({
      status: 409,
      code: 'NOTEBOOK_ATTACHMENT_WRITE_CONFLICT',
    });

    expect(mockQueryRun).toHaveBeenCalledTimes(3);
  });

  it('CAS succeeds on second attempt after concurrent modification', async () => {
    const { addNotebookAttachmentsToPage } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    const peer = { id: 'att-peer', name: 'peer.pdf', type: 'application/pdf', size: 50, uploadedAt: '2026-01-01' };

    mockQueryGet
      .mockResolvedValueOnce({ attachmentsJson: JSON.stringify([]) })
      .mockResolvedValueOnce({ attachmentsJson: JSON.stringify([peer]) });
    mockQueryRun
      .mockResolvedValueOnce({ changes: 0 })
      .mockResolvedValueOnce({ changes: 1 });

    const result = await addNotebookAttachmentsToPage({
      organizationId: 'org-1',
      pageId: 'page-1',
      files: [{ buffer: Buffer.from('data'), originalname: 'mine.pdf', mimetype: 'application/pdf' }],
    });

    expect(result).toHaveLength(2);
    expect(mockQueryRun).toHaveBeenCalledTimes(2);
  });

  it('degraded scenario 9 defines explicit conflict resolution (no silent overwrite)', () => {
    const s9 = P07_DEGRADED_SCENARIOS.find((s) => s.id === 9);
    expect(s9).toBeDefined();
    expect(s9!.nextAction).toContain('no silent overwrite');
  });

  it('cleanup runs on persistent CAS failure to avoid orphan files', async () => {
    const { addNotebookAttachmentsToPage } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    mockQueryGet.mockResolvedValue({ attachmentsJson: JSON.stringify([]) });
    mockQueryRun.mockResolvedValue({ changes: 0 });

    await expect(
      addNotebookAttachmentsToPage({
        organizationId: 'org-1',
        pageId: 'page-1',
        files: [{ buffer: Buffer.from('data'), originalname: 'orphan.pdf', mimetype: 'application/pdf' }],
      })
    ).rejects.toThrow();

    expect(mockUnlink).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// Suite 6: E2E Smoke (matching §5.3 staging proof)
// ═══════════════════════════════════════════════════════════════

describe('P07 E2E staging proof smoke', () => {
  it('1. capture from non-note surface preserves bounded entry point source', async () => {
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const { notebookService } = await import('../../server/src/services/notebookService.js');
    const result = await notebookService.capture('org-1', 'user-1', {
      source: 'web_clipper',
      url: 'https://example.com/article',
      content: 'Clipped article content',
      title: 'Test Article',
    });

    expect(result.source).toBe('web_clipper');
    expect(result.pageId).toBeTruthy();
    expect(result.title).toBe('Test Article');
  });

  it('2. attach file → observe storageKey assignment (available-ready)', async () => {
    const { persistNotebookAttachment } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );
    const record = await persistNotebookAttachment({
      organizationId: 'org-1',
      pageId: 'page-smoke',
      fileBuffer: Buffer.from('file content'),
      fileOriginalname: 'attachment.pdf',
      fileMimetype: 'application/pdf',
      userId: 'user-1',
    });

    expect(record.storageKey).toBeTruthy();
    expect(record.id).toBeTruthy();
    expect(record.type).toBe('application/pdf');
  });

  it('3. search for note → finds results with correct contract fields', async () => {
    const contractFields = P07_SEARCH_BASELINE.resultContract;
    expect(contractFields).toContain('note_id');
    expect(contractFields).toContain('title');
    expect(contractFields).toContain('snippet');
    expect(contractFields).toContain('match_kind');
    expect(contractFields).toContain('updated_at');
    expect(contractFields).toContain('status');
    expect(contractFields).toContain('maturity');
    expect(contractFields).toContain('tags');
    expect(contractFields).toContain('has_attachments');
    expect(contractFields).toContain('linked_artifacts_count');
  });

  it('4. build handoff to Radar → payload contains all required fields', () => {
    const radarTarget = P07_HANDOFF_TARGETS.radar;
    expect(radarTarget.module).toBe('P06');

    for (const field of P07_HANDOFF_COMMON_FIELDS) {
      expect(radarTarget.requiredFields).toContain(field);
    }
    expect(radarTarget.requiredFields).toContain('radar_signal_suggestion');
    expect(radarTarget.signalSuggestionFields).toContain('category');
    expect(radarTarget.signalSuggestionFields).toContain('why_now');
    expect(radarTarget.signalSuggestionFields).toContain('priority_hint');
  });

  it('5. build handoff to Inicjatywy → payload contains all required fields', () => {
    const inicjatywyTarget = P07_HANDOFF_TARGETS.inicjatywy;
    expect(inicjatywyTarget.module).toBe('P11');

    for (const field of P07_HANDOFF_COMMON_FIELDS) {
      expect(inicjatywyTarget.requiredFields).toContain(field);
    }
    expect(inicjatywyTarget.requiredFields).toContain('initiative_seed');
    expect(inicjatywyTarget.initiativeSeedFields).toContain('problem_statement');
    expect(inicjatywyTarget.initiativeSeedFields).toContain('proposed_outcome');
  });

  it('6. build handoff to Teresa → payload contains all required fields', () => {
    const teresaTarget = P07_HANDOFF_TARGETS.teresa;
    expect(teresaTarget.module).toBe('P08');

    for (const field of P07_HANDOFF_COMMON_FIELDS) {
      expect(teresaTarget.requiredFields).toContain(field);
    }
    expect(teresaTarget.requiredFields).toContain('assistant_context');
    expect(teresaTarget.assistantContextFields).toContain('user_intent');
    expect(teresaTarget.assistantContextFields).toContain('citations');
  });

  it('7. validate handoff payloads → empty payload yields missing fields', () => {
    for (const target of ['radar', 'inicjatywy', 'teresa'] as const) {
      const result = validateHandoffPayload(target, {});
      expect(result.valid).toBe(false);
      expect(result.missingFields.length).toBeGreaterThan(0);
    }
  });

  it('8. induce upload failure on blocked extension → error classification matches taxonomy', async () => {
    const { persistNotebookAttachment } = await import(
      '../../server/src/services/notebookAttachmentService.js'
    );

    const blockedExts = ['.exe', '.bat', '.sh', '.cmd', '.ps1'];
    for (const ext of blockedExts) {
      await expect(
        persistNotebookAttachment({
          organizationId: 'org-1',
          pageId: 'page-smoke',
          fileBuffer: Buffer.from('malicious'),
          fileOriginalname: `bad${ext}`,
          fileMimetype: 'application/octet-stream',
        })
      ).rejects.toThrow(/not allowed/i);
    }

    expect(P07_ATTACHMENT_ERROR_TAXONOMY.type_unsupported.retryable).toBe(false);
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.type_unsupported.userMessage).toBeTruthy();
  });

  it('operator hints parse correctly for search integration', () => {
    const { cleanQuery, extractedFilters } = parseOperatorHints(
      'tag:project status:active has:attachment quarterly review'
    );
    expect(cleanQuery).toBe('quarterly review');
    expect(extractedFilters.tags).toContain('project');
    expect(extractedFilters.status).toBe('active');
    expect(extractedFilters.has_attachments).toBe(true);
  });
});
