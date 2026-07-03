// @vitest-environment node
/**
 * R5 — proaktywny auto-skan kandydatów + realny LLM-seam.
 *
 * L1: `buildCandidateFromArtifactAI` — używa LLM gdy dostępny, FAIL-SOFT do
 *     deterministycznego buildera (brak LLM / błąd / niewalidny JSON), klamruje fitScore.
 * L2: `scanForCandidates({ propose })` — proposer wstrzykiwany per artefakt,
 *     throw proposera → fallback deterministyczny.
 * L3: `runCandidateScan` (cron) — iteruje orgi, agreguje created/errors, fail-soft.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// queryHelpers instancjuje getDatabase() — mock, by import serwisu nie wymagał DB.
const mockQueryAll = vi.fn(async () => [] as any[]);
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...a: any[]) => mockQueryAll(...a),
  queryOne: vi.fn(async () => null),
  queryRun: vi.fn(async () => ({ changes: 0 })),
}));

// L3 cron path uses the DEFAULT (lazy) LLM via getCandidateLlm() → mock the
// llmService module so no real network call fires; returns a benign JSON.
// Hoisted spy so tests can assert the prompt (e.g. portfolio grounding).
const { mockLlmCall } = vi.hoisted(() => ({
  mockLlmCall: vi.fn(async () => ({ content: JSON.stringify({ title: 'X', rationale: 'Y', fitScore: 0.5 }) })),
}));
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...a: any[]) => mockLlmCall(...a) },
  default: { call: (...a: any[]) => mockLlmCall(...a) },
}));

// F2→F1 wiring imports the funnel + brain — mock so the module graph stays light.
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: vi.fn(),
  default: { createInitiative: vi.fn() },
}));
vi.mock('../../../server/src/services/initiative/initiativeGeneratorBrain.js', () => ({
  generateFullInitiative: vi.fn(),
  defaultDeps: vi.fn(() => ({ generationService: {} as any })),
}));

import {
  buildCandidateFromArtifact,
  buildCandidateFromArtifactAI,
  scanForCandidates,
  type CandidateDb,
  type DiscoveryArtifact,
} from '../../../server/src/services/initiative/initiativeCandidateService.ts';
import { runCandidateScan } from '../../../server/src/cron/InitiativeCandidateScanCron.ts';

const artifact: DiscoveryArtifact = {
  sourceType: 'interview_insight',
  sourceId: 'ins-1',
  title: 'Wysoki czas obsługi zgłoszeń',
  summary: 'Klienci czekają 3 dni; brak automatyzacji triage.',
};

function fakeLlm(content: string | (() => never)) {
  return {
    call: vi.fn(async () => {
      if (typeof content === 'function') content();
      return { content };
    }),
  };
}

interface MockDbOpts {
  queryAll?: (sql: string, params: unknown[]) => Promise<any[]>;
  queryOne?: (sql: string, params: unknown[]) => Promise<any>;
}
function makeDb(opts: MockDbOpts = {}): CandidateDb {
  return {
    queryAll: (async (sql: string, params: unknown[] = []) =>
      (opts.queryAll ? opts.queryAll(sql, params) : [])) as CandidateDb['queryAll'],
    queryOne: (async (sql: string, params: unknown[] = []) =>
      (opts.queryOne ? opts.queryOne(sql, params) : null)) as CandidateDb['queryOne'],
    queryRun: (async () => ({ changes: 0 })) as CandidateDb['queryRun'],
  };
}

beforeEach(() => {
  mockQueryAll.mockReset().mockResolvedValue([]);
});

// ── L1: AI proposer ──────────────────────────────────────────────────────────

describe('buildCandidateFromArtifactAI (R5 LLM seam)', () => {
  it('uses the LLM proposal when JSON is valid', async () => {
    const llm = fakeLlm(JSON.stringify({ title: 'Automatyzacja triage zgłoszeń', rationale: 'Skraca czas obsługi z 3 dni do 4h', fitScore: 0.82 }));
    const out = await buildCandidateFromArtifactAI(artifact, { llm });
    expect(out.title).toBe('Automatyzacja triage zgłoszeń');
    expect(out.rationale).toContain('Skraca czas');
    expect(out.fitScore).toBe(0.82);
    expect(llm.call).toHaveBeenCalledTimes(1);
  });

  it('clamps an out-of-range fitScore into 0..1', async () => {
    const llm = fakeLlm(JSON.stringify({ title: 'T', rationale: 'R', fitScore: 9 }));
    const out = await buildCandidateFromArtifactAI(artifact, { llm });
    expect(out.fitScore).toBe(1);
  });

  it('per-field fallback when JSON is partial/garbage', async () => {
    const fallback = buildCandidateFromArtifact(artifact);
    const llm = fakeLlm('totalnie nie json');
    const out = await buildCandidateFromArtifactAI(artifact, { llm });
    expect(out.title).toBe(fallback.title);
    expect(out.rationale).toBe(fallback.rationale);
    expect(out.fitScore).toBe(fallback.fitScore);
  });

  it('falls back to deterministic when LLM throws', async () => {
    const fallback = buildCandidateFromArtifact(artifact);
    const llm = fakeLlm(() => {
      throw new Error('LLM down');
    });
    const out = await buildCandidateFromArtifactAI(artifact, { llm });
    expect(out).toEqual(fallback);
  });

  it('falls back to deterministic when no LLM is configured (llm: null)', async () => {
    const fallback = buildCandidateFromArtifact(artifact);
    const out = await buildCandidateFromArtifactAI(artifact, { llm: null });
    expect(out).toEqual(fallback);
  });

  it('passes portfolioSummary into the prompt for grounding', async () => {
    const llm = fakeLlm(JSON.stringify({ title: 'T', rationale: 'R', fitScore: 0.5 }));
    await buildCandidateFromArtifactAI(artifact, { llm, portfolioSummary: 'Istniejąca: Projekt X [ACTIVE]' });
    const promptUser = llm.call.mock.calls[0][0].messages[0].content;
    expect(promptUser).toContain('Projekt X');
  });
});

// ── L2: scanForCandidates with injected proposer ─────────────────────────────

describe('scanForCandidates({ propose }) — R5 hook', () => {
  function scanDb(insertCapture: (params: unknown[]) => void): CandidateDb {
    return makeDb({
      queryAll: async (sql) => {
        if (sql.includes('FROM interview_insights')) return [{ id: 'ins-1', title: 'Czas obsługi', summary: 'wolno' }];
        if (sql.includes('FROM initiative_candidates')) return [];
        return [];
      },
      queryOne: async (sql, params) => {
        if (sql.includes('INSERT INTO initiative_candidates')) {
          insertCapture(params);
          return {
            id: 'cand-1', organization_id: 'org-1', source_type: params[1], source_id: params[2],
            title: params[3], rationale: params[4], fit_score: params[5], status: 'pending',
          };
        }
        return null;
      },
    });
  }

  it('uses the injected proposer for title/rationale/fitScore', async () => {
    let captured: unknown[] = [];
    const propose = vi.fn(async () => ({ title: 'AI tytuł', rationale: 'AI uzasadnienie', fitScore: 0.77 }));
    const created = await scanForCandidates(scanDb((p) => (captured = p)), 'org-1', { propose });
    expect(propose).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(captured[3]).toBe('AI tytuł'); // title param
    expect(captured[5]).toBe(0.77); // fit_score param
  });

  it('proposer throw → falls back to deterministic builder (still inserts)', async () => {
    let captured: unknown[] = [];
    const propose = vi.fn(async () => {
      throw new Error('proposer boom');
    });
    const created = await scanForCandidates(scanDb((p) => (captured = p)), 'org-1', { propose });
    expect(created).toHaveLength(1);
    expect(String(captured[3])).toContain('Inicjatywa:'); // deterministic title
  });

  it('default (no propose) stays deterministic', async () => {
    let captured: unknown[] = [];
    const created = await scanForCandidates(scanDb((p) => (captured = p)), 'org-1');
    expect(created).toHaveLength(1);
    expect(String(captured[3])).toContain('Inicjatywa:');
  });
});

// ── L3: runCandidateScan cron ────────────────────────────────────────────────

describe('runCandidateScan (cron) — proactive sweep', () => {
  it('enumerates orgs and aggregates created counts (fail-soft per org)', async () => {
    // org enumeration → two orgs; per-org discovery → one new insight each.
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (sql.includes('DISTINCT organization_id')) {
        return [{ organization_id: 'org-1' }, { organization_id: 'org-2' }];
      }
      if (sql.includes('FROM interview_insights')) return [{ id: 'ins-x', title: 'T', summary: 'S' }];
      if (sql.includes('FROM initiative_candidates')) return [];
      return [];
    });
    // queryOne (insert RETURNING) is mocked at module level to return null →
    // 0 created, but orgs are still counted. We assert enumeration + no throw.
    const res = await runCandidateScan();
    expect(res.orgs).toBe(2);
    expect(res.errors).toBe(0);
    expect(typeof res.created).toBe('number');
  });

  it('feeds F0 portfolio grounding into the proposer prompt', async () => {
    mockLlmCall.mockClear();
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (sql.includes('DISTINCT organization_id')) return [{ organization_id: 'org-1' }];
      // portfolio summary query (name+status from initiatives)
      if (sql.includes('SELECT name, status FROM initiatives')) {
        return [{ name: 'Projekt Alfa', status: 'ACTIVE' }];
      }
      if (sql.includes('FROM interview_insights')) return [{ id: 'ins-x', title: 'T', summary: 'S' }];
      if (sql.includes('FROM initiative_candidates')) return [];
      return [];
    });
    await runCandidateScan();
    // proposer was called with portfolioSummary → the prompt cites the existing initiative.
    expect(mockLlmCall).toHaveBeenCalled();
    const prompt = mockLlmCall.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Projekt Alfa');
  });

  it('fail-soft: org enumeration error → errors counted, no throw', async () => {
    mockQueryAll.mockImplementation(async (sql: string) => {
      if (sql.includes('DISTINCT organization_id')) throw new Error('db down');
      return [];
    });
    const res = await runCandidateScan();
    expect(res.orgs).toBe(0);
    expect(res.errors).toBe(1);
  });
});
