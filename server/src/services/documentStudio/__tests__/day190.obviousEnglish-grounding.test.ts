import { describe, expect, it } from 'vitest';

import { enforceDocumentSchemaGrounding } from '../documentContentGenerator.js';

const schema = (language: 'pl' | 'en', title: string, paragraph: string) =>
  ({
    documentId: 'day190',
    artifactId: 'day190',
    title: `Dokument ${title}`,
    documentType: 'board_report',
    language,
    audience: ['Zarząd'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'concise',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {},
    sourceRefs: [],
    createdAt: '',
    updatedAt: '',
    sections: [
      {
        sectionId: 's1',
        orderIndex: 0,
        level: 1,
        title,
        purpose: `Cel: ${title}`,
        sourceRefs: [],
        blocks: [
          { blockId: 'h1', type: 'heading', content: { text: title } },
          { blockId: 'p1', type: 'paragraph', content: { text: paragraph } },
        ],
      },
    ],
  }) as any;

describe('day190 obviousEnglish final grounding boundary', () => {
  // FIX-195 (5) restores the fixture day 195 had weakened away (the paragraph
  // was rewritten to drop the word "Plan", which silenced the very defect the
  // test exists for) and asserts the NEW behaviour: `plan` is a Polish word
  // (report 190, token table, row "plan | tak"), so a fully grounded Polish
  // sentence containing it must stay AND must not be amber.
  it('R1 keeps a grounded Polish title, heading and "Plan wdrożenia" sentence and raises NO signal for the Polish homograph', () => {
    const title = 'Plan działania';
    const paragraph = 'Plan wdrożenia obejmuje trzy fale: pilotaż, skalowanie i utrwalenie.';
    const result = enforceDocumentSchemaGrounding(
      schema('pl', title, paragraph),
      `${title}. ${paragraph}`
    );

    expect(result.title).toBe(`Dokument ${title}`);
    expect(result.sections[0].title).toBe(title);
    expect(result.sections[0].purpose).toBe(`Cel: ${title}`);
    expect(result.sections[0].blocks[0].content).toEqual({ text: title });
    expect(result.sections[0].blocks[1].content).toEqual({ text: paragraph });
    // Neither the heading (pinned to "Plan działania") nor the sentence is an
    // assumption any more: nothing English is present.
    expect(result.sections[0].blocks[0].isAssumption).toBe(false);
    expect(result.sections[0].blocks[1].isAssumption).toBe(false);
    expect(result.evidence.toVerify).not.toContain(
      'Tytuł lub cel sekcji "Plan działania" zawiera niepotwierdzony lub niepolski fragment — do weryfikacji.'
    );
    expect(JSON.stringify(result)).not.toContain('Treść usunięta');
  });

  // The three remaining Polish homographs from the same table row group.
  it.each([
    ['portfolio', 'Portfolio inicjatyw obejmuje osiem projektów.'],
    ['total', 'Total zamówień pozostaje bez zmian.'],
    ['medium', 'Medium jest przekaźnikiem informacji.'],
  ])('R1b keeps a grounded Polish sentence with the homograph %s unmarked', (_token, paragraph) => {
    const title = 'Stan programu';
    const result = enforceDocumentSchemaGrounding(
      schema('pl', title, paragraph),
      `${title}. ${paragraph}`
    );
    expect(result.sections[0].blocks[1].content).toEqual({ text: paragraph });
    expect(result.sections[0].blocks[1].isAssumption).toBe(false);
  });

  it('R2 reports a flagged document title without mutating it and leaves a clean title unreported', () => {
    const flagged = enforceDocumentSchemaGrounding(
      schema('pl', 'Stan programu', 'Program przebiega zgodnie z ustaleniami.'),
      'Stan programu. Program przebiega zgodnie z ustaleniami.'
    );
    flagged.title = 'Executive plan 2030';
    const checked = enforceDocumentSchemaGrounding(flagged, 'Stan programu bez angielskiego tytułu.');
    expect(checked.title).toBe('Executive plan 2030');
    expect(checked.evidence.toVerify).toContain(
      'Tytuł dokumentu zawiera niepotwierdzony lub niepolski fragment — do weryfikacji.'
    );

    const clean = enforceDocumentSchemaGrounding(
      schema('pl', 'Stan programu', 'Program przebiega zgodnie z ustaleniami.'),
      'Dokument Stan programu. Program przebiega zgodnie z ustaleniami.'
    );
    expect(clean.evidence.toVerify).not.toContain(
      'Tytuł dokumentu zawiera niepotwierdzony lub niepolski fragment — do weryfikacji.'
    );
  });

  it('R3a leaves an English document unchanged because localization is disjoint', () => {
    const title = 'Delivery Plan';
    const paragraph = 'The delivery plan covers pilot, scale-up, and adoption.';
    const input = schema('en', title, paragraph);
    const result = enforceDocumentSchemaGrounding(input, `${title}. ${paragraph}`);

    expect(result.title).toBe(input.title);
    expect(result.sections[0].title).toBe(title);
    expect(result.sections[0].purpose).toBe(`Cel: ${title}`);
    expect(result.sections[0].blocks[0].content).toEqual({ text: title });
    expect(result.sections[0].blocks[1].content).toEqual({ text: paragraph });
  });

  it('R3b preserves and marks an English leak in a Polish document', () => {
    const title = 'Executive delivery plan';
    const paragraph = 'The delivery plan requires executive approval.';
    const result = enforceDocumentSchemaGrounding(
      schema('pl', title, paragraph),
      'Polski dokument bez źródeł dla angielskiej treści.'
    );

    expect(result.sections[0].title).toBe(title);
    expect(result.sections[0].blocks[0].content).toEqual({ text: title });
    expect(result.sections[0].blocks[1].content).toEqual({ text: paragraph });
    expect(result.sections[0].blocks.every((block: any) => block.isAssumption === true)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('Treść usunięta');
  });
});
