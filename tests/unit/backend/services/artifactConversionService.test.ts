import { describe, expect, it } from 'vitest';

import {
  buildInitiativePayload,
  canConvertToInitiative,
} from '../../../../server/src/services/artifacts/ArtifactConversionService.ts';
import type { Conclusion } from '../../../../server/src/services/conclusions/ConclusionService.ts';

function conclusion(overrides: Partial<Conclusion> = {}): Conclusion {
  return {
    id: 'conc-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    title: 'Approvals bottleneck',
    statement: 'Approvals are the main bottleneck in the process.',
    sourceModule: 'interview',
    sourceArtifactRefs: [{ type: 'interview_finding', id: 'finding-1' }],
    sourcePackId: 'source-pack-1',
    confidenceLevel: 'medium',
    limits: 'Based on two interviews; validate with sponsor.',
    evidenceRefs: [{ type: 'question_answer', ref: 'answer:1' }],
    recommendedNextAction: 'Clarify owner and remove approval bottleneck.',
    status: 'published',
    createdBy: 'user-1',
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('ArtifactConversionService initiative guards', () => {
  it('allows initiative conversion for a conclusion with evidence and limits', () => {
    expect(canConvertToInitiative(conclusion())).toEqual({ allowed: true });
  });

  it('blocks insufficient conclusions', () => {
    const result = canConvertToInitiative(conclusion({ confidenceLevel: 'insufficient' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('needs evidence');
  });

  it('blocks contradicted conclusions from execution initiative conversion', () => {
    const result = canConvertToInitiative(conclusion({ confidenceLevel: 'contradicted' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Contradicted');
  });

  it('builds bounded initiative payload with source lineage', () => {
    const payload = buildInitiativePayload(conclusion());
    expect(payload.status).toBe('DRAFT');
    expect(payload.sourceType).toBe('conclusion');
    expect(payload.sourceId).toBe('conc-1');
    expect((payload.sourceContext as any).sourceArtifactRefs).toHaveLength(1);
    expect((payload.sourceContext as any).evidenceCount).toBe(1);
  });
});
