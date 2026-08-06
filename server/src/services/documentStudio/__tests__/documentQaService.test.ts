/**
 * Document Studio — QA Engine tests (MVP-3 hardening slice).
 *
 * Brand QA covers:
 *   - Banned global phrases ("placeholder", "TBD", "as an ai", ...).
 *   - Banned language-specific phrases (English: "amazing", "leverage";
 *     Polish: "rewolucyjny", "synergia").
 *   - Register mismatch: casual markers in `executive` register.
 *   - Excessive ALL-CAPS heuristic.
 *   - Clean documents → score 100, no findings.
 *
 * Language QA covers:
 *   - Language mismatch (English block in PL document, PL block in EN doc).
 *   - Per-block density (under floor / over ceiling).
 *   - Document-level average density.
 *   - Clean documents at the right density → score 100, no findings.
 *
 * Engine envelope:
 *   - `runDocumentQa` returns both categories with `anyBlocking` correctly
 *     reflecting the worst category.
 *   - Score threshold: `blocking === score < 70`.
 */

import { describe, expect, it } from 'vitest';

import { canOverrideQa, requiresApprovalForExport, runDocumentQa } from '../documentQaService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-qa-1',
    artifactId: 'artifact-qa-1',
    title: 'QA Test Document',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
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

describe('Document QA — Brand QA category', () => {
  it('flags global banned phrases (placeholder, TBD, as an AI)', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'As an AI assistant, the recommendation is TBD; placeholder content for the executive narrative pending stakeholder review and final sign-off.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const brand = report.categories.find((c) => c.category === 'brand');
    if (!brand) throw new Error('expected brand category');
    const codes = brand.findings.map((f) => f.code);
    expect(codes).toContain('banned_phrase');
    // Three banned phrases × medium severity (-12 each) = -36 → 64 → blocking.
    expect(brand.score).toBeLessThan(70);
    expect(brand.blocking).toBe(true);
  });

  it('flags English-specific marketing fluff', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'Our cutting-edge platform delivers world-class outcomes by leveraging amazing synergy across the enterprise; we will utilize the framework throughout the organization.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const brand = report.categories.find((c) => c.category === 'brand');
    if (!brand) throw new Error('expected brand category');
    const phrases = brand.findings.filter((f) => f.code === 'banned_phrase').map((f) => f.message);
    // At least 4 of the marketing fluff terms should be flagged.
    expect(phrases.length).toBeGreaterThanOrEqual(4);
  });

  it('flags Polish-specific marketing fluff when language=pl', () => {
    const schema = makeSchema({
      language: 'pl',
      communicationRegister: 'professional',
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Streszczenie',
          blocks: [
            makeParagraph(
              'b-1',
              'Nasz rewolucyjny i innowacyjny produkt buduje synergia między zespołami w całej organizacji.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const brand = report.categories.find((c) => c.category === 'brand');
    if (!brand) throw new Error('expected brand category');
    const phrases = brand.findings.filter((f) => f.code === 'banned_phrase');
    expect(phrases.length).toBeGreaterThanOrEqual(3);
  });

  it('flags casual markers in executive register but not in professional register', () => {
    const casualText =
      'Basically, the team kinda thinks the new approach is a thing we should literally try across the org for the upcoming quarter and beyond.';

    const exec = makeSchema({
      communicationRegister: 'executive',
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [makeParagraph('b-1', casualText)],
          sourceRefs: [],
        },
      ],
    });
    const execReport = runDocumentQa(exec);
    const execBrand = execReport.categories.find((c) => c.category === 'brand');
    if (!execBrand) throw new Error('expected brand category');
    expect(execBrand.findings.some((f) => f.code === 'register_mismatch')).toBe(true);

    const prof = makeSchema({
      ...exec,
      communicationRegister: 'professional',
    });
    const profReport = runDocumentQa(prof);
    const profBrand = profReport.categories.find((c) => c.category === 'brand');
    if (!profBrand) throw new Error('expected brand category');
    expect(profBrand.findings.some((f) => f.code === 'register_mismatch')).toBe(false);
  });

  it('flags excessive ALL-CAPS but ignores roman numerals', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'IMPORTANT: This URGENT memo addresses the BOARD review for fiscal year MMXXVI carefully today.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const brand = report.categories.find((c) => c.category === 'brand');
    if (!brand) throw new Error('expected brand category');
    expect(brand.findings.some((f) => f.code === 'excessive_caps')).toBe(true);
  });

  it('returns a clean Brand QA report (score 100) for well-written executive prose', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Executive Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'The proposed roadmap consolidates three workstreams under a single accountable owner. Phase one closes the data foundation in nine weeks. Phase two delivers measurable adoption gains within the following quarter; the board can review the milestones at the next checkpoint.'
            ),
            makeParagraph(
              'b-2',
              'Investment is bounded at the agreed envelope. Risks are concentrated in vendor dependency and change adoption; both are mitigated through staged rollout and named owners. Recommend approval at the next steering meeting.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const brand = report.categories.find((c) => c.category === 'brand');
    if (!brand) throw new Error('expected brand category');
    expect(brand.findings).toEqual([]);
    expect(brand.score).toBe(100);
    expect(brand.blocking).toBe(false);
  });
});

describe('Document QA — Language QA category', () => {
  it('does not count exact safety placeholders in block or document density', () => {
    const safetyText = 'Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).';
    const schema = makeSchema({
      language: 'pl',
      documentType: 'generic_document',
      sections: [
        {
          sectionId: 'safe',
          orderIndex: 0,
          level: 1,
          title: 'Bezpieczna treść',
          blocks: ['a', 'b', 'c', 'd', 'e'].map((blockId) => makeParagraph(blockId, safetyText)),
          sourceRefs: [],
        },
      ],
    });
    const language = runDocumentQa(schema).categories.find(
      (category) => category.category === 'language'
    );
    expect(language?.findings.filter((finding) => finding.code.includes('density'))).toEqual([]);
    expect(language?.blocking).toBe(false);
  });

  it('flags an English block inside a Polish document', () => {
    const schema = makeSchema({
      language: 'pl',
      communicationRegister: 'professional',
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Streszczenie',
          blocks: [
            makeParagraph(
              'b-1',
              'Niniejszy raport prezentuje rekomendacje dla zarządu dotyczące programu transformacji w bieżącym kwartale oraz plan działań na kolejne miesiące.'
            ),
            makeParagraph(
              'b-2',
              'The following section presents the findings from the discovery interviews with the executive team and the recommended next steps for the board to review.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const lang = report.categories.find((c) => c.category === 'language');
    if (!lang) throw new Error('expected language category');
    const mismatch = lang.findings.find((f) => f.code === 'language_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch?.blockId).toBe('b-2');
    expect(lang.score).toBeLessThan(100);
    expect(lang.blocking).toBe(true);
  });

  it('flags a Polish block inside an English document', () => {
    const schema = makeSchema({
      language: 'en',
      communicationRegister: 'professional',
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'The transformation program will deliver measurable benefits to the organization across three workstreams in the next quarter and the steering committee will review.'
            ),
            makeParagraph(
              'b-2',
              'Niniejszy fragment jest po polsku i nie powinien się tutaj znaleźć w angielskim dokumencie zarządczym, ponieważ łamie spójność językową.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const lang = report.categories.find((c) => c.category === 'language');
    if (!lang) throw new Error('expected language category');
    expect(lang.findings.some((f) => f.code === 'language_mismatch' && f.blockId === 'b-2')).toBe(
      true
    );
  });

  it('flags per-block density under the floor and over the ceiling', () => {
    const schema = makeSchema({
      density: 'standard', // 30..120 words target
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            // 5 words → under floor.
            makeParagraph('b-stub', 'Stub paragraph with five words.'),
            // ~150 words → over ceiling.
            makeParagraph('b-bloat', new Array(150).fill('word').join(' ')),
            // ~60 words → in range.
            makeParagraph('b-ok', new Array(60).fill('analysis').join(' ')),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const lang = report.categories.find((c) => c.category === 'language');
    if (!lang) throw new Error('expected language category');
    const codes = lang.findings.map((f) => f.code);
    expect(codes).toContain('density_under');
    expect(codes).toContain('density_over');
  });

  it('flags document-level average density when persistently off', () => {
    const schema = makeSchema({
      density: 'detailed', // 60..220 target → floor 60.
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph('b-1', new Array(10).fill('thin').join(' ')),
            makeParagraph('b-2', new Array(12).fill('thin').join(' ')),
            makeParagraph('b-3', new Array(15).fill('thin').join(' ')),
            makeParagraph('b-4', new Array(11).fill('thin').join(' ')),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const lang = report.categories.find((c) => c.category === 'language');
    if (!lang) throw new Error('expected language category');
    expect(lang.findings.some((f) => f.code === 'document_density_under')).toBe(true);
  });

  it('returns a clean Language QA report (score 100) for a homogeneous, well-sized document', () => {
    const block = (id: string, n: number) => makeParagraph(id, `${'analysis '.repeat(n).trim()}.`);
    const schema = makeSchema({
      density: 'standard', // 30..120 target
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [block('b-1', 60), block('b-2', 60), block('b-3', 60)],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const lang = report.categories.find((c) => c.category === 'language');
    if (!lang) throw new Error('expected language category');
    expect(lang.findings).toEqual([]);
    expect(lang.score).toBe(100);
    expect(lang.blocking).toBe(false);
  });
});

describe('Document QA — Source QA category', () => {
  it('flags a document with substantive content but no sourceRefs at all', () => {
    const schema = makeSchema({
      sourceRefs: [],
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'Detailed analysis paragraph one with substantive content for the board review process today and beyond.'
            ),
            makeParagraph(
              'b-2',
              'Detailed analysis paragraph two with substantive content for the board review process today and beyond.'
            ),
            makeParagraph(
              'b-3',
              'Detailed analysis paragraph three with substantive content for the board review process today and beyond.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const sources = report.categories.find((c) => c.category === 'sources');
    if (!sources) throw new Error('expected sources category');
    expect(sources.findings.some((f) => f.code === 'document_no_sources')).toBe(true);
    expect(sources.blocking).toBe(true);
  });

  it('flags a section with substantive content but no sourceRefs (document has top-level sources)', () => {
    const schema = makeSchema({
      sourceRefs: [{ sourceType: 'doc', sourceId: 'src-1', sourceTitle: 'Top-level source' }],
      sections: [
        {
          sectionId: 'sec-with-sources',
          orderIndex: 0,
          level: 1,
          title: 'Findings',
          blocks: [
            makeParagraph(
              'b-1',
              'Findings paragraph with substantive content backed by a credible source reference today and beyond.'
            ),
          ],
          sourceRefs: [{ sourceType: 'doc', sourceId: 'src-2', sourceTitle: 'Section-level' }],
        },
        {
          sectionId: 'sec-no-sources',
          orderIndex: 1,
          level: 1,
          title: 'Recommendations',
          blocks: [
            makeParagraph(
              'b-2',
              'Recommendations paragraph with substantive content but no source references attached at the section level here.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const sources = report.categories.find((c) => c.category === 'sources');
    if (!sources) throw new Error('expected sources category');
    const sectionFindings = sources.findings.filter((f) => f.code === 'section_no_sources');
    expect(sectionFindings).toHaveLength(1);
    expect(sectionFindings[0].sectionId).toBe('sec-no-sources');
  });

  it('flags assumptions in a section with no sourceRefs', () => {
    const schema = makeSchema({
      sourceRefs: [{ sourceType: 'doc', sourceId: 'src-1', sourceTitle: 'Top-level source' }],
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Hypothesis',
          blocks: [
            {
              blockId: 'b-asm',
              type: 'paragraph',
              content: { text: 'Assumed market growth of 12% annually pending validation.' },
              isAssumption: true,
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const sources = report.categories.find((c) => c.category === 'sources');
    if (!sources) throw new Error('expected sources category');
    expect(sources.findings.some((f) => f.code === 'unresolved_assumption')).toBe(true);
    expect(sources.findings.some((f) => f.code === 'section_only_assumptions')).toBe(true);
  });

  it('returns a clean Source QA report when every section has sources', () => {
    const schema = makeSchema({
      sourceRefs: [{ sourceType: 'doc', sourceId: 'src-1', sourceTitle: 'Top-level' }],
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'Substantive summary block backed by a section-level source reference today and beyond review window.'
            ),
          ],
          sourceRefs: [{ sourceType: 'doc', sourceId: 'src-2', sourceTitle: 'Section src' }],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const sources = report.categories.find((c) => c.category === 'sources');
    if (!sources) throw new Error('expected sources category');
    expect(sources.findings).toEqual([]);
    expect(sources.score).toBe(100);
    expect(sources.blocking).toBe(false);
  });

  it('skips the document-level no-sources finding for trivially short documents', () => {
    const schema = makeSchema({
      sourceRefs: [],
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Title',
          blocks: [makeParagraph('b-1', 'Short note.')],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    const sources = report.categories.find((c) => c.category === 'sources');
    if (!sources) throw new Error('expected sources category');
    expect(sources.findings.some((f) => f.code === 'document_no_sources')).toBe(false);
  });
});

describe('Document QA — engine envelope', () => {
  it('returns a report with both categories and anyBlocking aggregated', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'Placeholder content with TBD action items; this amazing world-class roadmap leverages cutting-edge synergy across the program.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    expect(report.artifactId).toBe('artifact-qa-1');
    // Slice E5.6.qa — `source_drift` joins as the 11th canonical
    // category, positioned immediately after `sources` because the two
    // are semantically twinned. The category is non-blocking by design;
    // see runSourceDriftQa() for the threshold rationale.
    expect(report.categories.map((c) => c.category)).toEqual([
      'brand',
      'language',
      'completeness',
      'sources',
      'source_drift',
      'methodology',
      'executive',
      'risk',
      'data',
      'format',
      'export',
    ]);
    // Many banned phrases → brand score collapses below 70 → blocking → anyBlocking.
    expect(report.anyBlocking).toBe(true);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('approval-gating policy: high-stakes types are gated, drafts are not', () => {
    expect(requiresApprovalForExport('decision_memo')).toBe(true);
    expect(requiresApprovalForExport('board_report')).toBe(true);
    expect(requiresApprovalForExport('client_final_report')).toBe(true);
    expect(requiresApprovalForExport('business_case')).toBe(true);
    expect(requiresApprovalForExport('due_diligence_note')).toBe(true);

    expect(requiresApprovalForExport('generic_document')).toBe(false);
    expect(requiresApprovalForExport('workshop_summary')).toBe(false);
    expect(requiresApprovalForExport('interview_summary_report')).toBe(false);
    expect(requiresApprovalForExport('executive_memo')).toBe(false);
  });

  it('canOverrideQa policy: privileged roles allow, others deny', () => {
    expect(canOverrideQa('SUPERADMIN')).toBe(true);
    expect(canOverrideQa('SUPER_ADMIN')).toBe(true);
    expect(canOverrideQa('OWNER')).toBe(true);
    expect(canOverrideQa('ADMIN')).toBe(true);
    expect(canOverrideQa('ADMINISTRATOR')).toBe(true);
    expect(canOverrideQa('PROJECT_MANAGER')).toBe(true);
    expect(canOverrideQa('MANAGER')).toBe(true);

    expect(canOverrideQa('TEAM_MEMBER')).toBe(false);
    expect(canOverrideQa('MEMBER')).toBe(false);
    expect(canOverrideQa('USER')).toBe(false);
    expect(canOverrideQa('VIEWER')).toBe(false);
    expect(canOverrideQa('GUEST')).toBe(false);
    expect(canOverrideQa('CLIENT')).toBe(false);

    // Defensive: empty / null / undefined / unknown roles deny by default.
    expect(canOverrideQa('')).toBe(false);
    expect(canOverrideQa(null)).toBe(false);
    expect(canOverrideQa(undefined)).toBe(false);
    expect(canOverrideQa('something_else')).toBe(false);

    // Case-insensitive + whitespace-tolerant.
    expect(canOverrideQa('  superadmin  ')).toBe(true);
    expect(canOverrideQa('Owner')).toBe(true);
    expect(canOverrideQa('admin')).toBe(true);
  });

  it('clamps the score to [0, 100] even with many findings', () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'sec-1',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [
            makeParagraph(
              'b-1',
              'Placeholder TBD synergy amazing incredible cutting-edge world-class leverage utilize.'
            ),
            makeParagraph(
              'b-2',
              'Placeholder TBD synergy amazing incredible cutting-edge world-class leverage utilize.'
            ),
          ],
          sourceRefs: [],
        },
      ],
    });
    const report = runDocumentQa(schema);
    for (const cat of report.categories) {
      expect(cat.score).toBeGreaterThanOrEqual(0);
      expect(cat.score).toBeLessThanOrEqual(100);
    }
  });
});
