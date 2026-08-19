/**
 * V8 API Module Index
 * Re-exports all V8 domain API modules.
 */

export { V8AdminApi } from './admin';
export { V8AICoreApi } from './ai-core';
export type {
  V8AssessmentAssignment,
  V8AssessmentAssignmentPayload,
  V8AssessmentCreatePayload,
  V8AssessmentDetail,
  V8AssessmentListItem,
  V8AssessmentListResponse,
  V8AssessmentUpdatePayload,
  V8AssessmentUserRole,
  V8AssessmentUserState,
  V8AssessmentUserStatePayload,
} from './assessment';
export { V8AssessmentApi } from './assessment';
export { V8ChatApi } from './chat';
export { v8Delete, v8Get, v8Post, v8Put } from './client';
export type { V8ExecutionDelaySignal, V8ExecutionRiskSignal } from './execution-control';
export { V8ExecutionControlApi } from './execution-control';
export type { V8FinanceDashboard } from './finance';
export { V8FinanceApi } from './finance';
export type { V8InterviewSession } from './interview';
export { V8InterviewApi } from './interview';
export type { V8KbArticle, V8KbArticleListItem, V8KbCategory } from './kb';
export {
  V8_KB_ARTICLE_PATH,
  V8_KB_CATEGORIES_PATH,
  V8_KB_CONTEXT_PATH,
  V8_KB_SEARCH_PATH,
  V8KnowledgeBaseApi,
} from './kb';
export type {
  V8MultiplayerLockRecord,
  V8MultiplayerResourceMapping,
  V8MultiplayerRoomBinding,
  V8MultiplayerSurfacePresence,
} from './multiplayer';
export { V8MultiplayerApi } from './multiplayer';
export { V8MyWorkApi } from './my-work';
export type {
  V8PartnerAttribution,
  V8PartnerCampaignCreatePayload,
  V8PartnerCampaignDeleteResult,
  V8PartnerCampaignLink,
  V8PartnerClient,
  V8PartnerCommissionTransaction,
  V8PartnerEarningsSummary,
  V8PartnerEmployee,
  V8PartnerListingUpdatePayload,
  V8PartnerListingUpdateResult,
  V8PartnerOnboardingAcceptTermsPayload,
  V8PartnerOnboardingAcceptTermsResult,
  V8PartnerOnboardingCompleteResult,
  V8PartnerOnboardingSelectTierPayload,
  V8PartnerOnboardingSelectTierResult,
  V8PartnerOnboardingStatus,
  V8PartnerOrganizationUpdatePayload,
  V8PartnerOrganizationUpdateResult,
  V8PartnerPayoutAccount,
  V8PartnerPayoutHistoryItem,
  V8PartnerPayoutRequestPayload,
  V8PartnerPayoutRequestResponse,
  V8PartnerPayoutRequestResult,
  V8PartnerPayoutSettings,
  V8PartnerParticipantLedgerEntry,
  V8PartnerProgramStatus,
  V8PartnerProject,
  V8PartnerReferralAnalytics,
  V8PartnerReferralTools,
  V8PartnerReferralToolsCampaignLink,
  V8PartnerRegionsUpdatePayload,
  V8PartnerRegionsUpdateResult,
  V8PartnerSpecializationsUpdatePayload,
  V8PartnerSpecializationsUpdateResult,
} from './partner';
export { shouldFallbackToLegacyPartner, V8PartnerApi } from './partner';
export type { V8PlanningDecisionChain, V8PlanningDecisionEntry } from './planning';
export { V8PlanningApi } from './planning';
export type { V8PromptOsRuntimeSummary } from './prompt-os';
export { V8_PROMPT_OS_RUNTIME_SUMMARY_PATH, V8PromptOsApi } from './prompt-os';
export type { V8ResultsDashboardSnapshot } from './results';
export { V8ResultsApi } from './results';
export { V8RetrievalApi } from './retrieval';
export type {
  V8SyncAuthEscalation,
  V8SyncConflictRecord,
  V8SyncCredentialHealthSummary,
} from './sync';
export { V8SyncApi } from './sync';
