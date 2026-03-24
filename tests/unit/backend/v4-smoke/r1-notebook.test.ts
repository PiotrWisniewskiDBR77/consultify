/**
 * R1 Smoke: V4-NOTE-01..07 — Notebook Service
 * Verifies: capture, semanticSearch, RAG context, AI proposals, embed chips
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../server/src/database/Database.js', () => ({
  default: { getDatabase: vi.fn().mockResolvedValue({ run: vi.fn(), all: vi.fn().mockResolvedValue([]), get: vi.fn() }) },
  getDatabase: vi.fn().mockResolvedValue({ run: vi.fn(), all: vi.fn().mockResolvedValue([]), get: vi.fn() }),
}));

import notebookService from '../../../../server/src/services/notebookService.js';

describe('V4-NOTE: Notebook Service', () => {
  it('exports capture method', () => {
    expect(typeof notebookService.capture).toBe('function');
  });
  it('exports semanticSearch method', () => {
    expect(typeof notebookService.semanticSearch).toBe('function');
  });
  it('exports buildRAGContext method', () => {
    expect(typeof notebookService.buildRAGContext).toBe('function');
  });
  it('exports createAIProposal method', () => {
    expect(typeof notebookService.createAIProposal).toBe('function');
  });
  it('exports resolveAIProposal method', () => {
    expect(typeof notebookService.resolveAIProposal).toBe('function');
  });
  it('exports resolveEmbedChip method', () => {
    expect(typeof notebookService.resolveEmbedChip).toBe('function');
  });
  it('exports resolveEmbedChips method', () => {
    expect(typeof notebookService.resolveEmbedChips).toBe('function');
  });
});
