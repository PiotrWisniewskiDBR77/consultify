/**
 * O-INJ-07 (Fala 2) — CARD_CONTENT_FORMULA + tone INJECTION proof for the
 * Insight/report generator (InterviewInsightService.generateInsight / buildV6Prompt).
 *
 * WHY this test exists: prior audits (Fala 1) asserted "O7 formula+ton" was wired
 * into the AI generation prompt by grepping the SOURCE FILE for the string
 * `CARD_CONTENT_FORMULA` — but a string existing SOMEWHERE in a file (e.g. in the
 * advisory post-hoc validator or its repair-prompt builder) is NOT proof that the
 * literal doctrine text is actually INJECTED into the prompt that gets sent to the
 * LLM on the FIRST generation pass. This suite intercepts the REAL, ACTUAL prompt
 * object handed to `llmService.generateResponse` by calling the real, unmodified
 * `generateInsight` method (private, invoked directly via `as any` — no duplicated
 * prompt-building logic) with every DB dependency mocked/spied out, and asserts on
 * the captured `{ prompt, systemPrompt }`.
 *
 * FINDING (honest, per protocol): unlike the Initiative generator — which literally
 * interpolates `CARD_CONTENT_FORMULA_A3_LITE` / `_FULL` (server/src/services/
 * initiative/cardContentFormulaPrompt.ts) into its FIRST-PASS prompts (locked by
 * tests/unit/backend/services/initiativeGenerationService.formula.test.ts, M13 #16)
 * — the Insight/report generator's FIRST-PASS prompt (`buildV6Prompt`) does NOT
 * contain the literal string `CARD_CONTENT_FORMULA` anywhere (checked below). It
 * DOES bake in the numeric thresholds from the same SSOT (executive_summary
 * 60-130 words / ≥3 sentences, ≥3 themes, ≥2 issues, ≥2 missing_data — see
 * commit d02570cef3 "tightened the V6 prompt output contract to the formula
 * thresholds") via its own duplicated doctrine text (BCG_P10_PROMPT_DOCTRINE,
 * INSIGHT_SECTION_BCG_GUIDANCE, `_FORMULA_TRESCI_INSIGHT` §3 per-type guidance),
 * and it DOES carry the tone directives (McKinsey-style, executive, "so what",
 * zero jargon padding) in the `systemPrompt`. The literal `CARD_CONTENT_FORMULA`
 * name is only wired in on the ADVISORY side: the post-generation scorer
 * (`validateInsightCard`) and — only when that scorer fails — the ONE-SHOT
 * auto-repair prompt (`buildRepairBriefFromVerdict`). This is a real gap vs. the
 * Initiative path (no shared SSOT text-block reuse for Insight's first pass) —
 * reported as a finding, not silently asserted as "done".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- LLM client mock ----------------------------------------------------------
// InterviewInsightService calls `llmService.generateResponse(...)` (not `.call`,
// unlike initiativeGenerationService — different client method on the same
// singleton). Mock only that method; capture every call's argument object.
const mockGenerateResponse = vi.fn();
vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: { generateResponse: (...args: unknown[]) => mockGenerateResponse(...args) },
  default: { generateResponse: (...args: unknown[]) => mockGenerateResponse(...args) },
}));

// --- DB mock --------------------------------------------------------------
// generateInsight() does a best-effort `db.get` (title lookup, wrapped in its
// own try/catch — fail-soft) and, after the LLM call, a `db.run` UPDATE plus a
// context-lineage write. We stub all three generically; none of this touches a
// real database, and none of it is what this test is proving.
const mockDbGet = vi.fn().mockResolvedValue({ title: 'Wąskie gardło w akceptacji zamówień' });
const mockDbRun = vi.fn().mockResolvedValue(undefined);
const mockDbAll = vi.fn().mockResolvedValue([]);
vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ get: mockDbGet, run: mockDbRun, all: mockDbAll, query: mockDbRun }),
}));

const IMPORT_PATH = '../../../../server/src/services/InterviewInsightService.js';

/** Minimal fake session data — the exact shape `fetchSessionData` returns. */
const FAKE_SESSION_DATA = [
  {
    id: 'sess-1',
    name: 'Respondent A',
    status: 'completed',
    template_name: 'Ops Assessment',
    job_title: 'COO',
    department: 'Operations',
    answers: [
      {
        id: 'ans-1',
        question_text: 'Jak wygląda proces akceptacji zamówień?',
        answer_text: 'Akceptacja zajmuje 5 dni, głównie z powodu ręcznych przekazań między działami.',
        category: 'process',
        status: 'answered',
        confidence_score: 0.9,
      },
    ],
  },
];

/** A VALID V6 payload — passes the hard gate cleanly (no filler, title present, etc.). */
const VALID_V6_RESPONSE = {
  schema_version: 'v6',
  executive_summary:
    'Proces akceptacji zamówień trwa średnio 5 dni roboczych wobec celu 2 dni, co generuje opóźnienia dostaw. ' +
    'Główną przyczyną są ręczne przekazania między działami sprzedaży i finansów, bez jednego właściciela procesu. ' +
    'Wniosek ma średnią pewność — oparty na jednej sesji wywiadu z COO, wymaga triangulacji z działem finansów.',
  themes: [
    {
      title: 'Ręczne przekazania wydłużają cykl akceptacji',
      description:
        'Zamówienia przechodzą przez trzy ręczne przekazania (sprzedaż → kontroling → finanse) bez jednego ' +
        'właściciela end-to-end, co zgodnie z relacją COO generuje średnio 3 dodatkowe dni oczekiwania na etapie ' +
        'kontrolingu. Brak zautomatyzowanego workflow jest wskazywany jako główna przyczyna źródłowa.',
      evidence_refs: ['ans-1'],
      strength: 'moderate',
    },
  ],
  issues: [
    {
      title: 'Brak jednego właściciela procesu akceptacji',
      description: 'Odpowiedzialność rozproszona między trzy działy, co utrudnia eskalację opóźnień.',
      severity: 'high',
      evidence_refs: ['ans-1'],
    },
    {
      title: 'Brak SLA na poszczególne etapy akceptacji',
      description: 'Żaden z etapów nie ma zdefiniowanego czasu granicznego, co uniemożliwia monitoring.',
      severity: 'medium',
      evidence_refs: ['ans-1'],
    },
  ],
  opportunities: [],
  signals: [],
  evidence_map: [
    {
      answer_id: 'ans-1',
      question_text: 'Jak wygląda proces akceptacji zamówień?',
      answer_snippet: 'Akceptacja zajmuje 5 dni, głównie ręczne przekazania.',
      linked_themes: ['Ręczne przekazania wydłużają cykl akceptacji'],
      linked_issues: ['Brak jednego właściciela procesu akceptacji'],
    },
  ],
  missing_data: [
    'Brak danych z działu finansów potwierdzających przyczynę opóźnień na etapie kontrolingu.',
    'Brak porównania z innymi liniami produktowymi, by ocenić czy problem jest systemowy.',
  ],
  material_quality: {
    overall_material_score: 55,
    answer_quality_posture: 'usable',
    coverage_posture: 'single_perspective',
    missing_voices: ['Dział finansów', 'Dział sprzedaży'],
    limitations: ['Jedna sesja, jeden respondent — brak triangulacji.'],
    recommended_followups: ['Wywiad z kontrolerem finansowym potwierdzający przyczyny opóźnień.'],
  },
};

describe('O-INJ-07 — Insight generator: capture the REAL first-pass prompt sent to the LLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockResolvedValue({ title: 'Wąskie gardło w akceptacji zamówień' });
    mockDbRun.mockResolvedValue(undefined);
    mockDbAll.mockResolvedValue([]);
    mockGenerateResponse.mockResolvedValue({
      content: JSON.stringify(VALID_V6_RESPONSE),
      usage: { totalTokens: 321 },
    });
  });

  it('injects TONE (McKinsey/executive/so-what/BCG doctrine) into systemPrompt, and the CARD_CONTENT_FORMULA numeric thresholds into the user prompt — the REAL, captured first call', async () => {
    const mod = await import(IMPORT_PATH);
    const service = mod.default;

    vi.spyOn(service as any, 'fetchSessionData').mockResolvedValue(FAKE_SESSION_DATA);

    await (service as any).generateInsight(
      'insight-1',
      ['sess-1'],
      'org-1',
      'general_analysis',
      undefined, // customPrompt
      undefined, // analysisScope — let the real code build its own default
      {
        // ApprovedOrgKnowledgePack — concrete object so `buildApprovedOrgKnowledgePack`
        // (a real DB-touching private method) is never invoked (`||` short-circuits).
        requested: false,
        available: false,
        included: false,
        degraded: false,
        degradedReasons: [],
        policy: 'accepted_or_approved_context_claims_only',
        sourceCount: 0,
        builtAt: new Date().toISOString(),
        entries: [],
      },
      undefined, // contextDocumentPack
      'user-1',
      undefined // generationPreferences
    );

    // The FIRST call is the actual generation call (a possible 2nd call would be
    // the auto-repair pass — irrelevant here, VALID_V6_RESPONSE should pass clean).
    expect(mockGenerateResponse).toHaveBeenCalled();
    const firstCallArg = mockGenerateResponse.mock.calls[0][0] as {
      prompt: string;
      systemPrompt: string;
    };
    const { prompt, systemPrompt } = firstCallArg;
    expect(typeof prompt).toBe('string');
    expect(typeof systemPrompt).toBe('string');

    // ── TONE (O7.3) — asserted on the REAL captured systemPrompt ──────────────
    expect(systemPrompt).toContain('McKinsey-style management consultant');
    expect(systemPrompt).toContain('busy executive');
    expect(systemPrompt).toContain('so what');
    expect(systemPrompt).toContain('Ground every finding strictly in the provided interview data');

    // ── FORMULA doctrine actually injected into the first-pass user prompt ───
    // (own duplicated doctrine text, not the shared cardContentFormulaPrompt.ts
    // blocks used by the Initiative generator — see file-header note).
    expect(prompt).toContain('BCG-GRADE DOCTRINE');
    expect(prompt).toContain('SECTION-LEVEL EMPHASIS');
    expect(prompt).toContain('FORMUŁA TREŚCI PER TYP');
    // The literal §B3 numeric thresholds from CARD_CONTENT_FORMULA.md, baked into
    // the JSON-contract instructions (commit d02570cef3):
    expect(prompt).toContain('60-130 words');
    expect(prompt).toContain('≥3 themes');
    expect(prompt).toContain('≥2 issues');
    expect(prompt).toContain('≥2 missing_data');

    // ── HONEST FINDING — the literal SSOT name is NOT in the first-pass prompt ─
    // This is the gap this task was asked to surface if present. It is present.
    expect(prompt).not.toContain('CARD_CONTENT_FORMULA');
    expect(systemPrompt).not.toContain('CARD_CONTENT_FORMULA');
  });

  it('the literal CARD_CONTENT_FORMULA name IS injected on the auto-repair pass (2nd call) when the first draft fails the guardian — confirming the gap is first-pass-only', async () => {
    const mod = await import(IMPORT_PATH);
    const service = mod.default;

    vi.spyOn(service as any, 'fetchSessionData').mockResolvedValue(FAKE_SESSION_DATA);

    // A THIN first draft (short summary, 1 theme, no missing_data) fails the
    // advisory scorer -> triggers exactly one repair pass whose prompt is built
    // by `buildRepairBriefFromVerdict`, which DOES name CARD_CONTENT_FORMULA.
    const thinResponse = {
      ...VALID_V6_RESPONSE,
      executive_summary: 'Krótkie podsumowanie.',
      missing_data: [],
    };
    mockGenerateResponse
      .mockResolvedValueOnce({ content: JSON.stringify(thinResponse) })
      .mockResolvedValueOnce({ content: JSON.stringify(VALID_V6_RESPONSE) });

    await (service as any).generateInsight(
      'insight-2',
      ['sess-1'],
      'org-1',
      'general_analysis',
      undefined,
      undefined,
      {
        requested: false,
        available: false,
        included: false,
        degraded: false,
        degradedReasons: [],
        policy: 'accepted_or_approved_context_claims_only',
        sourceCount: 0,
        builtAt: new Date().toISOString(),
        entries: [],
      },
      undefined,
      'user-1',
      undefined
    );

    expect(mockGenerateResponse.mock.calls.length).toBeGreaterThanOrEqual(2);
    const repairCallArg = mockGenerateResponse.mock.calls[1][0] as { prompt: string };
    expect(repairCallArg.prompt).toContain('CARD_CONTENT_FORMULA');
  });
});
