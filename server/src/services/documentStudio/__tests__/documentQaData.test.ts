/**
 * Document Studio — Data QA tests (Epic E2, Slice 3.2).
 *
 * Data QA enforces internal consistency of numeric content across the
 * document: currency mixing, conflicting KPI percentages, mixed date
 * formats, placeholder values (TBD/XXX/N/A) and empty kpi_strip blocks.
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from '../documentStudioTypes.js';

/**
 * Section literals in this suite are authored without the (required)
 * `orderIndex` field; the QA service derives ordering from array position.
 * `makeSchema` therefore accepts order-free section inputs and stamps the
 * positional index, keeping the fixtures type-correct without changing what
 * the assertions exercise.
 */
type SectionInput = Omit<DocumentSchema['sections'][number], 'orderIndex'> & {
  orderIndex?: number;
};
type SchemaOverrides = Partial<Omit<DocumentSchema, 'sections'>> & {
  sections?: SectionInput[];
};

function withOrderIndex(sections: SectionInput[]): DocumentSchema['sections'] {
  return sections.map((section, index) => ({
    ...section,
    orderIndex: section.orderIndex ?? index,
  }));
}

function makeSchema(overrides: SchemaOverrides = {}): DocumentSchema {
  const { sections, ...rest } = overrides;
  return {
    documentId: 'doc-data-1',
    artifactId: 'artifact-data-1',
    title: 'Data QA Test Document',
    documentType: 'business_case',
    language: 'en',
    audience: ['CFO'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...rest,
    sections: withOrderIndex(sections ?? ([] satisfies SectionInput[])),
  };
}

function makeParagraph(blockId: string, text: string) {
  return { blockId, type: 'paragraph' as const, content: { text } };
}

function findData(report: ReturnType<typeof runDocumentQa>) {
  const c = report.categories.find((cat) => cat.category === 'data');
  if (!c) throw new Error('expected data category in report');
  return c;
}

describe('Document QA — Data QA category', () => {
  it('returns clean Data QA on a single-currency, consistent-KPI document', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Investment',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'The total investment is USD 2.5M across the three workstreams over the next four quarters.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings).toHaveLength(0);
  });

  it('flags currency mixing without an explicit FX / conversion phrase', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Investment',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'The total investment is USD 2.5M for the platform plus EUR 800k for the integration services.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings.map((f) => f.code)).toContain('data_currency_mix_without_fx');
  });

  it('does NOT flag currency mixing when an explicit FX / conversion phrase is present', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Investment',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'The total investment is USD 2.5M and EUR 800k, converted at FX rate USD/EUR 0.92 for the consolidated view.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings.map((f) => f.code)).not.toContain('data_currency_mix_without_fx');
  });

  it('flags the same KPI quoted with different percentage values across blocks', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Adoption',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Adoption is 12% across the pilot business units.'),
            makeParagraph('b-2', 'In the appendix, adoption is 18% reported by the field team.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings.map((f) => f.code)).toContain('data_inconsistent_kpi_percent');
  });

  it('flags placeholder values (TBD / XXX / N/A / "do uzupełnienia") in the body', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Forecast',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'Q4 revenue is TBD pending the channel mix decision.'),
            makeParagraph(
              'b-2',
              'Customer acquisition cost is N/A because the cost model is not finalised yet.'
            ),
            makeParagraph('b-3', 'Margin uplift is XXX percent at the consolidated level.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    const finding = data.findings.find((f) => f.code === 'data_placeholder_values_present');
    expect(finding).toBeDefined();
    // 3 hits → severity medium.
    expect(finding?.severity).toBe('medium');
  });

  it('flags an empty `kpi_strip` block as a structural data integrity issue', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-kpi',
          title: 'KPI Strip',
          level: 1,
          blocks: [{ blockId: 'b-kpi', type: 'kpi_strip', content: { items: [] } }],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings.map((f) => f.code)).toContain('data_empty_kpi_strip');
  });

  it('flags a scenario investment cell that conflicts with its assessment text', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-scenarios',
          title: 'Scenarios and Assumptions',
          level: 1,
          blocks: [
            {
              blockId: 'b-scenarios',
              type: 'table',
              content: {
                columns: ['Scenario', 'Investment', 'Assessment'],
                rows: [
                  [
                    'C — Big bang',
                    'EUR 0.9m',
                    'Scenario C costs EUR 2.2m and has excessive delivery risk.',
                  ],
                ],
              },
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const data = findData(runDocumentQa(schema));
    expect(data.findings.map((finding) => finding.code)).toContain(
      'data_scenario_investment_assessment_mismatch'
    );
    expect(
      data.findings.find(
        (finding) => finding.code === 'data_scenario_investment_assessment_mismatch'
      )?.severity
    ).toBe('high');
  });

  it('flags three or more mixed date formats in the same document', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Timeline',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'The kickoff is scheduled for 2026-05-15 across all teams.'),
            makeParagraph('b-2', 'The first checkpoint is on 15/06/2026 for sponsor review.'),
            makeParagraph('b-3', 'The mid-program review is in October 2026 for the steerco.'),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings.map((f) => f.code)).toContain('data_mixed_date_formats');
  });

  it('does NOT flag mixed date formats when only one or two formats are used', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Timeline',
          level: 1,
          blocks: [
            makeParagraph('b-1', 'The kickoff is scheduled for 2026-05-15 across all teams.'),
            makeParagraph(
              'b-2',
              'The first checkpoint is on 2026-06-15 for sponsor review of progress.'
            ),
            makeParagraph(
              'b-3',
              'The mid-program review is on 2026-10-15 for the steering committee approval.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings.map((f) => f.code)).not.toContain('data_mixed_date_formats');
  });

  it('Polish "do uzupełnienia" placeholder is detected at low severity for a single hit', () => {
    const schema = makeSchema({
      language: 'pl',
      sections: [
        {
          sectionId: 's-1',
          title: 'Prognoza',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'Wartość Q4 do uzupełnienia po decyzji o miksie kanałów dystrybucji.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    const finding = data.findings.find((f) => f.code === 'data_placeholder_values_present');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('low');
  });

  it('Data QA stays clean on a workshop_summary with no numeric content', () => {
    const schema = makeSchema({
      documentType: 'workshop_summary',
      sections: [
        {
          sectionId: 's-1',
          title: 'Themes',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'Three dominant themes emerged from the workshop discussion across the breakout groups.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings).toHaveLength(0);
  });

  it('Data QA participates in `anyBlocking` when multiple medium findings stack below 70', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Investment',
          level: 1,
          blocks: [
            // Currency mix without FX (medium)
            makeParagraph(
              'b-1',
              'The total investment is USD 2.5M for the platform plus EUR 800k for the integration services.'
            ),
            // KPI inconsistency (medium)
            makeParagraph('b-2', 'Adoption is 12% in the pilot business units.'),
            makeParagraph('b-3', 'Adoption is 18% per the field team report.'),
            // Empty kpi_strip (medium)
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-kpi',
          title: 'KPIs',
          level: 1,
          blocks: [{ blockId: 'b-kpi', type: 'kpi_strip', content: { items: [] } }],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const data = findData(report);
    expect(data.findings.length).toBeGreaterThanOrEqual(3);
    expect(data.blocking).toBe(true);
    expect(report.anyBlocking).toBe(true);
  });
});
