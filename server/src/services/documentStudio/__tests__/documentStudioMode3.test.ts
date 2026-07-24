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

import { materializeDocumentArtifact } from '../documentStudioService.js';
import type { DocumentIntake } from '../documentStudioTypes.js';
import {
  __resetTemplateRegistryForTests,
  approveTemplate,
  draftTemplate,
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
