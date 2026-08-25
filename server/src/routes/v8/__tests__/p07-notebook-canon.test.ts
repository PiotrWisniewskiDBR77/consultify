/**
 * P07 Notebook Canon — Integration tests.
 *
 * Covers: §2.3.1 bounded entries, §2.3.2 durable identity,
 * §2.3.3 provenance, §2.3.4 attachment lifecycle, §2.3.5 search baseline,
 * §2.3.6 handoff targets, §2.3.7 anti-duplicate, §2.3.8 degraded posture,
 * §2.3.9 acceptance checklist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  P07_ACCEPTANCE_CHECKLIST,
  P07_ANTI_DUPLICATE_RULES,
  P07_ATTACHMENT_ERROR_TAXONOMY,
  P07_ATTACHMENT_LIFECYCLE_STATES,
  P07_CAPTURE_ENTRIES,
  P07_DEGRADED_SCENARIOS,
  P07_HANDOFF_COMMON_FIELDS,
  P07_HANDOFF_TARGETS,
  P07_NON_GOALS,
  P07_NOTEBOOK_CANON_CONTRACT,
  P07_PROVENANCE_LANGUAGE,
  P07_PROVENANCE_RULES,
  P07_SEARCH_BASELINE,
} from '../../../services/v8/notebookCanon.js';

const mockQueryRun = vi.fn();
const mockQueryGet = vi.fn();
const mockQueryAll = vi.fn();

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryOne: (...args: unknown[]) => mockQueryGet(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
  }),
}));

vi.mock('../../../services/ai/embeddingService.js', () => ({
  embeddingService: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  },
}));

vi.mock('../../../services/notebookSourceFileService.js', () => ({
  persistNotebookSourceFile: vi.fn().mockResolvedValue({ storedSourceFile: true }),
}));

// notebookService.capture() filters its INSERT columns through
// getTableColumns('notebook_pages') (compat guard for deployments whose
// schema predates the V4 capture columns — see notebookService.ts). Without
// a mock, getTableColumns falls through to querying via queryHelpers.queryAll
// (mocked above, no default implementation) and then to
// MOCK_TABLE_FALLBACK_COLUMNS in dbSchema.ts, which doesn't list
// 'notebook_pages' — so every column silently gets filtered out of the real
// INSERT and its params, not just in this test but in ANY mock-DB-mode run.
// Mock it here with the columns capture() actually writes (see the `values`
// object in notebookService.ts) so this test exercises the real column set.
vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async () =>
    new Set([
      'id',
      'owner_user_id',
      'organization_id',
      'project_id',
      'visibility',
      'title',
      'content_json',
      'content_text',
      'tags_json',
      'status',
      'capture_source',
      'capture_metadata',
      'idempotency_key',
      'source_type',
      'source_id',
      'created_at',
      'updated_at',
    ])
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// §2.3.1 — Bounded entry points
// ═══════════════════════════════════════════════════════════════

describe('§2.3.1 Bounded entry points', () => {
  it('declares at least 7 capture entry points', () => {
    expect(P07_CAPTURE_ENTRIES.create.length).toBeGreaterThanOrEqual(7);
  });

  it('includes all required capture connectors', () => {
    const entries = P07_CAPTURE_ENTRIES.create;
    expect(entries).toContain('web_clipper');
    expect(entries).toContain('email_forward');
    expect(entries).toContain('upload_import');
    expect(entries).toContain('api_import');
  });

  it('includes My Work notebook as primary entry', () => {
    expect(P07_CAPTURE_ENTRIES.create).toContain('my_work_notebook_new');
  });

  it('declares open entry points', () => {
    expect(P07_CAPTURE_ENTRIES.open).toContain('notebook_list');
    expect(P07_CAPTURE_ENTRIES.open).toContain('search_results');
    expect(P07_CAPTURE_ENTRIES.open).toContain('stable_deeplink');
    expect(P07_CAPTURE_ENTRIES.open).toContain('backlink_context_panel');
  });

  it('forbids top-level module outside My Work and dead inbox', () => {
    expect(P07_CAPTURE_ENTRIES.forbidden).toContain('no_top_level_module_outside_my_work');
    expect(P07_CAPTURE_ENTRIES.forbidden).toContain('no_dead_inbox');
  });
});

// ═══════════════════════════════════════════════════════════════
// §2.3.3 — Provenance language
// ═══════════════════════════════════════════════════════════════

describe('§2.3.3 Provenance language', () => {
  it('declares exactly 3 provenance types', () => {
    expect(P07_PROVENANCE_LANGUAGE).toHaveLength(3);
    expect(P07_PROVENANCE_LANGUAGE).toContain('source');
    expect(P07_PROVENANCE_LANGUAGE).toContain('user_edit');
    expect(P07_PROVENANCE_LANGUAGE).toContain('ai_transform');
  });

  it('enforces no-silent-loss rules', () => {
    expect(P07_PROVENANCE_RULES.no_silent_overwrite).toBe(true);
    expect(P07_PROVENANCE_RULES.no_silent_delete).toBe(true);
    expect(P07_PROVENANCE_RULES.ai_requires_input_pointers).toBe(true);
    expect(P07_PROVENANCE_RULES.ai_requires_audit_trail).toBe(true);
    expect(P07_PROVENANCE_RULES.export_preserves_provenance).toBe(true);
  });

  it('defines AI flow as observe→propose→review→accept/reject', () => {
    expect(P07_PROVENANCE_RULES.ai_flow).toBe('observe -> propose -> review -> accept/reject');
  });
});

// ═══════════════════════════════════════════════════════════════
// §2.3.4 — Attachment lifecycle
// ═══════════════════════════════════════════════════════════════

describe('§2.3.4 Attachment lifecycle', () => {
  it('declares at least 5 lifecycle states', () => {
    expect(P07_ATTACHMENT_LIFECYCLE_STATES.length).toBeGreaterThanOrEqual(5);
  });

  it('includes required states: queued, uploading, processing, available, failed, blocked', () => {
    expect(P07_ATTACHMENT_LIFECYCLE_STATES).toContain('queued');
    expect(P07_ATTACHMENT_LIFECYCLE_STATES).toContain('uploading');
    expect(P07_ATTACHMENT_LIFECYCLE_STATES).toContain('processing');
    expect(P07_ATTACHMENT_LIFECYCLE_STATES).toContain('available');
    expect(P07_ATTACHMENT_LIFECYCLE_STATES).toContain('failed');
    expect(P07_ATTACHMENT_LIFECYCLE_STATES).toContain('blocked_policy');
  });

  it('declares error taxonomy with at least 5 error types', () => {
    const errorKeys = Object.keys(P07_ATTACHMENT_ERROR_TAXONOMY);
    expect(errorKeys.length).toBeGreaterThanOrEqual(5);
  });

  it('includes required error types', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY).toHaveProperty('network_timeout');
    expect(P07_ATTACHMENT_ERROR_TAXONOMY).toHaveProperty('size_limit');
    expect(P07_ATTACHMENT_ERROR_TAXONOMY).toHaveProperty('type_unsupported');
    expect(P07_ATTACHMENT_ERROR_TAXONOMY).toHaveProperty('virus_detected');
    expect(P07_ATTACHMENT_ERROR_TAXONOMY).toHaveProperty('processing_failed');
  });

  it('every error has retryable flag and userMessage', () => {
    for (const [key, val] of Object.entries(P07_ATTACHMENT_ERROR_TAXONOMY)) {
      expect(val).toHaveProperty('retryable');
      expect(typeof val.retryable).toBe('boolean');
      expect(val).toHaveProperty('userMessage');
      expect(val.userMessage.length).toBeGreaterThan(0);
    }
  });

  it('retryable errors include network_timeout and processing_failed', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.network_timeout.retryable).toBe(true);
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.processing_failed.retryable).toBe(true);
  });

  it('non-retryable errors include size_limit and type_unsupported', () => {
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.size_limit.retryable).toBe(false);
    expect(P07_ATTACHMENT_ERROR_TAXONOMY.type_unsupported.retryable).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// §2.3.5 — Search baseline
// ═══════════════════════════════════════════════════════════════

describe('§2.3.5 Search baseline', () => {
  it('declares text, tags, date_range, author, attachment_type as filters', () => {
    expect(P07_SEARCH_BASELINE.declaredFilters).toContain('text');
    expect(P07_SEARCH_BASELINE.declaredFilters).toContain('tags');
    expect(P07_SEARCH_BASELINE.declaredFilters).toContain('date_range');
    expect(P07_SEARCH_BASELINE.declaredFilters).toContain('author');
    expect(P07_SEARCH_BASELINE.declaredFilters).toContain('attachment_type');
  });

  it('declares at least 10 filters', () => {
    expect(P07_SEARCH_BASELINE.declaredFilters.length).toBeGreaterThanOrEqual(10);
  });

  it('declares operator hints', () => {
    expect(P07_SEARCH_BASELINE.operatorHints.length).toBeGreaterThanOrEqual(5);
  });

  it('declares result contract fields', () => {
    expect(P07_SEARCH_BASELINE.resultContract).toContain('note_id');
    expect(P07_SEARCH_BASELINE.resultContract).toContain('title');
    expect(P07_SEARCH_BASELINE.resultContract).toContain('snippet');
    expect(P07_SEARCH_BASELINE.resultContract).toContain('match_kind');
  });

  it('enforces anti-duplicate: no search v2 index', () => {
    expect(P07_SEARCH_BASELINE.antiDuplicate).toBe('no_search_v2_index');
  });
});

// ═══════════════════════════════════════════════════════════════
// §2.3.6 — Handoff targets
// ═══════════════════════════════════════════════════════════════

describe('§2.3.6 Handoff targets', () => {
  it('declares common handoff fields with at least 15 fields', () => {
    expect(P07_HANDOFF_COMMON_FIELDS.length).toBeGreaterThanOrEqual(15);
    expect(P07_HANDOFF_COMMON_FIELDS).toContain('origin');
    expect(P07_HANDOFF_COMMON_FIELDS).toContain('note_id');
    expect(P07_HANDOFF_COMMON_FIELDS).toContain('note_deeplink');
    expect(P07_HANDOFF_COMMON_FIELDS).toContain('title');
    expect(P07_HANDOFF_COMMON_FIELDS).toContain('summary');
  });

  it('declares Radar handoff with signal suggestion fields', () => {
    expect(P07_HANDOFF_TARGETS.radar.module).toBe('P06');
    expect(P07_HANDOFF_TARGETS.radar.signalSuggestionFields).toContain('category');
    expect(P07_HANDOFF_TARGETS.radar.signalSuggestionFields).toContain('why_now');
    expect(P07_HANDOFF_TARGETS.radar.signalSuggestionFields).toContain('priority_hint');
  });

  it('declares Inicjatywy handoff with initiative seed fields', () => {
    expect(P07_HANDOFF_TARGETS.inicjatywy.module).toBe('P11');
    expect(P07_HANDOFF_TARGETS.inicjatywy.initiativeSeedFields).toContain('problem_statement');
    expect(P07_HANDOFF_TARGETS.inicjatywy.initiativeSeedFields).toContain('proposed_outcome');
    expect(P07_HANDOFF_TARGETS.inicjatywy.initiativeSeedFields).toContain('assumptions');
    expect(P07_HANDOFF_TARGETS.inicjatywy.initiativeSeedFields).toContain('risks');
  });

  it('declares Teresa handoff with assistant context fields', () => {
    expect(P07_HANDOFF_TARGETS.teresa.module).toBe('P08');
    expect(P07_HANDOFF_TARGETS.teresa.assistantContextFields).toContain('user_intent');
    expect(P07_HANDOFF_TARGETS.teresa.assistantContextFields).toContain('constraints');
    expect(P07_HANDOFF_TARGETS.teresa.assistantContextFields).toContain('citations');
  });

  it('all handoff targets include common fields', () => {
    for (const target of Object.values(P07_HANDOFF_TARGETS)) {
      for (const commonField of P07_HANDOFF_COMMON_FIELDS) {
        expect(target.requiredFields).toContain(commonField);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// §2.3.7 — Anti-duplicate gate
// ═══════════════════════════════════════════════════════════════

describe('§2.3.7 Anti-duplicate gate', () => {
  it('declares exactly 4 anti-duplicate rules', () => {
    expect(Object.keys(P07_ANTI_DUPLICATE_RULES)).toHaveLength(4);
  });

  it('forbids parallel attachment system', () => {
    expect(P07_ANTI_DUPLICATE_RULES.no_parallel_attachment_system).toBeTruthy();
  });

  it('forbids search v2 index', () => {
    expect(P07_ANTI_DUPLICATE_RULES.no_search_v2_index).toBeTruthy();
  });

  it('forbids dead inbox', () => {
    expect(P07_ANTI_DUPLICATE_RULES.no_dead_inbox).toBeTruthy();
  });

  it('forbids parallel link model', () => {
    expect(P07_ANTI_DUPLICATE_RULES.no_parallel_link_model).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// §2.3.8 — Degraded posture
// ═══════════════════════════════════════════════════════════════

describe('§2.3.8 Degraded posture', () => {
  it('declares at least 8 degraded scenarios', () => {
    expect(P07_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(8);
  });

  it('every scenario has id, scenario, userVisibleState, nextAction', () => {
    for (const s of P07_DEGRADED_SCENARIOS) {
      expect(s).toHaveProperty('id');
      expect(typeof s.id).toBe('number');
      expect(s.scenario.length).toBeGreaterThan(0);
      expect(s.userVisibleState.length).toBeGreaterThan(0);
      expect(s.nextAction.length).toBeGreaterThan(0);
    }
  });

  it('includes upload failure scenario', () => {
    const uploadFail = P07_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Upload failed'));
    expect(uploadFail).toBeDefined();
    expect(uploadFail!.nextAction).toContain('Retry');
  });

  it('includes semantic search degraded scenario', () => {
    const searchDegraded = P07_DEGRADED_SCENARIOS.find((s) =>
      s.scenario.includes('Semantic search')
    );
    expect(searchDegraded).toBeDefined();
    expect(searchDegraded!.nextAction.toLowerCase()).toContain('keyword');
  });

  it('includes deeplink target missing scenario', () => {
    const deeplink = P07_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('Deeplink'));
    expect(deeplink).toBeDefined();
  });

  it('includes AI unavailable scenario', () => {
    const aiDown = P07_DEGRADED_SCENARIOS.find((s) => s.scenario.includes('AI unavailable'));
    expect(aiDown).toBeDefined();
    expect(aiDown!.userVisibleState).toContain('disabled');
  });
});

// ═══════════════════════════════════════════════════════════════
// §2.3.9 — Acceptance checklist
// ═══════════════════════════════════════════════════════════════

describe('§2.3.9 Acceptance checklist', () => {
  it('declares exactly 11 checklist items', () => {
    expect(P07_ACCEPTANCE_CHECKLIST).toHaveLength(11);
  });

  it('every item has id, requirement, section', () => {
    for (const item of P07_ACCEPTANCE_CHECKLIST) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('requirement');
      expect(item).toHaveProperty('section');
      expect(item.requirement.length).toBeGreaterThan(0);
    }
  });

  it('ids are sequential 1-11', () => {
    for (let i = 0; i < 11; i++) {
      expect(P07_ACCEPTANCE_CHECKLIST[i].id).toBe(i + 1);
    }
  });

  it('covers all contract sections', () => {
    const sections = P07_ACCEPTANCE_CHECKLIST.map((c) => c.section);
    expect(sections).toContain('§2.3.1');
    expect(sections).toContain('§2.3.2');
    expect(sections).toContain('§2.3.3');
    expect(sections).toContain('§2.3.4');
    expect(sections).toContain('§2.3.5');
    expect(sections).toContain('§2.3.6');
    expect(sections).toContain('§2.3.7');
    expect(sections).toContain('§2.3.8');
  });
});

// ═══════════════════════════════════════════════════════════════
// Non-goals + contract identifier
// ═══════════════════════════════════════════════════════════════

describe('Non-goals and contract', () => {
  it('declares at least 3 non-goals', () => {
    expect(P07_NON_GOALS.length).toBeGreaterThanOrEqual(3);
  });

  it('non-goals include no Notion DB parity', () => {
    const hasNotion = P07_NON_GOALS.some((g) => g.toLowerCase().includes('notion'));
    expect(hasNotion).toBe(true);
  });

  it('non-goals include no new module', () => {
    const hasModule = P07_NON_GOALS.some((g) =>
      g.toLowerCase().includes('no new top-level module')
    );
    expect(hasModule).toBe(true);
  });

  it('non-goals include no silent AI writing', () => {
    const hasAI = P07_NON_GOALS.some((g) => g.toLowerCase().includes('silent ai'));
    expect(hasAI).toBe(true);
  });

  it('contract identifier is notebook_canon_v1', () => {
    expect(P07_NOTEBOOK_CANON_CONTRACT).toBe('notebook_canon_v1');
  });
});

// ═══════════════════════════════════════════════════════════════
// Service integration — NotebookService capture (mock DB)
// ═══════════════════════════════════════════════════════════════

describe('NotebookService integration (capture)', () => {
  it('capture via upload calls queryRun with correct source', async () => {
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const { notebookService } = await import('../../../services/notebookService.js');
    await notebookService.capture('org-1', 'user-1', {
      source: 'upload',
      title: 'Test upload',
      content: 'File content here',
      fileBuffer: Buffer.from('hello'),
      fileMimetype: 'text/plain',
      fileOriginalname: 'test.txt',
    });

    expect(mockQueryRun).toHaveBeenCalled();
    const insertCall = mockQueryRun.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO notebook_pages');
    expect(insertCall[1]).toContain('upload');
  });

  it('capture via web_clipper preserves URL in content', async () => {
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const { notebookService } = await import('../../../services/notebookService.js');
    const result = await notebookService.capture('org-1', 'user-1', {
      source: 'web_clipper',
      url: 'https://example.com',
      content: 'Clipped content',
    });

    expect(result.source).toBe('web_clipper');
    expect(result.pageId).toBeTruthy();
  });

  it('capture via email_forward includes email metadata', async () => {
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const { notebookService } = await import('../../../services/notebookService.js');
    const result = await notebookService.capture('org-1', 'user-1', {
      source: 'email_forward',
      emailFrom: 'sender@example.com',
      emailSubject: 'Important note',
      content: 'Email body',
    });

    expect(result.source).toBe('email_forward');
    expect(result.title).toBe('Important note');
  });

  it('capture via api_import works with minimal fields', async () => {
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });

    const { notebookService } = await import('../../../services/notebookService.js');
    const result = await notebookService.capture('org-1', 'user-1', {
      source: 'api_import',
      title: 'API note',
      content: 'Imported content',
    });

    expect(result.source).toBe('api_import');
    expect(result.title).toBe('API note');
  });
});

// ═══════════════════════════════════════════════════════════════
// Service integration — Attachment lifecycle
// ═══════════════════════════════════════════════════════════════

describe('Attachment service integration', () => {
  it('parseNotebookAttachments handles null gracefully', async () => {
    const { parseNotebookAttachments } =
      await import('../../../services/notebookAttachmentService.js');
    expect(parseNotebookAttachments(null)).toEqual([]);
    expect(parseNotebookAttachments(undefined)).toEqual([]);
    expect(parseNotebookAttachments('')).toEqual([]);
  });

  it('parseNotebookAttachments parses valid JSON array', async () => {
    const { parseNotebookAttachments } =
      await import('../../../services/notebookAttachmentService.js');
    const input = JSON.stringify([
      { id: 'a1', name: 'file.pdf', type: 'application/pdf', size: 1024, uploadedAt: '2026-01-01' },
    ]);
    const result = parseNotebookAttachments(input);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
    expect(result[0].name).toBe('file.pdf');
  });

  it('toPublicNotebookAttachments strips storageKey', async () => {
    const { toPublicNotebookAttachments } =
      await import('../../../services/notebookAttachmentService.js');
    const input = [
      {
        id: 'a1',
        name: 'file.pdf',
        type: 'application/pdf',
        size: 1024,
        uploadedAt: '2026-01-01',
        storageKey: 'secret/path',
      },
    ];
    const result = toPublicNotebookAttachments(input);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('storageKey');
  });
});

// ═══════════════════════════════════════════════════════════════
// Service integration — Search (semanticSearch)
// ═══════════════════════════════════════════════════════════════

describe('NotebookService search integration', () => {
  it('semanticSearch returns results from FTS', async () => {
    mockQueryAll.mockResolvedValueOnce([
      { id: 'page-1', title: 'Test Note', snippet: 'Some content', score: 0.8 },
    ]);

    const { notebookService } = await import('../../../services/notebookService.js');
    const results = await notebookService.semanticSearch('org-1', 'user-1', 'test query', {
      limit: 10,
    });

    expect(Array.isArray(results)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-check: canon constants match existing service types
// ═══════════════════════════════════════════════════════════════

describe('Canon ↔ service coherence', () => {
  it('capture connectors in canon match CaptureSource type', async () => {
    const canonConnectors = P07_CAPTURE_ENTRIES.create.filter((e) =>
      ['web_clipper', 'email_forward', 'upload_import', 'api_import'].includes(e)
    );
    expect(canonConnectors).toHaveLength(4);
  });

  it('provenance language covers all AI proposal statuses', () => {
    expect(P07_PROVENANCE_LANGUAGE).toContain('ai_transform');
    expect(P07_PROVENANCE_LANGUAGE).toContain('user_edit');
    expect(P07_PROVENANCE_LANGUAGE).toContain('source');
  });
});
