import { beforeEach, describe, expect, it, vi } from 'vitest';

// FIX-3 (ODBIOR_231, P0): `generateKnowledgeOutline` mocks its two edges —
// `AIPipeline.getInstance().process` (the model call) and `executeToolCall`
// (the tool executor) — exactly like R5b's boundary-only mock, so the guard
// at presentationKnowledgeOutlineService.ts (`if
// (!toolCalls.includes('search_knowledge_base')) throw ...`) runs for real
// and the test can prove it is actually load-bearing (mutation A from the
// audit — `if (false)` — must turn RED here).
const executeToolCallMock = vi.fn(async () =>
  JSON.stringify({
    source: 'knowledge_base',
    results: [{ content: 'Retencja 63,4%.', documentTitle: 'Raport pilotażu', score: 0.9 }],
  })
);
vi.mock('../ai/toolDefinitions.js', () => ({
  executeToolCall: (...args: unknown[]) => executeToolCallMock(...args),
}));

let pipelineBehavior: 'calls-tool' | 'skips-tool' = 'calls-tool';
const processMock = vi.fn(async (request: any) => {
  if (pipelineBehavior === 'calls-tool') {
    await request.options.readTools.context.executeReadTool('search_knowledge_base', {
      query: 'retencja',
    });
  }
  const content = JSON.stringify({
    outline: [
      {
        tytul: 'Wynik pilotażu',
        teza: 'Retencja osiągnęła 63,4%.',
        archetyp: 'single_insight',
        zrodla: [{ typ: 'knowledge_doc', id: 'raport-pilotazu', etykieta: 'Raport pilotażu' }],
      },
    ],
  });
  return {
    success: true,
    stream: (async function* () {
      yield content;
    })(),
    metadata: { provider: 'mock', model: 'mock' },
  };
});
vi.mock('../ai/AIPipeline.js', () => ({
  AIPipeline: { getInstance: () => ({ process: (...args: unknown[]) => processMock(...args) }) },
}));

// featureFlags is a frozen snapshot computed at import time; FIX-5's
// upfront gate reads `featureFlags.ENABLE_TERESA_TOOL_LOOP` from it, so this
// suite must see it enabled to exercise the guard below the gate.
vi.mock('../../config/FeatureFlags.js', () => ({
  default: { ENABLE_TERESA_TOOL_LOOP: true },
}));

const { filterOutlineSourcesByEvidence, parseKnowledgeOutline, generateKnowledgeOutline } =
  await import('../presentationKnowledgeOutlineService.js');

describe('Day231 presentation knowledge outline contract', { retry: 0 }, () => {
  it('parses a grounded thesis and preserves exact provenance', () => {
    const outline = parseKnowledgeOutline(JSON.stringify({
      outline: [{
        tytul: 'Retencja po pilotażu',
        teza: 'Retencja osiągnęła 63,4% wobec 51,2% w grupie kontrolnej.',
        archetyp: 'performance_overview',
        zrodla: [{ typ: 'knowledge_doc', id: 'doc-231', etykieta: 'Raport pilotażu' }],
      }],
    }));
    expect(outline).toEqual([{
      tytul: 'Retencja po pilotażu',
      teza: 'Retencja osiągnęła 63,4% wobec 51,2% w grupie kontrolnej.',
      archetyp: 'performance_overview',
      zrodla: [{ typ: 'knowledge_doc', id: 'doc-231', etykieta: 'Raport pilotażu' }],
    }]);
  });

  it('keeps zrodla empty instead of inventing incomplete references', () => {
    const [item] = parseKnowledgeOutline('```json\n[{"tytul":"Kierunek","teza":"Potrzebna jest decyzja.","archetyp":"next_steps","zrodla":[{"typ":"","id":"x","etykieta":"?"}]}]\n```');
    expect(item.zrodla).toEqual([]);
  });

  // FIX-2 (ODBIOR_231, P0): `evidence` is the raw JSON of `executeKBSearch`
  // (toolDefinitions.ts:1174-1178), which exposes only `content` /
  // `documentTitle` / `score` — NEVER a `documentId`. The old test asserted
  // matching against a fabricated `{"documentId":"doc-real"}` shape that the
  // real tool never produces, so the old filter (`evidence.includes(source.id)`)
  // could never let a real source through — this is the "zabezpieczenie
  // zielone bo nie działa nikomu" defect. This test uses the REAL shape and
  // is the mandatory pair: an invented source is dropped AND a real one
  // (matched by `documentTitle`, the only identifier the tool exposes) survives.
  it('BRAMKA FIX-2: drops an invented source AND lets a real knowledge-base source through', () => {
    const outline = parseKnowledgeOutline(
      '[{"tytul":"Wynik","teza":"63,4%","archetyp":"single_insight","zrodla":[' +
        '{"typ":"knowledge_doc","id":"raport-pilotazu","etykieta":"Raport pilotażu"},' +
        '{"typ":"knowledge_doc","id":"doc-invented","etykieta":"Zmyślone źródło"}]}]'
    );
    const evidence = JSON.stringify({
      source: 'knowledge_base',
      results: [{ content: 'Retencja 63,4%.', documentTitle: 'Raport pilotażu', score: 0.91 }],
    });
    expect(filterOutlineSourcesByEvidence(outline, evidence)[0].zrodla).toEqual([
      { typ: 'knowledge_doc', id: 'raport-pilotazu', etykieta: 'Raport pilotażu' },
    ]);
  });

  it('BRAMKA FIX-2: normalizes whitespace/case before matching a real documentTitle', () => {
    const outline = parseKnowledgeOutline(
      '[{"tytul":"Wynik","teza":"63,4%","archetyp":"single_insight","zrodla":[' +
        '{"typ":"knowledge_doc","id":"x","etykieta":"  raport   PILOTAŻU  "}]}]'
    );
    const evidence = JSON.stringify({
      results: [{ content: '...', documentTitle: 'Raport pilotażu', score: 0.5 }],
    });
    expect(filterOutlineSourcesByEvidence(outline, evidence)[0].zrodla).toHaveLength(1);
  });

  // FIX-3 (ODBIOR_231, P0): mutacja A z audytu (`if
  // (!toolCalls.includes('search_knowledge_base'))` -> `if (false)`) zostawiała
  // testy zielone 4/4 — strażnik fail-closed nie miał ŻADNEGO pokrycia. Te
  // dwa testy wołają `generateKnowledgeOutline` na boundary-mockach
  // (AIPipeline.process + executeToolCall) i muszą się CZERWIENIĆ pod tą
  // dokładną mutacją.
  describe('BRAMKA FIX-3: fail-closed guard has real coverage', () => {
    beforeEach(() => {
      pipelineBehavior = 'calls-tool';
      processMock.mockClear();
      executeToolCallMock.mockClear();
    });

    it('rejects when the model never calls search_knowledge_base', async () => {
      pipelineBehavior = 'skips-tool';
      await expect(
        generateKnowledgeOutline({
          organizationId: 'org-1',
          userId: 'user-1',
          title: 'T',
          audience: 'executive',
          goal: 'decide',
          language: 'pl',
        })
      ).rejects.toThrow('KNOWLEDGE_OUTLINE_SEARCH_NOT_CALLED');
      expect(executeToolCallMock).not.toHaveBeenCalled();
    });

    it('resolves when the model does call search_knowledge_base', async () => {
      pipelineBehavior = 'calls-tool';
      const result = await generateKnowledgeOutline({
        organizationId: 'org-1',
        userId: 'user-1',
        title: 'T',
        audience: 'executive',
        goal: 'decide',
        language: 'pl',
      });
      expect(executeToolCallMock).toHaveBeenCalledTimes(1);
      expect(result.outline[0].zrodla).toEqual([
        { typ: 'knowledge_doc', id: 'raport-pilotazu', etykieta: 'Raport pilotażu' },
      ]);
    });
  });
});
