/**
 * Deliverables — lekki runtime: gałąź DOC (L2).
 *
 * Weryfikuje kontrakt plan→generate→poll dla format='doc':
 *   1. planDoc tworzy canvas draft i zwraca edytowalny plan (plan_ready).
 *   2. planDoc odrzuca setup bez intencji (invalid_setup) — wejście = rozmowa.
 *   3. startDoc + statusDoc: szczęśliwa ścieżka kończy się stanem 'draft'
 *      z realną treścią zapisaną do draftu i referencją artefaktu.
 *   4. Bramka D-L2-3: gdy silnik prozy odda stuby (cicha degradacja LLM),
 *      generacja kończy się uczciwym stanem 'error' — draft NIE jest
 *      nadpisywany wydmuszką.
 *   5. statusDoc po restarcie procesu (pusta mapa runtime) wnioskuje stan
 *      z treści draftu (szkielet ⇒ plan_ready, treść ⇒ draft).
 *
 * documentStudio i workCanvas są mockowane na granicy modułów — spec biega
 * bez DB i bez LLM.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const createDraftMock = vi.fn();
const getDraftMock = vi.fn();
const updateDraftMock = vi.fn();
const planDocumentMock = vi.fn();
const materializeMock = vi.fn();
const renderMarkdownMock = vi.fn();
const generateChatResponseMock = vi.fn();

vi.mock('../../aiService.js', () => ({
  generateChatResponse: (...args: unknown[]) => generateChatResponseMock(...args),
}));

vi.mock('../../workCanvasService.js', () => ({
  createDraft: (...args: unknown[]) => createDraftMock(...args),
  getDraft: (...args: unknown[]) => getDraftMock(...args),
  updateDraft: (...args: unknown[]) => updateDraftMock(...args),
}));

vi.mock('../../documentStudio/documentStudioService.js', () => ({
  planDocument: (...args: unknown[]) => planDocumentMock(...args),
  materializeDocumentArtifact: (...args: unknown[]) => materializeMock(...args),
}));

vi.mock('../../documentStudio/documentSchemaRenderer.js', () => ({
  renderSchemaToMarkdown: (...args: unknown[]) => renderMarkdownMock(...args),
}));

const buildContextPackMock = vi.fn();
vi.mock('../../contextPackBuilder.js', () => ({
  buildContextPack: (...args: unknown[]) => buildContextPackMock(...args),
}));

vi.mock('../../tableSchemaGeneratorService.js', () => ({
  generateTableSchema: vi.fn().mockResolvedValue({
    tierUsed: 'STANDARD',
    fallbackUsed: true,
    fields: [],
    seedRows: [],
    conditionalFormatting: [],
    hasFormulas: false,
    sheets: [],
  }),
}));

const registerArtifactOriginMock = vi.fn();
vi.mock('../../v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: unknown[]) => registerArtifactOriginMock(...args),
}));

const searchInsightsMock = vi.fn();
vi.mock('../../ai/tools/searchInsights.js', () => ({
  searchInsights: (...args: unknown[]) => searchInsightsMock(...args),
}));
const searchOrgNotesMock = vi.fn();
vi.mock('../../ai/tools/searchOrgNotes.js', () => ({
  searchOrgNotes: (...args: unknown[]) => searchOrgNotesMock(...args),
}));

const featureFlagsMock = { ENABLE_DELIVERABLES_DOC_STREAMING: false };
vi.mock('../../../config/FeatureFlags.js', () => ({
  get featureFlags() {
    return featureFlagsMock;
  },
}));

const {
  planDoc,
  planSheet,
  polishMarkdownForCanvas,
  dedupeMarkdownHeadings,
  startDoc,
  startSheet,
  statusDoc,
  __clearDocRuntimeStateForTests,
} = await import('../docGenerationRuntime.js');
const { isPlaceholderDocumentProse, SECTION_STUB_PREFIX } =
  await import('../../documentStudio/documentContentGenerator.js');
const { DeliverablesGenerationError } = await import('../errors.js');

const ORG = 'org-1';
const USER = 'user-1';

const outline = {
  documentType: 'generic_document',
  title: 'Raport o transformacji',
  sections: [
    { title: 'Synteza', level: 1, purpose: 'Najważniejsze wnioski', expectedLengthHint: 'short' },
    { title: 'Kontekst', level: 1, purpose: 'Tło', expectedLengthHint: 'medium' },
  ],
  recommendedDensity: 'standard',
  recommendedRegister: 'professional',
  recommendedLanguageStyle: 'consulting',
};

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    organizationId: ORG,
    conversationId: 'conv-1',
    kind: 'document',
    title: 'Raport o transformacji',
    content: '# Raport\n\n> Teresa pisze treść — sekcje wypełnią się po zakończeniu generacji.',
    sources: [],
    provenance: {
      deliverablesGeneration: {
        intake: { description: 'Napisz raport', language: 'pl', title: 'Raport o transformacji' },
        outline,
      },
    },
    artifactId: null,
    ...overrides,
  };
}

async function flushBackgroundWork() {
  // startDoc odpala generację jako void async — dwa ticki wystarczą, bo
  // wszystkie awaity w środku są zamockowane synchronicznie.
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
  __clearDocRuntimeStateForTests();
  planDocumentMock.mockReturnValue({ outline });
  createDraftMock.mockResolvedValue(draftRow());
  getDraftMock.mockResolvedValue(draftRow());
  updateDraftMock.mockResolvedValue(draftRow());
  materializeMock.mockResolvedValue({ artifactId: 'doc-artifact-1', schema: {} });
  buildContextPackMock.mockResolvedValue({ key_points: [], data_points: [] });
  searchInsightsMock.mockResolvedValue({ results: [], truncated: false });
  searchOrgNotesMock.mockResolvedValue({ results: [], truncated: false });
  registerArtifactOriginMock.mockResolvedValue({ artifactId: 'registry-1' });
  featureFlagsMock.ENABLE_DELIVERABLES_DOC_STREAMING = false;
  renderMarkdownMock.mockReturnValue(
    '# Raport o transformacji\n\n## Synteza\n\nRealna treść konsultingowa oparta o kontekst.'
  );
});

describe('isPlaceholderDocumentProse (D-L2-3)', () => {
  it('wykrywa nowe stuby sekcji i historyczne teksty MVP-1', () => {
    expect(isPlaceholderDocumentProse(`${SECTION_STUB_PREFIX} — "Kontekst".`)).toBe(true);
    expect(isPlaceholderDocumentProse('MVP-1 ships this as a structured placeholder')).toBe(true);
    expect(isPlaceholderDocumentProse('Key message go here. Replace with grounded text')).toBe(
      true
    );
  });

  it('przepuszcza realną prozę', () => {
    expect(isPlaceholderDocumentProse('Transformacja objęła 7 z 12 procesów produkcyjnych.')).toBe(
      false
    );
  });
});

describe('polishMarkdownForCanvas (Kimi-parity: czysty deliverable)', () => {
  it('usuwa blok metadanych, notki Purpose i tłumaczy etykiety calloutów', () => {
    const raw = [
      '# Tytuł',
      '',
      '- **Document type:** generic_document',
      '- **Audience:** Unspecified',
      '- **Confidentiality:** internal',
      '',
      '## Synteza',
      '',
      '_Purpose: Top-level synthesis with the decision._',
      '',
      'Realna treść.',
      '',
      '> **KEY_MESSAGE:** Najważniejszy wniosek.',
    ].join('\n');
    const polished = polishMarkdownForCanvas(raw, 'pl');
    expect(polished).not.toContain('Document type');
    expect(polished).not.toContain('_Purpose:');
    expect(polished).not.toContain('KEY_MESSAGE');
    expect(polished).toContain('> **Kluczowa myśl:** Najważniejszy wniosek.');
    expect(polished).toContain('Realna treść.');
  });
});

describe('dedupeMarkdownHeadings (BUG E — zdublowane nagłówki)', () => {
  it('scala dwa równoważne H2 pod rząd (tytuł + opis bez treści między)', () => {
    const raw = ['## Streszczenie', '', '## Streszczenie', '', 'Treść sekcji.'].join('\n');
    const out = dedupeMarkdownHeadings(raw);
    expect(out.match(/## Streszczenie/g)?.length).toBe(1);
    expect(out).toContain('Treść sekcji.');
  });

  it('traktuje Streszczenie/Podsumowanie jako synonim gdy stoją pod rząd', () => {
    const raw = ['## Streszczenie', '', '## Podsumowanie', '', 'Kluczowe wnioski.'].join('\n');
    const out = dedupeMarkdownHeadings(raw);
    // Zostaje jeden nagłówek (pierwszy), treść zachowana.
    const h2 = out.match(/^## .*/gm) || [];
    expect(h2.length).toBe(1);
    expect(out).toContain('Kluczowe wnioski.');
  });

  it('NIE łączy nagłówków rozdzielonych realną treścią', () => {
    const raw = [
      '## Streszczenie',
      '',
      'Realny akapit.',
      '',
      '## Podsumowanie',
      '',
      'Inny akapit.',
    ].join('\n');
    const out = dedupeMarkdownHeadings(raw);
    expect(out).toContain('## Streszczenie');
    expect(out).toContain('## Podsumowanie');
  });
});

describe('planDoc', () => {
  it('tworzy draft i zwraca plan_ready z sekcjami outline', async () => {
    const result = await planDoc({
      setup: { intent: 'Napisz raport o transformacji', language: 'pl', conversationId: 'conv-1' },
      organizationId: ORG,
      userId: USER,
    });

    expect(result.state).toBe('plan_ready');
    expect(result.generationId).toBe('draft-1');
    expect(result.format).toBe('doc');
    expect(result.plan.map((p) => p.title)).toEqual(['Synteza', 'Kontekst']);
    expect(createDraftMock).toHaveBeenCalledTimes(1);
    const input = createDraftMock.mock.calls[0][0].input;
    expect(input.kind).toBe('document');
    expect(input.provenance.deliverablesGeneration.outline).toEqual(outline);
  });

  it('odrzuca setup bez intencji (invalid_setup)', async () => {
    await expect(
      planDoc({ setup: { language: 'pl' }, organizationId: ORG, userId: USER })
    ).rejects.toMatchObject({ code: 'invalid_setup' });
    expect(createDraftMock).not.toHaveBeenCalled();
  });
});

describe('startDoc + statusDoc — szczęśliwa ścieżka', () => {
  it('kończy w stanie draft z zapisaną treścią i referencją artefaktu', async () => {
    const started = await startDoc({
      generationId: 'draft-1',
      setup: {},
      organizationId: ORG,
      userId: USER,
    });
    expect(started.state).toBe('generating');

    await flushBackgroundWork();

    expect(materializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ useLlm: true, organizationId: ORG, userId: USER })
    );
    expect(updateDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-1',
        patch: expect.objectContaining({
          content: expect.stringContaining('Realna treść'),
          artifactId: 'doc-artifact-1',
        }),
      })
    );

    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
    expect(status.artifact).toMatchObject({
      artifactId: 'doc-artifact-1',
      originRecordId: 'draft-1',
      format: 'doc',
      unitCount: 2,
    });
  });

  it('odrzuca podwójny start tej samej generacji (invalid_state)', async () => {
    // Pierwszy start zostawia stan 'generating' w mapie (mock materialize wisi).
    materializeMock.mockReturnValue(new Promise(() => {}));
    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await expect(
      startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER })
    ).rejects.toMatchObject({ code: 'invalid_state' });
  });
});

describe('startDoc — tor streaming zunifikowany z Document Studio (C3)', () => {
  it('materializuje encję Studio + rejestruje w Outputs, mimo streamingu do draftu', async () => {
    // Streaming ON: sekcje rosną w draftcie (per-sekcja LLM), ale artefakt
    // KANONICZNY nadal powstaje przez materializeDocumentArtifact (encja Studio).
    featureFlagsMock.ENABLE_DELIVERABLES_DOC_STREAMING = true;
    generateChatResponseMock.mockResolvedValue({
      content: 'Realna, konkretna treść sekcji oparta o kontekst konsultingowy.',
    });

    const started = await startDoc({
      generationId: 'draft-1',
      setup: {},
      organizationId: ORG,
      userId: USER,
    });
    expect(started.state).toBe('generating');

    await flushBackgroundWork();
    // Streaming woła LLM raz na sekcję (2 sekcje w outline).
    expect(generateChatResponseMock).toHaveBeenCalledTimes(2);

    // Kanoniczna unifikacja: encja Studio powstaje TAKŻE na torze streaming.
    expect(materializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ useLlm: true, organizationId: ORG, userId: USER })
    );
    // Draft dostaje referencję do encji Studio (artifactId) — eksport DOCX/PDF.
    expect(updateDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-1',
        patch: expect.objectContaining({ artifactId: 'doc-artifact-1' }),
      })
    );
    // Rejestr Outputs: dokument z czatu istnieje jako 'report'/'document'.
    expect(registerArtifactOriginMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputType: 'report',
        artifactFamily: 'document',
        originRecordId: 'doc-artifact-1',
      })
    );

    // statusDoc zwraca referencję encji Studio (nie fallback na draft.id).
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
    expect(status.artifact).toMatchObject({ artifactId: 'doc-artifact-1', format: 'doc' });
  });

  it('awaria materializacji Studio nie psuje gotowego draftu (best-effort)', async () => {
    featureFlagsMock.ENABLE_DELIVERABLES_DOC_STREAMING = true;
    generateChatResponseMock.mockResolvedValue({
      content: 'Realna, konkretna treść sekcji oparta o kontekst konsultingowy.',
    });
    materializeMock.mockRejectedValueOnce(new Error('wave5 down'));

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    // Draft nadal zapisany z treścią (bez artifactId) — użytkownik ma dokument.
    const lastUpdate = updateDraftMock.mock.calls.at(-1)?.[0];
    expect(lastUpdate?.patch?.content).toContain('Realna');
    expect(lastUpdate?.patch?.artifactId).toBeUndefined();

    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
  });
});

describe('startDoc — bramka anty-placeholder (D-L2-3)', () => {
  it('stub w wyrenderowanym markdownie ⇒ stan error, treść = uczciwy komunikat (nie szkielet)', async () => {
    renderMarkdownMock.mockReturnValue(
      `# Raport\n\n## Synteza\n\n${SECTION_STUB_PREFIX} — "Synteza". Add sources or use AI generation to fill it.`
    );

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    // naprawa-r2Narr · Problem 2: przy porażce NIE zostawiamy szkieletu z
    // placeholderami-purpose udającymi treść — nadpisujemy draft UCZCIWYM stanem
    // błędu (+ tytuł oznaczony jako nieudana generacja).
    const contentPatches = updateDraftMock.mock.calls.filter((c) => 'content' in c[0].patch);
    expect(contentPatches.length).toBeGreaterThan(0);
    const failureContent = String(contentPatches.at(-1)![0].patch.content || '');
    expect(failureContent.toLowerCase()).toContain('nie powiodła się');
    expect(failureContent).not.toContain('Substantive section');
    expect(failureContent).not.toContain('Teresa pisze treść');
    expect(updateDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ title: expect.stringContaining('generacja nieudana') }),
      })
    );
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('error');
    expect(status.error).toContain('nie został wypełniony');
  });

  it('wyjątek silnika ⇒ stan error z treścią błędu', async () => {
    materializeMock.mockRejectedValue(new Error('provider down'));

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('error');
    expect(status.error).toBe('provider down');
  });
});

describe('statusDoc — wnioskowanie po restarcie (pusta mapa runtime)', () => {
  it('szkielet w treści ⇒ plan_ready', async () => {
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('plan_ready');
  });

  it('wypełniona treść ⇒ draft z unitCount z nagłówków', async () => {
    getDraftMock.mockResolvedValue(
      draftRow({ content: '# Raport\n\n## Synteza\n\ntreść\n\n## Kontekst\n\ntreść' })
    );
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
    expect(status.artifact?.unitCount).toBe(2);
  });

  it('nieistniejący draft ⇒ not_found', async () => {
    getDraftMock.mockResolvedValue(null);
    await expect(statusDoc({ generationId: 'ghost', organizationId: ORG })).rejects.toBeInstanceOf(
      DeliverablesGenerationError
    );
  });
});

// ── Gałąź SHEET (L3) ────────────────────────────────────────────────────────

const GFM_TABLE =
  '# Budżet Q1\n\n| Pozycja | Kwota | Status |\n| --- | --- | --- |\n| Licencje | 12000 | planowane |\n| Szkolenia | 8000 | planowane |';

function sheetDraftRow(overrides: Record<string, unknown> = {}) {
  return draftRow({
    kind: 'table',
    title: 'Budżet Q1',
    content:
      '# Budżet Q1\n\n> Teresa buduje tabelę — struktura i dane pojawią się po zakończeniu generacji.',
    provenance: {
      deliverablesGeneration: {
        sheetSetup: { intent: 'Przygotuj budżet Q1', language: 'pl', title: 'Budżet Q1' },
      },
    },
    ...overrides,
  });
}

describe('planSheet + startSheet (L3)', () => {
  it('planSheet tworzy draft kind=table i zwraca plan_ready format=sheet', async () => {
    createDraftMock.mockResolvedValue(sheetDraftRow());
    const result = await planSheet({
      setup: { intent: 'Przygotuj budżet Q1', language: 'pl', conversationId: 'conv-1' },
      organizationId: ORG,
      userId: USER,
    });
    expect(result.format).toBe('sheet');
    expect(result.state).toBe('plan_ready');
    expect(createDraftMock.mock.calls[0][0].input.kind).toBe('table');
  });

  it('startSheet: poprawna tabela GFM ⇒ draft z liczbą wierszy', async () => {
    getDraftMock.mockResolvedValue(sheetDraftRow());
    generateChatResponseMock.mockResolvedValue({ content: GFM_TABLE });

    await startSheet({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    await flushBackgroundWork();
    await flushBackgroundWork();

    expect(updateDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ content: expect.stringContaining('| Licencje |') }),
      })
    );
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
    expect(status.format).toBe('sheet');
    expect(status.artifact?.unitCount).toBe(2);
  });

  it('startSheet: system prompt zabrania prezentowania zmyślonych liczb jako realnych danych org (§0.3)', async () => {
    getDraftMock.mockResolvedValue(sheetDraftRow());
    generateChatResponseMock.mockResolvedValue({ content: GFM_TABLE });

    await startSheet({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    await flushBackgroundWork();
    await flushBackgroundWork();

    const call = generateChatResponseMock.mock.calls[0][0];
    expect(call.systemPrompt).toContain('§0.3');
    expect(call.systemPrompt).toContain('przykładowe');
    expect(call.systemPrompt).toContain(
      'NIGDY nie prezentuj zmyślonych precyzyjnych metryk biznesowych jako rzeczywistych danych organizacji'
    );
  });

  it('startSheet: odpowiedź bez tabeli ⇒ error, treść = uczciwy komunikat błędu', async () => {
    getDraftMock.mockResolvedValue(sheetDraftRow());
    generateChatResponseMock.mockResolvedValue({ content: 'Przepraszam, nie mogę.' });

    await startSheet({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    await flushBackgroundWork();
    await flushBackgroundWork();

    // naprawa-r2Narr · Problem 2: przy porażce nadpisujemy treść uczciwym stanem
    // błędu (nie zostawiamy szkieletu udającego treść) + tytuł oznaczony.
    const contentPatches = updateDraftMock.mock.calls.filter((c) => 'content' in c[0].patch);
    expect(contentPatches.length).toBeGreaterThan(0);
    const failureContent = String(contentPatches.at(-1)![0].patch.content || '');
    expect(failureContent.toLowerCase()).toContain('nie powiodła się');
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('error');
  });

  it('statusDoc po restarcie: kind=table + tabela w treści ⇒ format sheet, stan draft', async () => {
    getDraftMock.mockResolvedValue(sheetDraftRow({ content: GFM_TABLE }));
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.format).toBe('sheet');
    expect(status.state).toBe('draft');
  });

  // BUG D: bogaty prompt → 1. próba proza bez tabeli, 2. próba (z korektą) poprawna tabela ⇒ draft.
  it('startSheet: retry ratuje bogaty prompt — 1. bez tabeli, 2. poprawna ⇒ draft', async () => {
    getDraftMock.mockResolvedValue(sheetDraftRow());
    generateChatResponseMock
      .mockResolvedValueOnce({ content: 'Oto analiza Twojego budżetu w formie opisowej...' })
      .mockResolvedValueOnce({ content: GFM_TABLE });

    await startSheet({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    await flushBackgroundWork();
    await flushBackgroundWork();

    expect(generateChatResponseMock).toHaveBeenCalledTimes(2);
    // 2. wywołanie zawiera twardą instrukcję korygującą.
    const secondPrompt = String(generateChatResponseMock.mock.calls[1][0].messages[0].content);
    expect(secondPrompt).toMatch(/NIE zawierała poprawnej tabeli|did NOT contain a valid table/);
    const contentPatches = updateDraftMock.mock.calls.filter((c) => 'content' in c[0].patch);
    expect(contentPatches.length).toBeGreaterThan(0);
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
  });

  // BUG D: tabela otoczona prozą (borderless / prefiks) ⇒ extractor salvage’uje ją, draft.
  it('startSheet: tabela otoczona prozą ⇒ salvage, draft', async () => {
    getDraftMock.mockResolvedValue(sheetDraftRow());
    generateChatResponseMock.mockResolvedValue({
      content:
        'Przygotowałem następujące zestawienie:\n\n# Budżet Q1\n\n| Pozycja | Kwota | Status |\n| --- | --- | --- |\n| Licencje | 12000 | planowane |\n| Szkolenia | 8000 | planowane |\n\nDaj znać, jeśli chcesz coś zmienić.',
    });

    await startSheet({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    await flushBackgroundWork();
    await flushBackgroundWork();

    const contentPatch = updateDraftMock.mock.calls.filter((c) => 'content' in c[0].patch).at(-1);
    expect(contentPatch?.[0]?.patch?.content).toContain('| Licencje |');
    // Trailing prose salvaged out of the stored content.
    expect(contentPatch?.[0]?.patch?.content).not.toContain('Daj znać');
    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
  });
});

describe('B2 — grounding sourceRefs przez ContextPack', () => {
  it('fakty z encji trafiają do intake.description silnika prozy', async () => {
    getDraftMock.mockResolvedValue(
      draftRow({
        provenance: {
          deliverablesGeneration: {
            intake: {
              description: 'Napisz raport',
              language: 'pl',
              title: 'Raport',
              sourceHints: [
                { sourceType: 'initiative', sourceId: 'init-7', sourceTitle: 'Automatyzacja' },
              ],
            },
            outline,
          },
        },
      })
    );
    buildContextPackMock.mockResolvedValue({
      key_points: ['Inicjatywa Automatyzacja ma budżet 120 000 PLN'],
      data_points: [{ label: 'ROI', value: 18, unit: '%' }],
    });

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    expect(buildContextPackMock).toHaveBeenCalledWith(
      ORG,
      [{ artifact_id: 'init-7', artifact_type: 'initiative', artifact_name: 'Automatyzacja' }],
      'pl'
    );
    const intakeArg = materializeMock.mock.calls[0][0].intake;
    expect(intakeArg.description).toContain('budżet 120 000 PLN');
    expect(intakeArg.description).toContain('ROI: 18 %');
  });

  it('awaria ContextPacka nie blokuje generacji (fallback na tryb rozmowy)', async () => {
    getDraftMock.mockResolvedValue(
      draftRow({
        provenance: {
          deliverablesGeneration: {
            intake: {
              description: 'Napisz raport',
              language: 'pl',
              title: 'Raport',
              sourceHints: [{ sourceType: 'insight', sourceId: 'x', sourceTitle: 'X' }],
            },
            outline,
          },
        },
      })
    );
    buildContextPackMock.mockRejectedValue(new Error('extractor missing'));

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
  });
});

describe('B4 — auto-skan organizacji (brak wskazanych źródeł)', () => {
  it('planDoc zwraca znalezione źródła i zapisuje fakty (snippety) do provenance', async () => {
    searchInsightsMock.mockResolvedValue({
      results: [
        {
          id: 'ins-1',
          title: 'Wąskie gardło w intralogistyce',
          snippet: 'Magazyn traci 4h dziennie na ręczne skanowanie.',
          type: 'process',
        },
      ],
      truncated: false,
    });
    searchOrgNotesMock.mockResolvedValue({
      results: [
        {
          pageId: 'note-9',
          title: 'Notatka z warsztatu',
          snippet: 'Zarząd zatwierdził budżet pilota automatyzacji.',
          updatedAt: null,
        },
      ],
      truncated: false,
    });

    const result = await planDoc({
      setup: { intent: 'Napisz raport o automatyzacji', language: 'pl', conversationId: 'conv-1' },
      organizationId: ORG,
      userId: USER,
    });

    expect(result.sources).toEqual([
      { sourceType: 'insight', sourceId: 'ins-1', sourceTitle: 'Wąskie gardło w intralogistyce' },
      { sourceType: 'note', sourceId: 'note-9', sourceTitle: 'Notatka z warsztatu' },
    ]);
    const provenance = createDraftMock.mock.calls[0][0].input.provenance;
    expect(provenance.deliverablesGeneration.autoGrounding.facts).toContain('4h dziennie');
    expect(provenance.deliverablesGeneration.autoGrounding.facts).toContain('budżet pilota');
  });

  it('startDoc używa faktów z auto-skanu, gdy brak explicit sourceRefs', async () => {
    getDraftMock.mockResolvedValue(
      draftRow({
        provenance: {
          deliverablesGeneration: {
            intake: { description: 'Napisz raport', language: 'pl', title: 'Raport' },
            outline,
            autoGrounding: {
              refs: [{ sourceType: 'insight', sourceId: 'ins-1', sourceTitle: 'X' }],
              facts: 'Fakty ze źródeł organizacji:\n- Magazyn traci 4h dziennie.',
            },
          },
        },
      })
    );

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    const intakeArg = materializeMock.mock.calls[0][0].intake;
    expect(intakeArg.description).toContain('Magazyn traci 4h dziennie');
  });

  it('auto-skan z zerem trafień ⇒ generacja biegnie trybem rozmowy (sources puste)', async () => {
    const result = await planDoc({
      setup: { intent: 'Napisz raport o czymkolwiek', language: 'pl', conversationId: 'conv-1' },
      organizationId: ORG,
      userId: USER,
    });
    expect(result.sources).toEqual([]);
    expect(result.state).toBe('plan_ready');
  });
});

describe('B3 — sekcja Źródła w artefakcie', () => {
  it('dokument kończy się sekcją Źródła z tytułami encji', async () => {
    getDraftMock.mockResolvedValue(
      draftRow({
        provenance: {
          deliverablesGeneration: {
            intake: {
              description: 'Napisz raport',
              language: 'pl',
              title: 'Raport',
              sourceHints: [
                {
                  sourceType: 'initiative',
                  sourceId: 'init-7',
                  sourceTitle: 'Automatyzacja magazynu',
                },
              ],
            },
            outline,
          },
        },
      })
    );

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    const contentPatch = updateDraftMock.mock.calls.find((c) => 'content' in c[0].patch);
    if (!contentPatch) throw new Error('expected an updateDraft call carrying a content patch');
    expect(contentPatch[0].patch.content).toContain('## Źródła');
    expect(contentPatch[0].patch.content).toContain('Inicjatywa: Automatyzacja magazynu');
  });

  it('brak źródeł ⇒ brak sekcji Źródła (czysty dokument)', async () => {
    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    const contentPatch = updateDraftMock.mock.calls.find((c) => 'content' in c[0].patch);
    if (!contentPatch) throw new Error('expected an updateDraft call carrying a content patch');
    expect(contentPatch[0].patch.content).not.toContain('## Źródła');
  });
});

describe('A3 — streaming per-sekcja (flaga ENABLE_DELIVERABLES_DOC_STREAMING)', () => {
  it('generuje sekcja-po-sekcji z progresywnym zapisem i koherencją (priors w prompcie)', async () => {
    featureFlagsMock.ENABLE_DELIVERABLES_DOC_STREAMING = true;
    generateChatResponseMock
      .mockResolvedValueOnce({ content: 'Proza sekcji Synteza.' })
      .mockResolvedValueOnce({ content: 'Proza sekcji Kontekst.' });

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    await flushBackgroundWork();

    // C3: treść draftu powstaje per-sekcja (streaming), a NIE z one-shot
    // renderu materializeDocumentArtifact — dowodzą tego 2 wywołania LLM (2 sekcje)
    // oraz progresywne zapisy treści niżej. Sam materialize jest teraz wołany
    // DODATKOWO (kanoniczna encja Studio), co pokrywa osobny opis „C3".
    // dwa wywołania = dwie sekcje
    expect(generateChatResponseMock).toHaveBeenCalledTimes(2);
    // drugie wywołanie zna pierwszą sekcję (koherencja)
    const secondPrompt = generateChatResponseMock.mock.calls[1][0].messages[0].content;
    expect(secondPrompt).toContain('Synteza');
    // progresywny zapis: ≥2 zapisy treści (po każdej sekcji)
    const contentWrites = updateDraftMock.mock.calls.filter((c) => 'content' in c[0].patch);
    expect(contentWrites.length).toBeGreaterThanOrEqual(2);
    // finalna treść ma obie sekcje
    const finalContent = contentWrites[contentWrites.length - 1][0].patch.content;
    expect(finalContent).toContain('## Synteza');
    expect(finalContent).toContain('Proza sekcji Kontekst.');

    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('draft');
  });

  it('wszystkie sekcje padły ⇒ stan error (uczciwy, brak wydmuszki)', async () => {
    featureFlagsMock.ENABLE_DELIVERABLES_DOC_STREAMING = true;
    generateChatResponseMock.mockRejectedValue(new Error('LLM down'));

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();
    await flushBackgroundWork();

    const status = await statusDoc({ generationId: 'draft-1', organizationId: ORG });
    expect(status.state).toBe('error');
  });
});
