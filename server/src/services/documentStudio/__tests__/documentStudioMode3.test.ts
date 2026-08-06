/**
 * Document Studio — Mode 3 (template-driven generation) tests.
 *
 * Covers:
 *   - Approved template hydrates outline + FormattingSchema during materialize.
 *   - Wave5 metadata records the templateId + version.
 *   - Generation against a draft template is blocked (template_not_usable).
 *   - Cross-tenant template id is rejected.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('../../wave5ArtifactRuntimeService.js', () => {
  let nextId = 1;
  const captured: Array<Record<string, unknown>> = [];
  return {
    __captured: captured,
    createWave5Artifact: vi.fn(async (input: Record<string, unknown>) => {
      captured.push(input);
      const artifactId = `wave5-mode3-${nextId++}`;
      return { artifact_id: artifactId, artifactId };
    }),
    getWave5Artifact: vi.fn(),
    buildWave5ExportManifest: vi.fn(),
    markWave5ArtifactExported: vi.fn(),
  };
});

import {
  DocumentManualStructureMismatchError,
  materializeDocumentArtifact,
  updateDocumentManualContent,
} from '../documentStudioService.js';
import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import { runDocumentQa } from '../documentQaService.js';
import type { DocumentIntake } from '../documentStudioTypes.js';
import {
  __resetTemplateRegistryForTests,
  approveTemplate,
  draftTemplate,
  getTemplate,
  reviseTemplateStructure,
} from '../documentTemplateService.js';

const baseIntake: DocumentIntake = {
  description: 'Quarterly memo for the board summarizing the program state.',
  audience: ['Board'],
  language: 'en',
  goal: 'decide',
};

describe('Document Studio Mode 3 (template-driven)', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('keeps the manual Czysto artifact genuinely blank even when org context was auto-attached', async () => {
    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: {
        title: 'Nowy dokument',
        description: 'Pusty dokument roboczy do samodzielnej edycji.',
        documentType: 'generic_document',
        language: 'pl',
      },
      outline: {
        documentType: 'generic_document',
        title: 'Nowy dokument',
        sections: [{ title: 'Sekcja 1', level: 1, purpose: '', expectedLengthHint: 'short' }],
        recommendedDensity: 'concise',
        recommendedRegister: 'professional',
        recommendedLanguageStyle: 'formal',
      },
      sourceRefs: [
        {
          sourceType: 'organization_context',
          sourceId: 'org-context-1',
          sourceTitle: 'Kontekst organizacji',
        },
      ],
    });

    expect(result.schema.sourceRefs).toEqual([]);
    expect(result.schema.sections).toHaveLength(1);
    expect(result.schema.sections[0].title).toBe('Sekcja 1');
    expect(result.schema.sections[0].sourceRefs).toEqual([]);
    expect(result.schema.sections[0].blocks).toEqual([
      expect.objectContaining({ type: 'paragraph', content: { text: '' }, isAssumption: false }),
    ]);
  });

  it('hydrates outline + formatting from an approved template', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'arch-user',
      input: {
        name: 'Mode3 memo template',
        documentType: 'executive_memo',
        purpose: 'Recurring board memo',
        confidentiality: 'restricted',
      },
    });
    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'gov-user',
    });

    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: baseIntake,
      templateId: approved.templateId,
    });

    expect(result.schema.documentType).toBe(approved.documentType);
    expect(result.schema.confidentiality).toBe('restricted');
    expect(result.schema.formattingSchema).toEqual(approved.formattingSchema);
    // Section blueprint must drive the section list 1:1.
    expect(result.schema.sections.map((s) => s.title)).toEqual(
      approved.sectionBlueprint.map((s) => s.title)
    );
  });

  it('treats the approved template as authoritative and rejects full-editor flattening', async () => {
    const { template: draft } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: {
        name: 'Investment decision memo',
        documentType: 'business_case',
        purpose: 'Decision',
      },
    });
    const governedTitles = [
      'Executive Summary',
      'Problem Statement',
      'Scope and Approach',
      'Proposed Initiative',
      'Scenarios and Assumptions',
      'Benefits and KPIs',
      'Risks',
      '30/60/90 Implementation Roadmap',
      'Recommendation',
    ];
    const sections = governedTitles.map((title, index) => ({
      title,
      level: 1 as const,
      purpose: `Decision guidance ${index + 1}`,
      contentHints: [`Explain evidence ${index + 1}`],
      keyMessage: `Investment thesis ${index + 1}`,
      required: true,
      expectedLengthHint: 'medium' as const,
    }));
    reviseTemplateStructure({
      templateId: draft.templateId,
      organizationId: 'org-A',
      userId: 'author',
      sections,
    });
    const approved = approveTemplate({
      templateId: draft.templateId,
      organizationId: 'org-A',
      userId: 'owner',
    });
    const genericOutline = {
      documentType: 'business_case' as const,
      title: 'Generic plan',
      sections: [
        {
          title: 'Generic deterministic section',
          level: 1 as const,
          purpose: 'Wrong',
          expectedLengthHint: 'short' as const,
        },
      ],
      recommendedDensity: 'standard' as const,
      recommendedRegister: 'executive' as const,
      recommendedLanguageStyle: 'concise' as const,
    };
    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: baseIntake,
      templateId: approved.templateId,
      outline: genericOutline,
    });

    expect(result.schema.sections.map((section) => section.title)).toEqual(
      sections.map((section) => section.title)
    );
    expect(result.schema.sections[0].purpose).toContain('Investment thesis 1');
    await expect(
      updateDocumentManualContent({
        artifactId: result.schema.artifactId,
        organizationId: 'org-A',
        userId: 'consult-user',
        expectedVersion: result.schema.updatedAt,
        sections: [
          { ...result.schema.sections[0], blocks: result.schema.sections.flatMap((s) => s.blocks) },
        ],
      })
    ).rejects.toBeInstanceOf(DocumentManualStructureMismatchError);

    const docx = await renderDocumentSchemaToDocxBuffer(result.schema);
    const zip = await JSZip.loadAsync(docx);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    for (const section of sections) expect(documentXml).toContain(section.title);
  });

  it('materializes premium business-case blocks, passes blocking QA and renders DOCX structure', async () => {
    const { template: draft } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: {
        name: 'Premium business case',
        documentType: 'business_case',
        purpose: 'Board investment decision',
        language: 'en',
      },
    });
    const approved = approveTemplate({
      templateId: draft.templateId,
      organizationId: 'org-A',
      userId: 'owner',
    });
    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      templateId: approved.templateId,
      intake: {
        ...baseIntake,
        title: 'Nova Unified Commerce',
        description:
          'Approve Scenario B. Scenario A costs EUR 0.35m with limited benefits. Scenario B costs EUR 1.4m and is recommended. Scenario C costs EUR 2.2m with excessive risk. Current conversion is 2.1%, cancellation is 8.4%, inventory accuracy is 91%; targets are 3.0%, below 4%, and above 97%. Payback is 22-month payback. Risks are ERP integration, data quality and frontline adoption. Use an integration spike, six-week data cleansing sprint and store champion network. CIO owns delivery and COO owns adoption.',
      },
      sourceRefs: [
        { sourceType: 'brief', sourceId: 'nova-board-brief', sourceTitle: 'Nova board brief' },
      ],
    });
    expect(result.schema.sections).toHaveLength(9);
    expect(result.schema.sections.map((section) => section.title)).toEqual(
      expect.arrayContaining(['Scope and Approach', 'Scenarios and Assumptions'])
    );
    const blocks = result.schema.sections.flatMap((section) => section.blocks);
    expect(blocks.map((block) => block.type)).toEqual(
      expect.arrayContaining(['kpi_strip', 'callout', 'table', 'risk_table'])
    );
    expect(blocks.some((block) => JSON.stringify(block.content).includes('awaiting content'))).toBe(
      false
    );
    const scenarioTable = blocks.find(
      (block) => block.type === 'table' && JSON.stringify(block.content).includes('C — Big bang')
    );
    expect(scenarioTable).toBeDefined();
    const scenarioRows = (scenarioTable!.content as { rows: string[][] }).rows;
    expect(scenarioRows[2][1]).toBe('EUR 2.2m');
    expect(scenarioRows[2][1]).not.toBe('EUR 0.9m');
    expect(runDocumentQa(result.schema).categories.filter((category) => category.blocking)).toEqual(
      []
    );

    const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(result.schema));
    const xml = await zip.file('word/document.xml')!.async('string');
    for (const text of [
      'Scope and Approach',
      'Scenarios and Assumptions',
      'Recommended investment',
      'ERP integration',
      '0–30 days',
    ])
      expect(xml).toContain(text);
    expect((xml.match(/<w:tbl>/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('creates, versions, approves, reopens and consumes an exact Word template version through DOCX export', async () => {
    const { template: draft } = draftTemplate({
      organizationId: 'org-A',
      userId: 'author',
      input: {
        name: 'Governed Word board pack',
        documentType: 'board_report',
        purpose: 'Reusable governed board document',
        language: 'en',
      },
    });
    const formattingSchema = {
      ...draft.formattingSchema,
      fonts: { ...draft.formattingSchema.fonts, body: 'Arial 10', heading: 'Arial' },
      headingStyles: { h1: '18pt bold', h2: '14pt bold', h3: '11pt bold' },
      coverPage: true,
      coverPageDetailed: { enabled: true, includeLogo: true, includeStatus: true },
      toc: true,
      tocConfig: { enabled: true, maxDepth: 2 as const },
      headers: { enabled: true, content: 'Board Confidential' },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        pageNumberingFormat: 'Page X of Y',
      },
    };
    const revised = reviseTemplateStructure({
      templateId: draft.templateId,
      organizationId: 'org-A',
      userId: 'author',
      sections: [
        {
          title: 'Executive Summary',
          level: 1,
          purpose: 'Decision summary',
          required: true,
          expectedLengthHint: 'short',
        },
        {
          title: 'Evidence',
          level: 1,
          purpose: 'Grounding evidence',
          required: true,
          expectedLengthHint: 'medium',
        },
      ],
      formattingSchema,
      requiredInputs: ['Board pack source'],
    });
    expect(revised.status).toBe('draft');
    const approved = approveTemplate({
      templateId: draft.templateId,
      organizationId: 'org-A',
      userId: 'owner',
    });
    expect(approved.version).not.toBe(draft.version);

    const reopened = getTemplate(approved.templateId, 'org-A');
    expect(reopened).toEqual(approved);
    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: baseIntake,
      templateId: approved.templateId,
      sourceRefs: [
        { sourceType: 'document', sourceId: 'board-pack', sourceTitle: 'Board pack source' },
      ],
    });
    expect(result.schema.templateRef).toEqual({
      templateId: approved.templateId,
      templateVersion: approved.version,
    });
    expect(result.schema.formattingSchema).toEqual(formattingSchema);
    expect(result.schema.sections.map((section) => section.title)).toEqual([
      'Executive Summary',
      'Evidence',
    ]);
    const docx = await renderDocumentSchemaToDocxBuffer(result.schema);
    expect(docx[0]).toBe(0x50);
    expect(docx[1]).toBe(0x4b);
    expect(docx.includes(Buffer.from('[Content_Types].xml'))).toBe(true);
    const zip = await JSZip.loadAsync(docx);
    const documentXml = await zip.file('word/document.xml')!.async('string');
    const headerXml = await zip.file('word/header1.xml')!.async('string');
    const footerXml = await zip.file('word/footer1.xml')!.async('string');
    expect(documentXml).toContain('Table of Contents');
    expect(headerXml).toContain('Board Confidential');
    expect(footerXml).toContain('Page ');
  });

  it('records the templateId in wave5 artifact metadata', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'arch-user',
      input: { documentType: 'executive_memo', purpose: 'Mode3 metadata test' },
    });
    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'gov-user',
    });

    await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: baseIntake,
      templateId: approved.templateId,
    });

    const mocked = await import('../../wave5ArtifactRuntimeService.js');
    const captured = (
      mocked as unknown as {
        __captured: Array<Record<string, unknown>>;
      }
    ).__captured;
    const last = captured[captured.length - 1] as Record<string, unknown>;
    const metadata = last.metadata as Record<string, unknown>;
    expect(metadata.documentStudioMode).toBe('mode_3');
    expect(metadata.documentStudioTemplateId).toBe(approved.templateId);
    expect(metadata.documentStudioTemplateVersion).toBe(approved.version);
  });

  it('rejects generation against a draft template', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'arch-user',
      input: { documentType: 'executive_memo', purpose: 'draft test' },
    });

    await expect(
      materializeDocumentArtifact({
        organizationId: 'org-A',
        userId: 'consult-user',
        intake: baseIntake,
        templateId: template.templateId,
      })
    ).rejects.toThrow('template_not_usable');
  });

  // ---------------------------------------------------------------------
  // R1 doc slice (2026-07-24) — SYSTEM catalogue must be usable by any tenant.
  //
  // `getTemplate` deliberately falls back to the SYSTEM org so curated
  // templates are visible to every tenant, but the Mode 3 usability gate
  // used strict org equality and rejected them with `template_not_usable`.
  // On demo that was 44 of 45 document templates — precisely the rows the
  // Template Library surfaces, so "Użyj wzorca" was a broken promise.
  //
  // `'__system__'` is duplicated as a literal here (not imported from
  // documentTemplateRegistryDao) so this test never pulls the real
  // Postgres/DbPromise import chain — same convention as
  // deliverableTemplateService.ts.
  // ---------------------------------------------------------------------
  const SYSTEM_ORG = '__system__';

  it('uses an approved SYSTEM template for a different tenant and drives sections from its blueprint', async () => {
    const { template } = draftTemplate({
      organizationId: SYSTEM_ORG,
      userId: 'curator',
      input: {
        name: 'Curated system memo',
        documentType: 'executive_memo',
        purpose: 'System catalogue template shared with every tenant',
      },
    });
    const approved = approveTemplate({
      templateId: template.templateId,
      organizationId: SYSTEM_ORG,
      userId: 'curator',
    });

    // Consumer is a NORMAL tenant, not the system org.
    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: baseIntake,
      templateId: approved.templateId,
    });

    // DoD #4: the resulting draft's sections match the record's sectionBlueprint.
    expect(result.schema.sections.map((s) => s.title)).toEqual(
      approved.sectionBlueprint.map((s) => s.title)
    );
    expect(approved.sectionBlueprint.length).toBeGreaterThan(0);
  });

  it('rejects cross-tenant template usage', async () => {
    const { template } = draftTemplate({
      organizationId: 'org-A',
      userId: 'arch-user',
      input: { documentType: 'executive_memo', purpose: 'cross tenant test' },
    });
    approveTemplate({
      templateId: template.templateId,
      organizationId: 'org-A',
      userId: 'gov-user',
    });

    await expect(
      materializeDocumentArtifact({
        organizationId: 'org-B',
        userId: 'consult-user',
        intake: baseIntake,
        templateId: template.templateId,
      })
    ).rejects.toThrow('template_not_usable');
  });
});
