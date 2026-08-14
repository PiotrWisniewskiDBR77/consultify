/**
 * Covers canon tests 5 and 6:
 *  5. Presentation View does not contain `proposed`/draft content.
 *  6. A presentation block carries `sourceOutputId` + `sourceVersion`
 *     (traceability).
 */
import { describe, expect, it } from 'vitest';
import { buildPresentationView } from '../reportSnapshot';
import {
  createPresentationSourceBlock,
  PresentationSourceBlockError,
} from '../presentationSourceBlock';
import { makeEvidence, makeFinding, makeOutput } from './testFixtures';

describe('Presentation View — approved-only by default (test 5)', () => {
  it('excludes findings whose evidence is needs_evidence (E0) from acceptedFindings', () => {
    const acceptedFinding = makeFinding({ id: 'f-accepted', supportingEvidence: [makeEvidence({ strength: 'E2' })] });
    const draftFinding = makeFinding({ id: 'f-draft', supportingEvidence: [makeEvidence({ strength: 'E0' })] });
    const output = makeOutput({ findings: [acceptedFinding, draftFinding] });

    const view = buildPresentationView(output);

    expect(view.acceptedFindings.map((f) => f.id)).toEqual(['f-accepted']);
    expect(view.draftFindings).toEqual([]);
  });

  it('surfaces draft content only when explicitly requested, and always tagged isDraft: true', () => {
    const acceptedFinding = makeFinding({ id: 'f-accepted', supportingEvidence: [makeEvidence({ strength: 'E2' })] });
    const draftFinding = makeFinding({ id: 'f-draft', supportingEvidence: [makeEvidence({ strength: 'E0' })] });
    const output = makeOutput({ findings: [acceptedFinding, draftFinding] });

    const view = buildPresentationView(output, { includeDrafts: true });

    expect(view.acceptedFindings.map((f) => f.id)).toEqual(['f-accepted']);
    expect(view.draftFindings).toHaveLength(1);
    expect(view.draftFindings[0].finding.id).toBe('f-draft');
    expect(view.draftFindings[0].isDraft).toBe(true);
  });

  it('the presentation view object itself is frozen (no working-layer state can be attached later)', () => {
    const output = makeOutput();
    const view = buildPresentationView(output);
    expect(() => {
      (view as { outputId: string }).outputId = 'tampered';
    }).toThrow(TypeError);
  });
});

describe('PresentationSourceBlock — traceability (test 6)', () => {
  const baseInput = {
    blockId: 'block-1',
    blockType: 'finding' as const,
    dataSnapshot: { level: 2 },
    title: 'Data ownership is unclear',
    keyMessage: 'Processes stall at level 2 without an accountable data owner.',
    visualIntent: 'recommendation' as const,
    preferredLayouts: ['two_column' as const],
    density: 'standard' as const,
    themeTokens: { accent: 'c-focus' },
    confidentiality: 'client_deliverable' as const,
    generatedBy: 'human' as const,
    generatedAt: '2026-08-13T11:00:00.000Z',
  };

  it('carries sourceOutputId and sourceVersion from the Output it was built from', () => {
    const acceptedFinding = makeFinding({ supportingEvidence: [makeEvidence({ strength: 'E3' })] });
    const output = makeOutput({ id: 'output-42', version: 3, findings: [acceptedFinding] });

    const block = createPresentationSourceBlock(output, { ...baseInput, finding: acceptedFinding });

    expect(block.sourceOutputId).toBe('output-42');
    expect(block.sourceVersion).toBe(3);
  });

  it('refuses to build a block from draft (needs-evidence) content by default', () => {
    const draftFinding = makeFinding({ supportingEvidence: [makeEvidence({ strength: 'E0' })] });
    const output = makeOutput({ findings: [draftFinding] });

    expect(() =>
      createPresentationSourceBlock(output, { ...baseInput, finding: draftFinding })
    ).toThrow(PresentationSourceBlockError);
  });

  it('allows draft content only when explicitly opted in, and marks provenance.isDraft', () => {
    const draftFinding = makeFinding({ supportingEvidence: [makeEvidence({ strength: 'E0' })] });
    const output = makeOutput({ findings: [draftFinding] });

    const block = createPresentationSourceBlock(output, {
      ...baseInput,
      finding: draftFinding,
      allowDraftContent: true,
    });

    expect(block.provenance.isDraft).toBe(true);
  });

  it('a block built from an accepted finding is marked isDraft: false', () => {
    const acceptedFinding = makeFinding({ supportingEvidence: [makeEvidence({ strength: 'E3' })] });
    const output = makeOutput({ findings: [acceptedFinding] });

    const block = createPresentationSourceBlock(output, { ...baseInput, finding: acceptedFinding });

    expect(block.provenance.isDraft).toBe(false);
  });
});
