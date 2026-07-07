// @vitest-environment node
/**
 * BUG A + BUG B (Teresa obiekty-N) — regression proof.
 *
 * BUG A: Initiative full-fill "cicho pada" — a transient throw on ONE section used
 *        to (via the concurrent burst) wipe the WHOLE fill. Prove: sequential fill
 *        + retry-on-throw recovers, and one hard-failing card never kills the rest.
 *
 * BUG B: create_task / create_decision must fill STRUCTURAL fields at create time.
 *        Prove: task why/expectedOutcome/acceptanceCriteria columns get UPDATE'd;
 *        decision decision_rationale + ai_generated_sections sink get filled.
 *
 * Pure orchestration tests — the section generators / DB are mocked (zero LLM/DB).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── BUG A: brain retry + sequential fail-soft ────────────────────────────────

import {
  generateFullInitiative,
  type GeneratorDeps,
  type SectionGenerator,
} from '../../../server/src/services/initiative/initiativeGeneratorBrain.ts';

function depsFor(gen: SectionGenerator, passThreshold = 90): GeneratorDeps {
  return { generationService: gen, passThreshold };
}

describe('BUG A — brain robustness', () => {
  it('retries a section that THROWS once, then succeeds (card is NOT lost)', async () => {
    const calls: Record<string, number> = {};
    const spy = vi.fn(async (sectionKey: string) => {
      calls[sectionKey] = (calls[sectionKey] || 0) + 1;
      // problemDefinition throws on its FIRST attempt, succeeds on the retry.
      if (sectionKey === 'problemDefinition' && calls[sectionKey] === 1) {
        throw new Error('429 rate limit');
      }
      return {
        content: `ok:${sectionKey}`,
        isJson: false,
        tokensUsed: 1,
        model: 'mock',
        review: {
          score: 95,
          verdict: 'PASS',
          failedValidators: [],
          qualityGaps: [],
          fixes: [],
          sectionKey,
          model: 'mock',
          degraded: false,
        },
      };
    });
    const gen: SectionGenerator = { generateSectionContent: spy as any };

    const r = await generateFullInitiative(depsFor(gen), {
      initiativeId: 'i-A1',
      cardKeys: ['problemDefinition', 'kpis'],
    });

    // problemDefinition was retried (2 attempts) and its card is present.
    expect(calls.problemDefinition).toBe(2);
    expect(r.cards.problemDefinition).toBe('ok:problemDefinition');
    expect(r.cards.kpis).toBe('ok:kpis');
    expect(r.qualitySummary.filled).toBe(2);
    expect(r.qualitySummary.failed).toBe(0);
  });

  it('a section that throws on BOTH attempts fails-soft; other cards still fill', async () => {
    const spy = vi.fn(async (sectionKey: string) => {
      if (sectionKey === 'scope') throw new Error('persistent boom');
      return {
        content: `ok:${sectionKey}`,
        isJson: false,
        tokensUsed: 1,
        model: 'mock',
        review: {
          score: 95,
          verdict: 'PASS',
          failedValidators: [],
          qualityGaps: [],
          fixes: [],
          sectionKey,
          model: 'mock',
          degraded: false,
        },
      };
    });
    const gen: SectionGenerator = { generateSectionContent: spy as any };

    const r = await generateFullInitiative(depsFor(gen), {
      initiativeId: 'i-A2',
      cardKeys: ['scope', 'kpis'],
    });

    // scope tried twice (initial + 1 retry) then failed-soft; kpis still filled.
    expect(spy.mock.calls.filter((c: any[]) => c[0] === 'scope')).toHaveLength(2);
    expect(r.cards.scope).toBeUndefined();
    expect(r.cards.kpis).toBe('ok:kpis');
    expect(r.qualitySummary.failed).toBe(1);
    expect(r.qualitySummary.filled).toBe(1);
  });
});

// ── BUG B: create_task structural fill ───────────────────────────────────────

const taskMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  generateTaskSection: vi.fn(),
  queryRun: vi.fn(async () => ({ changes: 1 })),
}));

vi.mock('../../../server/src/ai/actionExecutors/taskExecutor.js', () => ({
  default: { execute: taskMocks.execute },
}));
vi.mock('../../../server/src/services/taskSectionGenerationService.js', () => ({
  generateTaskSection: (...a: any[]) => taskMocks.generateTaskSection(...a),
}));
vi.mock('../../../server/src/services/decisionService.js', () => ({
  default: { generateSection: (...a: any[]) => decisionMocks.generateSection(...a) },
}));
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: (...a: any[]) => taskMocks.queryRun(...a),
}));
// getTableColumns must report the decisions structural + rationale columns so the
// column-defensive writes actually fire (otherwise the fill is silently skipped).
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn(async (table: string) => {
    if (table === 'decisions') {
      return new Set([
        'id', 'organization_id', 'title', 'description', 'status', 'created_by',
        'decision_maker_id', 'alternatives', 'risk_impact', 'consequences_of_inaction',
        'recommendation', 'assumptions', 'decision_rationale', 'ai_generated_sections',
      ]);
    }
    return new Set(['id', 'organization_id', 'title', 'description', 'status']);
  }),
}));
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TERESA_RECORD_CREATE: true },
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const decisionMocks = vi.hoisted(() => ({ generateSection: vi.fn() }));

import { createTask } from '../../../server/src/services/ai/tools/createTask.ts';
import { createDecision } from '../../../server/src/services/ai/tools/createDecision.ts';

beforeEach(() => {
  vi.clearAllMocks();
  taskMocks.queryRun.mockResolvedValue({ changes: 1 });
});

describe('BUG B — create_task fills why/expectedOutcome/acceptanceCriteria', () => {
  it('UPDATEs tasks with structural fields from the section generator', async () => {
    taskMocks.execute.mockResolvedValueOnce({ success: true, result: { taskId: 't-1' } });
    taskMocks.generateTaskSection.mockImplementation(async (key: string) => {
      if (key === 'strategy') {
        return {
          parsedContent: { why: 'link do celu inicjatywy', expectedOutcome: '20% szybciej w 30 dni' },
          isJson: true,
        };
      }
      return { parsedContent: { checklist: ['krok 1', 'krok 2', 'krok 3'] }, isJson: true };
    });

    await createTask({ title: 'Zadanie X', description: 'opis' }, { organizationId: 'org-1', userId: 'u1' });

    // structural UPDATE is fire-and-forget → poll for it.
    const upd = await vi.waitFor(() => {
      const c = taskMocks.queryRun.mock.calls.find((c) => /UPDATE tasks SET/.test(String(c[0])));
      if (!c) throw new Error('task structural UPDATE not issued yet');
      return c;
    });
    const [sql, params] = upd as [string, any[]];
    expect(sql).toContain('why = ?');
    expect(sql).toContain('expected_outcome = ?');
    expect(sql).toContain('acceptance_criteria = ?');
    expect(params).toContain('link do celu inicjatywy');
    expect(params).toContain('20% szybciej w 30 dni');
    expect(params).toContain(JSON.stringify(['krok 1', 'krok 2', 'krok 3']));
  });

  it('one section throwing does not block the other (fail-soft)', async () => {
    taskMocks.execute.mockResolvedValueOnce({ success: true, result: { taskId: 't-2' } });
    taskMocks.generateTaskSection.mockImplementation(async (key: string) => {
      if (key === 'strategy') throw new Error('LLM down');
      return { parsedContent: { checklist: ['a', 'b'] }, isJson: true };
    });

    const r = await createTask({ title: 'Y' }, { organizationId: 'org-1', userId: 'u1' });
    expect(r.ok).toBe(true); // task still created

    const upd = await vi.waitFor(() => {
      const c = taskMocks.queryRun.mock.calls.find((c) => /acceptance_criteria = \?/.test(String(c[0])));
      if (!c) throw new Error('acceptance UPDATE not issued yet');
      return c;
    });
    expect(String(upd[0])).not.toContain('why = ?'); // strategy failed → no why
    expect((upd[1] as any[])).toContain(JSON.stringify(['a', 'b']));
  });
});

describe('BUG B — create_decision fills structured columns (902) + rationale (dedup)', () => {
  it('fills alternatives/risk_impact/consequences/recommendation + DISTINCT decision_rationale', async () => {
    decisionMocks.generateSection.mockImplementation(async (_id: string, key: string) => {
      if (key === 'alternatives') {
        return { parsedContent: { alternatives: [{ title: 'Opcja A' }, { title: 'Nie robić nic' }] } };
      }
      if (key === 'risk') {
        return {
          parsedContent: { risks: [{ title: 'Ryzyko 1', probability: 'high', impact: 'high' }] },
        };
      }
      // consequencesOfInaction → proza: konsekwencje + Rekomendacja + Uzasadnienie.
      // Ucięty nagłówek "**:" na starcie rekomendacji testuje defekt #1 (glitch).
      return {
        content:
          'Bez decyzji w 30 dni tracimy okno wdrożeniowe (~300k PLN).\n\n' +
          '**Rekomendacja**: **: Wdrożyć Opcję A w Q1. ' +
          'Uzasadnienie: najniższy TCO i gotowe kompetencje zespołu.',
      };
    });

    const r = await createDecision(
      { title: 'Decyzja X', description: 'kontekst' },
      { organizationId: 'org-1', userId: 'u1' },
    );
    expect(r.ok).toBe(true);

    // (1) Structured-columns UPDATE (migration 902) — alternatives/risk_impact/
    // consequences_of_inaction/recommendation w jednym SET.
    const structCall = await vi.waitFor(() => {
      const c = taskMocks.queryRun.mock.calls.find((c) => /recommendation = COALESCE/.test(String(c[0])));
      if (!c) throw new Error('structured columns UPDATE not issued yet');
      return c;
    });
    const structSql = String(structCall[0]);
    expect(structSql).toContain('alternatives = COALESCE');
    expect(structSql).toContain('risk_impact = COALESCE');
    expect(structSql).toContain('consequences_of_inaction = COALESCE');
    const structParams = structCall[1] as any[];
    // recommendation column = answer-first, glitch-free (defekt #1).
    const recVal = structParams.find(
      (p) => typeof p === 'string' && p.includes('Wdrożyć Opcję A'),
    ) as string;
    expect(recVal).toBeTruthy();
    expect(recVal.startsWith('**')).toBe(false);
    expect(recVal).toBe('Wdrożyć Opcję A w Q1.');

    // (2) decision_rationale UPDATE — the DISTINCT "why" (rationale), NOT a copy of
    // recommendation (defekt #2 dedup).
    const ratCall = await vi.waitFor(() => {
      const c = taskMocks.queryRun.mock.calls.find((c) => /decision_rationale = \?/.test(String(c[0])));
      if (!c) throw new Error('rationale UPDATE not issued yet');
      return c;
    });
    const ratVal = (ratCall[1] as any[])[0] as string;
    expect(ratVal).toContain('najniższy TCO'); // to jest UZASADNIENIE, nie rekomendacja
    expect(ratVal).not.toBe(recVal); // dedup: rationale ≠ recommendation
    expect(ratVal.startsWith('**')).toBe(false); // glitch-free
  });

  it('decision still created even when all structural sections fail', async () => {
    decisionMocks.generateSection.mockRejectedValue(new Error('LLM exploded'));
    const r = await createDecision({ title: 'Z' }, { organizationId: 'org-1', userId: 'u1' });
    expect(r.ok).toBe(true);
  });
});
