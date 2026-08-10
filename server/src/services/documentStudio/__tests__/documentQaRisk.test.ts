/**
 * Document Studio — Risk QA tests (Epic E2, Slice 3.1).
 *
 * Risk QA enforces that risk-bearing document types contain a Risks
 * section with severity classification, mitigation language and owner
 * attribution. It also validates structural risk_table blocks.
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
    documentId: 'doc-risk-1',
    artifactId: 'artifact-risk-1',
    title: 'Risk QA Test Document',
    documentType: 'ai_audit_report',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
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

function findRisk(report: ReturnType<typeof runDocumentQa>) {
  const c = report.categories.find((cat) => cat.category === 'risk');
  if (!c) throw new Error('expected risk category in report');
  return c;
}

describe('Document QA — Risk QA category', () => {
  it('returns clean Risk QA on a well-populated risks section', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'Talent attrition risk is rated high; mitigation is owned by the CHRO with a quarterly retention review.'
            ),
            makeParagraph(
              'b-2',
              'Vendor concentration risk is rated medium; mitigation is a parallel POC with a second supplier owned by the CIO.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    expect(risk.findings).toHaveLength(0);
    expect(risk.score).toBe(100);
  });

  it('flags risk-bearing type without a Risks section at high severity for risk-critical types', () => {
    const schema = makeSchema({
      documentType: 'risk_register_report',
      sections: [
        {
          sectionId: 's-1',
          title: 'Overview',
          level: 1,
          blocks: [makeParagraph('b-1', 'Overview content without any risk enumeration.')],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    const finding = risk.findings.find((f) => f.code === 'risk_section_missing');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
    expect(risk.blocking).toBe(true);
  });

  it('flags an empty risks section at high severity', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    expect(risk.findings.map((f) => f.code)).toContain('risk_section_empty');
  });

  it('flags risks section without any severity / impact classification', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [
            // No "high/medium/low/critical/RAG/P0-P3" tokens.
            makeParagraph(
              'b-1',
              'There are several considerations the team should be aware of as the program proceeds; mitigation owned by CIO.'
            ),
            makeParagraph(
              'b-2',
              'Some additional concerns deserve discussion at the next steering meeting; mitigation owned by sponsor.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    expect(risk.findings.map((f) => f.code)).toContain('risk_section_no_severity');
  });

  it('flags risks section without any mitigation / control language', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [
            // Severity present, owner present, but no mitigation/control wording.
            makeParagraph(
              'b-1',
              'Talent attrition risk is rated high; CHRO is monitoring the situation closely.'
            ),
            makeParagraph(
              'b-2',
              'Vendor concentration risk is rated medium; CIO is observing supplier health.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    expect(risk.findings.map((f) => f.code)).toContain('risk_section_no_mitigation');
  });

  it('flags risks section without any owner attribution at low severity', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [
            // Severity + mitigation, no owner role tokens at all.
            makeParagraph(
              'b-1',
              'Talent attrition risk is rated high; mitigation is a quarterly retention review.'
            ),
            makeParagraph(
              'b-2',
              'Vendor concentration risk is rated medium; mitigation is a parallel POC with a second supplier.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    const finding = risk.findings.find((f) => f.code === 'risk_section_no_owner');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('low');
  });

  it('flags an empty `risk_table` block as a structural integrity issue', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [
            // Provide a paragraph with severity, mitigation and owner so
            // the section-level checks pass and we isolate the risk_table
            // structural finding.
            makeParagraph(
              'b-1',
              'CIO owns the high-severity vendor concentration risk; mitigation is a parallel POC with a second supplier.'
            ),
            {
              blockId: 'b-rt',
              type: 'risk_table',
              content: { rows: [] },
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    const finding = risk.findings.find((f) => f.code === 'risk_empty_risk_table');
    expect(finding).toBeDefined();
    expect(finding?.blockId).toBe('b-rt');
  });

  it('uses canonical risk-table columns and rows for severity, mitigation and owner QA', () => {
    const schema = makeSchema({
      documentType: 'business_case',
      sections: [
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [
            {
              blockId: 'b-rt',
              type: 'risk_table',
              content: {
                columns: ['Risk', 'Severity', 'Mitigation', 'Owner'],
                rows: [['Store rejection', 'High', 'Pre-submission control', 'Product owner']],
              },
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const risk = findRisk(runDocumentQa(schema));
    expect(risk.findings).toHaveLength(0);
    expect(risk.score).toBe(100);
  });

  it('Polish heuristics: "Ryzyka" with "krytyczny" / "mitygacja" / "sponsor" satisfies all checks', () => {
    const schema = makeSchema({
      language: 'pl',
      sections: [
        {
          sectionId: 's-ryzyka',
          title: 'Ryzyka',
          level: 1,
          blocks: [
            makeParagraph(
              'b-1',
              'Ryzyko utraty kluczowego talentu oznaczone jako wysoki priorytet; mitygacja po stronie sponsora jako kwartalny przegląd retencji.'
            ),
            makeParagraph(
              'b-2',
              'Ryzyko koncentracji dostawcy na poziomie średnim; plan naprawczy obejmuje równoległy pilotaż z drugim dostawcą po stronie CIO.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    expect(risk.findings).toHaveLength(0);
  });

  it('non-risk-bearing types (workshop_summary) without Risks section produce no Risk QA findings', () => {
    const schema = makeSchema({
      documentType: 'workshop_summary',
      sections: [
        {
          sectionId: 's-themes',
          title: 'Themes',
          level: 1,
          blocks: [makeParagraph('b-1', 'Three workshop themes emerged from the discussion.')],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    expect(risk.findings).toHaveLength(0);
    expect(risk.blocking).toBe(false);
  });

  it('Risk QA participates in `anyBlocking` when multiple findings stack', () => {
    const schema = makeSchema({
      documentType: 'risk_register_report',
      sections: [
        // Only an empty Risks section. → risk_section_empty (high) plus
        // is risk-critical type → risk_section_missing? No; the section
        // exists, just empty. So we'll add another stacking finding via
        // empty risk_table.
        {
          sectionId: 's-risks',
          title: 'Risks',
          level: 1,
          blocks: [{ blockId: 'b-rt', type: 'risk_table', content: { rows: [] } }],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const risk = findRisk(report);
    expect(risk.blocking).toBe(true);
    expect(report.anyBlocking).toBe(true);
  });
});
