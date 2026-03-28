/**
 * Preview AI Hints Service
 *
 * Generates contextual AI hint suggestions based on entity state.
 * Falls back to static hints when no dynamic hints apply.
 */

interface EntityState {
  entityType: string;
  status?: string;
  priority?: string;
  progress?: number;
  dueDate?: string;
  hasOwner?: boolean;
  hasDescription?: boolean;
  completeness?: number;
  daysSinceLastUpdate?: number;
}

interface HintResult {
  hints: string[];
  suggestedAction?: {
    label: string;
    confidence: number;
  };
}

const STATIC_HINTS: Record<string, string[]> = {
  task: ['Summarize', 'Risks', 'Next steps'],
  decision: ['Summarize', 'Risks', 'Alternatives'],
  initiative: ['Summarize', 'Risks', 'Next steps'],
  interview_session: ['Summarize', 'Key findings', 'Gaps'],
  interview_assignment: ['Summarize', 'Risks', 'Next steps'],
  interview_template: ['Summary', 'Improvements', 'Gaps'],
  kpi: ['Summarize', 'Trend analysis', 'Recommendations'],
  finance: ['Summarize', 'Cost optimization', 'Forecast'],
  report: ['Summarize', 'Key findings', 'Recommendations'],
  meeting: ['Summarize', 'Action items', 'Follow-ups'],
  tool: ['Summarize', 'Use cases', 'Alternatives'],
  default: ['Summarize', 'Risks', 'Next steps'],
};

export function generateContextualHints(state: EntityState): HintResult {
  const dynamicHints: string[] = [];
  let suggestedAction: HintResult['suggestedAction'] = undefined;

  const isOverdue = state.dueDate && new Date(state.dueDate) < new Date();
  const isStale = (state.daysSinceLastUpdate ?? 0) > 7;
  const isLowProgress = (state.progress ?? 100) < 30;
  const isIncomplete = (state.completeness ?? 100) < 50;

  if (isOverdue) {
    dynamicHints.push('Why is this blocked?');
    suggestedAction = { label: 'Escalate to sponsor', confidence: 0.82 };
  }

  if (isStale && state.status !== 'done' && state.status !== 'completed') {
    dynamicHints.push('What happened since last update?');
    if (!suggestedAction) {
      suggestedAction = { label: 'Request status update', confidence: 0.75 };
    }
  }

  if (isLowProgress && state.entityType === 'initiative') {
    dynamicHints.push("What's the bottleneck?");
  }

  if (!state.hasOwner) {
    dynamicHints.push('Who should own this?');
    if (!suggestedAction) {
      suggestedAction = { label: 'Assign owner', confidence: 0.7 };
    }
  }

  if (!state.hasDescription || isIncomplete) {
    dynamicHints.push('What information is missing?');
  }

  if (state.status === 'pending_approval' || state.status === 'review') {
    dynamicHints.push('Who should approve?');
    if (!suggestedAction) {
      suggestedAction = { label: 'Send for approval', confidence: 0.85 };
    }
  }

  const staticHints = STATIC_HINTS[state.entityType] ?? STATIC_HINTS.default;
  const allHints = [...dynamicHints, ...staticHints.filter((h) => !dynamicHints.includes(h))];

  return {
    hints: allHints.slice(0, 5),
    suggestedAction,
  };
}
