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

const { planDoc, startDoc, statusDoc, __clearDocRuntimeStateForTests } =
  await import('../docGenerationRuntime.js');
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

describe('planDoc', () => {
  it('tworzy draft i zwraca plan_ready z sekcjami outline', async () => {
    const result = await planDoc({
      setup: { intent: 'Napisz raport o transformacji', language: 'pl' },
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

describe('startDoc — bramka anty-placeholder (D-L2-3)', () => {
  it('stub w wyrenderowanym markdownie ⇒ stan error, draft nienaruszony', async () => {
    renderMarkdownMock.mockReturnValue(
      `# Raport\n\n## Synteza\n\n${SECTION_STUB_PREFIX} — "Synteza". Add sources or use AI generation to fill it.`
    );

    await startDoc({ generationId: 'draft-1', setup: {}, organizationId: ORG, userId: USER });
    await flushBackgroundWork();

    expect(updateDraftMock).not.toHaveBeenCalled();
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
