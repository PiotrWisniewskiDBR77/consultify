/**
 * R2 — generator emituje CardSpec + `validateCardSpec` jako bramka-recenzent.
 *
 * L1: deterministyczna bramka (validateCardSpec) + pętla auto-heal (regen raz).
 * L2: `generateSectionCardSpec` zwraca walidny CardSpec dla poprawnego LLM-a.
 *
 * LLM jest mockowany (seam: dynamiczny import `./ai/llmService.js`).
 * `enrichContext` nadpisany na identyczność → test izoluje bramkę/heal (bez DB).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...a: any[]) => mockCall(...a) },
  default: { call: (...a: any[]) => mockCall(...a) },
}));

import service, {
  __resetLlmInstanceForTests,
  extractJsonObject,
} from '../../../server/src/services/initiativeGenerationService.js';
import {
  coerceToCardSpec,
  hasCriticalIssues,
  validateCardSpec,
} from '../../../server/src/services/initiative/cardSpecSchema.js';

// Identity enrichContext → no DB in unit tests.
(service as any).enrichContext = async (c: any) => c;

function llmReturns(payload: unknown) {
  return {
    content: typeof payload === 'string' ? payload : JSON.stringify(payload),
    usage: { totalTokens: 12 },
    model: 'test-premium',
  };
}

const ctx: any = { initiativeId: '1', initiativeName: 'Test', language: 'pl' };

beforeEach(() => {
  __resetLlmInstanceForTests();
  mockCall.mockReset();
});

// ── L1: server-side validator parity + helpers ───────────────────────────────

describe('validateCardSpec (server) — deterministic gate', () => {
  it('flags empty blocks as CRITICAL (CB-03)', () => {
    const issues = validateCardSpec({ sectionKey: 'problemDefinition', title: 'X', blocks: [] });
    expect(hasCriticalIssues(issues)).toBe(true);
    expect(issues.some((i) => i.code === 'CB-03-EMPTY-BLOCKS')).toBe(true);
  });

  it('flags unknown block type as CRITICAL (CB-04)', () => {
    const issues = validateCardSpec({
      sectionKey: 'scope',
      title: 'X',
      blocks: [{ type: 'banana' } as any],
    });
    expect(hasCriticalIssues(issues)).toBe(true);
  });

  it('passes a well-formed spec with no CRITICAL', () => {
    const issues = validateCardSpec({
      sectionKey: 'targetState',
      title: 'Stan docelowy',
      blocks: [{ type: 'paragraph', text: 'Samoobsługa w 24h' }],
    });
    expect(hasCriticalIssues(issues)).toBe(false);
  });

  it('flags mismatched table rows as MAJOR (CB-06), not CRITICAL', () => {
    const issues = validateCardSpec({
      sectionKey: 'kpis',
      title: 'KPI',
      blocks: [{ type: 'table', columns: ['a', 'b'], rows: [['1']] }],
    });
    expect(issues.some((i) => i.code === 'CB-06-TABLE-SHAPE')).toBe(true);
    expect(hasCriticalIssues(issues)).toBe(false);
  });
});

describe('extractJsonObject + coerceToCardSpec', () => {
  it('extracts JSON from a fenced ```json block', () => {
    const obj = extractJsonObject('```json\n{"title":"T","blocks":[]}\n```');
    expect(obj).toMatchObject({ title: 'T' });
  });

  it('extracts JSON embedded in surrounding prose', () => {
    const obj = extractJsonObject('Oto karta: {"title":"T","blocks":[]} — gotowe.');
    expect(obj).toMatchObject({ title: 'T' });
  });

  it('returns null for non-JSON', () => {
    expect(extractJsonObject('zupełnie nie json')).toBeNull();
    expect(extractJsonObject('')).toBeNull();
  });

  it('coerce forces sectionKey and tolerates garbage', () => {
    const spec = coerceToCardSpec({ title: 'T', blocks: 'nope' }, 'scope', 'fallback');
    expect(spec.sectionKey).toBe('scope');
    expect(spec.blocks).toEqual([]);
    const spec2 = coerceToCardSpec(null, 'control', 'Fallback Title');
    expect(spec2.title).toBe('Fallback Title');
  });
});

// ── L2: generateSectionCardSpec — gate + auto-heal loop ──────────────────────

describe('generateSectionCardSpec — critic gate', () => {
  it('returns a valid CardSpec on first try (no regen)', async () => {
    mockCall.mockResolvedValueOnce(
      llmReturns({ title: 'Definicja problemu', blocks: [{ type: 'paragraph', text: 'Spadek 12%' }] })
    );
    const res = await service.generateSectionCardSpec('problemDefinition', ctx);
    expect(res.ok).toBe(true);
    expect(res.regenerated).toBe(false);
    expect(res.cardSpec?.sectionKey).toBe('problemDefinition');
    expect(res.cardSpec?.blocks).toHaveLength(1);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('auto-heals: CRITICAL first → regenerates once → valid', async () => {
    mockCall
      .mockResolvedValueOnce(llmReturns({ title: '', blocks: [] })) // CB-03 CRITICAL
      .mockResolvedValueOnce(
        llmReturns({ title: 'Zakres', blocks: [{ type: 'bullet_list', items: ['A', 'B'] }] })
      );
    const res = await service.generateSectionCardSpec('scope', ctx);
    expect(res.regenerated).toBe(true);
    expect(res.ok).toBe(true);
    expect(res.cardSpec?.blocks?.[0]).toMatchObject({ type: 'bullet_list' });
    expect(mockCall).toHaveBeenCalledTimes(2);
    // the heal prompt must feed back the validator issues
    const secondPrompt = mockCall.mock.calls[1][0]?.messages?.[0]?.content || '';
    expect(secondPrompt).toContain('ODRZUCONA PRZEZ WALIDATOR');
  });

  it('gives up after one regen and reports ok=false (caller falls back to builder)', async () => {
    mockCall
      .mockResolvedValueOnce(llmReturns({ title: 'x', blocks: [] }))
      .mockResolvedValueOnce(llmReturns({ title: 'x', blocks: [] }));
    const res = await service.generateSectionCardSpec('kpis', ctx);
    expect(res.regenerated).toBe(true);
    expect(res.ok).toBe(false);
    expect(hasCriticalIssues(res.issues)).toBe(true);
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it('respects maxRegen=0 (single attempt, no heal)', async () => {
    mockCall.mockResolvedValueOnce(llmReturns({ title: 'x', blocks: [] }));
    const res = await service.generateSectionCardSpec('control', ctx, undefined, { maxRegen: 0 });
    expect(res.ok).toBe(false);
    expect(res.regenerated).toBe(false);
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('survives malformed (non-JSON) LLM output → coerces to empty, gate fails soft', async () => {
    mockCall
      .mockResolvedValueOnce(llmReturns('totalnie nie json'))
      .mockResolvedValueOnce(llmReturns('dalej nie json'));
    const res = await service.generateSectionCardSpec('targetState', ctx);
    expect(res.ok).toBe(false);
    expect(res.cardSpec?.blocks).toEqual([]);
    expect(mockCall).toHaveBeenCalledTimes(2);
  });
});
