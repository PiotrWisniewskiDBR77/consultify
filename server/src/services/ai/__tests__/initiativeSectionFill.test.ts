/**
 * K4 (decyzja właściciela 2026-07-19): AI-„uzupełnij" UNIWERSALNIE na KAŻDEJ
 * sekcji inicjatywy. Ten test dowodzi REALNEGO wiringu backendu serwisu
 * `initiativeSectionFill` (LLM zmockowany → asercje deterministyczne):
 *
 *  1. KONTRAKT normalizeFillSectionKey pokrywa WSZYSTKIE realne klucze
 *     komponentów FE (SECTION_REGISTRY) dla 10 sekcji bez natywnego AI —
 *     w tym warianty camelCase/kebab i naprawione luki history/raciEscalation/
 *     initiativeTeam. Sekcje z natywnym AI (scope/kpis/…) → null (kieruj do
 *     /generate-section).
 *  2. generateInitiativeSectionFill dla reprezentatywnych sekcji: buduje
 *     prompt, woła LLM z tierem premium, parsuje JSON, zwraca kontrakt
 *     {content, parsedContent, isJson, sectionKey, model, tokensUsed}.
 *  3. Język PL vs EN wybiera właściwy SYSTEM prompt (doktryna BCG) i regułę
 *     przyszłych dat.
 *  4. LLM nieskonfigurowany → 503/FEATURE_UNAVAILABLE (fail-closed jak brak AI).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLlmCall = vi.fn();
let llmConfigured = true;

vi.mock('../llmService.js', () => ({
  get llmService() {
    return llmConfigured ? { call: (...a: unknown[]) => mockLlmCall(...a) } : null;
  },
  get default() {
    return llmConfigured ? { call: (...a: unknown[]) => mockLlmCall(...a) } : null;
  },
}));

import {
  __resetInitiativeFillLlmForTests,
  generateInitiativeSectionFill,
  INITIATIVE_FILL_PROMPTS,
  INITIATIVE_FILL_SYSTEM_PROMPT_EN,
  INITIATIVE_FILL_SYSTEM_PROMPT_PL,
  normalizeFillSectionKey,
} from '../initiativeSectionFill.js';

beforeEach(() => {
  llmConfigured = true;
  mockLlmCall.mockReset();
  __resetInitiativeFillLlmForTests();
});

// ──────────────────────────────────────────────────────────────────────────
describe('normalizeFillSectionKey — kontrakt kluczy sekcji (10 bez natywnego AI)', () => {
  // Canonical keys — muszą trafiać w siebie.
  const canonical = [
    'team',
    'raci',
    'dependencies',
    'milestones',
    'timeline',
    'technical',
    'tasks',
    'attachments',
    'comments',
    'activity',
  ] as const;

  it.each(canonical)('canonical %s → %s', (k) => {
    expect(normalizeFillSectionKey(k)).toBe(k);
  });

  // ★ Realne klucze komponentów FE (src/components/Initiatives/sections/registry.ts)
  // które MUSZĄ się mapować, inaczej „uzupełnij AI" 400-uje na tej sekcji.
  const feRegistryKeys: Array<[string, string]> = [
    ['team', 'team'],
    ['initiativeTeam', 'team'], // legacy FE key
    ['raciEscalation', 'raci'], // FE komponent-key (bug regression lock)
    ['dependencies', 'dependencies'],
    ['timeline', 'timeline'],
    ['tasks', 'tasks'],
    ['attachments', 'attachments'],
    ['comments', 'comments'],
    ['history', 'activity'], // HistorySection = Activity Log
  ];

  it.each(feRegistryKeys)('FE key %s → %s', (feKey, expected) => {
    expect(normalizeFillSectionKey(feKey)).toBe(expected);
  });

  // Warianty pisowni (snake/kebab/case).
  it.each([
    ['ACTIVITY-LOG', 'activity'],
    ['activity_log', 'activity'],
    ['raci-escalation', 'raci'],
    ['technical-spec', 'technical'],
    ['technicalSpecification', 'technical'],
    ['attachments-and-links', 'attachments'],
    ['team-staffing', 'team'],
  ])('wariant %s → %s', (raw, expected) => {
    expect(normalizeFillSectionKey(raw)).toBe(expected);
  });

  // Sekcje z natywnym AI (obsługiwane przez /generate-section) → null.
  it.each([
    'scope',
    'kpis',
    'financialAnalysis',
    'financialImpact',
    'resources',
    'raid',
    'decisions',
    'gates',
    'unknown-xyz',
    '',
  ])('natywne/nieznane „%s" → null (kieruj do /generate-section)', (raw) => {
    expect(normalizeFillSectionKey(raw)).toBeNull();
  });

  it('każdy zwrócony klucz ma prompt w INITIATIVE_FILL_PROMPTS', () => {
    for (const k of canonical) {
      expect(INITIATIVE_FILL_PROMPTS[k]).toBeDefined();
      expect(INITIATIVE_FILL_PROMPTS[k].instruction.length).toBeGreaterThan(40);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('generateInitiativeSectionFill — wiring LLM (mock)', () => {
  function stubJson(payload: unknown) {
    mockLlmCall.mockResolvedValue({
      content: JSON.stringify(payload),
      usage: { totalTokens: 321 },
      model: 'claude-sonnet-4-6',
    });
  }

  it('team: buduje prompt, woła premium, parsuje JSON, zwraca kontrakt', async () => {
    stubJson({
      team: [
        { role: 'lider projektu', responsibility: 'koordynacja i bramki', fte: '0.2 (szacunek)' },
        {
          role: 'analityk procesów',
          responsibility: 'mapowanie AS-IS/TO-BE',
          fte: '0.5 (szacunek)',
        },
        {
          role: 'inżynier utrzymania',
          responsibility: 'wdrożenie techniczne',
          fte: '0.3 (szacunek)',
        },
      ],
    });

    const res = await generateInitiativeSectionFill(
      'team',
      {
        initiativeName: 'Redukcja przestojów linii',
        summary: 'Skrócić MTTR na linii pakowania',
        module: 'Operations',
      },
      { language: 'pl' }
    );

    expect(mockLlmCall).toHaveBeenCalledTimes(1);
    const callArg = mockLlmCall.mock.calls[0][0] as any;
    // Tier premium, doktryna BCG PL, kontekst inicjatywy w USER prompcie.
    expect(callArg.modelConfig).toEqual({ id: 'premium' });
    expect(callArg.systemPrompt).toBe(INITIATIVE_FILL_SYSTEM_PROMPT_PL);
    expect(callArg.messages[0].content).toContain('Redukcja przestojów linii');
    expect(callArg.messages[0].content).toContain('SKŁAD ZESPOŁU'); // instrukcja sekcji obecna

    // Kontrakt wyniku.
    expect(res.sectionKey).toBe('team');
    expect(res.isJson).toBe(true);
    expect(res.model).toBe('claude-sonnet-4-6');
    expect(res.tokensUsed).toBe(321);
    expect((res.parsedContent as any).team).toHaveLength(3);
  });

  it('history (FE) → activity: uzupełnia właściwą sekcję', async () => {
    stubJson({
      summary: 'Postęp on-track',
      recentHighlights: ['pilotaż zakończony'],
      momentum: 'on-track — 2/3 kamieni',
    });

    const res = await generateInitiativeSectionFill(
      'history',
      { initiativeName: 'X' },
      { language: 'pl' }
    );

    expect(res.sectionKey).toBe('activity');
    expect((res.parsedContent as any).momentum).toContain('on-track');
  });

  it('raciEscalation (FE) → raci: uzupełnia macierz RACI', async () => {
    stubJson({
      raci: [
        {
          activity: 'zatwierdzenie zakresu',
          responsible: 'PM',
          accountable: 'sponsor',
          consulted: 'ops',
          informed: 'zespół',
        },
        {
          activity: 'wdrożenie',
          responsible: 'inżynier',
          accountable: 'PM',
          consulted: 'sponsor',
          informed: 'ops',
        },
        {
          activity: 'odbiór',
          responsible: 'QA',
          accountable: 'sponsor',
          consulted: 'PM',
          informed: 'zespół',
        },
      ],
    });

    const res = await generateInitiativeSectionFill(
      'raciEscalation',
      { initiativeName: 'X' },
      { language: 'pl' }
    );
    expect(res.sectionKey).toBe('raci');
    expect((res.parsedContent as any).raci).toHaveLength(3);
  });

  it('język EN → SYSTEM prompt EN + reguła przyszłych dat', async () => {
    stubJson({
      phases: [{ phase: 'Discovery', start: '+0', end: '+4w', goal: 'baseline captured' }],
    });

    await generateInitiativeSectionFill('timeline', { initiativeName: 'X' }, { language: 'en' });
    const callArg = mockLlmCall.mock.calls[0][0] as any;
    expect(callArg.systemPrompt).toBe(INITIATIVE_FILL_SYSTEM_PROMPT_EN);
    expect(callArg.messages[0].content).toMatch(/ALL dates\/deadlines MUST be \d{4} or later/);
  });

  it('klucz spoza serwisu → rzuca (router mapuje na 400 SECTION_NOT_FILLABLE)', async () => {
    await expect(generateInitiativeSectionFill('scope', { initiativeName: 'X' })).rejects.toThrow(
      /Unsupported initiative fill section/
    );
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  it('LLM nieskonfigurowany → 503 FEATURE_UNAVAILABLE (fail-closed)', async () => {
    llmConfigured = false;
    __resetInitiativeFillLlmForTests();
    await expect(
      generateInitiativeSectionFill('team', { initiativeName: 'X' })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'FEATURE_UNAVAILABLE',
    });
  });
});
