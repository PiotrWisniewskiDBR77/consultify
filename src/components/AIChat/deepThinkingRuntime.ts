export type DeepThinkingExpectedOutput = 'Decision' | 'StructuredAnalysis' | 'FullReport';

export interface DeepThinkingConfirmPayload {
  understanding?: {
    goal?: string;
    context?: string;
    constraints?: string[];
    expectedOutput?: DeepThinkingExpectedOutput;
    decisionHorizon?: string;
  };
  isClearEnoughToProceed?: boolean;
  missingInfoQuestions?: Array<{
    id?: string;
    question?: string;
    whyItMatters?: string;
  }>;
  researchPlanItems?: Array<{
    id?: string;
    type?: string;
    label?: string;
    rationale?: string;
  }>;
  suggestedDepth?: 'Light' | 'Standard' | 'Hard' | string;
}

export interface DeepThinkingPendingConfirmBase {
  messageId: string;
  conversationId: string | null;
  originalMessage: string;
  editedMessage: string;
  confirm: DeepThinkingConfirmPayload;
  context: Record<string, unknown>;
  confirmToken?: string | null;
  clarificationAnswers?: Record<string, string> | null;
  clarificationRequested?: boolean;
  clarificationHandled?: boolean;
}

export const DEEP_THINKING_REPORT_OPTIONS = [
  { id: 'dt-go-deeper', label: 'Go deeper', value: 'Go deeper' },
  { id: 'dt-too-shallow', label: 'Too shallow', value: 'Too shallow' },
  {
    id: 'dt-challenge',
    label: 'Challenge this conclusion',
    value: 'Challenge this conclusion',
  },
] as const;

export function normalizeDeepThinkingExpectedOutput(
  raw: unknown
): DeepThinkingExpectedOutput | undefined {
  if (raw === 'Decision' || raw === 'StructuredAnalysis' || raw === 'FullReport') {
    return raw;
  }
  return undefined;
}

export function resolveDeepThinkingDepth(raw: unknown): 'light' | 'standard' | 'hard' {
  const value = String(raw || '')
    .trim()
    .toLowerCase();
  if (value === 'light') return 'light';
  if (value === 'hard') return 'hard';
  return 'standard';
}

export function shouldOpenDeepThinkingClarification(
  confirm: DeepThinkingConfirmPayload,
  clarificationHandled?: boolean
): boolean {
  if (clarificationHandled) return false;
  return (
    confirm?.isClearEnoughToProceed === false ||
    (Array.isArray(confirm?.missingInfoQuestions) && confirm.missingInfoQuestions.length > 0)
  );
}

export function buildDeepThinkingConfirmCardContent(confirm: DeepThinkingConfirmPayload): string {
  const understanding = confirm?.understanding || {};
  return [
    '**My understanding of your task**',
    `- Goal: ${understanding.goal || ''}`,
    understanding.context ? `- Context: ${understanding.context}` : '',
    Array.isArray(understanding.constraints) && understanding.constraints.length
      ? `- Constraints: ${understanding.constraints.join('; ')}`
      : '',
    understanding.expectedOutput ? `- Output: ${understanding.expectedOutput}` : '',
    understanding.decisionHorizon ? `- Horizon: ${understanding.decisionHorizon}` : '',
    '',
    Array.isArray(confirm?.missingInfoQuestions) && confirm.missingInfoQuestions.length
      ? `**Assumptions & gaps (optional):**\n${confirm.missingInfoQuestions
          .slice(0, 3)
          .map((q, i) => `${i + 1}. ${String(q?.question || '').trim()}`)
          .filter(Boolean)
          .join('\n')}`
      : '',
    '',
    '_Confirm to start Deep Thinking. Adjust if the task needs correction._',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildDeepThinkingConfirmMessageMetadata(args: {
  originalMessage: string;
  confirm: DeepThinkingConfirmPayload;
  confirmToken?: string | null;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const expectedOutput = normalizeDeepThinkingExpectedOutput(
    args.confirm?.understanding?.expectedOutput
  );
  const suggestedDepth = resolveDeepThinkingDepth(args.confirm?.suggestedDepth);
  return {
    deepThinking: {
      kind: 'confirm',
      originalMessage: args.originalMessage,
      ...(expectedOutput ? { expectedOutput } : {}),
      suggestedDepth,
    },
    deepThinkingConfirm: args.confirm,
    ...(args.confirmToken ? { deepThinkingConfirmToken: args.confirmToken } : {}),
    ...(args.extra || {}),
  };
}

export function buildDeepThinkingReportMetadata(args: {
  confirm?: DeepThinkingConfirmPayload | null;
  report?: string;
  streamSessionId?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const expectedOutput = normalizeDeepThinkingExpectedOutput(
    args.confirm?.understanding?.expectedOutput
  );
  const suggestedDepth = resolveDeepThinkingDepth(args.confirm?.suggestedDepth);
  return {
    options: [...DEEP_THINKING_REPORT_OPTIONS],
    multiSelect: false,
    deepThinking: {
      kind: 'report',
      ...(expectedOutput ? { expectedOutput } : {}),
      suggestedDepth,
      ...(args.streamSessionId ? { streamSessionId: args.streamSessionId } : {}),
    },
    ...(args.report ? { deepThinkingReport: args.report } : {}),
    ...(args.extra || {}),
  };
}

export function buildDeepThinkingConfirmedContext(
  pendingConfirm: DeepThinkingPendingConfirmBase,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const expectedOutput = normalizeDeepThinkingExpectedOutput(
    pendingConfirm.confirm?.understanding?.expectedOutput
  );
  return {
    ...(pendingConfirm.context || {}),
    deepThinkingConfirmed: true,
    deepThinkingConfirm: pendingConfirm.confirm,
    deepThinkingDepth: resolveDeepThinkingDepth(pendingConfirm.confirm?.suggestedDepth),
    ...(expectedOutput ? { deepThinkingExpectedOutput: expectedOutput } : {}),
    ...(pendingConfirm.confirmToken
      ? { deepThinkingConfirmToken: pendingConfirm.confirmToken }
      : {}),
    ...(pendingConfirm.clarificationAnswers
      ? { clarificationAnswers: pendingConfirm.clarificationAnswers }
      : {}),
    ...(extra || {}),
  };
}
