/**
 * Document Studio — Source-pack preflight tests (MVP-3).
 *
 * Covers the `preflightRequiredSources` predicate and the
 * `MissingRequiredSourceError` integration in `materializeDocumentArtifact`.
 *
 *   - Empty `requiredInputs` always passes preflight.
 *   - Substring matching across `sourceType`, `sourceId`, `sourceTitle` is
 *     case-insensitive and forgiving.
 *   - Mode 3 generation throws `MissingRequiredSourceError` with the missing
 *     list when the source pack is incomplete.
 *   - Mode 1 (no template) is unaffected by the preflight (source pack is
 *     allowed to be empty; assumptions are flagged per-block elsewhere).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(async () => ({ artifact_id: 'wave5-preflight-1' })),
  getWave5Artifact: vi.fn(),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

import {
  materializeDocumentArtifact,
  MissingRequiredSourceError,
  preflightRequiredSources,
} from '../documentStudioService.js';
import type {
  DocumentIntake,
  DocumentSourceRef,
  DocumentTemplate,
} from '../documentStudioTypes.js';
import {
  __resetTemplateRegistryForTests,
  approveTemplate,
  draftTemplate,
} from '../documentTemplateService.js';

const baseIntake: DocumentIntake = {
  description: 'Quarterly board memo summarizing programme state and risks.',
  audience: ['Board'],
  language: 'en',
  goal: 'decide',
};

function approvedTemplateWithRequirements(requiredInputs: string[]): {
  template: DocumentTemplate;
} {
  __resetTemplateRegistryForTests();
  const drafted = draftTemplate({
    organizationId: 'org-A',
    userId: 'arch-user',
    input: {
      documentType: 'executive_memo',
      purpose: 'Quarterly board memo template',
      requiredInputs,
    },
  });
  const approved = approveTemplate({
    templateId: drafted.template.templateId,
    organizationId: 'org-A',
    userId: 'gov-user',
  });
  return { template: approved };
}

describe('Document Studio source-pack preflight (MVP-3)', () => {
  beforeEach(() => {
    __resetTemplateRegistryForTests();
  });

  it('passes when the template declares no required inputs', () => {
    const { template } = approvedTemplateWithRequirements([]);
    const result = preflightRequiredSources(template, []);
    expect(result.ok).toBe(true);
  });

  it('passes when each requirement is satisfied by a source ref (case-insensitive substring)', () => {
    const { template } = approvedTemplateWithRequirements([
      'Discovery interview transcript',
      'Financial KPIs',
    ]);
    const sourceRefs: DocumentSourceRef[] = [
      {
        sourceType: 'Interview',
        sourceId: 'i-1',
        sourceTitle: 'Discovery Interview – CFO transcript',
      },
      { sourceType: 'Sheet', sourceId: 'kpi-q4', sourceTitle: 'Q4 financial KPIs' },
    ];
    const result = preflightRequiredSources(template, sourceRefs);
    expect(result.ok).toBe(true);
  });

  it('returns the unsatisfied requirements when the source pack is incomplete', () => {
    const { template } = approvedTemplateWithRequirements([
      'Discovery interview transcript',
      'Risk register',
      'Financial KPIs',
    ]);
    const result = preflightRequiredSources(template, [
      { sourceType: 'Interview', sourceId: 'i-1', sourceTitle: 'Discovery interview transcript' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(['Risk register', 'Financial KPIs']);
    }
  });

  it('Mode 3 generation throws MissingRequiredSourceError when source pack is incomplete', async () => {
    const { template } = approvedTemplateWithRequirements([
      'Discovery interview transcript',
      'Risk register',
    ]);
    await expect(
      materializeDocumentArtifact({
        organizationId: 'org-A',
        userId: 'consult-user',
        intake: baseIntake,
        templateId: template.templateId,
        sourceRefs: [
          { sourceType: 'Interview', sourceId: 'i-1', sourceTitle: 'Discovery interview' },
        ],
      })
    ).rejects.toBeInstanceOf(MissingRequiredSourceError);

    try {
      await materializeDocumentArtifact({
        organizationId: 'org-A',
        userId: 'consult-user',
        intake: baseIntake,
        templateId: template.templateId,
        sourceRefs: [],
      });
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingRequiredSourceError);
      if (err instanceof MissingRequiredSourceError) {
        expect(err.code).toBe('missing_required_source');
        expect(err.missing).toEqual(['Discovery interview transcript', 'Risk register']);
      }
    }
  });

  it('Mode 3 generation succeeds when all requirements are met', async () => {
    const { template } = approvedTemplateWithRequirements(['Discovery interview transcript']);
    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: baseIntake,
      templateId: template.templateId,
      sourceRefs: [
        { sourceType: 'Interview', sourceId: 'i-1', sourceTitle: 'Discovery interview transcript' },
      ],
    });
    expect(result.artifactId).toBe('wave5-preflight-1');
    expect(result.schema.templateRef).toEqual({
      templateId: template.templateId,
      templateVersion: template.version,
    });
  });

  it('pins Mode 3 to the exact selected template version', async () => {
    const { template } = approvedTemplateWithRequirements([]);
    await expect(
      materializeDocumentArtifact({
        organizationId: 'org-A',
        userId: 'consult-user',
        intake: baseIntake,
        templateId: template.templateId,
        templateVersion: 'stale-version',
      })
    ).rejects.toThrow('template_version_mismatch');
  });

  it('Mode 1 generation ignores preflight (no template, source pack allowed to be empty)', async () => {
    const result = await materializeDocumentArtifact({
      organizationId: 'org-A',
      userId: 'consult-user',
      intake: baseIntake,
    });
    expect(result.artifactId).toBe('wave5-preflight-1');
  });
});
