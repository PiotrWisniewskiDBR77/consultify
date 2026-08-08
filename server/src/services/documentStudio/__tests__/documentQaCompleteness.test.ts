/**
 * Document Studio — Completeness QA tests (Epic E2, Slice 2.1).
 *
 * Covers the 6 completeness checks added to `documentQaService.ts`:
 *   1. Empty schema (zero sections).
 *   2. Empty section (no editable blocks or all blocks empty).
 *   3. Block-level length below the per-section minimum (template-aware).
 *   4. Blueprint-required section missing (template-aware).
 *   5. Executive-summary requirement on approval-gated document types.
 *   6. Decision/Next Steps section requirement on decision-driving types.
 *
 * Plus the happy-path: a well-formed approval-gated document with
 * blueprint coverage produces zero findings and a score of 100.
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema, DocumentTemplate } from '../documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-completeness-1',
    artifactId: 'artifact-completeness-1',
    title: 'Completeness QA Test Document',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    sections: [],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeParagraph(blockId: string, text: string) {
  return {
    blockId,
    type: 'paragraph' as const,
    content: { text },
  };
}

function makeTemplate(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    templateId: 'doc-template-1',
    organizationId: 'org-A',
    name: 'Test Template',
    category: 'memo',
    documentType: 'executive_memo',
    purpose: 'test template',
    audience: ['Board'],
    language: 'en',
    languageStyle: 'consulting',
    communicationRegister: 'executive',
    density: 'standard',
    confidentiality: 'internal',
    requiredInputs: [],
    sectionBlueprint: [
      {
        title: 'Executive Summary',
        level: 1,
        purpose: 'one-paragraph TL;DR',
        required: true,
        expectedLengthHint: 'short',
      },
      {
        title: 'Findings',
        level: 1,
        purpose: 'core observations',
        required: true,
        expectedLengthHint: 'medium',
      },
      {
        title: 'Recommendations',
        level: 1,
        purpose: 'forward-looking actions',
        required: true,
        expectedLengthHint: 'medium',
      },
    ],
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: false },
    status: 'approved',
    version: '1.0',
    createdBy: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function findCompleteness(report: ReturnType<typeof runDocumentQa>) {
  const c = report.categories.find((cat) => cat.category === 'completeness');
  if (!c) throw new Error('expected completeness category in report');
  return c;
}

describe('Document QA — Completeness QA category', () => {
  it('recognizes a singular Recommendation section in a business case', () => {
    const schema = makeSchema({
      documentType: 'business_case',
      sections: [
        {
          sectionId: 's-exec',
          title: 'Executive Summary',
          level: 1,
          blocks: [makeParagraph('b-exec', 'We recommend approving the next validation gate.')],
          sourceRefs: [],
        },
        {
          sectionId: 's-rec',
          title: 'Recommendation',
          level: 1,
          blocks: [makeParagraph('b-rec', 'Approve the pilot and nominate an accountable owner.')],
          sourceRefs: [],
        },
      ],
    });
    const completeness = findCompleteness(runDocumentQa(schema));
    expect(completeness.findings.map((finding) => finding.code)).not.toContain(
      'completeness_missing_decision_section'
    );
  });

  it('returns a clean completeness category for a well-formed approval-gated document', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'The board must decide on the Q3 transformation budget allocation across the three priority initiatives in order to unlock the second wave of execution.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Findings',
          level: 1,
          blocks: [
            makeParagraph(
              'b-2',
              'The current operating model concentrates seventy percent of analytical effort in two teams while strategic initiatives require five teams to maintain pace, leading to consistent delivery delays and morale erosion within the impacted units across the last two quarters of activity.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-3',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-3',
              'Reallocate the analytical capacity by the end of Q4, stand up two new working teams reporting to the transformation officer, define a thirty sixty ninety day measurement cadence for early signal, and run a board-level checkpoint at each cadence boundary to confirm continued alignment on the strategic objectives.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema, { template: makeTemplate() });
    const completeness = findCompleteness(report);
    expect(completeness.findings).toHaveLength(0);
    expect(completeness.score).toBe(100);
    expect(completeness.blocking).toBe(false);
  });

  it('flags a document with zero sections as catastrophic completeness failure', () => {
    const schema = makeSchema({ sections: [] });
    const report = runDocumentQa(schema);
    const completeness = findCompleteness(report);
    const codes = completeness.findings.map((f) => f.code);
    expect(codes).toContain('completeness_no_sections');
    // Zero sections also implies missing executive summary on an
    // approval-gated type — both findings must surface.
    expect(codes).toContain('completeness_missing_executive_summary');
    expect(completeness.blocking).toBe(true);
  });

  it('flags an empty section (no editable blocks or all blocks empty)', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-empty',
          title: 'Executive Summary',
          level: 1,
          blocks: [],
          sourceRefs: [],
        },
        {
          sectionId: 's-also-empty',
          title: 'Findings',
          level: 1,
          blocks: [makeParagraph('b-empty', '   ')],
          sourceRefs: [],
        },
        {
          sectionId: 's-recs',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-rec',
              'Stand up the new transformation working group and allocate three FTEs for Q4 execution.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const completeness = findCompleteness(report);
    const empties = completeness.findings.filter((f) => f.code === 'completeness_empty_section');
    expect(empties).toHaveLength(2);
    expect(empties.map((f) => f.sectionId)).toEqual(
      expect.arrayContaining(['s-empty', 's-also-empty'])
    );
    expect(completeness.blocking).toBe(true);
  });

  it('treats a populated structured risk table as renderable section content', () => {
    const populated = makeSchema({
      documentType: 'workshop_summary',
      sections: [
        {
          sectionId: 's-risks',
          title: 'Ryzyka',
          level: 1,
          sourceRefs: [],
          blocks: [
            {
              blockId: 'b-risk',
              type: 'risk_table',
              content: {
                columns: ['Ryzyko', 'Wpływ'],
                rows: [['Brak danych budżetowych', 'Do weryfikacji']],
              },
            },
          ],
        },
      ],
    });
    expect(findCompleteness(runDocumentQa(populated)).findings.map((f) => f.code)).not.toContain(
      'completeness_empty_section'
    );

    const empty = makeSchema({
      documentType: 'workshop_summary',
      sections: [
        {
          sectionId: 's-risks-empty',
          title: 'Ryzyka',
          level: 1,
          sourceRefs: [],
          blocks: [{ blockId: 'b-risk-empty', type: 'risk_table', content: { rows: [] } }],
        },
      ],
    });
    expect(findCompleteness(runDocumentQa(empty)).findings.map((f) => f.code)).toContain(
      'completeness_empty_section'
    );
  });

  it('flags blueprint-required sections that are absent from the schema', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Executive Summary',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'Decision required on the budget reallocation across the three transformation initiatives.'
            ),
          ],
          sourceRefs: [],
        },
        // "Findings" and "Recommendations" are missing — both required
        // by the template blueprint.
      ],
    });
    const template = makeTemplate();
    const report = runDocumentQa(schema, { template });
    const completeness = findCompleteness(report);
    const missing = completeness.findings.filter(
      (f) => f.code === 'completeness_required_section_missing'
    );
    expect(missing).toHaveLength(2);
    expect(missing.map((f) => f.message).join(' | ')).toMatch(/Findings/);
    expect(missing.map((f) => f.message).join(' | ')).toMatch(/Recommendations/);
    expect(completeness.blocking).toBe(true);
  });

  it('flags blocks shorter than the per-section blueprint minimum (template-aware)', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          title: 'Executive Summary',
          level: 1,
          blocks: [makeParagraph('b-1', 'Short.')],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Findings',
          level: 1,
          // `medium` blueprint hint → minWords = 35. These are all way under.
          blocks: [
            makeParagraph('b-2a', 'A short observation.'),
            makeParagraph('b-2b', 'Another short observation.'),
            makeParagraph('b-2c', 'Yet another short observation.'),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-3',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-3',
              'Reallocate the analytical capacity by the end of Q4, stand up two new working teams reporting to the transformation officer, define a thirty sixty ninety day measurement cadence for early signal, and run a board-level checkpoint at each cadence boundary to confirm alignment on the strategic objectives.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const template = makeTemplate();
    const report = runDocumentQa(schema, { template });
    const completeness = findCompleteness(report);
    const tooShort = completeness.findings.filter((f) => f.code === 'completeness_block_too_short');
    // Every `medium` section that has only short blocks must surface a
    // single per-section finding, not one per block.
    expect(tooShort.find((f) => f.sectionId === 's-2')).toBeDefined();
    // The third section (which has a long-form recommendation) must NOT
    // be flagged.
    expect(tooShort.find((f) => f.sectionId === 's-3')).toBeUndefined();
  });

  it('flags missing executive summary on approval-gated document types (PL + EN heuristics)', () => {
    const schemaEn = makeSchema({
      documentType: 'board_report',
      sections: [
        {
          sectionId: 's-1',
          title: 'Findings',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'The strategic initiatives portfolio shows three at-risk programs that require board-level intervention.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Recommendations',
          level: 1,
          blocks: [
            makeParagraph(
              'b-2',
              'Pause the lowest-confidence initiative and reallocate its budget to the two highest-confidence programs.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const reportEn = runDocumentQa(schemaEn);
    const enCompleteness = findCompleteness(reportEn);
    expect(enCompleteness.findings.map((f) => f.code)).toContain(
      'completeness_missing_executive_summary'
    );

    // Polish heuristic: "Streszczenie zarządcze" should satisfy the
    // executive-summary requirement.
    const schemaPl = makeSchema({
      documentType: 'decision_memo',
      language: 'pl',
      sections: [
        {
          sectionId: 's-pl',
          title: 'Streszczenie zarządcze',
          level: 1,
          blocks: [
            makeParagraph(
              'b-pl',
              'Zarząd musi zdecydować w sprawie alokacji budżetu transformacyjnego pomiędzy trzy inicjatywy strategiczne.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-pl-rec',
          title: 'Rekomendacje',
          level: 1,
          blocks: [
            makeParagraph(
              'b-pl-rec',
              'Zalecamy realokację zasobów analitycznych do końca Q4 oraz powołanie dwóch nowych zespołów roboczych raportujących do dyrektora transformacji.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const reportPl = runDocumentQa(schemaPl);
    const plCompleteness = findCompleteness(reportPl);
    expect(plCompleteness.findings.map((f) => f.code)).not.toContain(
      'completeness_missing_executive_summary'
    );
  });

  it('flags missing decision/next-steps section on decision-driving document types', () => {
    const schema = makeSchema({
      documentType: 'project_status_report',
      sections: [
        {
          sectionId: 's-1',
          title: 'Progress',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'Workstream A is on track; workstream B is delayed by two weeks against the baseline plan.'
            ),
          ],
          sourceRefs: [],
        },
        // No Recommendations / Next Steps / Decisions Required.
      ],
    });
    const report = runDocumentQa(schema);
    const completeness = findCompleteness(report);
    expect(completeness.findings.map((f) => f.code)).toContain(
      'completeness_missing_decision_section'
    );
  });

  it('does not flag executive-summary or decision-section on non-approval-gated types (e.g. workshop_summary)', () => {
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
              'Three dominant themes emerged: capacity constraints, governance friction, and tooling fragmentation.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const completeness = findCompleteness(report);
    const codes = completeness.findings.map((f) => f.code);
    expect(codes).not.toContain('completeness_missing_executive_summary');
    expect(codes).not.toContain('completeness_missing_decision_section');
    expect(completeness.blocking).toBe(false);
  });

  it('blueprint-aware section title fuzzy match tolerates light rewording', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-1',
          // Schema title is reworded by Mode 1 / Mode 3 generation but
          // structurally equivalent to the blueprint's "Executive Summary".
          title: 'Executive summary & key takeaways',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'The board must approve the Q3 transformation budget reallocation across the three priority initiatives.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-2',
          title: 'Findings — operational diagnostic',
          level: 1,
          blocks: [
            makeParagraph(
              'b-2',
              'The current operating model concentrates 70% of analytical effort in two teams while strategic initiatives require five.'
            ),
          ],
          sourceRefs: [],
        },
        {
          sectionId: 's-3',
          title: 'Recommendations and next steps',
          level: 1,
          blocks: [
            makeParagraph(
              'b-3',
              'Reallocate analytical capacity by Q4 and stand up two new working teams reporting to the transformation officer.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const template = makeTemplate();
    const report = runDocumentQa(schema, { template });
    const completeness = findCompleteness(report);
    expect(
      completeness.findings.filter((f) => f.code === 'completeness_required_section_missing')
    ).toHaveLength(0);
  });

  it('Completeness QA participates in `anyBlocking` when score collapses below 70', () => {
    const schema = makeSchema({
      documentType: 'board_report',
      sections: [
        {
          sectionId: 's-empty-1',
          title: 'Findings',
          level: 1,
          blocks: [],
          sourceRefs: [],
        },
        {
          sectionId: 's-empty-2',
          title: 'Risks',
          level: 1,
          blocks: [],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const completeness = findCompleteness(report);
    expect(completeness.blocking).toBe(true);
    expect(report.anyBlocking).toBe(true);
  });
});
