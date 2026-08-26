import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../documentStudio/documentDocxRenderer.js';
import {
  buildAssessmentDrdReportSchema,
  type AssessmentReportContract,
} from '../assessmentDrdReportSchemaService.js';

function contract(): AssessmentReportContract {
  const chapters = Array.from({ length: 7 }, (_, index) => {
    const axisId = index + 1;
    const unitId = `${axisId}A`;
    return {
      axisId,
      axisName: `Axis ${axisId}`,
      axisNamePL: `Oś ${axisId}`,
      maxLevel: axisId === 1 || axisId === 4 ? 7 : axisId === 5 || axisId === 6 ? 6 : 5,
      introduction: { content: null, minWords: 120, maxWords: 180 },
      matrix: {
        caption: { content: null, minWords: 30, maxWords: 60 },
        areas: [
          {
            unitId,
            unitName: `Area ${unitId}`,
            unitNamePL: `Obszar ${unitId}`,
            currentLevel: 1,
            targetLevel: Math.min(4, axisId === 1 || axisId === 4 ? 7 : 5),
            gap: 3,
            skipped: false,
            skipCode: null,
            skips: [] as Array<{ questionId: string; skipCode: string }>,
            evidenceState: 'evidenced' as const,
          },
        ],
      },
      areaComments: [
        {
          unitId,
          content: null,
          minWords: 110,
          maxWords: 170,
          microstructure: [
            'stan_faktyczny',
            'ocena_i_wiarygodnosc',
            'znaczenie_dla_przedsiebiorstwa',
            'luka_i_sens_targetu',
            'najblizszy_krok',
          ] as const,
          skipped: false,
          skipCode: null,
          skips: [] as Array<{ questionId: string; skipCode: string }>,
          answerRefs: [],
          evidenceRefs: [],
          sourceLocators: [],
          uncertainty: 'evidenced' as const,
        },
      ],
      conclusion: {
        content: null,
        minWords: 180,
        maxWords: 260,
        decisionLine: {
          direction: null,
          priority: null,
          horizon: null,
          successCondition: null,
        },
      },
    };
  });
  return {
    contractVersion: 'assessment-report-contract-v1',
    sessionId: 'session-day32-schema',
    outputId: 'output-day32-schema',
    revision: 3,
    generatedAt: '2026-08-28T12:00:00.000Z',
    methodVersion: 'drd-v1',
    sessionLabel: { displayName: 'Zakład Ćmielów', source: 'project', projectId: 'project-1' },
    chapters,
  } as AssessmentReportContract;
}

function allText(schema: ReturnType<typeof buildAssessmentDrdReportSchema>): string {
  return JSON.stringify(schema);
}

describe('Day 32 — assessment contract to DRD document schema', () => {
  it('builds cover/TOC/summary, seven chapters, conclusions, and appendix deterministically', async () => {
    const input = contract();
    const first = buildAssessmentDrdReportSchema(input);
    const second = buildAssessmentDrdReportSchema(input);
    expect(second).toEqual(first);
    expect(first.sections).toHaveLength(10);
    expect(first.sections.map((section) => section.sectionId)).toEqual([
      'executive-summary',
      'axis-1',
      'axis-2',
      'axis-3',
      'axis-4',
      'axis-5',
      'axis-6',
      'axis-7',
      'final-conclusions',
      'gap-register',
    ]);
    for (const section of first.sections.slice(1, 8)) {
      const headings = section.blocks
        .filter((block) => block.type === 'heading')
        .map((block) => (block.content as { text: string }).text);
      expect(headings).toEqual(
        expect.arrayContaining([
          'Matryca poziomów dojrzałości',
          'Ocena obszarów',
          'Wnioski rozdziału',
        ])
      );
    }
    const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(first));
    const xml = await zip.file('word/document.xml')?.async('string');
    expect(xml).toContain('TOC \\h \\o &quot;1-2&quot;');
    expect(xml).toContain('Zakład Ćmielów');
  });

  it('keeps null levels visible as em dash and never turns them into zero', () => {
    const input = contract();
    input.chapters[0].matrix.areas[0].currentLevel = null;
    input.chapters[0].matrix.areas[0].targetLevel = null;
    input.chapters[0].matrix.areas[0].gap = null;
    const text = allText(buildAssessmentDrdReportSchema(input));
    expect(text).toContain('Poziom obecny: —');
    expect(text).not.toContain('Poziom obecny: 0');
  });

  it('represents an entirely unassessed axis with missing radar points and an explicit notice', () => {
    const input = contract();
    for (const area of input.chapters[2].matrix.areas) {
      area.currentLevel = null;
      area.targetLevel = null;
      area.gap = null;
    }
    const schema = buildAssessmentDrdReportSchema(input);
    const radar = schema.sections[0].blocks.find((block) => block.blockId === 'executive-radar');
    const series = (radar?.content as { series: Array<{ values: Array<number | null> }> }).series;
    expect(series[0].values[2]).toBeNull();
    expect(series[1].values[2]).toBeNull();
    expect(allText(schema)).toContain('Oś nie została oceniona.');
  });

  it('keeps a fully skipped area with its code and excludes it from averages', () => {
    const input = contract();
    const area = input.chapters[0].matrix.areas[0];
    area.skipped = true;
    area.skipCode = 'OUT_OF_SCOPE';
    const schema = buildAssessmentDrdReportSchema(input);
    expect(allText(schema)).toContain('Obszar pominięty w ocenie — kod: OUT_OF_SCOPE.');
    const radar = schema.sections[0].blocks.find((block) => block.blockId === 'executive-radar');
    expect(
      (radar?.content as { series: Array<{ values: Array<number | null> }> }).series[0].values[0]
    ).toBeNull();
  });

  it('keeps a partially skipped area assessed and lists every skipped question', () => {
    const input = contract();
    input.chapters[1].matrix.areas[0].skips = [
      { questionId: '2A-L2', skipCode: 'NO_DATA' },
      { questionId: '2A-L4', skipCode: 'NOT_APPLICABLE' },
    ];
    const schema = buildAssessmentDrdReportSchema(input);
    const text = allText(schema);
    expect(text).toContain('Pominięte pytania: 2A-L2 — NO_DATA; 2A-L4 — NOT_APPLICABLE.');
    const radar = schema.sections[0].blocks.find((block) => block.blockId === 'executive-radar');
    expect(
      (radar?.content as { series: Array<{ values: Array<number | null> }> }).series[0].values[1]
    ).not.toBeNull();
  });

  it('uses placeholders only for null slots and preserves supplied contract content', () => {
    const input = contract();
    (input.chapters[0].introduction as { content: string | null }).content =
      'Treść zatwierdzona w kontrakcie i zachowana bez zmian.';
    const schema = buildAssessmentDrdReportSchema(input);
    const axisOne = JSON.stringify(
      schema.sections.find((section) => section.sectionId === 'axis-1')
    );
    expect(axisOne).toContain('Treść zatwierdzona w kontrakcie i zachowana bez zmian.');
    expect(axisOne).not.toContain('Sekcja do uzupełnienia — limit 120–180 słów.');
    expect(allText(schema)).toContain('Sekcja do uzupełnienia — limit 120–180 słów.');
  });

  it('does not smuggle Metalpol, lorem ipsum, or model-generated prose into the output', () => {
    const text = allText(buildAssessmentDrdReportSchema(contract()));
    expect(text).not.toMatch(/Metalpol|lorem ipsum|jako model|as an AI/i);
    expect(text).toContain('Sekcja do uzupełnienia — limit 110–170 słów.');
  });
});
