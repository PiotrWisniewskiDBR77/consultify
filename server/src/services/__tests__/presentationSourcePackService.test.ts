import { describe, expect, it } from 'vitest';

import type { DeckSetup } from '../presentationGeneratorService.js';
import {
  buildPresentationSourcePack,
  preflightPresentationSourcePack,
} from '../presentationSourcePackService.js';

function baseSetup(overrides: Partial<DeckSetup> = {}): DeckSetup {
  return {
    title: 'Board Decision Update',
    audience: 'executive',
    goal: 'decide',
    language: 'en',
    theme: 'corporate',
    confidentiality: 'confidential',
    sourceArtifacts: [
      {
        type: 'assessment',
        id: 'assessment-1',
        artifactId: 'artifact-assessment-1',
        label: 'AI readiness assessment',
        confidence: 0.86,
        readiness: 'ready',
        freshnessDays: 12,
        lineage: { runtime: 'assessment', recordId: 'assessment-1' },
      } as any,
    ],
    ...overrides,
  };
}

describe('presentationSourcePackService', () => {
  it('builds a ready source pack with coverage and normalized source refs', () => {
    const pack = buildPresentationSourcePack({
      setup: baseSetup(),
      organizationId: 'org-1',
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(pack.status).toBe('ready');
    expect(pack.confidence).toBe('high');
    expect(pack.coverage.readySources).toBe(1);
    expect(pack.sources[0]).toMatchObject({
      sourceId: 'artifact-assessment-1',
      sourceType: 'assessment',
      label: 'AI readiness assessment',
      readiness: 'ready',
    });
    expect(pack.missingInputs).toEqual([]);
  });

  it('surfaces missing required inputs without blocking non-strict generation', () => {
    const result = preflightPresentationSourcePack({
      setup: baseSetup({ title: 'KPI and ROI Board Update', sourceArtifacts: [] }),
      organizationId: 'org-1',
      strict: false,
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.sourcePack.status).toBe('empty');
    expect(result.missingInputs).toContain('decision evidence or recommendation source');
    expect(result.missingInputs).toContain('kpi_roi');
    expect(result.warnings.join(' ')).toContain('Source pack is empty');
  });

  it('blocks strict generation when required inputs are missing', () => {
    const result = preflightPresentationSourcePack({
      setup: baseSetup({ sourceArtifacts: [] }),
      organizationId: 'org-1',
      strict: true,
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(result.ok).toBe(false);
    expect(result.missingInputs).toEqual(['decision evidence or recommendation source']);
  });

  it('marks policy-blocked sources as blocked even outside strict mode', () => {
    const result = preflightPresentationSourcePack({
      setup: baseSetup({
        sourceArtifacts: [
          {
            type: 'report',
            id: 'report-1',
            label: 'Restricted report',
            readiness: 'policy_blocked',
          } as any,
        ],
      }),
      organizationId: 'org-1',
      strict: false,
    });

    expect(result.ok).toBe(false);
    expect(result.sourcePack.status).toBe('blocked');
    expect(result.warnings.join(' ')).toContain('blocked by policy');
  });
});
