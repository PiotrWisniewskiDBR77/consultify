import type { V8InterviewAnswerApproval } from '@/services/api/v8/interview';

export interface InterviewAnswerApprovalPresentation {
  labelKey: string;
  tone: 'neutral' | 'info' | 'success' | 'warning';
  reason: string | null;
  canApprove: boolean;
  canSendBack: boolean;
}

/**
 * DEC-535: answer approval is question state, never a competing workspace.
 * Keep the projection mapping independent from React so the navigator and the
 * active question always render the same state and available decisions.
 */
export function getInterviewAnswerApprovalPresentation(
  approval: V8InterviewAnswerApproval | undefined,
  isReviewerMode: boolean
): InterviewAnswerApprovalPresentation {
  if (!approval) {
    return {
      labelKey: 'interview.workspace.answerApprovalStatus.not_requested',
      tone: 'neutral',
      reason: null,
      canApprove: false,
      canSendBack: false,
    };
  }

  if (approval.status === 'sent_back' || approval.latestDecision === 'sent_back') {
    return {
      labelKey: 'interview.workspace.answerApprovalStatus.sent_back',
      tone: 'warning',
      reason: approval.reason,
      canApprove: false,
      canSendBack: false,
    };
  }

  if (approval.status === 'stages_complete' || approval.latestDecision === 'approved') {
    return {
      labelKey: 'interview.workspace.answerApprovalStatus.stages_complete',
      tone: 'success',
      reason: approval.reason,
      canApprove: false,
      canSendBack: false,
    };
  }

  const awaitsManager = approval.nextStage === 'manager';
  return {
    labelKey:
      approval.nextStage === 'ai'
        ? 'interview.workspace.answerApprovalStatus.ai_review'
        : 'interview.workspace.answerApprovalStatus.pending',
    tone: awaitsManager ? 'info' : 'neutral',
    reason: approval.reason,
    canApprove: isReviewerMode && awaitsManager,
    canSendBack: isReviewerMode && awaitsManager,
  };
}

export function interviewAnswerApprovalToneClass(
  tone: InterviewAnswerApprovalPresentation['tone']
): string {
  if (tone === 'success') return 'border-c-success/30 bg-c-success/10 text-c-success';
  if (tone === 'warning') return 'border-c-warning/30 bg-c-warning/10 text-c-warning';
  if (tone === 'info') return 'border-c-info/30 bg-c-info/10 text-c-info';
  return 'border-c-border bg-c-surface-raised text-c-text-secondary';
}
