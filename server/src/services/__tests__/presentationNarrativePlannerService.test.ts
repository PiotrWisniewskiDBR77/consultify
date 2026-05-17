import { describe, expect, it } from 'vitest';

import type { DeckSetup, OutlineItem } from '../presentationGeneratorService.js';
import { buildPresentationNarrativePlan } from '../presentationNarrativePlannerService.js';
import { buildPresentationSourcePack } from '../presentationSourcePackService.js';

const setup: DeckSetup = {
  title: 'VTS Steering Committee Decision Deck',
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
      confidence: 0.88,
      readiness: 'ready',
      lineage: { runtime: 'assessment', recordId: 'assessment-1' },
    },
    {
      type: 'initiative_portfolio',
      id: 'portfolio-1',
      artifactId: 'artifact-portfolio-1',
      label: 'Transformation portfolio',
      confidence: 0.79,
      readiness: 'ready',
      lineage: { runtime: 'initiative', recordId: 'portfolio-1' },
    },
  ],
};

const outline: OutlineItem[] = [
  { intent: 'cover', title: 'VTS Steering Committee Decision Deck', enabled: true },
  {
    intent: 'executive_summary',
    title: 'Executive Summary',
    keyMessage: 'The program is ready for the next funding decision.',
    enabled: true,
    sourceRef: 'artifact-assessment-1',
  },
  {
    intent: 'initiative_portfolio',
    title: 'Portfolio Recommendation',
    enabled: true,
    sourceRef: 'artifact-portfolio-1',
  },
  {
    intent: 'risk_management',
    title: 'Risks and Decisions',
    enabled: true,
  },
];

describe('presentationNarrativePlannerService', () => {
  it('builds a deck-level narrative plan for decision decks', () => {
    const sourcePack = buildPresentationSourcePack({
      setup,
      organizationId: 'org-1',
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    const plan = buildPresentationNarrativePlan({
      setup,
      outline,
      sourcePack,
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(plan.status).toBe('ready');
    expect(plan.thesis).toContain('support a decision');
    expect(plan.decisionContext).toContain('decision');
    expect(plan.proofPoints).toEqual([
      'AI readiness assessment (assessment)',
      'Transformation portfolio (initiative_portfolio)',
    ]);
    expect(plan.decisionsRequired).toContain('Confirm the recommended direction.');
    expect(plan.slidePlan).toHaveLength(4);
    expect(plan.slidePlan[1]).toMatchObject({
      narrativeRole: 'thesis',
      decisionRelevance: 'supporting',
      requiredEvidence: ['artifact-assessment-1'],
    });
    expect(plan.slidePlan[3]).toMatchObject({
      narrativeRole: 'decision',
      decisionRelevance: 'primary',
    });
  });

  it('marks prompt-only decks as needing sources and hypothesis treatment', () => {
    const promptOnlySetup: DeckSetup = {
      ...setup,
      goal: 'inform',
      sourceArtifacts: [],
    };
    const sourcePack = buildPresentationSourcePack({
      setup: promptOnlySetup,
      organizationId: 'org-1',
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    const plan = buildPresentationNarrativePlan({
      setup: promptOnlySetup,
      outline,
      sourcePack,
      now: new Date('2026-05-08T12:00:00.000Z'),
    });

    expect(plan.status).toBe('needs_sources');
    expect(plan.thesis).toContain('limited source grounding');
    expect(plan.warnings.join(' ')).toContain('draft hypotheses');
    expect(plan.slidePlan[1].requiredEvidence).toEqual([]);
  });
});
