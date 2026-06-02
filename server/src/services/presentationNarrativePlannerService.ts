import type { DeckSetup, OutlineItem } from './presentationGeneratorService.js';
import type { PresentationSourcePack } from './presentationSourcePackService.js';

export type PresentationNarrativePlanStatus = 'ready' | 'needs_sources' | 'needs_decision_context';

export interface PresentationNarrativeSlidePlan {
  slideIndex: number;
  intent: string;
  title: string;
  narrativeRole: 'frame' | 'thesis' | 'proof' | 'implication' | 'decision' | 'appendix';
  audienceQuestion: string;
  keyMessage: string;
  requiredEvidence: string[];
  decisionRelevance: 'none' | 'supporting' | 'primary';
}

export interface PresentationNarrativePlan {
  planId: string;
  status: PresentationNarrativePlanStatus;
  thesis: string;
  audience: string;
  goal: string;
  decisionContext: string | null;
  storyline: string[];
  proofPoints: string[];
  risks: string[];
  decisionsRequired: string[];
  slidePlan: PresentationNarrativeSlidePlan[];
  warnings: string[];
  createdAt: string;
}

function roleForIntent(intent: string): PresentationNarrativeSlidePlan['narrativeRole'] {
  if (intent === 'cover' || intent === 'section_intro') return 'frame';
  if (intent === 'executive_summary' || intent === 'key_messages') return 'thesis';
  if (
    intent === 'risk_management' ||
    intent === 'next_steps' ||
    intent === 'recommendation_portfolio'
  ) {
    return 'decision';
  }
  if (intent === 'appendix') return 'appendix';
  if (intent === 'roadmap' || intent === 'initiative_portfolio') return 'implication';
  return 'proof';
}

function audienceQuestionFor(
  role: PresentationNarrativeSlidePlan['narrativeRole'],
  setup: DeckSetup
): string {
  const audience = setup.audience || 'audience';
  switch (role) {
    case 'frame':
      return `Why is this deck relevant for ${audience} now?`;
    case 'thesis':
      return 'What is the main recommendation or message?';
    case 'proof':
      return 'What evidence supports the message?';
    case 'implication':
      return 'What changes, actions, or trade-offs follow from the evidence?';
    case 'decision':
      return setup.goal === 'decide'
        ? 'What decision is needed and what is the recommended path?'
        : 'What should stakeholders do next?';
    case 'appendix':
      return 'What detail supports review without slowing the main story?';
  }
}

function buildThesis(setup: DeckSetup, sourcePack: PresentationSourcePack): string {
  const goalVerb =
    setup.goal === 'decide'
      ? 'support a decision'
      : setup.goal === 'sell'
        ? 'build confidence in the proposal'
        : setup.goal === 'align'
          ? 'align stakeholders'
          : 'inform stakeholders';
  const grounding =
    sourcePack.status === 'ready'
      ? `grounded in ${sourcePack.coverage.readySources} ready source(s)`
      : sourcePack.status === 'empty'
        ? 'with limited source grounding'
        : `with ${sourcePack.status.replace(/_/g, ' ')} evidence`;
  return `${setup.title} should ${goalVerb} for ${setup.audience} using a ${grounding} storyline.`;
}

function requiredEvidenceFor(item: OutlineItem, sourcePack: PresentationSourcePack): string[] {
  const availableSourceIds = new Set(sourcePack.sources.map((source) => source.sourceId));
  const sourceRefs = Array.isArray((item as any).sourceRefs)
    ? ((item as any).sourceRefs as string[])
    : item.sourceRef
      ? [item.sourceRef]
      : [];
  const currentRefs = sourceRefs.filter((sourceRef) => availableSourceIds.has(sourceRef));
  if (currentRefs.length > 0) return currentRefs;
  if (item.intent === 'cover' || item.intent === 'next_steps') return [];
  return sourcePack.sources.slice(0, 2).map((source) => source.sourceId);
}

export function buildPresentationNarrativePlan(params: {
  setup: DeckSetup;
  outline: OutlineItem[];
  sourcePack: PresentationSourcePack;
  now?: Date;
}): PresentationNarrativePlan {
  const now = params.now || new Date();
  const enabledOutline = params.outline.filter((item) => item.enabled !== false);
  const warnings: string[] = [];
  if (params.sourcePack.status === 'empty') {
    warnings.push('Narrative plan has no concrete source pack; treat claims as draft hypotheses.');
  }
  if (params.sourcePack.missingInputs.length > 0) {
    warnings.push(`Narrative plan missing inputs: ${params.sourcePack.missingInputs.join(', ')}.`);
  }

  const slidePlan = enabledOutline.map((item, index) => {
    const narrativeRole = roleForIntent(item.intent);
    return {
      slideIndex: index,
      intent: item.intent,
      title: item.title,
      narrativeRole,
      audienceQuestion: audienceQuestionFor(narrativeRole, params.setup),
      keyMessage: item.keyMessage || `${item.title} must support the deck thesis.`,
      requiredEvidence: requiredEvidenceFor(item, params.sourcePack),
      decisionRelevance:
        params.setup.goal === 'decide' && narrativeRole === 'decision'
          ? 'primary'
          : params.setup.goal === 'decide' && narrativeRole !== 'appendix'
            ? 'supporting'
            : 'none',
    } satisfies PresentationNarrativeSlidePlan;
  });

  const proofPoints = params.sourcePack.sources
    .filter((source) => source.readiness === 'ready')
    .slice(0, 5)
    .map((source) => `${source.label} (${source.sourceType})`);
  const decisionsRequired =
    params.setup.goal === 'decide'
      ? [
          'Confirm the recommended direction.',
          'Assign owner and timing for next action.',
          ...params.sourcePack.missingInputs.map((input) => `Resolve missing input: ${input}`),
        ]
      : params.sourcePack.missingInputs.map((input) => `Resolve missing input: ${input}`);

  const status: PresentationNarrativePlanStatus =
    params.sourcePack.status === 'empty'
      ? 'needs_sources'
      : params.setup.goal === 'decide' && decisionsRequired.length === 0
        ? 'needs_decision_context'
        : 'ready';

  return {
    planId: `pnp_${now.getTime()}`,
    status,
    thesis: buildThesis(params.setup, params.sourcePack),
    audience: params.setup.audience,
    goal: params.setup.goal,
    decisionContext:
      params.setup.goal === 'decide'
        ? 'Deck must make the decision, recommendation, owner, timing, and evidence explicit.'
        : null,
    storyline: [
      'Frame the business context and why now.',
      'State the executive thesis early.',
      'Use source-backed proof before recommendations.',
      'Translate evidence into actions, risks, or decisions.',
      'Close with owners, timing, and next steps.',
    ],
    proofPoints,
    risks: params.sourcePack.warnings,
    decisionsRequired,
    slidePlan,
    warnings,
    createdAt: now.toISOString(),
  };
}
