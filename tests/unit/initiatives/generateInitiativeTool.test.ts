import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockGenerateFull = vi.fn();
const mockDefaultDeps = vi.fn(() => ({ generationService: {}, passThreshold: 70 }));

vi.mock('../../../server/src/services/initiativeGenerationService.js', () => ({
  createInitiative: (...a: unknown[]) => mockCreate(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  getTableColumns: (...a: unknown[]) => mockGetTableColumns(...a),
}));
vi.mock('../../../server/src/services/initiative/initiativeGeneratorBrain.js', () => ({
  generateFullInitiative: (...a: unknown[]) => mockGenerateFull(...a),
  defaultDeps: (...a: unknown[]) => mockDefaultDeps(...a),
}));

import { generateInitiative } from '../../../server/src/services/ai/tools/generateInitiative.js';

const ORG = 'org-1';

/** Default happy-path columns: all lineage + persist columns present. */
const FULL_COLS = [
  { name: 'id' },
  { name: 'organization_id' },
  { name: 'source_type' },
  { name: 'source_id' },
  { name: 'ai_generated_sections' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTableColumns.mockResolvedValue(FULL_COLS);
  mockQueryRun.mockResolvedValue({ changes: 1 });
  mockGenerateFull.mockResolvedValue({
    initiativeId: 'init-9',
    language: 'pl',
    cards: { problemDefinition: 'P', kpis: 'K' },
    outcomes: [],
    qualitySummary: {},
  });
});

describe('generate_initiative tool (C2)', () => {
  it('ok:false when there is no organization context', async () => {
    const r = await generateInitiative({ title: 'X' }, {});
    expect(r.ok).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a draft and returns ok:true + id (org-scoped, source=teresa_chat)', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    const r = await generateInitiative(
      { title: 'Robotic picking', problem: 'manual picking is slow' },
      { organizationId: ORG }
    );
    expect(r).toMatchObject({ ok: true, id: 'init-9', title: 'Robotic picking' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        title: 'Robotic picking',
        description: 'manual picking is slow',
        source: 'teresa_chat',
      })
    );
  });

  it('defaults the title when blank', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-10' });
    const r = await generateInitiative({ title: '   ' }, { organizationId: ORG });
    expect(r.title).toBe('New initiative');
  });

  it('ok:false when the create returns no id', async () => {
    mockCreate.mockResolvedValueOnce({ id: '' });
    const r = await generateInitiative({ title: 'X' }, { organizationId: ORG });
    expect(r.ok).toBe(false);
    // No lineage / fill attempted when create failed.
    expect(mockGenerateFull).not.toHaveBeenCalled();
  });

  it('ok:false (swallowed) when the create throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('db down'));
    const r = await generateInitiative({ title: 'X' }, { organizationId: ORG });
    expect(r.ok).toBe(false);
  });
});

describe('generate_initiative — lineage stamp (F1)', () => {
  it('stamps source_type + source_id via a post-create UPDATE', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    await generateInitiative({ title: 'X', problem: 'p' }, { organizationId: ORG });

    const lineageCall = mockQueryRun.mock.calls.find(
      (c) => /UPDATE initiatives SET/.test(String(c[0])) && /source_type/.test(String(c[0]))
    );
    expect(lineageCall).toBeDefined();
    // source_type default = teresa_chat; source_id falls back to the new id.
    expect(lineageCall![1]).toEqual(['teresa_chat', 'init-9', 'init-9', ORG]);
  });

  it('uses a passed-in originating artifact type/id when available', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-42' });
    const r = await generateInitiative(
      { title: 'From idea' },
      { organizationId: ORG, sourceType: 'idea', sourceId: 'idea-7' }
    );
    expect(r.sourceType).toBe('idea');
    const lineageCall = mockQueryRun.mock.calls.find(
      (c) => /source_type/.test(String(c[0]))
    );
    expect(lineageCall![1]).toEqual(['idea', 'idea-7', 'init-42', ORG]);
  });

  it('only sets lineage columns that exist in the live schema (schema-safe)', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    // Schema lacks source_id → only source_type should be set.
    mockGetTableColumns.mockResolvedValue([{ name: 'id' }, { name: 'source_type' }]);
    await generateInitiative({ title: 'X' }, { organizationId: ORG });
    const lineageCall = mockQueryRun.mock.calls.find(
      (c) => /source_type/.test(String(c[0]))
    );
    expect(lineageCall).toBeDefined();
    expect(String(lineageCall![0])).not.toMatch(/source_id/);
  });

  it('lineage stamp failure does NOT break the tool (draft still returned)', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    mockGetTableColumns.mockRejectedValue(new Error('information_schema blew up'));
    const r = await generateInitiative({ title: 'X' }, { organizationId: ORG });
    expect(r).toMatchObject({ ok: true, id: 'init-9' });
  });
});

describe('generate_initiative — full-fill (F1)', () => {
  it('calls generateFullInitiative with the brief + org + language', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    const r = await generateInitiative(
      { title: 'X', problem: 'slow manual flow' },
      { organizationId: ORG, language: 'en' }
    );
    // Full-fill is fire-and-forget (backgrounded since the async change), so the
    // tool returns immediately with filledCards:0 and the brain runs after.
    expect(r.filledCards).toBe(0);
    await vi.waitFor(() => {
      expect(mockGenerateFull).toHaveBeenCalledTimes(1);
    });
    const [, input] = mockGenerateFull.mock.calls[0];
    expect(input).toMatchObject({
      initiativeId: 'init-9',
      brief: 'slow manual flow',
      sourceType: 'teresa_chat',
      language: 'en',
      organizationId: ORG,
    });
  });

  it('persists the brain cards into ai_generated_sections (lazy-ALTER + UPDATE)', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    await generateInitiative({ title: 'X', problem: 'p' }, { organizationId: ORG });
    const persistCall = await vi.waitFor(() => {
      const c = mockQueryRun.mock.calls.find((c) => /ai_generated_sections = \?/.test(String(c[0])));
      if (!c) throw new Error('persist UPDATE not issued yet');
      return c;
    });
    const stored = JSON.parse(String(persistCall![1][0]));
    expect(stored).toEqual({ problemDefinition: 'P', kpis: 'K' });
  });

  it('ALTERs ai_generated_sections when the column is missing', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    mockGetTableColumns.mockResolvedValue([
      { name: 'id' },
      { name: 'source_type' },
      { name: 'source_id' },
    ]); // no ai_generated_sections
    await generateInitiative({ title: 'X', problem: 'p' }, { organizationId: ORG });
    await vi.waitFor(() => {
      const alter = mockQueryRun.mock.calls.find((c) =>
        /ALTER TABLE initiatives ADD COLUMN ai_generated_sections/.test(String(c[0]))
      );
      if (!alter) throw new Error('ALTER not issued yet');
    });
  });

  it('FAIL-SOFT: a full-fill error never breaks initiative creation', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    mockGenerateFull.mockRejectedValue(new Error('LLM exploded'));
    const r = await generateInitiative({ title: 'X', problem: 'p' }, { organizationId: ORG });
    expect(r).toMatchObject({ ok: true, id: 'init-9', filledCards: 0 });
  });

  it('FAIL-SOFT: a card-persist error never breaks initiative creation', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'init-9' });
    // lineage UPDATE ok, persist UPDATE throws.
    mockQueryRun.mockImplementation((sql: string) => {
      if (/ai_generated_sections = \?/.test(String(sql))) throw new Error('persist boom');
      return Promise.resolve({ changes: 1 });
    });
    const r = await generateInitiative({ title: 'X', problem: 'p' }, { organizationId: ORG });
    expect(r).toMatchObject({ ok: true, id: 'init-9' });
  });
});
