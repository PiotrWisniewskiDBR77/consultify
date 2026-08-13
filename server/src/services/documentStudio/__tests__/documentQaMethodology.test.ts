/**
 * Document Studio — Methodology QA tests (Epic E2, Slice 2.2).
 *
 * Methodology QA covers two dimensions:
 *
 *   1. **Template-aware**: section ordering matches the template blueprint;
 *      optional blueprint sections that are missing are flagged at low
 *      severity; "drift" sections (present in schema but not in blueprint)
 *      are flagged at low severity.
 *   2. **Type-aware**: even without a template, certain document types
 *      MUST contain structural sections to be credible:
 *        - audit / research / DD / final-client / business-case → Methodology
 *        - business-case / DD / audit → Assumptions
 *        - audit / business-case / DD / risk-register / steerco / board /
 *          implementation / change → Risks
 */

import { describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema, DocumentTemplate } from '../documentStudioTypes.js';
import { DEFAULT_CONSULTING_FORMATTING_SCHEMA } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-meth-1',
    artifactId: 'artifact-meth-1',
    title: 'Methodology QA Test Document',
    documentType: 'ai_audit_report',
    language: 'en',
    audience: ['Board'],
    // 'audit' is not a member of DocumentGoal (inform|decide|approve|recommend|align);
    // the QA service never reads `goal`, so 'inform' keeps the fixture behaviour identical.
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
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

function longPara(): string {
  return 'The current operating model concentrates analytical effort across the two business units while strategic initiatives require five teams to maintain pace, leading to consistent delivery delays and morale erosion within the impacted units across the last two quarters of recorded activity.';
}

function makeAuditTemplate(overrides: Partial<DocumentTemplate> = {}): DocumentTemplate {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    templateId: 'doc-template-audit',
    organizationId: 'org-A',
    name: 'AI Audit Template',
    category: 'audit',
    documentType: 'ai_audit_report',
    purpose: 'Formal AI readiness audit',
    audience: ['CEO', 'CFO'],
    language: 'en',
    languageStyle: 'consulting',
    communicationRegister: 'executive',
    density: 'detailed',
    confidentiality: 'client_confidential',
    requiredInputs: [],
    sectionBlueprint: [
      {
        title: 'Executive Summary',
        level: 1,
        purpose: 'TL;DR',
        required: true,
        expectedLengthHint: 'short',
      },
      {
        title: 'Scope and Methodology',
        level: 1,
        purpose: 'audit approach',
        required: true,
        expectedLengthHint: 'medium',
      },
      {
        title: 'Findings',
        level: 1,
        purpose: 'core findings',
        required: true,
        expectedLengthHint: 'medium',
      },
      {
        title: 'Risks',
        level: 1,
        purpose: 'risk register',
        required: true,
        expectedLengthHint: 'medium',
      },
      {
        title: 'Assumptions',
        level: 1,
        purpose: 'assumption set',
        required: false,
        expectedLengthHint: 'short',
      },
      {
        title: 'Recommendations',
        level: 1,
        purpose: 'forward actions',
        required: true,
        expectedLengthHint: 'medium',
      },
    ],
    formattingSchema: { ...DEFAULT_CONSULTING_FORMATTING_SCHEMA },
    exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: true },
    status: 'approved',
    version: '1.0',
    createdBy: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeSection(
  sectionId: string,
  title: string,
  bodyWords = 35,
  orderIndex = 0
): DocumentSchema['sections'][number] {
  return {
    sectionId,
    orderIndex,
    title,
    level: 1,
    blocks: [makeParagraph(`${sectionId}-b1`, longPara().split(' ').slice(0, bodyWords).join(' '))],
    sourceRefs: [],
  };
}

function findMethodology(report: ReturnType<typeof runDocumentQa>) {
  const c = report.categories.find((cat) => cat.category === 'methodology');
  if (!c) throw new Error('expected methodology category in report');
  return c;
}

describe('Document QA — Methodology QA category', () => {
  it('returns clean methodology when schema matches blueprint exactly', () => {
    const template = makeAuditTemplate();
    const schema = makeSchema({
      sections: [
        makeSection('s-1', 'Executive Summary'),
        makeSection('s-2', 'Scope and Methodology'),
        makeSection('s-3', 'Findings'),
        makeSection('s-4', 'Risks'),
        makeSection('s-5', 'Assumptions'),
        makeSection('s-6', 'Recommendations'),
      ],
    });
    const report = runDocumentQa(schema, { template });
    const m = findMethodology(report);
    expect(m.findings).toHaveLength(0);
    expect(m.score).toBe(100);
  });

  it('flags section ordering mismatch against blueprint', () => {
    const template = makeAuditTemplate();
    const schema = makeSchema({
      sections: [
        makeSection('s-1', 'Executive Summary'),
        // Findings BEFORE Scope and Methodology — out of blueprint order.
        makeSection('s-2', 'Findings'),
        makeSection('s-3', 'Scope and Methodology'),
        makeSection('s-4', 'Risks'),
        makeSection('s-5', 'Recommendations'),
      ],
    });
    const report = runDocumentQa(schema, { template });
    const m = findMethodology(report);
    const codes = m.findings.map((f) => f.code);
    expect(codes).toContain('methodology_section_order_mismatch');
  });

  it('flags optional blueprint sections that are missing as low severity', () => {
    const template = makeAuditTemplate();
    const schema = makeSchema({
      sections: [
        makeSection('s-1', 'Executive Summary'),
        makeSection('s-2', 'Scope and Methodology'),
        makeSection('s-3', 'Findings'),
        makeSection('s-4', 'Risks'),
        // "Assumptions" (optional) intentionally omitted.
        makeSection('s-6', 'Recommendations'),
      ],
    });
    const report = runDocumentQa(schema, { template });
    const m = findMethodology(report);
    const codes = m.findings.map((f) => f.code);
    expect(codes).toContain('methodology_optional_section_missing');
    const optionalFinding = m.findings.find(
      (f) => f.code === 'methodology_optional_section_missing'
    );
    expect(optionalFinding?.severity).toBe('low');
  });

  it('flags drift sections (present in schema but not in blueprint)', () => {
    const template = makeAuditTemplate();
    const schema = makeSchema({
      sections: [
        makeSection('s-1', 'Executive Summary'),
        makeSection('s-2', 'Scope and Methodology'),
        makeSection('s-3', 'Findings'),
        makeSection('s-4', 'Risks'),
        makeSection('s-5', 'Recommendations'),
        // "Bonus Material" not declared in blueprint → drift.
        makeSection('s-drift', 'Bonus Material'),
      ],
    });
    const report = runDocumentQa(schema, { template });
    const m = findMethodology(report);
    const drift = m.findings.filter((f) => f.code === 'methodology_drift_section');
    expect(drift).toHaveLength(1);
    expect(drift[0]?.sectionId).toBe('s-drift');
    expect(drift[0]?.severity).toBe('low');
  });

  it('type-aware: ai_audit_report without Methodology section is flagged at high severity', () => {
    const schema = makeSchema({
      sections: [
        makeSection('s-1', 'Executive Summary'),
        makeSection('s-2', 'Findings'),
        makeSection('s-3', 'Risks'),
        makeSection('s-4', 'Recommendations'),
        // No "Methodology / Approach / Scope" section.
      ],
    });
    const report = runDocumentQa(schema);
    const m = findMethodology(report);
    const finding = m.findings.find((f) => f.code === 'methodology_missing_methodology_section');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('high');
    expect(m.blocking).toBe(true);
  });

  it('type-aware: business_case without Assumptions section is flagged at medium severity', () => {
    const schema = makeSchema({
      documentType: 'business_case',
      sections: [
        makeSection('s-1', 'Executive Summary'),
        makeSection('s-2', 'Methodology'),
        makeSection('s-3', 'Findings'),
        makeSection('s-4', 'Risks'),
        // Assumptions / Scenarios / Sensitivity intentionally omitted.
        makeSection('s-5', 'Recommendations'),
      ],
    });
    const report = runDocumentQa(schema);
    const m = findMethodology(report);
    const finding = m.findings.find((f) => f.code === 'methodology_missing_assumptions_section');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('medium');
  });

  it('type-aware: implementation_plan without Risks section is flagged at medium severity', () => {
    const schema = makeSchema({
      documentType: 'implementation_plan',
      sections: [
        makeSection('s-1', 'Scope'),
        makeSection('s-2', 'Phases'),
        makeSection('s-3', 'Recommendations'),
        // No Risks.
      ],
    });
    const report = runDocumentQa(schema);
    const m = findMethodology(report);
    expect(m.findings.map((f) => f.code)).toContain('methodology_missing_risks_section');
  });

  it('type-aware: workshop_summary has no methodology / assumptions / risks requirement', () => {
    const schema = makeSchema({
      documentType: 'workshop_summary',
      sections: [
        makeSection('s-1', 'Themes'),
        makeSection('s-2', 'Decisions'),
        makeSection('s-3', 'Next steps'),
      ],
    });
    const report = runDocumentQa(schema);
    const m = findMethodology(report);
    const codes = m.findings.map((f) => f.code);
    expect(codes).not.toContain('methodology_missing_methodology_section');
    expect(codes).not.toContain('methodology_missing_assumptions_section');
    expect(codes).not.toContain('methodology_missing_risks_section');
    expect(m.blocking).toBe(false);
  });

  it('Polish heuristics: "Metodologia", "Założenia", "Ryzyka" satisfy the structural requirements', () => {
    const schema = makeSchema({
      documentType: 'ai_audit_report',
      language: 'pl',
      sections: [
        makeSection('s-1', 'Streszczenie zarządcze'),
        makeSection('s-2', 'Metodologia'),
        makeSection('s-3', 'Wnioski'),
        makeSection('s-4', 'Ryzyka'),
        makeSection('s-5', 'Założenia'),
        makeSection('s-6', 'Rekomendacje'),
      ],
    });
    const report = runDocumentQa(schema);
    const m = findMethodology(report);
    const codes = m.findings.map((f) => f.code);
    expect(codes).not.toContain('methodology_missing_methodology_section');
    expect(codes).not.toContain('methodology_missing_assumptions_section');
    expect(codes).not.toContain('methodology_missing_risks_section');
  });

  it('Methodology QA participates in `anyBlocking` when multiple structural sections are missing', () => {
    const schema = makeSchema({
      documentType: 'ai_audit_report',
      // Audit report missing Methodology (high), Assumptions (medium),
      // AND Risks (medium) → 25 + 12 + 12 = 49 deduction → score 51 →
      // below the 70 blocking threshold.
      sections: [
        makeSection('s-1', 'Executive Summary'),
        makeSection('s-2', 'Findings'),
        makeSection('s-3', 'Recommendations'),
      ],
    });
    const report = runDocumentQa(schema);
    const m = findMethodology(report);
    expect(m.blocking).toBe(true);
    expect(report.anyBlocking).toBe(true);
  });
});
