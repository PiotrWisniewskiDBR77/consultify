/**
 * Chat V10 — central registry of feature flags for the Chat V10 rollout.
 *
 * Status (Wave A seed pass · 2026-04-18)
 * --------------------------------------
 * The first three V10 tickets have landed as schema-only seeds and
 * register their default-OFF flags here:
 *
 *   - `V10-ART-001` → `ff.artifact_unified_model`
 *   - `V10-AGT-001` → `ff.agent_execution_proposal_v1`
 *   - `V10-ONB-001` → `ff.onboard_persona_capture`
 *
 * None of the three are wired into telemetry yet (`telemetry: []`).
 * Per `ADR-V10-003`, the rename of the V9 telemetry contract to V10
 * does NOT trigger until the first V10 flag declares a non-empty
 * `telemetry` array; until then the V9 contract remains the single
 * source of truth.
 *
 * Per-flag helpers live in `src/utils/v10/` (subfolder), out of the
 * recursive scan radius of the V9 invariant 13 (orphan-resolver
 * check), so V10 helpers never need an explicit V9 allowlist entry.
 *
 * Adding a V10 flag
 * -----------------
 * When a V10 ticket reaches "implementation" status:
 *
 *   1. Drop its per-flag helper (`src/utils/v10/<camelCaseName>Flag.ts`)
 *      with `is<Name>Enabled()` + `<CONST>_FLAG_KEYS`.
 *   2. Import the pair here and append a full descriptor to
 *      `CHAT_V10_FLAGS`.
 *   3. Cross-reference the ticket id (`V10-<CODE>-<nnn>`) and the
 *      requirement id (`R-<BLOCK>-<n>`) in the `ticketId` /
 *      `requirementId` fields.
 *   4. Ensure the feature is wired into the telemetry contract (event
 *      family `<block>.*`) and the runbook.
 *
 * Source of truth
 * ---------------
 * - Master plan:  `docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`
 * - Per-block dev plans: `docs/Chat V9/*_DEVELOPMENT_PLAN_2026-04-18.md`
 * - Deep research sources: `docs/Chat V9/DEEP_RESEARCH_*_2026-04-18.md`
 *
 * Default policy (master plan §4.3)
 * ---------------------------------
 * Every V10 flag defaults to **off** in production. Two exceptions are
 * encoded as **on-by-construction** safety flags — see the individual
 * dev plan §"Flags to register at implementation time" sections; the
 * invariants in `chatV10FeatureFlags.test.ts` will enforce asymmetry
 * when those flags land.
 */

import {
  type FlagKeys,
  type FlagOverrideState,
  encodeFlagOverrideState,
  readFlagOverrideState,
  writeFlagOverride,
} from './chatFlagsShared';
import {
  AGENT_APPROVAL_MODE_FLAG_KEYS,
  isAgentApprovalModeEnabled,
} from './v10/agentApprovalModeFlag';
import {
  AGENT_BUDGET_V1_FLAG_KEYS,
  isAgentBudgetV1Enabled,
} from './v10/agentBudgetV1Flag';
import {
  AGENT_DIFF_PREVIEW_V1_FLAG_KEYS,
  isAgentDiffPreviewV1Enabled,
} from './v10/agentDiffPreviewV1Flag';
import {
  AGENT_EXECUTION_PROPOSAL_V1_FLAG_KEYS,
  isAgentExecutionProposalV1Enabled,
} from './v10/agentExecutionProposalV1Flag';
import {
  AGENT_NAVIGATION_INTENT_FLAG_KEYS,
  isAgentNavigationIntentEnabled,
} from './v10/agentNavigationIntentFlag';
import {
  AGENT_OP_TYPE_REGISTRY_FLAG_KEYS,
  isAgentOpTypeRegistryEnabled,
} from './v10/agentOpTypeRegistryFlag';
import {
  AGENT_OPTIMISTIC_CONCURRENCY_FLAG_KEYS,
  isAgentOptimisticConcurrencyEnabled,
} from './v10/agentOptimisticConcurrencyFlag';
import {
  AGENT_SEVERITY_POLICIES_FLAG_KEYS,
  isAgentSeverityPoliciesEnabled,
} from './v10/agentSeverityPoliciesFlag';
import {
  AGENT_SEVERITY_S0_FLAG_KEYS,
  isAgentSeverityS0Enabled,
} from './v10/agentSeverityS0Flag';
import {
  AGENT_SEVERITY_S1_FLAG_KEYS,
  isAgentSeverityS1Enabled,
} from './v10/agentSeverityS1Flag';
import {
  AGENT_SEVERITY_S2_FLAG_KEYS,
  isAgentSeverityS2Enabled,
} from './v10/agentSeverityS2Flag';
import {
  AGENT_SEVERITY_S3_FLAG_KEYS,
  isAgentSeverityS3Enabled,
} from './v10/agentSeverityS3Flag';
import {
  AGENT_RUN_LEDGER_FLAG_KEYS,
  isAgentRunLedgerEnabled,
} from './v10/agentRunLedgerFlag';
import {
  AGENT_QUEUE_EXECUTOR_FLAG_KEYS,
  isAgentQueueExecutorEnabled,
} from './v10/agentQueueExecutorFlag';
import {
  AGENT_SEVERITY_S4_FLAG_KEYS,
  isAgentSeverityS4Enabled,
} from './v10/agentSeverityS4Flag';
import {
  ARTIFACT_ONE_STEP_UNDO_FLAG_KEYS,
  isArtifactOneStepUndoEnabled,
} from './v10/artifactOneStepUndoFlag';
import {
  ARTIFACT_SELECTION_AWARE_FLAG_KEYS,
  isArtifactSelectionAwareEnabled,
} from './v10/artifactSelectionAwareFlag';
import {
  ARTIFACT_CROSS_TRANSFORM_FLAG_KEYS,
  isArtifactCrossTransformEnabled,
} from './v10/artifactCrossTransformFlag';
import {
  ARTIFACT_APPROVE_EDIT_REJECT_FLAG_KEYS,
  isArtifactApproveEditRejectEnabled,
} from './v10/artifactApproveEditRejectFlag';
import {
  ARTIFACT_PARTIAL_ACCEPTANCE_FLAG_KEYS,
  isArtifactPartialAcceptanceEnabled,
} from './v10/artifactPartialAcceptanceFlag';
import {
  ARTIFACT_CANONICAL_CONTENT_FLAG_KEYS,
  isArtifactCanonicalContentEnabled,
} from './v10/artifactCanonicalContentFlag';
import {
  ARTIFACT_CITATION_V1_FLAG_KEYS,
  isArtifactCitationV1Enabled,
} from './v10/artifactCitationV1Flag';
import {
  ARTIFACT_DATA_CLASSIFICATION_FLAG_KEYS,
  isArtifactDataClassificationEnabled,
} from './v10/artifactDataClassificationFlag';
import {
  ARTIFACT_LINEAGE_GRAPH_FLAG_KEYS,
  isArtifactLineageGraphEnabled,
} from './v10/artifactLineageGraphFlag';
import {
  ARTIFACT_MUTATION_PROPOSAL_FLAG_KEYS,
  isArtifactMutationProposalEnabled,
} from './v10/artifactMutationProposalFlag';
import {
  ARTIFACT_NO_SILENT_WRITES_FLAG_KEYS,
  isArtifactNoSilentWritesEnabled,
} from './v10/artifactNoSilentWritesFlag';
import {
  ARTIFACT_TYPED_OPS_FLAG_KEYS,
  isArtifactTypedOpsEnabled,
} from './v10/artifactTypedOpsFlag';
import {
  ARTIFACT_REVIEW_FSM_FLAG_KEYS,
  isArtifactReviewFsmEnabled,
} from './v10/artifactReviewFsmFlag';
import {
  ARTIFACT_TYPE_REGISTRY_FLAG_KEYS,
  isArtifactTypeRegistryEnabled,
} from './v10/artifactTypeRegistryFlag';
import {
  ARTIFACT_UNIFIED_MODEL_FLAG_KEYS,
  isArtifactUnifiedModelEnabled,
} from './v10/artifactUnifiedModelFlag';
import {
  ONBOARD_BUYER_DATA_ONLY_FLAG_KEYS,
  isOnboardBuyerDataOnlyEnabled,
} from './v10/onboardBuyerDataOnlyFlag';
import {
  ONBOARD_CONNECTOR_RANKING_FLAG_KEYS,
  isOnboardConnectorRankingEnabled,
} from './v10/onboardConnectorRankingFlag';
import {
  ONBOARD_CONNECTOR_VALIDATION_FLAG_KEYS,
  isOnboardConnectorValidationEnabled,
} from './v10/onboardConnectorValidationFlag';
import {
  ONBOARD_FIRST_MUTATION_ENVELOPE_FLAG_KEYS,
  isOnboardFirstMutationEnvelopeEnabled,
} from './v10/onboardFirstMutationEnvelopeFlag';
import {
  ONBOARD_LIBRARY_SAVE_FLAG_KEYS,
  isOnboardLibrarySaveEnabled,
} from './v10/onboardLibrarySaveFlag';
import {
  ONBOARD_FIRST_EXPORT_MANIFEST_FLAG_KEYS,
  isOnboardFirstExportManifestEnabled,
} from './v10/onboardFirstExportManifestFlag';
import {
  ONBOARD_RESEARCH_COST_CAP_GATE_FLAG_KEYS,
  isOnboardResearchCostCapGateEnabled,
} from './v10/onboardResearchCostCapGateFlag';
import {
  ARTIFACT_MEMO_RICH_DOC_FLAG_KEYS,
  isArtifactMemoRichDocEnabled,
} from './v10/artifactMemoRichDocFlag';
import {
  AGENT_ATOMIC_BUNDLE_FLAG_KEYS,
  isAgentAtomicBundleEnabled,
} from './v10/agentAtomicBundleFlag';
import {
  ONBOARD_MEMORY_LAYER_OPT_IN_FLAG_KEYS,
  isOnboardMemoryLayerOptInEnabled,
} from './v10/onboardMemoryLayerOptInFlag';
import {
  ARTIFACT_SPREADSHEET_LINEAGE_FLAG_KEYS,
  isArtifactSpreadsheetLineageEnabled,
} from './v10/artifactSpreadsheetLineageFlag';
import {
  AGENT_SAGA_SEQUENCE_FLAG_KEYS,
  isAgentSagaSequenceEnabled,
} from './v10/agentSagaSequenceFlag';
import {
  ONBOARD_TENANT_BOOTSTRAP_FLAG_KEYS,
  isOnboardTenantBootstrapEnabled,
} from './v10/onboardTenantBootstrapFlag';
import {
  ARTIFACT_DECISION_DOC_FLAG_KEYS,
  isArtifactDecisionDocEnabled,
} from './v10/artifactDecisionDocFlag';
import {
  AGENT_APPROVAL_BARRIER_FLAG_KEYS,
  isAgentApprovalBarrierEnabled,
} from './v10/agentApprovalBarrierFlag';
import {
  ONBOARD_CONSERVATIVE_DEFAULTS_FLAG_KEYS,
  isOnboardConservativeDefaultsEnabled,
} from './v10/onboardConservativeDefaultsFlag';
import {
  ARTIFACT_RESEARCH_REPORT_FLAG_KEYS,
  isArtifactResearchReportEnabled,
} from './v10/artifactResearchReportFlag';
import {
  AGENT_FAN_OUT_FAN_IN_FLAG_KEYS,
  isAgentFanOutFanInEnabled,
} from './v10/agentFanOutFanInFlag';
import {
  ONBOARD_OAUTH_FALLBACK_FLAG_KEYS,
  isOnboardOAuthFallbackEnabled,
} from './v10/onboardOAuthFallbackFlag';
import {
  ARTIFACT_COMMENTS_ANNOTATIONS_FLAG_KEYS,
  isArtifactCommentsAnnotationsEnabled,
} from './v10/artifactCommentsAnnotationsFlag';
import {
  AGENT_SCHEDULE_DEFINITION_FLAG_KEYS,
  isAgentScheduleDefinitionEnabled,
} from './v10/agentScheduleDefinitionFlag';
import {
  ONBOARD_CITATION_VALIDATION_FALLBACK_FLAG_KEYS,
  isOnboardCitationValidationFallbackEnabled,
} from './v10/onboardCitationValidationFallbackFlag';
import {
  ARTIFACT_STORE_CONTRACT_FLAG_KEYS,
  isArtifactStoreContractEnabled,
} from './v10/artifactStoreContractFlag';
import {
  AGENT_SCHEDULE_REGISTRY_FLAG_KEYS,
  isAgentScheduleRegistryEnabled,
} from './v10/agentScheduleRegistryFlag';
import {
  ONBOARD_RESUME_ABANDONMENT_FLAG_KEYS,
  isOnboardResumeAbandonmentEnabled,
} from './v10/onboardResumeAbandonmentFlag';
import {
  ARTIFACT_IMMUTABLE_AUDIT_FLAG_KEYS,
  isArtifactImmutableAuditEnabled,
} from './v10/artifactImmutableAuditFlag';
import {
  AGENT_SWARM_DEFINITION_FLAG_KEYS,
  isAgentSwarmDefinitionEnabled,
} from './v10/agentSwarmDefinitionFlag';
import {
  ONBOARD_TELEMETRY_FLAG_KEYS,
  isOnboardTelemetryEnabled,
} from './v10/onboardTelemetryFlag';
import {
  ARTIFACT_EXPORT_MANIFEST_FLAG_KEYS,
  isArtifactExportManifestEnabled,
} from './v10/artifactExportManifestFlag';
import {
  ARTIFACT_PROVENANCE_FOOTER_FLAG_KEYS,
  isArtifactProvenanceFooterEnabled,
} from './v10/artifactProvenanceFooterFlag';
import {
  ARTIFACT_LIBRARY_FOLDERS_FLAG_KEYS,
  isArtifactLibraryFoldersEnabled,
} from './v10/artifactLibraryFoldersFlag';
import {
  ARTIFACT_TEMPLATE_FINGERPRINT_FLAG_KEYS,
  isArtifactTemplateFingerprintEnabled,
} from './v10/artifactTemplateFingerprintFlag';
import {
  AGENT_INTERRUPT_VERBS_FLAG_KEYS,
  isAgentInterruptVerbsEnabled,
} from './v10/agentInterruptVerbsFlag';
import {
  AGENT_RESEARCH_PHASE_MACHINE_FLAG_KEYS,
  isAgentResearchPhaseMachineEnabled,
} from './v10/agentResearchPhaseMachineFlag';
import {
  AGENT_TRACE_COLLECTOR_FLAG_KEYS,
  isAgentTraceCollectorEnabled,
} from './v10/agentTraceCollectorFlag';
import {
  AGENT_NOTIFICATION_BROKER_FLAG_KEYS,
  isAgentNotificationBrokerEnabled,
} from './v10/agentNotificationBrokerFlag';
import {
  ONBOARD_ACTIVATION_KPI_DASHBOARD_FLAG_KEYS,
  isOnboardActivationKpiDashboardEnabled,
} from './v10/onboardActivationKpiDashboardFlag';
import {
  ONBOARD_TEAM_INVITE_AFTER_AHA_FLAG_KEYS,
  isOnboardTeamInviteAfterAhaEnabled,
} from './v10/onboardTeamInviteAfterAhaFlag';
import {
  ARTIFACT_ROLE_BASED_APPROVAL_GATES_FLAG_KEYS,
  isArtifactRoleBasedApprovalGatesEnabled,
} from './v10/artifactRoleBasedApprovalGatesFlag';
import {
  AGENT_ANTI_PATTERNS_FLAG_KEYS,
  isAgentAntiPatternsEnabled,
} from './v10/agentAntiPatternsFlag';
import {
  ARTIFACT_SLIDE_DECK_SCHEMA_FLAG_KEYS,
  isArtifactSlideDeckSchemaEnabled,
} from './v10/artifactSlideDeckSchemaFlag';
import {
  AGENT_CHECKPOINT_STORE_FLAG_KEYS,
  isAgentCheckpointStoreEnabled,
} from './v10/agentCheckpointStoreFlag';
import {
  ONBOARD_FIVE_MINUTE_SLA_FLAG_KEYS,
  isOnboardFiveMinuteSlaEnabled,
} from './v10/onboardFiveMinuteSlaFlag';
import {
  ONBOARD_NO_GHOST_CAPS_FLAG_KEYS,
  isOnboardNoGhostCapsEnabled,
} from './v10/onboardNoGhostCapsFlag';
import {
  ONBOARD_PERSONA_CAPTURE_FLAG_KEYS,
  isOnboardPersonaCaptureEnabled,
} from './v10/onboardPersonaCaptureFlag';
import {
  ONBOARD_APPROVAL_AUDIT_FLAG_KEYS,
  isOnboardApprovalAuditEnabled,
} from './v10/onboardApprovalAuditFlag';
import {
  ONBOARD_PROVENANCE_PANEL_FLAG_KEYS,
  isOnboardProvenancePanelEnabled,
} from './v10/onboardProvenancePanelFlag';
import {
  ONBOARD_PERSONA_INFERENCE_OVERRIDE_FLAG_KEYS,
  isOnboardPersonaInferenceOverrideEnabled,
} from './v10/onboardPersonaInferenceOverrideFlag';
import {
  ONBOARD_PERSONA_JOURNEY_FLAG_KEYS,
  isOnboardPersonaJourneyEnabled,
} from './v10/onboardPersonaJourneyFlag';
import {
  ONBOARD_ROUTE_RESOLVER_FLAG_KEYS,
  isOnboardRouteResolverEnabled,
} from './v10/onboardRouteResolverFlag';
import {
  ONBOARD_TRUST_FIRST_BANNER_FLAG_KEYS,
  isOnboardTrustFirstBannerEnabled,
} from './v10/onboardTrustFirstBannerFlag';
import {
  REASONING_WORKLOAD_CLASS_REGISTRY_FLAG_KEYS,
  isReasoningWorkloadClassRegistryEnabled,
} from './v10/reasoningWorkloadClassRegistryFlag';
import {
  REASONING_INTENT_CLASSIFIER_FLAG_KEYS,
  isReasoningIntentClassifierEnabled,
} from './v10/reasoningIntentClassifierFlag';
import {
  REASONING_SCOPE_RESOLVER_FLAG_KEYS,
  isReasoningScopeResolverEnabled,
} from './v10/reasoningScopeResolverFlag';
import {
  REASONING_PLAN_FORMULATOR_FLAG_KEYS,
  isReasoningPlanFormulatorEnabled,
} from './v10/reasoningPlanFormulatorFlag';
import {
  LEARNING_TYPED_CONSENT_FLAG_KEYS,
  isLearningTypedConsentEnabled,
} from './v10/learningTypedConsentFlag';
import {
  LEARNING_FEEDBACK_SIGNAL_FLAG_KEYS,
  isLearningFeedbackSignalEnabled,
} from './v10/learningFeedbackSignalFlag';
import {
  LEARNING_FEEDBACK_COLLECTOR_FLAG_KEYS,
  isLearningFeedbackCollectorEnabled,
} from './v10/learningFeedbackCollectorFlag';
import {
  LEARNING_BEHAVIOURAL_SIGNALS_FLAG_KEYS,
  isLearningBehaviouralSignalsEnabled,
} from './v10/learningBehaviouralSignalsFlag';
import {
  RESEARCH_MISSION_FLAG_KEYS,
  isResearchMissionEnabled,
} from './v10/researchMissionFlag';
import {
  RESEARCH_MISSION_SCOPE_FLAG_KEYS,
  isResearchMissionScopeEnabled,
} from './v10/researchMissionScopeFlag';
import {
  RESEARCH_RETRIEVAL_POLICY_FLAG_KEYS,
  isResearchRetrievalPolicyEnabled,
} from './v10/researchRetrievalPolicyFlag';
import {
  RESEARCH_SOURCE_ALLOW_BLOCK_LIST_FLAG_KEYS,
  isResearchSourceAllowBlockListEnabled,
} from './v10/researchSourceAllowBlockListFlag';
import {
  CONNECTORS_CONNECTOR_INTERFACE_FLAG_KEYS,
  isConnectorsConnectorInterfaceEnabled,
} from './v10/connectorsConnectorInterfaceFlag';
import {
  CONNECTORS_REGISTRY_FLAG_KEYS,
  isConnectorsRegistryEnabled,
} from './v10/connectorsRegistryFlag';
import {
  OUTCOME_SIGNAL_FLAG_KEYS,
  isOutcomeSignalEnabled,
} from './v10/outcomeSignalFlag';
import {
  OUTCOME_RECORD_FLAG_KEYS,
  isOutcomeRecordEnabled,
} from './v10/outcomeRecordFlag';
import {
  REASONING_TOOL_CALL_REGISTRY_FLAG_KEYS,
  isReasoningToolCallRegistryEnabled,
} from './v10/reasoningToolCallRegistryFlag';
import {
  REASONING_RETRIEVAL_LAYER_FLAG_KEYS,
  isReasoningRetrievalLayerEnabled,
} from './v10/reasoningRetrievalLayerFlag';
import {
  REASONING_EXECUTION_LOOP_FLAG_KEYS,
  isReasoningExecutionLoopEnabled,
} from './v10/reasoningExecutionLoopFlag';
import {
  REASONING_CLAIM_EXTRACTION_FLAG_KEYS,
  isReasoningClaimExtractionEnabled,
} from './v10/reasoningClaimExtractionFlag';
import {
  LEARNING_OUTCOME_SIGNALS_FLAG_KEYS,
  isLearningOutcomeSignalsEnabled,
} from './v10/learningOutcomeSignalsFlag';
import {
  LEARNING_MEMORY_PACK_FLAG_KEYS,
  isLearningMemoryPackEnabled,
} from './v10/learningMemoryPackFlag';
import {
  LEARNING_TTL_FORGETTING_FLAG_KEYS,
  isLearningTtlForgettingEnabled,
} from './v10/learningTtlForgettingFlag';
import {
  LEARNING_REVOCATION_FLAG_KEYS,
  isLearningRevocationEnabled,
} from './v10/learningRevocationFlag';
import {
  RESEARCH_MISSION_PLAN_FORMULATOR_FLAG_KEYS,
  isResearchMissionPlanFormulatorEnabled,
} from './v10/researchMissionPlanFormulatorFlag';
import {
  RESEARCH_MISSION_BUDGET_FLAG_KEYS,
  isResearchMissionBudgetEnabled,
} from './v10/researchMissionBudgetFlag';
import {
  RESEARCH_EXECUTOR_FLAG_KEYS,
  isResearchExecutorEnabled,
} from './v10/researchExecutorFlag';
import {
  RESEARCH_SOURCE_FETCHER_FLAG_KEYS,
  isResearchSourceFetcherEnabled,
} from './v10/researchSourceFetcherFlag';
import {
  CONNECTORS_OAUTH_LAYER_FLAG_KEYS,
  isConnectorsOAuthLayerEnabled,
} from './v10/connectorsOAuthLayerFlag';
import {
  CONNECTORS_TOKEN_VAULT_FLAG_KEYS,
  isConnectorsTokenVaultEnabled,
} from './v10/connectorsTokenVaultFlag';
import {
  OUTCOME_TAXONOMY_FLAG_KEYS,
  isOutcomeTaxonomyEnabled,
} from './v10/outcomeTaxonomyFlag';
import {
  OUTCOME_ATTRIBUTION_POLICY_FLAG_KEYS,
  isOutcomeAttributionPolicyEnabled,
} from './v10/outcomeAttributionPolicyFlag';
import {
  REASONING_CITATION_BINDER_FLAG_KEYS,
  isReasoningCitationBinderEnabled,
} from './v10/reasoningCitationBinderFlag';
import {
  REASONING_EVIDENCE_COVERAGE_SCORER_FLAG_KEYS,
  isReasoningEvidenceCoverageScorerEnabled,
} from './v10/reasoningEvidenceCoverageScorerFlag';
import {
  REASONING_HEDGING_CALIBRATION_FLAG_KEYS,
  isReasoningHedgingCalibrationEnabled,
} from './v10/reasoningHedgingCalibrationFlag';
import {
  REASONING_HALLUCINATION_FILTER_FLAG_KEYS,
  isReasoningHallucinationFilterEnabled,
} from './v10/reasoningHallucinationFilterFlag';
import {
  LEARNING_ROUTING_ADJUSTMENT_FLAG_KEYS,
  isLearningRoutingAdjustmentEnabled,
} from './v10/learningRoutingAdjustmentFlag';
import {
  LEARNING_PII_REDACTION_FLAG_KEYS,
  isLearningPiiRedactionEnabled,
} from './v10/learningPiiRedactionFlag';
import {
  LEARNING_NEVER_OVERRIDE_INVARIANTS_FLAG_KEYS,
  isLearningNeverOverrideInvariantsEnabled,
} from './v10/learningNeverOverrideInvariantsFlag';
import {
  LEARNING_TELEMETRY_FLAG_KEYS,
  isLearningTelemetryEnabled,
} from './v10/learningTelemetryFlag';
import {
  RESEARCH_CURATED_WEB_SOURCE_PROVIDER_FLAG_KEYS,
  isResearchCuratedWebSourceProviderEnabled,
} from './v10/researchCuratedWebSourceProviderFlag';
import {
  RESEARCH_CONTENT_EXTRACTOR_FLAG_KEYS,
  isResearchContentExtractorEnabled,
} from './v10/researchContentExtractorFlag';
import {
  RESEARCH_DEDUP_NEAR_DUPLICATE_FLAG_KEYS,
  isResearchDedupNearDuplicateEnabled,
} from './v10/researchDedupNearDuplicateFlag';
import {
  RESEARCH_EVIDENCE_GRAPH_FLAG_KEYS,
  isResearchEvidenceGraphEnabled,
} from './v10/researchEvidenceGraphFlag';
import {
  CONNECTORS_TOKEN_REFRESH_REVOCATION_FLAG_KEYS,
  isConnectorsTokenRefreshRevocationEnabled,
} from './v10/connectorsTokenRefreshRevocationFlag';
import {
  CONNECTORS_SESSION_FLAG_KEYS,
  isConnectorsSessionEnabled,
} from './v10/connectorsSessionFlag';
import {
  OUTCOME_LINEAGE_BINDING_FLAG_KEYS,
  isOutcomeLineageBindingEnabled,
} from './v10/outcomeLineageBindingFlag';
import {
  OUTCOME_TIME_SAVED_CALIBRATION_FLAG_KEYS,
  isOutcomeTimeSavedCalibrationEnabled,
} from './v10/outcomeTimeSavedCalibrationFlag';
import {
  REASONING_TRUST_BUNDLE_FLAG_KEYS,
  isReasoningTrustBundleEnabled,
} from './v10/reasoningTrustBundleFlag';
import {
  REASONING_TRUST_BUNDLE_HASH_FLAG_KEYS,
  isReasoningTrustBundleHashEnabled,
} from './v10/reasoningTrustBundleHashFlag';
import {
  REASONING_FAST_CHAT_FLAG_KEYS,
  isReasoningFastChatEnabled,
} from './v10/reasoningFastChatFlag';
import {
  REASONING_GROUNDED_CHAT_FLAG_KEYS,
  isReasoningGroundedChatEnabled,
} from './v10/reasoningGroundedChatFlag';
import {
  LEARNING_ADAPTIVE_COVERAGE_THRESHOLD_FLAG_KEYS,
  isLearningAdaptiveCoverageThresholdEnabled,
} from './v10/learningAdaptiveCoverageThresholdFlag';
import {
  LEARNING_TENANT_PROMPT_SNIPPETS_FLAG_KEYS,
  isLearningTenantPromptSnippetsEnabled,
} from './v10/learningTenantPromptSnippetsFlag';
import {
  LEARNING_CONNECTOR_RANKING_FLAG_KEYS,
  isLearningConnectorRankingEnabled,
} from './v10/learningConnectorRankingFlag';
import {
  LEARNING_DRIFT_DETECTION_FLAG_KEYS,
  isLearningDriftDetectionEnabled,
} from './v10/learningDriftDetectionFlag';
import {
  RESEARCH_CLAIM_NODE_SOURCE_EDGE_FLAG_KEYS,
  isResearchClaimNodeSourceEdgeEnabled,
} from './v10/researchClaimNodeSourceEdgeFlag';
import {
  RESEARCH_SUPPORT_CONTRADICT_EDGES_FLAG_KEYS,
  isResearchSupportContradictEdgesEnabled,
} from './v10/researchSupportContradictEdgesFlag';
import {
  RESEARCH_SYNTHESIS_FLAG_KEYS,
  isResearchSynthesisEnabled,
} from './v10/researchSynthesisFlag';
import {
  RESEARCH_CLAIM_VALIDATOR_FLAG_KEYS,
  isResearchClaimValidatorEnabled,
} from './v10/researchClaimValidatorFlag';
import {
  CONNECTORS_READ_WRITE_SCOPES_FLAG_KEYS,
  isConnectorsReadWriteScopesEnabled,
} from './v10/connectorsReadWriteScopesFlag';
import {
  CONNECTORS_SOURCE_REF_PROVENANCE_FLAG_KEYS,
  isConnectorsSourceRefProvenanceEnabled,
} from './v10/connectorsSourceRefProvenanceFlag';
import {
  OUTCOME_USER_CONFIRMATION_SURFACE_FLAG_KEYS,
  isOutcomeUserConfirmationSurfaceEnabled,
} from './v10/outcomeUserConfirmationSurfaceFlag';
import {
  OUTCOME_PASSIVE_OUTCOME_EMISSION_FLAG_KEYS,
  isOutcomePassiveOutcomeEmissionEnabled,
} from './v10/outcomePassiveOutcomeEmissionFlag';
import {
  REASONING_ON_WORKSPACE_FLAG_KEYS,
  isReasoningOnWorkspaceEnabled,
} from './v10/reasoningOnWorkspaceFlag';
import {
  REASONING_DECISION_REVIEW_FLAG_KEYS,
  isReasoningDecisionReviewEnabled,
} from './v10/reasoningDecisionReviewFlag';
import {
  REASONING_ARTIFACT_BUILD_FLAG_KEYS,
  isReasoningArtifactBuildEnabled,
} from './v10/reasoningArtifactBuildFlag';
import {
  REASONING_DEEP_RESEARCH_STUB_FLAG_KEYS,
  isReasoningDeepResearchStubEnabled,
} from './v10/reasoningDeepResearchStubFlag';
import {
  LEARNING_AUDIT_EXPORT_FLAG_KEYS,
  isLearningAuditExportEnabled,
} from './v10/learningAuditExportFlag';
import {
  LEARNING_PER_TENANT_KILL_SWITCH_FLAG_KEYS,
  isLearningPerTenantKillSwitchEnabled,
} from './v10/learningPerTenantKillSwitchFlag';
import {
  RESEARCH_DISAGREEMENT_PRESENTATION_FLAG_KEYS,
  isResearchDisagreementPresentationEnabled,
} from './v10/researchDisagreementPresentationFlag';
import {
  RESEARCH_HEDGING_CALIBRATION_FLAG_KEYS,
  isResearchHedgingCalibrationEnabled,
} from './v10/researchHedgingCalibrationFlag';
import {
  RESEARCH_REPORT_ARTIFACT_FLAG_KEYS,
  isResearchReportArtifactEnabled,
} from './v10/researchReportArtifactFlag';
import {
  RESEARCH_MISSION_TRUST_BUNDLE_FLAG_KEYS,
  isResearchMissionTrustBundleEnabled,
} from './v10/researchMissionTrustBundleFlag';
import {
  RESEARCH_MISSION_INTERRUPT_VERBS_FLAG_KEYS,
  isResearchMissionInterruptVerbsEnabled,
} from './v10/researchMissionInterruptVerbsFlag';
import {
  RESEARCH_MISSION_RESUME_FLAG_KEYS,
  isResearchMissionResumeEnabled,
} from './v10/researchMissionResumeFlag';
import {
  CONNECTORS_ACL_PROBE_FLAG_KEYS,
  isConnectorsAclProbeEnabled,
} from './v10/connectorsAclProbeFlag';
import {
  CONNECTORS_FEDERATED_SEARCH_FLAG_KEYS,
  isConnectorsFederatedSearchEnabled,
} from './v10/connectorsFederatedSearchFlag';
import {
  OUTCOME_DECISION_SHIPPED_DETECTOR_FLAG_KEYS,
  isOutcomeDecisionShippedDetectorEnabled,
} from './v10/outcomeDecisionShippedDetectorFlag';
import {
  OUTCOME_KPI_ACCEPT_OUTCOME_FLAG_KEYS,
  isOutcomeKpiAcceptOutcomeEnabled,
} from './v10/outcomeKpiAcceptOutcomeFlag';
import {
  REASONING_BACKGROUND_AGENT_STUB_FLAG_KEYS,
  isReasoningBackgroundAgentStubEnabled,
} from './v10/reasoningBackgroundAgentStubFlag';
import {
  REASONING_PRESENTATION_LAYER_FLAG_KEYS,
  isReasoningPresentationLayerEnabled,
} from './v10/reasoningPresentationLayerFlag';
import {
  REASONING_TELEMETRY_FLAG_KEYS,
  isReasoningTelemetryEnabled,
} from './v10/reasoningTelemetryFlag';
import {
  REASONING_EDGE_CASE_MATRIX_FLAG_KEYS,
  isReasoningEdgeCaseMatrixEnabled,
} from './v10/reasoningEdgeCaseMatrixFlag';
import {
  RESEARCH_MISSION_AUDIT_LOG_FLAG_KEYS,
  isResearchMissionAuditLogEnabled,
} from './v10/researchMissionAuditLogFlag';
import {
  RESEARCH_TELEMETRY_FLAG_KEYS,
  isResearchTelemetryEnabled,
} from './v10/researchTelemetryFlag';
import {
  RESEARCH_COST_DASHBOARD_FLAG_KEYS,
  isResearchCostDashboardEnabled,
} from './v10/researchCostDashboardFlag';
import {
  RESEARCH_SCHEDULED_WATCHES_FLAG_KEYS,
  isResearchScheduledWatchesEnabled,
} from './v10/researchScheduledWatchesFlag';
import {
  CONNECTORS_INCREMENTAL_SYNC_FLAG_KEYS,
  isConnectorsIncrementalSyncEnabled,
} from './v10/connectorsIncrementalSyncFlag';
import {
  CONNECTORS_FRESHNESS_SLO_FLAG_KEYS,
  isConnectorsFreshnessSloEnabled,
} from './v10/connectorsFreshnessSloFlag';
import {
  CONNECTORS_RATE_LIMIT_BACKOFF_FLAG_KEYS,
  isConnectorsRateLimitBackoffEnabled,
} from './v10/connectorsRateLimitBackoffFlag';
import {
  CONNECTORS_ACL_PROPAGATION_FLAG_KEYS,
  isConnectorsAclPropagationEnabled,
} from './v10/connectorsAclPropagationFlag';
import {
  OUTCOME_DOUBLE_COUNT_GUARD_FLAG_KEYS,
  isOutcomeDoubleCountGuardEnabled,
} from './v10/outcomeDoubleCountGuardFlag';
import {
  OUTCOME_REVERSAL_FLAG_KEYS,
  isOutcomeReversalEnabled,
} from './v10/outcomeReversalFlag';
import {
  OUTCOME_PER_TEAM_ROI_DASHBOARD_FLAG_KEYS,
  isOutcomePerTeamRoiDashboardEnabled,
} from './v10/outcomePerTeamRoiDashboardFlag';
import {
  OUTCOME_PER_PERSONA_BREAKDOWN_FLAG_KEYS,
  isOutcomePerPersonaBreakdownEnabled,
} from './v10/outcomePerPersonaBreakdownFlag';
import {
  REASONING_QUALITY_DASHBOARD_FLAG_KEYS,
  isReasoningQualityDashboardEnabled,
} from './v10/reasoningQualityDashboardFlag';
import {
  RESEARCH_WATCH_DELTA_REPORT_FLAG_KEYS,
  isResearchWatchDeltaReportEnabled,
} from './v10/researchWatchDeltaReportFlag';
import {
  RESEARCH_CROSS_MISSION_MEMORY_FLAG_KEYS,
  isResearchCrossMissionMemoryEnabled,
} from './v10/researchCrossMissionMemoryFlag';
import {
  RESEARCH_COMPARATIVE_MISSION_MODE_FLAG_KEYS,
  isResearchComparativeMissionModeEnabled,
} from './v10/researchComparativeMissionModeFlag';
import {
  RESEARCH_QUALITY_DASHBOARD_FLAG_KEYS,
  isResearchQualityDashboardEnabled,
} from './v10/researchQualityDashboardFlag';
import {
  CONNECTORS_HEALTH_DASHBOARD_FLAG_KEYS,
  isConnectorsHealthDashboardEnabled,
} from './v10/connectorsHealthDashboardFlag';
import {
  CONNECTORS_GOOGLE_DRIVE_FLAG_KEYS,
  isConnectorsGoogleDriveEnabled,
} from './v10/connectorsGoogleDriveFlag';
import {
  CONNECTORS_SLACK_FLAG_KEYS,
  isConnectorsSlackEnabled,
} from './v10/connectorsSlackFlag';
import {
  CONNECTORS_NOTION_CONNECTOR_FLAG_KEYS,
  isConnectorsNotionConnectorEnabled,
} from './v10/connectorsNotionConnectorFlag';
import {
  CONNECTORS_EMAIL_CONNECTOR_FLAG_KEYS,
  isConnectorsEmailConnectorEnabled,
} from './v10/connectorsEmailConnectorFlag';
import {
  CONNECTORS_CALENDAR_CONNECTOR_FLAG_KEYS,
  isConnectorsCalendarConnectorEnabled,
} from './v10/connectorsCalendarConnectorFlag';
import {
  CONNECTORS_CONNECTOR_GOVERNANCE_UI_FLAG_KEYS,
  isConnectorsConnectorGovernanceUiEnabled,
} from './v10/connectorsConnectorGovernanceUiFlag';
import {
  OUTCOME_PER_WORKLOAD_BREAKDOWN_FLAG_KEYS,
  isOutcomePerWorkloadBreakdownEnabled,
} from './v10/outcomePerWorkloadBreakdownFlag';
import {
  OUTCOME_CFO_NARRATIVE_EXPORT_FLAG_KEYS,
  isOutcomeCfoNarrativeExportEnabled,
} from './v10/outcomeCfoNarrativeExportFlag';
import {
  OUTCOME_AUDIT_LOG_FLAG_KEYS,
  isOutcomeAuditLogEnabled,
} from './v10/outcomeAuditLogFlag';
import {
  OUTCOME_TELEMETRY_FLAG_KEYS,
  isOutcomeTelemetryEnabled,
} from './v10/outcomeTelemetryFlag';
import {
  CONNECTORS_USER_DISCONNECT_FLAG_KEYS,
  isConnectorsUserDisconnectEnabled,
} from './v10/connectorsUserDisconnectFlag';
import {
  CONNECTORS_TELEMETRY_FULL_FLAG_KEYS,
  isConnectorsTelemetryFullEnabled,
} from './v10/connectorsTelemetryFullFlag';
import {
  CONNECTORS_WRITE_FRAMEWORK_FLAG_KEYS,
  isConnectorsWriteFrameworkEnabled,
} from './v10/connectorsWriteFrameworkFlag';
import {
  OUTCOME_NEVER_INVENT_METRIC_FLAG_KEYS,
  isOutcomeNeverInventMetricEnabled,
} from './v10/outcomeNeverInventMetricFlag';
import {
  OUTCOME_ADMIN_OVERRIDES_FLAG_KEYS,
  isOutcomeAdminOverridesEnabled,
} from './v10/outcomeAdminOverridesFlag';
import {
  OUTCOME_REVENUE_MARGIN_ATTRIBUTION_FLAG_KEYS,
  isOutcomeRevenueMarginAttributionEnabled,
} from './v10/outcomeRevenueMarginAttributionFlag';
import {
  OUTCOME_RISK_AVOIDED_OUTCOME_FLAG_KEYS,
  isOutcomeRiskAvoidedOutcomeEnabled,
} from './v10/outcomeRiskAvoidedOutcomeFlag';
import {
  OUTCOME_COHORT_BENCHMARK_FLAG_KEYS,
  isOutcomeCohortBenchmarkEnabled,
} from './v10/outcomeCohortBenchmarkFlag';
import {
  OUTCOME_OUTCOME_QUALITY_DASHBOARD_FLAG_KEYS,
  isOutcomeOutcomeQualityDashboardEnabled,
} from './v10/outcomeOutcomeQualityDashboardFlag';
import {
  AGENT_RUNTIME_TIME_TRAVEL_REPLAY_FLAG_KEYS,
  isAgentRuntimeTimeTravelReplayEnabled,
} from './v10/agentRuntimeTimeTravelReplayFlag';
import {
  ARTIFACT_CRDT_REPLICATED_STATE_FLAG_KEYS,
  isArtifactCrdtReplicatedStateEnabled,
} from './v10/artifactCrdtReplicatedStateFlag';
import {
  ARTIFACT_PRESENCE_FLAG_KEYS,
  isArtifactPresenceEnabled,
} from './v10/artifactPresenceFlag';
import {
  ARTIFACT_CROSS_REPLICA_MERGE_FLAG_KEYS,
  isArtifactCrossReplicaMergeEnabled,
} from './v10/artifactCrossReplicaMergeFlag';
import {
  PIPELINES_REASONING_FAST_CHAT_PIPELINE_FLAG_KEYS,
  isPipelinesReasoningFastChatPipelineEnabled,
} from './v10/pipelinesReasoningFastChatPipelineFlag';
import {
  PIPELINES_REASONING_GROUNDED_CHAT_PIPELINE_FLAG_KEYS,
  isPipelinesReasoningGroundedChatPipelineEnabled,
} from './v10/pipelinesReasoningGroundedChatPipelineFlag';
import {
  PIPELINES_RESEARCH_MISSION_PIPELINE_FLAG_KEYS,
  isPipelinesResearchMissionPipelineEnabled,
} from './v10/pipelinesResearchMissionPipelineFlag';
import {
  PIPELINES_RESEARCH_WATCH_PIPELINE_FLAG_KEYS,
  isPipelinesResearchWatchPipelineEnabled,
} from './v10/pipelinesResearchWatchPipelineFlag';
import {
  PIPELINES_ARTIFACT_MUTATION_PIPELINE_FLAG_KEYS,
  isPipelinesArtifactMutationPipelineEnabled,
} from './v10/pipelinesArtifactMutationPipelineFlag';
import {
  PIPELINES_ARTIFACT_EXPORT_PIPELINE_FLAG_KEYS,
  isPipelinesArtifactExportPipelineEnabled,
} from './v10/pipelinesArtifactExportPipelineFlag';
import {
  PIPELINES_AGENT_EXECUTION_PIPELINE_FLAG_KEYS,
  isPipelinesAgentExecutionPipelineEnabled,
} from './v10/pipelinesAgentExecutionPipelineFlag';
import {
  PIPELINES_AGENT_SCHEDULE_PIPELINE_FLAG_KEYS,
  isPipelinesAgentSchedulePipelineEnabled,
} from './v10/pipelinesAgentSchedulePipelineFlag';
import {
  PIPELINES_OUTCOME_ROLLUP_PIPELINE_FLAG_KEYS,
  isPipelinesOutcomeRollupPipelineEnabled,
} from './v10/pipelinesOutcomeRollupPipelineFlag';
import {
  PIPELINES_LEARNING_FEEDBACK_PIPELINE_FLAG_KEYS,
  isPipelinesLearningFeedbackPipelineEnabled,
} from './v10/pipelinesLearningFeedbackPipelineFlag';
import {
  PIPELINES_CONNECTORS_INGEST_PIPELINE_FLAG_KEYS,
  isPipelinesConnectorsIngestPipelineEnabled,
} from './v10/pipelinesConnectorsIngestPipelineFlag';
import {
  PIPELINES_ONBOARDING_PERSONA_PIPELINE_FLAG_KEYS,
  isPipelinesOnboardingPersonaPipelineEnabled,
} from './v10/pipelinesOnboardingPersonaPipelineFlag';

// ---------------------------------------------------------------------------
// §1 — Canonical V10 block taxonomy (master plan §1.1).
// ---------------------------------------------------------------------------
// Extends (does NOT replace) the V9 block enum. Every R-* requirement in
// the 8 authoritative research docs resolves to exactly one value here.
// Adding / removing a block requires an ADR (master plan §10.1).
//
// Kept alphabetical-by-code to make diff review trivial; code order is
// what `ChatV10BlockCode` exposes for ticket numbering (master plan §2.2).

export type ChatV10Block =
  | 'reasoning'
  | 'learning'
  | 'agent_runtime'
  | 'research'
  | 'artifact'
  | 'connectors'
  | 'outcome'
  | 'onboarding';

/**
 * The exhaustive, iteration-stable list of V10 blocks. Tests use this
 * to assert completeness against the master plan and the research
 * documents.
 */
export const CHAT_V10_BLOCKS: readonly ChatV10Block[] = [
  'reasoning',
  'learning',
  'agent_runtime',
  'research',
  'artifact',
  'connectors',
  'outcome',
  'onboarding',
] as const;

/**
 * Three-letter block codes used in the ticket ID scheme
 * `V10-<CODE>-<nnn>` (master plan §2.2). A `ChatV10Block` value ↔ three-
 * letter code mapping is bijective and fixed.
 */
export const CHAT_V10_BLOCK_CODE = {
  reasoning: 'RSN',
  learning: 'LRN',
  agent_runtime: 'AGT',
  research: 'RSR',
  artifact: 'ART',
  connectors: 'CON',
  outcome: 'OUT',
  onboarding: 'ONB',
} as const satisfies Record<ChatV10Block, string>;

/**
 * Requirement-prefix mapping (master plan §1.2). Used by invariant 31
 * to resolve `R-<BLOCK>-<n>` strings back to their owning V10 block.
 */
export const CHAT_V10_REQUIREMENT_PREFIX = {
  reasoning: 'R-REASON-',
  learning: 'R-LEARN-',
  agent_runtime: 'R-AGENT-',
  research: 'R-RESEARCH-',
  artifact: 'R-ARTIFACT-',
  connectors: 'R-CONNECT-',
  outcome: 'R-OUTCOME-',
  onboarding: 'R-ONBOARD-',
} as const satisfies Record<ChatV10Block, string>;

// ---------------------------------------------------------------------------
// §2 — Descriptor type (extends V9 shape with two required V10 fields).
// ---------------------------------------------------------------------------

export type RequirementId = `R-${string}-${number}`;
export type TicketId = `V10-${string}-${number}`;

export interface ChatV10FlagDescriptor {
  /** Stable, kebab-case identifier used by this registry and the runbook. */
  readonly id: string;
  /** V10 ticket code, e.g. `V10-RSN-007`. Unique across the registry. */
  readonly ticketId: TicketId;
  /** Deep-research requirement this flag implements, e.g. `R-REASON-7`. */
  readonly requirementId: RequirementId;
  /** V10 block classification (one of eight — master plan §1.1). */
  readonly block: ChatV10Block;
  /** Short human title. */
  readonly title: string;
  /** One-liner describing user-visible behaviour when the flag is on. */
  readonly description: string;
  /**
   * Hardcoded default used when no URL / localStorage / env override is
   * present. Defaults to `false` in V10 unless the flag is flagged
   * `on-by-construction` by its dev plan (master plan §4.3, exceptions
   * enumerated in per-block dev plans under "Flags to register at
   * implementation time").
   */
  readonly default: boolean;
  /** The three-key shape the resolver uses. */
  readonly keys: FlagKeys;
  /** Bound resolver. SSR-safe — returns the `default` when `window` is absent. */
  readonly isEnabled: () => boolean;
  /**
   * Telemetry events emitted by the feature, resolvable against the
   * `FunnelEventName` union extended in `CHAT_V10_TELEMETRY_CONTRACT`.
   * Empty array = not yet instrumented.
   */
  readonly telemetry: readonly string[];
  /** Primary `data-testid` used by QA. `null` = not yet instrumented. */
  readonly testId: string | null;
  /**
   * Spec docs (master plan + per-block dev plan) the owner should read
   * before rolling forward / back. Paths are relative to repo root and
   * MUST resolve to files on disk (enforced by invariant 5 shared with
   * V9 and by invariant 47 added for V10).
   */
  readonly specDocs: readonly string[];
}

// ---------------------------------------------------------------------------
// §3 — Registry.
// ---------------------------------------------------------------------------
// Wave A seed (2026-04-18) registers the three first V10 flags. All three
// are schema-only at landing time:
//   - the type / schema lives under `src/models/<block>/`,
//   - the per-flag helper lives under `src/utils/v10/`,
//   - `telemetry: []` until the corresponding UI / runtime ticket lands
//     and declares its events (per ADR-V10-003 the V9 telemetry contract
//     does not get renamed until the first non-empty `telemetry` array).
//
// Adding a new entry requires a PR that also:
//   - extends the FunnelEventName union if the flag declares telemetry,
//   - adds the event headings to CHAT_V10_TELEMETRY_CONTRACT,
//   - ensures the dev plan for this block references the new ticket id,
//   - keeps `on-by-construction` invariants in sync with the dev plan.
//
// See `CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md §4.2` for the required-
// fields contract and §6.1 for the full invariant list.

export const CHAT_V10_FLAGS: readonly ChatV10FlagDescriptor[] = [
  {
    id: 'artifact-unified-model',
    ticketId: 'V10-ART-001',
    requirementId: 'R-ARTIFACT-1',
    block: 'artifact',
    title: 'Unified Artifact model',
    description:
      'Adopt the V10 unified `Artifact` interface as the single shape every editable object resolves to. ' +
      'When OFF, modules continue to use their legacy per-module storage shapes.',
    default: false,
    keys: ARTIFACT_UNIFIED_MODEL_FLAG_KEYS,
    isEnabled: isArtifactUnifiedModelEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md',
      'docs/Chat V9/adr/ADR-V10-002-flag-registry-split.md',
    ],
  },
  {
    id: 'agent-execution-proposal-v1',
    ticketId: 'V10-AGT-001',
    requirementId: 'R-AGENT-1',
    block: 'agent_runtime',
    title: 'ExecutionProposalV1 envelope',
    description:
      'Adopt `ExecutionProposalV1` as the only envelope through which AI-originated actions reach downstream systems. ' +
      'When OFF, callers continue to invoke side-effects via legacy ad-hoc payloads.',
    default: false,
    keys: AGENT_EXECUTION_PROPOSAL_V1_FLAG_KEYS,
    isEnabled: isAgentExecutionProposalV1Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md',
      'docs/Chat V9/adr/ADR-V10-002-flag-registry-split.md',
    ],
  },
  {
    id: 'onboard-persona-capture',
    ticketId: 'V10-ONB-001',
    requirementId: 'R-ONBOARD-1',
    block: 'onboarding',
    title: 'Persona capture',
    description:
      'Materialise a persona record on the user row at first authenticated session. ' +
      'When OFF, tenants fall back to V9 generic onboarding (no persona resolved).',
    default: false,
    keys: ONBOARD_PERSONA_CAPTURE_FLAG_KEYS,
    isEnabled: isOnboardPersonaCaptureEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md',
      'docs/Chat V9/adr/ADR-V10-002-flag-registry-split.md',
    ],
  },
  {
    id: 'artifact-type-registry',
    ticketId: 'V10-ART-002',
    requirementId: 'R-ARTIFACT-2',
    block: 'artifact',
    title: 'ArtifactType registry',
    description:
      'Adopt `ARTIFACT_TYPE_REGISTRY` as the lookup for artifact-type metadata ' +
      '(renderer, supported ops, default classification, export formats).',
    default: false,
    keys: ARTIFACT_TYPE_REGISTRY_FLAG_KEYS,
    isEnabled: isArtifactTypeRegistryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md',
    ],
  },
  {
    id: 'agent-severity-policies',
    ticketId: 'V10-AGT-002',
    requirementId: 'R-AGENT-2',
    block: 'agent_runtime',
    title: 'Severity S0..S4 policy table',
    description:
      'Adopt `SEVERITY_POLICIES` as the lookup for per-severity defaults ' +
      '(approval mode, undo window, audit retention, UI affordance, signature).',
    default: false,
    keys: AGENT_SEVERITY_POLICIES_FLAG_KEYS,
    isEnabled: isAgentSeverityPoliciesEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-persona-inference-override',
    ticketId: 'V10-ONB-002',
    requirementId: 'R-ONBOARD-2',
    block: 'onboarding',
    title: 'Persona inference override',
    description:
      'Renders the "Not me — switch" affordance in the persona picker and re-fires ' +
      '`onboard.persona_confirmed` with previous_persona + override_reason.',
    default: false,
    keys: ONBOARD_PERSONA_INFERENCE_OVERRIDE_FLAG_KEYS,
    isEnabled: isOnboardPersonaInferenceOverrideEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-review-fsm',
    ticketId: 'V10-ART-003',
    requirementId: 'R-ARTIFACT-3',
    block: 'artifact',
    title: 'ReviewState FSM',
    description:
      'Adopt the closed review-lifecycle FSM (draft → ready_for_review → approved → ' +
      'published → archived, with rejected loop) as the single transition resolver.',
    default: false,
    keys: ARTIFACT_REVIEW_FSM_FLAG_KEYS,
    isEnabled: isArtifactReviewFsmEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-op-type-registry',
    ticketId: 'V10-AGT-003',
    requirementId: 'R-AGENT-3',
    block: 'agent_runtime',
    title: 'OpType registry',
    description:
      'Adopt `OP_TYPE_REGISTRY` as the lookup for op metadata (severity floor, ' +
      'reversibility, tenant scope, canonical handler path). Handler dispatch reads this table.',
    default: false,
    keys: AGENT_OP_TYPE_REGISTRY_FLAG_KEYS,
    isEnabled: isAgentOpTypeRegistryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-route-resolver',
    ticketId: 'V10-ONB-003',
    requirementId: 'R-ONBOARD-3',
    block: 'onboarding',
    title: 'admin-first vs user-first route resolver',
    description:
      'Routes the first authenticated session through `resolveOnboardingRoute`; the ' +
      'wizard reads `ONBOARDING_ROUTE_STEPS` to drive step order.',
    default: false,
    keys: ONBOARD_ROUTE_RESOLVER_FLAG_KEYS,
    isEnabled: isOnboardRouteResolverEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-data-classification',
    ticketId: 'V10-ART-004',
    requirementId: 'R-ARTIFACT-4',
    block: 'artifact',
    title: 'DataClassification catalogue + export gate',
    description:
      'Adopt `DATA_CLASSIFICATION_POLICIES` + `canExportToFormat` as the single ' +
      'export / egress / masking resolver for artifacts.',
    default: false,
    keys: ARTIFACT_DATA_CLASSIFICATION_FLAG_KEYS,
    isEnabled: isArtifactDataClassificationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-approval-mode',
    ticketId: 'V10-AGT-004',
    requirementId: 'R-AGENT-4',
    block: 'agent_runtime',
    title: 'ApprovalMode + upward-override rule',
    description:
      'Adopt `resolveEffectiveApprovalMode` (strictest-wins across severity / tenant / ' +
      'artifact). Tenant policy may only upgrade severity defaults, never downgrade.',
    default: false,
    keys: AGENT_APPROVAL_MODE_FLAG_KEYS,
    isEnabled: isAgentApprovalModeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-persona-journey',
    ticketId: 'V10-ONB-004',
    requirementId: 'R-ONBOARD-4',
    block: 'onboarding',
    title: 'Per-persona first-run journey',
    description:
      'Adopt `PERSONA_JOURNEYS` as the single source for first-run stage ordering, ' +
      'activation goals, and primary artifact type per persona.',
    default: false,
    keys: ONBOARD_PERSONA_JOURNEY_FLAG_KEYS,
    isEnabled: isOnboardPersonaJourneyEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-lineage-graph',
    ticketId: 'V10-ART-005',
    requirementId: 'R-ARTIFACT-5',
    block: 'artifact',
    title: 'Artifact lineage graph',
    description:
      'Adopt `buildLineageGraph` + `assertLineageInvariant` at the ArtifactStore boundary. ' +
      'Every write runs the DAG invariant bundle before committing.',
    default: false,
    keys: ARTIFACT_LINEAGE_GRAPH_FLAG_KEYS,
    isEnabled: isArtifactLineageGraphEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-optimistic-concurrency',
    ticketId: 'V10-AGT-005',
    requirementId: 'R-AGENT-5',
    block: 'agent_runtime',
    title: 'Optimistic concurrency (expectedVersions)',
    description:
      'Adopt `throwIfStale` / `verifyExpectedVersions` at the proposal-apply boundary. ' +
      'Any version drift raises `StaleProposalError` and shows a refreshed preview.',
    default: false,
    keys: AGENT_OPTIMISTIC_CONCURRENCY_FLAG_KEYS,
    isEnabled: isAgentOptimisticConcurrencyEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-trust-first-banner',
    ticketId: 'V10-ONB-005',
    requirementId: 'R-ONBOARD-5',
    block: 'onboarding',
    title: 'Trust-first disclosure banner (on-by-construction)',
    description:
      'Renders the trust-first disclosure before any prompt input or connector CTA ' +
      'for the first 5 minutes of a first session. Ships default-ON per master plan §4.3 ' +
      'and ADR-V10-002; explicitly disabling is an incident-response kill-switch only.',
    default: true,
    keys: ONBOARD_TRUST_FIRST_BANNER_FLAG_KEYS,
    isEnabled: isOnboardTrustFirstBannerEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/adr/ADR-V10-002-flag-registry-split.md',
    ],
  },
  {
    id: 'artifact-canonical-content',
    ticketId: 'V10-ART-006',
    requirementId: 'R-ARTIFACT-6',
    block: 'artifact',
    title: 'Per-type canonical content schema',
    description:
      'Adopt `ArtifactCanonicalContent` discriminated union + `assertNodeIdsUnique` + ' +
      '`assertContentMatchesType` at the ArtifactStore boundary. Writes rejected unless ' +
      'content is the typed union (not the V10-ART-001 opaque blob).',
    default: false,
    keys: ARTIFACT_CANONICAL_CONTENT_FLAG_KEYS,
    isEnabled: isArtifactCanonicalContentEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-navigation-intent',
    ticketId: 'V10-AGT-006',
    requirementId: 'R-AGENT-6',
    block: 'agent_runtime',
    title: 'NavigationIntent post-approval routing',
    description:
      'Adopt `NavigationIntent` union + `assertNavigationIntent` at the proposal-apply ' +
      'boundary. Best-effort router handoff; not-honoured outcomes telemetered with reason.',
    default: false,
    keys: AGENT_NAVIGATION_INTENT_FLAG_KEYS,
    isEnabled: isAgentNavigationIntentEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-five-minute-sla',
    ticketId: 'V10-ONB-006',
    requirementId: 'R-ONBOARD-6',
    block: 'onboarding',
    title: '5-minute activation SLA',
    description:
      'Adopt `computeActivationVerdict` in the onboarding telemetry pipeline. Emits ' +
      '`onboard.activation_reached` when all 4 gates fire; marks sessions `abandoned/sla_exceeded` ' +
      'at 600s. Server-side timestamps only (clock-skew invariant).',
    default: false,
    keys: ONBOARD_FIVE_MINUTE_SLA_FLAG_KEYS,
    isEnabled: isOnboardFiveMinuteSlaEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-mutation-proposal',
    ticketId: 'V10-ART-007',
    requirementId: 'R-ARTIFACT-7',
    block: 'artifact',
    title: 'MutationProposal envelope',
    description:
      'Adopt `assertMutationProposal` at the ArtifactStore write boundary. Every AI-sourced ' +
      'write MUST arrive as a typed MutationProposal integrating ArtifactCanonicalContent + ' +
      'ApprovalMode + EvidenceRef; invariant violations are rejected before commit.',
    default: false,
    keys: ARTIFACT_MUTATION_PROPOSAL_FLAG_KEYS,
    isEnabled: isArtifactMutationProposalEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-budget-v1',
    ticketId: 'V10-AGT-007',
    requirementId: 'R-AGENT-7',
    block: 'agent_runtime',
    title: 'BudgetBudgetV1 (wall / cost / tool / token caps)',
    description:
      'Adopt `throwIfExceeded` + `verifyBudget` in the Run Ledger and QueueExecutor. ' +
      'Every proposal declares a four-cap budget; the executor halts on the first breach ' +
      'and emits `agent.budget_exceeded` with the per-cap breakdown.',
    default: false,
    keys: AGENT_BUDGET_V1_FLAG_KEYS,
    isEnabled: isAgentBudgetV1Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-buyer-data-only',
    ticketId: 'V10-ONB-007',
    requirementId: 'R-ONBOARD-7',
    block: 'onboarding',
    title: 'Buyer-data-only first draft',
    description:
      'Adopt `assertBuyerDataOnly` at the first-draft generator ingress. Empty / non-tenant ' +
      'source sets raise planned errors (`NoSourcesError` / `BuyerDataViolationError`) and ' +
      'the UI renders the honest "no sources yet" empty state with upload/connect CTAs.',
    default: false,
    keys: ONBOARD_BUYER_DATA_ONLY_FLAG_KEYS,
    isEnabled: isOnboardBuyerDataOnlyEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-typed-ops',
    ticketId: 'V10-ART-008',
    requirementId: 'R-ARTIFACT-8',
    block: 'artifact',
    title: 'Typed ArtifactOp list',
    description:
      'Adopt the closed `ArtifactOp` discriminated union (json_patch / replace_text / ' +
      'move_block / update_cell_formula / update_chart_binding) with `assertArtifactOp` + ' +
      '`reverseArtifactOp` at the MutationProposal ingress. When OFF, the legacy opaque-kind ' +
      'placeholder is accepted.',
    default: false,
    keys: ARTIFACT_TYPED_OPS_FLAG_KEYS,
    isEnabled: isArtifactTypedOpsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-diff-preview-v1',
    ticketId: 'V10-AGT-008',
    requirementId: 'R-AGENT-8',
    block: 'agent_runtime',
    title: 'DiffPreviewV1 renderer contract',
    description:
      'Adopt `DiffPreview` + `diffBlockForOp` + `assertDiffPreview` for the approval UI. ' +
      'Every op produces a typed block; S3/S4 proposals require a computed `BlastRadius` ' +
      '(no heuristics). When OFF, the legacy text-diff fallback is shown.',
    default: false,
    keys: AGENT_DIFF_PREVIEW_V1_FLAG_KEYS,
    isEnabled: isAgentDiffPreviewV1Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-connector-ranking',
    ticketId: 'V10-ONB-008',
    requirementId: 'R-ONBOARD-8',
    block: 'onboarding',
    title: 'Persona/tenant connector ranking',
    description:
      'Adopt `rankConnectors(persona, tenant)` at every first-run connector-offer render. ' +
      'Primary CTA differs by persona, respects tenant-authorised systems, and CISO primary ' +
      'is null until admin review completes. When OFF, the legacy static connector order is used.',
    default: false,
    keys: ONBOARD_CONNECTOR_RANKING_FLAG_KEYS,
    isEnabled: isOnboardConnectorRankingEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-citation-v1',
    ticketId: 'V10-ART-009',
    requirementId: 'R-ARTIFACT-9',
    block: 'artifact',
    title: 'Typed CitationV1 + factual-op invariant',
    description:
      'Adopt `CitationV1` + `assertFactualOpsHaveCitations` at the MutationProposal ingress. ' +
      'AI/system-originated proposals with factual ops (replace_text, content-bearing json_patch) ' +
      'must declare per-op or proposal-level citations linking to an EvidenceRef. ' +
      'When OFF, the legacy Citation placeholder is accepted.',
    default: false,
    keys: ARTIFACT_CITATION_V1_FLAG_KEYS,
    isEnabled: isArtifactCitationV1Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-severity-s0',
    ticketId: 'V10-AGT-009',
    requirementId: 'R-AGENT-9',
    block: 'agent_runtime',
    title: 'S0 severity lane (read-only, implicit approval)',
    description:
      'Adopt `assertS0OpTypes` at the proposal ingress: S0 proposals are restricted to ' +
      'op types whose severity floor is S0 (navigate, render_message), run with implicit ' +
      'approval, have no undo window, and audit at 7-day retention. When OFF, S0 proposals ' +
      'fall through to the general approval path.',
    default: false,
    keys: AGENT_SEVERITY_S0_FLAG_KEYS,
    isEnabled: isAgentSeverityS0Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-connector-validation',
    ticketId: 'V10-ONB-009',
    requirementId: 'R-ONBOARD-9',
    block: 'onboarding',
    title: 'Connector validation 3-step FSM (probe → sample → promote)',
    description:
      'Adopt `reduceConnectorValidation` as the only path a newly-authorised connector may ' +
      'take before it backs the first draft. Failures carry closed reason codes and the ' +
      'onboarding UI surfaces the current step. When OFF, the legacy "authorise-and-trust" ' +
      'shortcut is used.',
    default: false,
    keys: ONBOARD_CONNECTOR_VALIDATION_FLAG_KEYS,
    isEnabled: isOnboardConnectorValidationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-no-silent-writes',
    ticketId: 'V10-ART-010',
    requirementId: 'R-ARTIFACT-10',
    block: 'artifact',
    title: 'No-silent-writes runtime invariant (on-by-construction)',
    description:
      'Adopt `assertCanWriteArtifact` as the first statement of `ArtifactStore.writeVersion`. ' +
      'Direct callers without the canonical `mutation_applier` token trip ' +
      '`SilentWriteForbiddenError`. The companion ESLint rule ' +
      '`consultify-artifact/no-direct-write` forbids source-code references to the signed ' +
      'write method outside `src/services/artifact/mutationApplier.ts`. Ships default-ON per ' +
      'master plan §4.3 and ADR-V10-002; explicitly disabling is an incident-response kill ' +
      'switch only.',
    default: true,
    keys: ARTIFACT_NO_SILENT_WRITES_FLAG_KEYS,
    isEnabled: isArtifactNoSilentWritesEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/adr/ADR-V10-002-flag-registry-split.md',
    ],
  },
  {
    id: 'agent-severity-s1',
    ticketId: 'V10-AGT-010',
    requirementId: 'R-AGENT-10',
    block: 'agent_runtime',
    title: 'S1 severity lane (reversible suggestion, inline approval)',
    description:
      'Adopt `assertS1OpTypes` + `assertS1SessionScope` at the proposal ingress: S1 ' +
      'proposals may only carry ops whose severity floor is ≤ S1 AND whose tenant scope is ' +
      '`session_local` or `read_only`. Approval is a one-click inline button; mutations ' +
      'expire at session end; audit lives 30 days. When OFF, S1 proposals fall through to ' +
      'the general approval path.',
    default: false,
    keys: AGENT_SEVERITY_S1_FLAG_KEYS,
    isEnabled: isAgentSeverityS1Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-no-ghost-caps',
    ticketId: 'V10-ONB-010',
    requirementId: 'R-ONBOARD-10',
    block: 'onboarding',
    title: 'No-ghost-capabilities rule (on-by-construction)',
    description:
      'Adopt `decideCapabilityRender` + `assertNoGhostCapabilities` in every onboarding CTA ' +
      'renderer. Unavailable capabilities are hidden (absent from DOM), not greyed-out or ' +
      'disabled-with-tooltip. Ships default-ON per master plan §4.3 and ADR-V10-002; ' +
      'explicitly disabling is an incident-response override only.',
    default: true,
    keys: ONBOARD_NO_GHOST_CAPS_FLAG_KEYS,
    isEnabled: isOnboardNoGhostCapsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
      'docs/Chat V9/adr/ADR-V10-002-flag-registry-split.md',
    ],
  },
  {
    id: 'artifact-approve-edit-reject',
    ticketId: 'V10-ART-011',
    requirementId: 'R-ARTIFACT-11',
    block: 'artifact',
    title: 'Approve / edit / reject — three-outcome proposal decision',
    description:
      'Adopt `assertProposalDecision` at the decision surface. A MutationProposal has ' +
      'exactly three terminal outcomes — approve (apply verbatim), edit (synthesize a new ' +
      'proposal and reject the original with `superseded_by_edit`), reject (record reason, ' +
      'apply nothing). No "skip review" branch exists. When OFF, the legacy decision payload ' +
      'is accepted.',
    default: false,
    keys: ARTIFACT_APPROVE_EDIT_REJECT_FLAG_KEYS,
    isEnabled: isArtifactApproveEditRejectEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-severity-s2',
    ticketId: 'V10-AGT-011',
    requirementId: 'R-AGENT-11',
    block: 'agent_runtime',
    title: 'S2 severity lane (reversible write, explicit form approval, 24h undo)',
    description:
      'Adopt `assertS2OpTypes` + `assertS2ApprovalRationale` at the proposal ingress: S2 ' +
      'proposals may only carry ops whose severity floor is ≤ S2, approval requires an ' +
      'explicit form with a non-empty rationale, undo window is 24h via Run Ledger ' +
      'checkpoint, audit retention is 365 days. When OFF, S2 proposals fall through to the ' +
      'general approval path.',
    default: false,
    keys: AGENT_SEVERITY_S2_FLAG_KEYS,
    isEnabled: isAgentSeverityS2Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-first-mutation-envelope',
    ticketId: 'V10-ONB-011',
    requirementId: 'R-ONBOARD-11',
    block: 'onboarding',
    title: 'First mutation wrapped in proposal envelope (initial_draft)',
    description:
      'Adopt `assertFirstMutationEnvelope` at the onboarding activation ingress. The first ' +
      'AI-generated artifact is wrapped in a MutationProposal with intent=create_artifact, ' +
      'null baseVersionId, non-empty sourceSet, typed preview, and explicit approval required. ' +
      'Approve / edit / reject are the only three user actions (pair with V10-ART-011). ' +
      'When OFF, the legacy direct-render path is used.',
    default: false,
    keys: ONBOARD_FIRST_MUTATION_ENVELOPE_FLAG_KEYS,
    isEnabled: isOnboardFirstMutationEnvelopeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-partial-acceptance',
    ticketId: 'V10-ART-012',
    requirementId: 'R-ARTIFACT-12',
    block: 'artifact',
    title: 'Partial acceptance of a MutationProposal',
    description:
      'Adopt `normalisePartialAcceptance` + `assertPartialAcceptance` + `deriveRejectedOps` ' +
      'at the applier ingress. The reviewer may accept any subset of ops on a proposal; the ' +
      'applier applies only the selected indices and writes a typed rejected-ops log ' +
      '(catalogue of 6 reason codes, default `user_deselected`) for the learning signal. ' +
      'When OFF, the legacy all-or-nothing acceptance path is used.',
    default: false,
    keys: ARTIFACT_PARTIAL_ACCEPTANCE_FLAG_KEYS,
    isEnabled: isArtifactPartialAcceptanceEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-severity-s3',
    ticketId: 'V10-AGT-012',
    requirementId: 'R-AGENT-12',
    block: 'agent_runtime',
    title: 'S3 severity lane (blast-radius, multi-reviewer gate, 7d compensating undo)',
    description:
      'Adopt `assertS3OpTypes` + `assertMultiReviewerApproval` + ' +
      '`assertCompensatingSequenceDeclared` at the proposal ingress and apply boundary. S3 ' +
      'proposals may carry ops whose severity floor is ≤ S3; approval requires at least 2 ' +
      'distinct reviewer actor-ids (tenant may raise, never lower); every approval declares a ' +
      'non-empty compensating sequence id so the saga executor (V10-AGT-018) can roll back. ' +
      'Undo window 7d via compensating ops; audit retention 730d. Default OFF.',
    default: false,
    keys: AGENT_SEVERITY_S3_FLAG_KEYS,
    isEnabled: isAgentSeverityS3Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-provenance-panel',
    ticketId: 'V10-ONB-012',
    requirementId: 'R-ONBOARD-12',
    block: 'onboarding',
    title: 'Provenance panel on the first-artifact approval surface',
    description:
      'Adopt `collectProvenance` + `assertProvenancePanelCoherence` + ' +
      '`assertProvenanceAvailableBeforeApproval` on the first-artifact approval surface. ' +
      'The panel lists every source used by the generator (exact set, not super/subset) with ' +
      'title, system, last-modified, snippet, and a freshness badge derived from the ' +
      'fresh/recent/stale/very_stale thresholds; the control is rendered in DOM before the ' +
      'approval button becomes active. When OFF, the legacy "no provenance surfacing" path is used.',
    default: false,
    keys: ONBOARD_PROVENANCE_PANEL_FLAG_KEYS,
    isEnabled: isOnboardProvenancePanelEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-one-step-undo',
    ticketId: 'V10-ART-013',
    requirementId: 'R-ARTIFACT-13',
    block: 'artifact',
    title: 'One-step undo (ReversibleTxn envelope + LIFO stack)',
    description:
      'Adopt `buildReversibleTxn` + `isUndoEligible` + `pushUndoStack` / `popUndoStack` at ' +
      'the applier boundary. Every approved proposal becomes exactly one ReversibleTxn with ' +
      'pre-computed reverse ops (via `reverseArtifactOps`), an effective undo retention cutoff ' +
      '(default 24h per SeverityPolicies S2), and a server-side applied timestamp. Undo ' +
      'produces a new version (history is never rewritten); LIFO semantics; 7 closed rejection ' +
      'reasons at the builder / guard. Default OFF.',
    default: false,
    keys: ARTIFACT_ONE_STEP_UNDO_FLAG_KEYS,
    isEnabled: isArtifactOneStepUndoEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-severity-s4',
    ticketId: 'V10-AGT-013',
    requirementId: 'R-AGENT-13',
    block: 'agent_runtime',
    title: 'S4 severity lane (irreversible / external — admin approval + ECDSA signature)',
    description:
      'Adopt `assertS4AdminApproval` + `assertS4SignatureShape` + ' +
      '`assertS4AuditNonDeletable` at the proposal ingress and audit-writer ingress. S4 ' +
      'mutations require an admin role (`admin` / `workspace_admin` / `tenant_admin`), an ' +
      'ECDSA signature envelope (P-256 / P-384) over the canonical audit payload, and an ' +
      'audit log entry that is non-tombstoneable with retention ≥ 7y (2555d). No undo. ' +
      'Default OFF.',
    default: false,
    keys: AGENT_SEVERITY_S4_FLAG_KEYS,
    isEnabled: isAgentSeverityS4Enabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-approval-audit',
    ticketId: 'V10-ONB-013',
    requirementId: 'R-ONBOARD-13',
    block: 'onboarding',
    title: 'First-artifact approval gate + immutable audit event',
    description:
      'Adopt `assertOnboardApprovalAuditEvent` + `shouldCountActivation` + ' +
      '`assertAuditLogAppendOnly` on the first-artifact approval surface. Approve / Edit / ' +
      'Reject each write an immutable `onboard.artifact_(approved|edited|rejected)` event ' +
      'carrying artifact id / version, mutation proposal id, reviewer id + role, ' +
      'server-side approved_at, and trust-bundle hash; activation counts only when ' +
      'action=approve AND artifact is saved; audit log write ops outside `append` throw. ' +
      'Default OFF.',
    default: false,
    keys: ONBOARD_APPROVAL_AUDIT_FLAG_KEYS,
    isEnabled: isOnboardApprovalAuditEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-selection-aware',
    ticketId: 'V10-ART-014',
    requirementId: 'R-ARTIFACT-14',
    block: 'artifact',
    title: 'Selection-aware mutations (scope resolver + demonstrative catalogue)',
    description:
      'Adopt `SelectionContext` + `resolveOpScope` + `assertOpsWithinSelection` at the chat- ' +
      'command translation and applier-ingress boundaries. A demonstrative lexeme ' +
      '("this" / "these" / "ten" / "zaznaczone" / …) with an empty selection is rejected with ' +
      'a clarification seed; a demonstrative with a non-empty selection scopes ops to those ' +
      'node ids; an unambiguous command with no selection applies to the whole artifact. When ' +
      'OFF, the legacy whole-artifact mutation path is used.',
    default: false,
    keys: ARTIFACT_SELECTION_AWARE_FLAG_KEYS,
    isEnabled: isArtifactSelectionAwareEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-run-ledger',
    ticketId: 'V10-AGT-014',
    requirementId: 'R-AGENT-14',
    block: 'agent_runtime',
    title: 'Run Ledger core schema (on-by-construction)',
    description:
      'Adopt the typed Run Ledger schema (`RunRow` / `StepRow` / `CheckpointRow` / ' +
      '`ArtifactRow` / `TraceRow`) + the closed run/step FSM transition tables + the ' +
      '`assertTenantScoped` RLS mirror + the `LEDGER_QUERY_FIELDS` whitelist. The ledger is ' +
      'the durable record of every run; disabling it is an incident-response kill switch ' +
      'only. Ships default-ON per master plan §4.3 and the Agent dev plan.',
    default: true,
    keys: AGENT_RUN_LEDGER_FLAG_KEYS,
    isEnabled: isAgentRunLedgerEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-library-save',
    ticketId: 'V10-ONB-014',
    requirementId: 'R-ONBOARD-14',
    block: 'onboarding',
    title: 'First-artifact library save + template fingerprint (idempotent)',
    description:
      'Adopt `assertLibrarySaveRequest` + `computeLibrarySaveIdempotencyKey` + ' +
      '`computeTemplateFingerprint` + `registerLibrarySave` on first-artifact approval. ' +
      'Saves the approved artifact to the persona default library destination ' +
      '(`PersonaJourney.libraryDestination` ∈ {Drafts, Approved, Templates}); idempotent ' +
      'against the `(tenantId, artifactId, versionTag, libraryDestination)` tuple; ' +
      'template fingerprint is a canonical-JSON SHA-256 over `(artifactType, content)` so ' +
      'structural equivalents hash identically. Default OFF.',
    default: false,
    keys: ONBOARD_LIBRARY_SAVE_FLAG_KEYS,
    isEnabled: isOnboardLibrarySaveEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-cross-transform',
    ticketId: 'V10-ART-015',
    requirementId: 'R-ARTIFACT-15',
    block: 'artifact',
    title: 'Cross-artifact transformation with lineage preservation',
    description:
      'Adopt `buildDerivedArtifactHeader` + `registerTransformLineage` + ' +
      '`assertEvidenceSuperset` at the transform service boundary. Closed 10-entry ' +
      '`CROSS_ARTIFACT_RECIPES` catalogue (`memo ↔ slide_deck / spreadsheet / ' +
      'decision_doc`, etc.); every derived artifact carries `parentArtifactId` + ' +
      '`derivedFromVersionId` so the V10-ART-005 lineage DAG answers "what is this ' +
      'deck derived from?". Evidence is union-preserved (source superset). ' +
      'Default OFF.',
    default: false,
    keys: ARTIFACT_CROSS_TRANSFORM_FLAG_KEYS,
    isEnabled: isArtifactCrossTransformEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-queue-executor',
    ticketId: 'V10-AGT-015',
    requirementId: 'R-AGENT-15',
    block: 'agent_runtime',
    title: 'QueueExecutor with retry + exponential backoff + DLQ',
    description:
      'Adopt the durable QueueExecutor schema: closed 8-state `JobStatus` FSM + ' +
      '`[1s, 5s, 30s, 2m, 10m]` backoff ladder (`MAX_RETRY_ATTEMPTS = 5`) + ' +
      '`transient`/`permanent` `FailureKind` classifier + `DeadLetterRow` with full ' +
      'context. Postgres LISTEN/NOTIFY + polling fallback per ADR-V10-006 ' +
      '(Temporal deferred to Wave C). The executor service itself lands in Wave B; ' +
      'this flag gates the schema-level contracts. Default OFF.',
    default: false,
    keys: AGENT_QUEUE_EXECUTOR_FLAG_KEYS,
    isEnabled: isAgentQueueExecutorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-first-export-manifest',
    ticketId: 'V10-ONB-015',
    requirementId: 'R-ONBOARD-15',
    block: 'onboarding',
    title: 'First-export manifest + SHA-256 gate (on-by-construction)',
    description:
      'Adopt `ExportManifest` + `ExportPreviewGate` + `assertExportPreviewGateOpen` + ' +
      '`computeExportPayloadSha256` + `computeManifestSidecar` at the export ingress. ' +
      'Download is blocked until the manifest preview is opened once; the manifest ' +
      'captures artifact id + version, source lineage with hashes, reviewer + approval ' +
      'timestamp, watermark / signature status, destination, classification, and the ' +
      'payload SHA-256 computed after serialisation. The sidecar is canonical-JSON so ' +
      'downstream verifiers can re-hash. On-by-construction: the dev plan acceptance ' +
      'criterion is "100% of first exports require manifest preview"; disabling is ' +
      'incident-response only.',
    default: true,
    keys: ONBOARD_FIRST_EXPORT_MANIFEST_FLAG_KEYS,
    isEnabled: isOnboardFirstExportManifestEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-slide-deck-schema',
    ticketId: 'V10-ART-016',
    requirementId: 'R-ARTIFACT-16',
    block: 'artifact',
    title: 'slide_deck canonical schema (6 layouts × 4 block kinds) + move_block op',
    description:
      'Adopt `TypedSlideDeckContent` + closed `SLIDE_LAYOUT_KINDS` (6 entries) + typed ' +
      '`SLIDE_BLOCK_KINDS` (text/image/chart/table) + `SLIDE_DECK_SUPPORTED_OPS` ' +
      '(`json_patch`/`replace_text`/`move_block`) + pure `applyMoveBlock` that preserves ' +
      'block IDs + `serializeSlideDeck` / `deserializeSlideDeck` + ' +
      '`assertSlideDeckContent` + `assertSlideDeckRoundtrip`. Renderer lands in Wave B; ' +
      'this flag gates the schema + pure ops. Default OFF.',
    default: false,
    keys: ARTIFACT_SLIDE_DECK_SCHEMA_FLAG_KEYS,
    isEnabled: isArtifactSlideDeckSchemaEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-checkpoint-store',
    ticketId: 'V10-AGT-016',
    requirementId: 'R-AGENT-16',
    block: 'agent_runtime',
    title: 'CheckpointStore + resume-from-checkpoint + dedup',
    description:
      'Adopt `CheckpointPolicy` + `DEFAULT_CHECKPOINT_POLICY` (`every_step` with 60s ' +
      'floor) + `shouldCheckpoint` (cadence predicate) + `canonicalJsonStringify` + ' +
      '`computeStateBlobHash` (SHA-256) + `assertCheckpointRowShape` + ' +
      '`dedupeCheckpointRows` + `findLatestCheckpointForRun` + `resolveResumePoint` + ' +
      '`registerCheckpoint` (idempotent) + `buildCheckpointRow`. Resume-anchor is ' +
      'deterministic and dedup collapses same `(runId, stateBlobHash)` to one row. The ' +
      'WAL + resume driver land in Wave B (V10-AGT-022). Default OFF.',
    default: false,
    keys: AGENT_CHECKPOINT_STORE_FLAG_KEYS,
    isEnabled: isAgentCheckpointStoreEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-research-cost-cap-gate',
    ticketId: 'V10-ONB-016',
    requirementId: 'R-ONBOARD-16',
    block: 'onboarding',
    title: 'First-research cost cap + source policy gate (on-by-construction)',
    description:
      'Adopt `ResearchGateState` + `SOURCE_POLICIES` (closed 3-entry catalogue) + ' +
      '`CostCap` + `SourceSplitEstimate` + `ResearchConfirmationRequest` + ' +
      '`openResearchConfirmationGate` + `assertResearchRunGated` + ' +
      '`canStartResearchRun`. The gate blocks the first research run until the user ' +
      'explicitly confirms a cost cap, source policy, private/web split, citation ' +
      'toggle, and runtime band. Telemetry `onboard.research_confirmed` fires at ' +
      'confirm time (wired by the telemetry sink). On-by-construction: the dev plan ' +
      'acceptance criterion is "100% of first research runs require explicit cap + ' +
      'source-policy confirmation"; disabling is incident-response only.',
    default: true,
    keys: ONBOARD_RESEARCH_COST_CAP_GATE_FLAG_KEYS,
    isEnabled: isOnboardResearchCostCapGateEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-memo-rich-doc',
    ticketId: 'V10-ART-017',
    requirementId: 'R-ARTIFACT-17',
    block: 'artifact',
    title: 'Memo / rich-doc canonical schema + pagination (Wave A seed)',
    description:
      'Promote the V10-ART-006 `MemoContent` / `RichNoteContent` placeholders to ' +
      'a typed discriminated union: `DOC_BLOCK_KINDS` (7 entries: paragraph / ' +
      'heading / list / quote / code / image / table), `HEADING_LEVELS` (1–4), ' +
      '`MEMO_SUPPORTED_OPS` (json_patch / replace_text / move_block), ' +
      '`TypedMemoContent` / `TypedRichNoteContent`, `applyMoveBlock`, ' +
      '`paginateDoc(blocks, { pageSize=20 })` as a pure block-boundary ' +
      'paginator, `assertPaginationStability`, and canonical-JSON serde ' +
      '(`serializeDoc` / `deserializeDoc` / `assertDocRoundtrip`). Dev-plan ' +
      'acceptance ("memo with ≥20 blocks paginates predictably") is pinned at ' +
      'runtime via deterministic pagination + byte-stable canonical JSON.',
    default: false,
    keys: ARTIFACT_MEMO_RICH_DOC_FLAG_KEYS,
    isEnabled: isArtifactMemoRichDocEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-atomic-bundle',
    ticketId: 'V10-AGT-017',
    requirementId: 'R-AGENT-17',
    block: 'agent_runtime',
    title: 'Atomic bundle executor — all-or-nothing multi-op (Wave A seed)',
    description:
      'Adopt `AtomicBundle` + `simulateBundle` + `buildCompensation` + ' +
      '`assertAtomicBundleAllOrNothing` + `BUNDLE_ISOLATION_LEVELS` (closed ' +
      '1-entry catalogue pinned to `serializable_snapshot`). The Wave A seed ' +
      'ships the schema and the pure simulator: failure at op 3 of 5 yields a ' +
      '`rolled_back` outcome whose compensation is `reverseArtifactOps(ops[0..1])` ' +
      'in reverse apply order; any partial commit raises `partial_commit`. The ' +
      'Postgres-level executor lands in Wave B.',
    default: false,
    keys: AGENT_ATOMIC_BUNDLE_FLAG_KEYS,
    isEnabled: isAgentAtomicBundleEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-memory-layer-opt-in',
    ticketId: 'V10-ONB-017',
    requirementId: 'R-ONBOARD-17',
    block: 'onboarding',
    title: 'Learning opt-in per memory layer (on-by-construction)',
    description:
      'Adopt `MEMORY_LAYERS` (closed 4-entry catalogue: conversation / user / ' +
      'organisation / learned), `MEMORY_LAYER_POLICIES` (per-layer ' +
      '{isPersistent, defaultGranted, requiresAdminOptIn, retentionDays}), ' +
      '`ConsentRecord` + `MemoryConsentState` + `DEFAULT_MEMORY_CONSENT_STATE`, ' +
      '`grantConsent` / `revokeConsent` transitions, ' +
      '`assertPersistentLayersDefaultOff` (new-tenant invariant), ' +
      '`assertMemoryWriteAuthorised` (write-authorisation gate refusing writes ' +
      'without a prior `feedback.consent_granted` event in the same session), ' +
      'and `canWriteLayer`. On-by-construction: the dev-plan acceptance ' +
      'criterion is "Default persistent memory state is off for 100% of new ' +
      'tenants" — disabling would silently permit ghost writes.',
    default: true,
    keys: ONBOARD_MEMORY_LAYER_OPT_IN_FLAG_KEYS,
    isEnabled: isOnboardMemoryLayerOptInEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-spreadsheet-lineage',
    ticketId: 'V10-ART-018',
    requirementId: 'R-ARTIFACT-18',
    block: 'artifact',
    title: 'Spreadsheet schema + cell-level lineage + acyclic dependency graph (Wave A seed)',
    description:
      'Promote the V10-ART-006 `SpreadsheetContent` placeholder to a ' +
      'lineage-aware typed shape: closed 6-entry `CELL_VALUE_KINDS` + closed ' +
      '5-entry `CELL_ERROR_CODES` on a discriminated-union `TypedCellValue`; ' +
      '`CellLineage` (directSources / externalRefs / computedAt / computedBy) ' +
      'is mandatory per cell — write pipeline must populate it. Pure ' +
      '`buildDependencyGraph` + `assertDependencyGraphAcyclic` (iterative DFS ' +
      'with three-colour marking) pins dev-plan "formula dependency graph is ' +
      'acyclic"; `queryCellLineage` is the pure accessor pinning "cell lineage ' +
      'is queryable per cell" (throws `cell_not_found` rather than synthesising). ' +
      '`applyInsertRow` / `applyInsertColumn` are pure dimension transforms that ' +
      'shift chart bindings + named ranges + cell coordinates; ' +
      '`assertChartBindingsInBounds` is the post-condition invariant pinning ' +
      '"chart bindings survive row / column insertions correctly". 20 closed ' +
      'reason codes on `assertTypedSpreadsheetContent` cover wrong kind, ' +
      'non-positive schema / dimensions, out-of-range row / column, missing ' +
      'dependency target, cycle, out-of-bounds / inverted ranges, unknown value ' +
      'kind / error code, non-finite numeric, missing lineage, and insert-op ' +
      'bounds errors.',
    default: false,
    keys: ARTIFACT_SPREADSHEET_LINEAGE_FLAG_KEYS,
    isEnabled: isArtifactSpreadsheetLineageEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-saga-sequence',
    ticketId: 'V10-AGT-018',
    requirementId: 'R-AGENT-18',
    block: 'agent_runtime',
    title: 'Sequential compensating sequence (Saga) — cross-entity S3 mutations (Wave A seed)',
    description:
      'Adopt `SagaSequence` carrying `{ id, tenantId, proposalRef, ops }` where ' +
      'each `SagaOp` declares `{ forward, compensating }` — unlike the atomic ' +
      'bundle (V10-AGT-017) the compensation is a *domain-specific* op, not the ' +
      'algebraic inverse. `simulateSaga` is the pure executor: `committed` when ' +
      '`failAt` is unset, `compensated` with reverse-order declared ' +
      'compensations when a forward step fails, `compensation_failed` with a ' +
      'structured `SagaEscalation` (reason / failedCompensationIndex / attempts) ' +
      'when a compensation itself fails. `MAX_COMPENSATION_RETRIES = 3` caps ' +
      'retries — the runtime mirror of the dev-plan "compensation failure is ' +
      'escalated (does not retry indefinitely)". Closed 3-entry `SAGA_OUTCOMES` ' +
      '+ closed 3-entry `SAGA_ESCALATION_REASONS`. ' +
      '`assertSagaAllOrCompensated` checks partial-commit, compensation-missing, ' +
      'and compensation-order-wrong post-conditions.',
    default: false,
    keys: AGENT_SAGA_SEQUENCE_FLAG_KEYS,
    isEnabled: isAgentSagaSequenceEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-tenant-bootstrap',
    ticketId: 'V10-ONB-018',
    requirementId: 'R-ONBOARD-18',
    block: 'onboarding',
    title: 'First-run tenant bootstrap — 10-object × SLA × idempotent × GDPR-deletable (Wave A seed)',
    description:
      'Adopt `BOOTSTRAP_OBJECT_KINDS` (closed 10-entry catalogue: ' +
      'persona_workspace_shell / policy_manifest / artifact_library_folders / ' +
      'approval_route / trust_banner_ack / research_policy_default / ' +
      'connector_shortlist / org_memory_seed / template_pack / ' +
      'telemetry_session_record), closed 2-entry `BOOTSTRAP_OUTCOMES` ' +
      '(created / reused), `BOOTSTRAP_SLA_P99_MS = 10_000` pinned budget. ' +
      '`planTenantBootstrap(tenantId)` is the pure 10-entry plan builder with a ' +
      'deterministic `<tenantId>/<kind>` key builder (the Wave B driver\'s ' +
      'idempotency key). `assertBootstrapCoverage` enforces "all 10 exist, no ' +
      'dupes"; `assertBootstrapSla` enforces "≥99% within 10 s" at the runtime ' +
      'boundary; `assertBootstrapIdempotent(prior, next)` enforces "re-run ' +
      'produces no duplicates" — every next object must reuse `(kind, key)` ' +
      'with `outcome=reused`; `assertBootstrapDeletable` enforces GDPR ' +
      're-onboarding by refusing any `deletable=false` object.',
    default: false,
    keys: ONBOARD_TENANT_BOOTSTRAP_FLAG_KEYS,
    isEnabled: isOnboardTenantBootstrapEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-decision-doc',
    ticketId: 'V10-ART-019',
    requirementId: 'R-ARTIFACT-19',
    block: 'artifact',
    title: 'decision_doc typed schema + addressability + unresolved-panel invariant (Wave A seed)',
    description:
      'Promote the V10-ART-006 `DecisionDocContent` placeholder (5-entry ' +
      '`DecisionSectionKind` catalogue, opaque `blocks: DocBlock[]`) to a ' +
      '**6-section typed shape** matching the dev-plan ordered list — closed ' +
      '6-entry `DECISION_SECTION_KINDS` (context / options / recommendation / ' +
      'rationale / unresolved_assumptions / evidence_refs). Every section is ' +
      'a required key on `TypedDecisionDocContent.sections` so the type system ' +
      'itself pins "all 6 sections addressable as stable nodes"; ' +
      '`assertAllSectionsAddressable` + `getDecisionSection` refuse empty / ' +
      'duplicate section ids, never synthesise a missing section. Closed ' +
      '3-entry `DECISION_OPTION_RECOMMENDED_LEVELS`, closed 3-entry ' +
      '`ASSUMPTION_SEVERITIES`, closed 2-entry `EVIDENCE_REF_KINDS`. ' +
      '`shouldSurfaceUnresolvedPanel(content)` is the pure predicate pinning ' +
      '"unresolved panel auto-surfaces when non-empty"; ' +
      '`assertUnresolvedPanelVisibilityConsistent(content, panelVisible)` is ' +
      'the post-condition invariant that refuses any UI layer reporting a ' +
      'mismatched visibility. 20+ closed reason codes on ' +
      '`assertTypedDecisionDocContent` cover wrong kind, non-positive schema, ' +
      'empty title, missing / kind-mismatched / duplicate sections, empty ' +
      'option title, duplicate option id, unknown recommendation level, ' +
      'recommendation-target-missing, no-options-for-recommendation, empty ' +
      'assumption text, unknown severity, duplicate assumption id, unknown ' +
      'evidence kind, empty evidence target, evidence-artifact-id mismatch, ' +
      'and duplicate evidence id.',
    default: false,
    keys: ARTIFACT_DECISION_DOC_FLAG_KEYS,
    isEnabled: isArtifactDecisionDocEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-approval-barrier',
    ticketId: 'V10-AGT-019',
    requirementId: 'R-AGENT-19',
    block: 'agent_runtime',
    title: 'Approval barrier sequence — pause-for-human + resume-at-correct-step (Wave A seed)',
    description:
      'Adopt `ApprovalBarrierSequence` carrying `{ id, tenantId, stepCount, ' +
      'barriers }` where each `ApprovalBarrier` pins a `stepOrdinal` at which ' +
      'the executor must pause. `APPROVAL_REQUIRED_EVENT_NAME = ' +
      "'agent.approval_required'` pins the dev-plan pause event; closed " +
      '2-entry `APPROVAL_DECISIONS` (approved / rejected); closed 4-entry ' +
      '`BARRIER_RUN_OUTCOMES`. `simulateBarrierSequence(seq, { untilStepOrdinal? })` ' +
      'is the pure executor: `completed` when no barrier fires, `paused` at ' +
      'the first barrier with a `BarrierPauseEvent` carrying the pinned event ' +
      'name + barrier id + step ordinal + emittedAt. `resumeAfterBarrier(pause, ' +
      'decision, resumedAt)` is the pure resume transition: `approved` sets ' +
      '`nextStepOrdinal = pausedAtStepOrdinal + 1` (re-enter ledger at the ' +
      'correct step), `rejected` terminates at `pausedAtStepOrdinal`. ' +
      '`assertBarrierEventEmitted(result)` refuses paused outcomes missing ' +
      'the event or carrying a wrong name; `assertResumePoint(pause, resume)` ' +
      'refuses any Wave B driver that re-enters at the wrong ordinal. ' +
      '`assertBarrierOrdinalsValid` enforces strictly-sorted barriers within ' +
      'stepCount bounds.',
    default: false,
    keys: AGENT_APPROVAL_BARRIER_FLAG_KEYS,
    isEnabled: isAgentApprovalBarrierEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-conservative-defaults',
    ticketId: 'V10-ONB-019',
    requirementId: 'R-ONBOARD-19',
    block: 'onboarding',
    title: 'Conservative defaults — Internal / 30d / approval-on-export / memory-off (on-by-construction)',
    description:
      'On-by-construction (dev plan §6, CI invariant 40). Pin the dev-plan ' +
      'default matrix: `DEFAULT_CLASSIFICATION = Internal`, ' +
      '`DEFAULT_DRAFT_RETENTION_DAYS = 30`, `DEFAULT_APPROVED_RETENTION_DAYS = ' +
      '365`, `learningLayersEnabled = false`, `researchSourcePolicy = ' +
      'private_only`, and all 4 `APPROVAL_POLICY_TRIGGERS` ' +
      '(first_external_share / first_export / first_write_back / ' +
      'classified_confidential_or_higher). Closed 4-entry ordered ' +
      '`DATA_CLASSIFICATIONS` (Public → Internal → Confidential → Restricted) ' +
      'with pure `isAtLeastAsRestrictiveAs` helper; closed 4-entry ' +
      '`CLASSIFICATION_ESCALATION_TRIGGERS` (finance / security / legal → ' +
      'Confidential; customer_identifiable → Restricted) with ' +
      '`escalateClassification` pure transition that never relaxes an already-' +
      'stricter classification. `TENANT_POLICY_OVERRIDDEN_EVENT_NAME = ' +
      "'tenant.policy_overridden'` pins the dev-plan override event; " +
      '`overrideTenantPolicy(prior, patch, actor, at)` refuses non-admin ' +
      'actors (`non_admin_actor`), empty patches (`override_patch_empty`), ' +
      'unknown dimensions (`unknown_override_dimension`), and emits the event ' +
      'with the list of changed dimensions; `assertOverrideEmitsEvent` is the ' +
      'post-condition invariant. `assertConservativeDefaults(manifest)` is ' +
      'the new-tenant baseline invariant refusing any manifest weaker than ' +
      'the safe floor (classification below Internal, retention above cap, ' +
      'learning enabled, research policy too open, missing approval trigger).',
    default: true,
    keys: ONBOARD_CONSERVATIVE_DEFAULTS_FLAG_KEYS,
    isEnabled: isOnboardConservativeDefaultsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-research-report',
    ticketId: 'V10-ART-020',
    requirementId: 'R-ARTIFACT-20',
    block: 'artifact',
    title: 'research_report typed schema + claim-citation invariant + hedging discipline (Wave A seed)',
    description:
      'Research outputs are first-class artifacts. Pin the dev-plan ' +
      '8-block catalogue `RESEARCH_BLOCK_KINDS` (summary / finding / claim / ' +
      'citation / hedging / assumption / appendix / method_note), closed ' +
      '4-entry `HEDGING_LEVELS` (certain / likely / plausible / speculative), ' +
      'closed 3-entry `RESEARCH_ASSUMPTION_SEVERITIES` (low / medium / high). ' +
      '`TypedResearchReportContent` carries `{ kind: research_report, ' +
      'schemaVersion, title, blocks }` with a discriminated `ResearchBlock` ' +
      'union across all 8 kinds. `assertEveryClaimHasCitation(content)` is ' +
      "the runtime mirror of the dev-plan 'every claim has ≥1 citation " +
      "(enforced at schema level)' acceptance — refuses any claim whose " +
      '`citations` array is empty (`claim_missing_citations`), carries ' +
      'duplicate ids (`duplicate_citation_in_claim`), references a missing ' +
      'block (`claim_cites_unknown_id`), or references a block that is not a ' +
      'citation (`claim_cites_non_citation`). ' +
      '`assertClaimHedgingRule(content)` pins the dev-plan honesty ' +
      "discipline 'hedging is explicit; un-hedged claims only allowed for " +
      "`certain` findings' — refuses any claim with `hedging === null` " +
      'whose linked finding has hedging ≠ certain ' +
      '(`unhedged_claim_on_uncertain_finding`), and any claim whose ' +
      'findingId does not resolve to a `FindingBlock` ' +
      '(`claim_references_unknown_finding` / ' +
      '`claim_references_non_finding`). Pure `indexResearchReport` builds ' +
      '`{ findingsById, citationsById, claimsByFinding }` for the Wave B ' +
      'renderer + the Deep Research writer (V10-RSR-*).',
    default: false,
    keys: ARTIFACT_RESEARCH_REPORT_FLAG_KEYS,
    isEnabled: isArtifactResearchReportEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-fan-out-fan-in',
    ticketId: 'V10-AGT-020',
    requirementId: 'R-AGENT-20',
    block: 'agent_runtime',
    title: 'Fan-out / fan-in schema + "waits-for-all" + "abort-propagates-up" invariants (Wave A seed)',
    description:
      'Wave C scope ("ship only after core executors proven"); Wave A seed ' +
      'pins the schema + pure reducer + invariants. Closed 4-entry ' +
      '`SUB_RUN_OUTCOMES` (pending / succeeded / failed / aborted); closed ' +
      '5-entry `FAN_OUT_PLAN_OUTCOMES` (pending / all_succeeded / ' +
      'partial_failure / all_failed / aborted); closed 1-entry ' +
      '`FAN_IN_JOIN_MODES` (all) matching the dev-plan literal "waits for ' +
      'all". `FanOutPlan` carries `{ id, tenantId, parentRunId, forkCount, ' +
      'subRuns[], joinMode }` with strict structural validation: ' +
      '`fork_count_mismatch` (forkCount ≠ subRuns.length), dense unique ' +
      'ordinals `[0, forkCount)` (`duplicate_ordinal` / ' +
      '`ordinal_out_of_range` / `non_integer_ordinal`), and the ' +
      'failed↔error coupling (`failed_sub_run_missing_error` / ' +
      '`non_failed_sub_run_has_error`). `simulateFanOutFanIn(plan)` is the ' +
      'pure deterministic reducer: pending sub-runs → `pending`; any abort ' +
      'on a settled plan → `aborted`; otherwise `all_succeeded` / ' +
      '`all_failed` / `partial_failure`. `assertFanInWaitsForAll(plan, ' +
      "result)` is the runtime mirror of the dev-plan 'fan-in waits for " +
      "all before continuing' acceptance, refusing any terminal outcome " +
      'while any sub-run remains pending (`fan_in_resolved_with_pending`). ' +
      '`assertAbortIsTerminal(plan, result)` refuses a driver that ' +
      'silently merges an aborted fork into `partial_failure` ' +
      '(`abort_not_propagated`) — abort propagates up, never downgrades.',
    default: false,
    keys: AGENT_FAN_OUT_FAN_IN_FLAG_KEYS,
    isEnabled: isAgentFanOutFanInEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-oauth-fallback',
    ticketId: 'V10-ONB-020',
    requirementId: 'R-ONBOARD-20',
    block: 'onboarding',
    title: 'OAuth 20s fallback — honest path + preserved connector context + no-demo-substitute (Wave A seed)',
    description:
      'First-connector OAuth must have an honest fallback path when the ' +
      'provider round-trip exceeds 20s or fails. `OAUTH_FALLBACK_TIMEOUT_MS ' +
      '= 20_000` pins the dev-plan budget. Closed 5-entry ' +
      '`OAUTH_WAITER_OUTCOMES` (succeeded / timed_out / provider_error / ' +
      'user_denied / network_error); closed 4-entry `OAUTH_FAILURE_EVENTS` ' +
      '(waiter outcomes minus `succeeded`) every entry of which must ' +
      'render a fallback; closed 3-entry `OAUTH_FALLBACK_OPTIONS` ' +
      '(secure_upload / forward_email / existing_approved_document). ' +
      '`OAuthSession` carries `{ connectorId, connectorName, scopes, ' +
      'startedAt, timeoutMs }`; `timeoutMs > 20_000` is refused ' +
      '(`timeout_exceeds_budget`). `resolveOAuthWaiter(session, event)` is ' +
      'the pure reducer returning `succeeded` or ' +
      '`fallback_rendered` with a canonical `OAuthFallbackScreen`. ' +
      '`assertFallbackRendered(event, result)` is the runtime mirror of ' +
      "'fallback shown automatically in 100% of tests' — refuses any " +
      'non-success event that did not render a fallback ' +
      '(`fallback_missing_on_failure`) or whose trigger diverged from the ' +
      'event (`unknown_trigger`). `assertConnectorContextPreserved(fallback, ' +
      "session)` pins 'intended connector context is preserved' — refuses " +
      'connectorId / connectorName / scopes drift and refuses a retry chip ' +
      'label that is empty or missing the connector name ' +
      '(`retry_chip_missing_connector_name`). ' +
      "`assertLiveSyncWarningPresent(fallback)` pins 'fallback screen " +
      "explicitly names that live sync is not active' via a pinned " +
      '`FALLBACK_LIVE_SYNC_WARNING_MESSAGE` canonical string, refusing copy ' +
      'drift (`live_sync_warning_mismatch`) or a fallback that flips ' +
      '`liveSyncActive` away from `false`. ' +
      "`assertNoDemoSubstitute(fallback)` pins the dev-plan negative rule " +
      "'No demo data is inserted as substitute' as a hard runtime error " +
      'on `demoDataInserted !== false`.',
    default: false,
    keys: ONBOARD_OAUTH_FALLBACK_FLAG_KEYS,
    isEnabled: isOnboardOAuthFallbackEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-comments-annotations',
    ticketId: 'V10-ART-021',
    requirementId: 'R-ARTIFACT-21',
    block: 'artifact',
    title:
      'Comments + annotations — anchor-survival on mutation + mention-notification invariant (Wave A seed)',
    description:
      'Review is native. Closed 4-entry `ANNOTATION_KINDS` ' +
      '(question / suggestion / issue / approval_note); closed 2-entry ' +
      '`COMMENT_STATES` (unresolved / resolved); closed 3-entry ' +
      '`REATTACH_OUTCOMES` (reattached / narrowed / orphaned); closed ' +
      '4-entry `ANCHOR_MUTATION_KINDS` (node_deleted / node_renamed / ' +
      'range_shifted / range_deleted). `TypedComment` carries a ' +
      '`CommentAnchor` (nodeId + optional `AnchorRange` — whole-node ' +
      'anchors use `range=null`), typed body + mentions[], and strict ' +
      'resolved/unresolved temporal rules (`resolved_without_timestamp` / ' +
      '`unresolved_with_timestamp` / `resolved_before_created`). ' +
      '`reattachCommentToMutation(comment, mutation)` is the pure ' +
      'transition: `node_deleted` → `orphaned`; `node_renamed` → ' +
      '`reattached` with nodeId rewritten; range mutations either shift, ' +
      'narrow, or orphan based on overlap. ' +
      "`assertAnchorSurvivesMutation(comment, mutation, result)` is the " +
      "runtime mirror of the dev-plan 'comments survive anchor node " +
      "mutations (anchor re-attaches or marks as orphan)' acceptance, " +
      'refusing outcome/orphan-flag mismatches ' +
      '(`orphan_flag_mismatch`) and refusing a `node_deleted` mutation ' +
      'that somehow produced `outcome=reattached` ' +
      '(`orphan_anchor_still_attached`). ' +
      "`assertMentionNotifications(comment, intents)` pins 'mentions " +
      "trigger notifications to mentioned users' — every mention MUST " +
      'appear as ≥1 `MentionNotificationIntent.recipient` ' +
      '(`mention_missing_notification`); extra watcher intents are ' +
      'allowed but stray intents for unknown comments are refused ' +
      '(`notification_for_unknown_comment`).',
    default: false,
    keys: ARTIFACT_COMMENTS_ANNOTATIONS_FLAG_KEYS,
    isEnabled: isArtifactCommentsAnnotationsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-schedule-definition',
    ticketId: 'V10-AGT-021',
    requirementId: 'R-AGENT-21',
    block: 'agent_runtime',
    title:
      'ScheduleDefinitionV1 — cron/interval validation + overlap-policy decision rule (Wave A seed)',
    description:
      'Scheduled agents get a typed schema + write-time validation. ' +
      'Closed 3-entry `OVERLAP_POLICIES` (skip / queue / parallel); ' +
      'closed 4-entry `SCHEDULE_INTERVAL_UNITS` (s / m / h / d); closed ' +
      '3-entry `SCHEDULE_TRIGGER_DECISIONS` (start / skip / queue). ' +
      '`SCHEDULE_MIN_INTERVAL_MS = 5 × 60_000` pins a safety floor so ' +
      'misconfigured tenants cannot spam sub-minute schedules; ' +
      '`SCHEDULE_MAX_RETENTION_DAYS = 365` caps retention. ' +
      '`parseCronOrInterval(expr)` accepts 5-field POSIX cron ' +
      '(minute 0–59, hour 0–23, dom 1–31, month 1–12, dow 0–6, with ' +
      '`*`, `*/N`, lists, ranges) OR `every <N><unit>` intervals; ' +
      'malformed expressions raise ' +
      '`malformed_cron` / `malformed_interval` / `interval_below_floor`. ' +
      "`assertScheduleDefinition(def)` is the write-time validator " +
      "(dev-plan 'cron expressions validated at write time') — refuses " +
      'empty IDs / refs, invalid retention, invalid budget (via ' +
      '`assertBudgetValid`), missing `nextRunAt`, or `lastRunAt > ' +
      'nextRunAt`. `decideOverlapAction(policy, prior)` is the pure ' +
      'decision rule: `parallel` ⇒ always `start`; `skip` ⇒ `start` iff ' +
      'prior.status=idle else `skip`; `queue` ⇒ `start` iff idle else ' +
      "`queue`. `assertOverlapPolicyBehaviour(policy, prior, decision)` " +
      "is the runtime mirror of the dev-plan 'overlap policy enforced " +
      "correctly' acceptance, refusing any (policy, prior, decision) " +
      'triple that the pure rule would not produce ' +
      '(`overlap_policy_violation`).',
    default: false,
    keys: AGENT_SCHEDULE_DEFINITION_FLAG_KEYS,
    isEnabled: isAgentScheduleDefinitionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-citation-validation-fallback',
    ticketId: 'V10-ONB-021',
    requirementId: 'R-ONBOARD-21',
    block: 'onboarding',
    title:
      'Citation-validation fallback — 80% coverage gate + zero-conclusion scaffold + onboard.artifact_blocked (Wave A seed)',
    description:
      'When the first artifact cannot meet evidence policy the system ' +
      'MUST block finalisation and show an honest scaffold, never ' +
      'fabricate a conclusion. `COVERAGE_THRESHOLD = 0.80` pins the ' +
      'dev-plan floor; closed 2-entry `BLOCK_REASONS` (low_coverage / ' +
      'missing_required_source_type); closed ordered 4-entry ' +
      '`BLOCKED_OPTIONS` (narrow_scope / add_source / ' +
      'continue_with_scaffold / handoff_to_review); closed 3-entry ' +
      '`SCAFFOLD_BLOCK_KINDS` (heading / placeholder / citation_slot). ' +
      '`ARTIFACT_BLOCKED_EVENT_NAME = onboard.artifact_blocked` is the ' +
      'canonical telemetry. `evaluateCitationCoverage(report)` returns ' +
      "`{status:'ready'}` only when coverageRatio ≥ 0.8 AND no required " +
      "source type is missing; otherwise `{status:'blocked', reasons}` " +
      'lists every triggered cause. ' +
      "`assertScaffoldHasZeroConclusions(scaffold)` is the runtime " +
      "mirror of 'scaffold fallback contains zero generated conclusions' " +
      '— any block with `isConclusion=true` is refused ' +
      '(`scaffold_contains_conclusion`). ' +
      "`assertBlockedOptionsComplete(options)` pins 'four one-click " +
      "options' (all four must be present, no duplicates, no unknown " +
      'entries — `missing_blocked_option` / `duplicate_blocked_option`). ' +
      "`assertBlockedEventEmitted(screen)` pins 'telemetry fires " +
      "onboard.artifact_blocked with reason code' — exactly one event, " +
      'known reason code, coverage + missing-source parity with the ' +
      'report, non-empty `emittedAt`. ' +
      "`assertBlockedScreenIntegrity(screen)` stitches the four rails " +
      "together and additionally refuses a ready report wearing the " +
      'blocked shell (`ready_state_with_blocked_shell`).',
    default: false,
    keys: ONBOARD_CITATION_VALIDATION_FALLBACK_FLAG_KEYS,
    isEnabled: isOnboardCitationValidationFallbackEnabled,
    telemetry: ['onboard.artifact_blocked'],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-store-contract',
    ticketId: 'V10-ART-022',
    requirementId: 'R-ARTIFACT-22',
    block: 'artifact',
    title:
      'ArtifactStore contract — tenant isolation + P90 ≤ 200 ms + version immutability (Wave A seed)',
    description:
      'Pins the ArtifactStore contract before the Wave B Postgres-backed ' +
      'service lands. Closed 6-entry `ARTIFACT_STORE_OPERATIONS` ' +
      '(create / findById / findByTenant / search / writeVersion / ' +
      'loadVersion). `ARTIFACT_STORE_LATENCY_P90_BUDGET_MS = 200` ' +
      'and `ARTIFACT_STORE_MIN_SAMPLES_FOR_P90 = 10` pin the latency ' +
      'budget; `ARTIFACT_SEARCH_MAX_QUERY_LENGTH = 500` pins the ' +
      'FTS safety cap. `assertTenantIsolation(caller, records)` is ' +
      "the runtime mirror of 'row-level security passes tenant " +
      "isolation test' — any record whose tenantId differs from " +
      'caller fails (`tenant_isolation_breach`). ' +
      '`assertLatencyP90WithinBudget` refuses any operation P90 > ' +
      '200 ms with ≥10 samples (`latency_p90_exceeds_budget`). ' +
      "`assertVersionImmutability` is the runtime mirror of 'versions " +
      "stored as immutable blobs' — same versionId must carry " +
      'identical contentBlob + metadata + tenantId + artifactId, else ' +
      'the most specific reason code fires. ' +
      '`assertVersionBlobIsolation` is defence-in-depth: JSON blobs ' +
      'carrying a mismatched tenantId field are refused ' +
      '(`version_blob_tenant_leak`).',
    default: false,
    keys: ARTIFACT_STORE_CONTRACT_FLAG_KEYS,
    isEnabled: isArtifactStoreContractEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-schedule-registry',
    ticketId: 'V10-AGT-022',
    requirementId: 'R-AGENT-22',
    block: 'agent_runtime',
    title:
      'ScheduleRegistry — drift ≤ 60 s P99 + missed-run replay per overlap policy (Wave A seed)',
    description:
      'Pins the ScheduleRegistry poll reducer and two dev-plan ' +
      'invariants before the Wave B poller binds to the Run Ledger. ' +
      'Closed 4-entry `REGISTRY_POLL_OUTCOMES` (triggered / queued / ' +
      'skipped / deferred). `SCHEDULE_REGISTRY_DRIFT_P99_BUDGET_MS ' +
      '= 60_000` and `SCHEDULE_REGISTRY_MIN_SAMPLES_FOR_P99 = 20` ' +
      'pin the drift budget. `pollDueSchedules(tick, priors)` is the ' +
      'pure per-tick reducer: `nextRunAt > now` ⇒ deferred (negative ' +
      'drift); otherwise it consults `decideOverlapAction` and emits ' +
      '`triggered` / `queued` / `skipped`. Input ordering is ' +
      'preserved; duplicate ids fail (`duplicate_schedule_id`). ' +
      "`assertDriftWithinBudget` is the runtime mirror of 'drift on " +
      "schedule ≤ 60 s P99' — refuses any bag of ≥20 non-deferred " +
      'events whose P99 drift exceeds 60 s. `replayMissedRuns(' +
      'policy, missed)` encodes the three overlap behaviours: ' +
      '`parallel` / `queue` fire every tick in order; `skip` ' +
      'collapses the backlog to the most recent tick. ' +
      '`assertMissedRunsHandled(policy, missed, emittedTriggered' +
      "Count)` is the runtime mirror of 'missed runs handled per " +
      "overlap policy' — any divergence from the pure reducer " +
      'fails with `missed_runs_not_replayed` / ' +
      '`missed_runs_wrong_count`.',
    default: false,
    keys: AGENT_SCHEDULE_REGISTRY_FLAG_KEYS,
    isEnabled: isAgentScheduleRegistryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-resume-abandonment',
    ticketId: 'V10-ONB-022',
    requirementId: 'R-ONBOARD-22',
    block: 'onboarding',
    title:
      'Resume on abandonment — 7-section snapshot + 2-click restore + 7-day TTL + hash-based source delta (Wave A seed)',
    description:
      'Pins the resume-on-abandonment contract so a returning user ' +
      'lands on the exact interrupted step without fabrication. ' +
      'Closed ordered 7-entry `SNAPSHOT_SECTION_KINDS` (persona / ' +
      'connector / uploads / draft / approvals / trust_banner / ' +
      'blockers). Closed 3-entry `RESUME_OUTCOMES` (resumed / ' +
      'expired_cleared / source_delta_confirm_required). ' +
      '`RESUME_TOKEN_DEFAULT_TTL_MS = 7 days`; ' +
      '`RESUME_MAX_CLICKS_TO_RESTORE = 2`. `resolveResumeAttempt` ' +
      'is the pure reducer: expired token ⇒ clear + fresh start; ' +
      'any source hash drifted ⇒ confirm-required carrying the ' +
      'exact changed ids; otherwise ⇒ land directly. ' +
      "`assertSnapshotCoverage` is the runtime mirror of 'snapshot " +
      "includes all 7 sections' — missing / unknown / duplicate " +
      'section kinds are refused. `assertResumeWithinClickBudget` ' +
      "pins 'within 2 clicks in ≥95% of resume tests' at the schema " +
      'level — any decision with clicksToRestore > 2 fails ' +
      '(`clicks_out_of_budget`). `assertExpiredTokenClearsSnapshot` ' +
      "pins 'expired resume tokens clear snapshot and start fresh' " +
      '— an expired outcome without clearedSnapshotId or carrying ' +
      'a landedOnStep is refused. `assertSourceDeltaDetected` pins ' +
      "'source-delta detection is correct (hash-based)' — both " +
      'false-positives and false-negatives against the real hash ' +
      'diff fail (`source_delta_false_positive` / ' +
      '`source_delta_false_negative`).',
    default: false,
    keys: ONBOARD_RESUME_ABANDONMENT_FLAG_KEYS,
    isEnabled: isOnboardResumeAbandonmentEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-immutable-audit',
    ticketId: 'V10-ART-023',
    requirementId: 'R-ARTIFACT-23',
    block: 'artifact',
    title:
      'Immutable audit trail — append-only + governance coverage + per-DataClassification retention (Wave A seed)',
    description:
      'Pins the append-only audit-trail contract before the Wave B ' +
      '`artifact_audit_events` Postgres table + trigger bind to it. ' +
      'Closed ordered 6-entry `ARTIFACT_AUDIT_EVENT_KINDS` ' +
      '(proposal_submitted / proposal_approved / proposal_rejected / ' +
      'proposal_edited / version_exported / artifact_shared_external) ' +
      'covers the dev-plan governance list (V10-ART-003 state ' +
      'transitions, V10-ART-024 export, V10-ART-028 external share). ' +
      'Per-`DataClassification` `ARTIFACT_AUDIT_RETENTION_DAYS` ' +
      '(Public=365 / Internal=730 / Confidential=1825 / Restricted=' +
      '2555) aligns with V10-ART-004 policy and the S4 audit floor. ' +
      "`assertAppendOnly` is the runtime mirror of 'audit log rejects " +
      "update / delete' — a row whose content changed between prior " +
      'and incoming snapshots fails (`immutability_update`), and a ' +
      'prior row missing from incoming fails ' +
      '(`immutability_delete`). `assertGovernanceEventLogged` pins ' +
      "'every governance event writes a row' — a governance ref " +
      'without a matching audit row fails ' +
      '(`governance_event_missing`). `assertRetentionPolicy` pins ' +
      "'retention per DataClassification' — sweeping before " +
      'cutoff fails (`retention_pruned_too_early`).',
    default: false,
    keys: ARTIFACT_IMMUTABLE_AUDIT_FLAG_KEYS,
    isEnabled: isArtifactImmutableAuditEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-swarm-definition',
    ticketId: 'V10-AGT-023',
    requirementId: 'R-AGENT-23',
    block: 'agent_runtime',
    title:
      'SwarmDefinitionV1 — distinct roles + coordinator + synthesis + budget-share arithmetic (Wave A seed)',
    description:
      'Pins the Wave C swarm definition shape before the multi-agent ' +
      'fan-out/fan-in scheduler lands. `SWARM_MIN_MEMBERS = 2` and ' +
      '`SWARM_MAX_MEMBERS = 16` match the V10-AGT-020 degree-of-' +
      'parallelism ceiling. `SwarmDefinitionV1` carries a branded ' +
      '`swarmId`, a coordinator `AgentDefRef`, N≥2 `SwarmMemberV1` ' +
      '(role + agentDefRef), a `SwarmSynthesisStep`, and an ' +
      'aggregate `BudgetV1`. Five runtime invariants enforce the ' +
      "dev-plan rule 'N agents with distinct roles, coordinator " +
      "agent, synthesis step': `assertSwarmDefinition` (structural), " +
      '`assertDistinctMemberRoles` (no duplicate role strings — ' +
      '`duplicate_member_role`), `assertCoordinatorDistinctFrom' +
      'Members` (coordinator cannot also be a member — ' +
      '`coordinator_is_member`), `assertSynthesisDistinctFrom' +
      'Coordinator` (synthesis ref ≠ coordinator ref — ' +
      '`synthesis_same_as_coordinator`), and ' +
      '`assertBudgetSharesWithinTotal` (all-or-nothing per-member ' +
      'shares whose sums must not exceed swarm-level ' +
      '`budget.costUsdCap` / `budget.tokenCap`).',
    default: false,
    keys: AGENT_SWARM_DEFINITION_FLAG_KEYS,
    isEnabled: isAgentSwarmDefinitionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-telemetry',
    ticketId: 'V10-ONB-023',
    requirementId: 'R-ONBOARD-23',
    block: 'onboarding',
    title:
      'Onboarding telemetry — 22 events × 11 required properties + ordering invariants (Wave A seed)',
    description:
      'Pins the `onboard.*` telemetry contract before the Wave B ' +
      'emitters and V10-ONB-024 KPI dashboard bind to it. Closed ' +
      'ordered 22-entry `ONBOARD_TELEMETRY_EVENTS` covers the ' +
      'persona → connector → artifact → export funnel plus the ' +
      'resume/abandon terminals. Closed 11-entry ' +
      '`ONBOARD_TELEMETRY_REQUIRED_PROPERTIES` (persona / ' +
      'source_type / data_classification / trust_mode / ' +
      'residency_region / seconds_since_start / artifact_type / ' +
      'citation_count / validation_status / approval_required / ' +
      'aha_reached). Closed 3-entry `ONBOARD_TELEMETRY_TERMINAL_' +
      "EVENTS` (artifact_saved / resume_reentered / abandoned). " +
      "`assertRequiredProperties` is the runtime mirror of 'no " +
      "event lacks any required property (CI invariant 35)' — any " +
      'missing / empty-string / non-finite-number value fails ' +
      '(`missing_required_property` / ' +
      '`empty_required_property_value`). `assertSessionCoverage` ' +
      "pins 'all 22 events present' — a session missing any " +
      'catalogued event fails (`session_missing_event`). ' +
      "`assertEventOrdering` pins 'onboard.started first + " +
      "monotonic occurredAt' (`session_started_not_first` / " +
      '`session_out_of_order_occurred_at`).',
    default: false,
    keys: ONBOARD_TELEMETRY_FLAG_KEYS,
    isEnabled: isOnboardTelemetryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-export-manifest',
    ticketId: 'V10-ART-024',
    requirementId: 'R-ARTIFACT-24',
    block: 'artifact',
    title:
      'Export manifest + SHA-256 integrity chain — canonical JSON + manifest/export coverage (Wave A seed)',
    description:
      'Pins the export-integrity contract before the Wave B export ' +
      'pipeline serialises artifacts to pdf / pptx / xlsx / docx / md ' +
      '/ json / csv. Closed 3-entry `EXPORT_DESTINATIONS` = email / ' +
      'link / download. `ExportManifest` shape matches the dev-plan ' +
      'spec (artifactId / versionId / format / exportedAt / ' +
      'exportedBy / sha256 / signature? / lineage / sources / ' +
      'watermark? / confidentialityTags / destination). ' +
      '`canonicaliseManifest` emits deterministic JSON (sorted keys, ' +
      'stable ordering of lineage / sources / confidentialityTags) ' +
      'so the SHA-256 input is reproducible. ' +
      "`assertManifestIntegrity(manifest, expectedSha256)` is the " +
      "runtime mirror of 'client-side hash equals server-side " +
      "hash' — any mismatch (wrong length, non-hex, or value " +
      'divergence) fails `integrity_hash_mismatch` / ' +
      '`integrity_hash_format`. `assertManifestHumanReadable` pins ' +
      "'manifest is human-readable JSON' — round-tripping through " +
      'JSON.parse/JSON.stringify must yield an identical object. ' +
      "`assertEveryExportHasManifest` pins 'every export has a " +
      "manifest' — an export event without a matching manifest " +
      '(artifactId + versionId + exportedAt) fails ' +
      '`export_missing_manifest`.',
    default: false,
    keys: ARTIFACT_EXPORT_MANIFEST_FLAG_KEYS,
    isEnabled: isArtifactExportManifestEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-provenance-footer',
    ticketId: 'V10-ART-025',
    requirementId: 'R-ARTIFACT-25',
    block: 'artifact',
    title:
      'Provenance footer + watermark — 12-char sha prefix + tenant-policy watermark (Wave A seed)',
    description:
      'Pins the external-share provenance rail. Closed 4-entry ' +
      '`FOOTER_TARGETS` (pdf_footer / slide_last / doc_last_row / ' +
      'md_trailing_block) picks the per-format rendering seat. ' +
      '`ProvenanceFooter` shape carries artifactId + versionId + ' +
      'reviewerUserId + approvedAt + `sha256Prefix12` (exactly 12 ' +
      'hex chars of the V10-ART-024 manifest hash). ' +
      '`WatermarkSpec` holds tenant-policy-derived text. ' +
      "`assertProvenanceFooter` is the structural mirror of the " +
      'footer shape — wrong-length / non-hex prefix fails ' +
      '`footer_sha_prefix_wrong_length` / ' +
      '`footer_sha_prefix_non_hex`. ' +
      "`assertFooterPresentForExternalShare` pins 'every externally " +
      "shared artifact has a provenance footer' — a share event " +
      'without a matching footer fails `share_missing_footer`. ' +
      "`assertWatermarkRespectsTenantPolicy` pins 'watermark " +
      "respects tenant policy' — a tenant that requires a watermark " +
      'without a non-empty `watermark.text` fails ' +
      '`watermark_required_but_empty`.',
    default: false,
    keys: ARTIFACT_PROVENANCE_FOOTER_FLAG_KEYS,
    isEnabled: isArtifactProvenanceFooterEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-library-folders',
    ticketId: 'V10-ART-026',
    requirementId: 'R-ARTIFACT-26',
    block: 'artifact',
    title:
      'Library folders — 4 standard destinations + sound ReviewState/export transitions (Wave A seed)',
    description:
      'Pins the four standard library destinations so the Wave B ' +
      'library UI has a closed domain to render. Closed ordered ' +
      '4-entry `LIBRARY_FOLDERS` = Drafts / Approved / Exported / ' +
      'Templates. Closed `LIBRARY_FOLDER_TRANSITION_EVENTS` ' +
      'catalogue covers the dev-plan triggers (approval / export / ' +
      'save_as_template). Pure reducer `placeArtifactInFolder(' +
      'reviewState, everExported, isTemplate)` maps a ReviewState ' +
      'snapshot to exactly one folder. ' +
      "`assertLibraryFolderPlacement` is the runtime mirror of the " +
      'placement reducer — rejects any folder claim that disagrees ' +
      'with the ReviewState (`placement_disagrees_with_state`). ' +
      "`assertFolderTransitionSound(prior, next, event)` pins the " +
      'sanctioned transitions (Drafts → Approved needs approval; ' +
      'Approved → Exported needs export; any → Templates needs ' +
      'save_as_template) — unauthorised edges fail ' +
      '`unauthorised_transition`.',
    default: false,
    keys: ARTIFACT_LIBRARY_FOLDERS_FLAG_KEYS,
    isEnabled: isArtifactLibraryFoldersEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-template-fingerprint',
    ticketId: 'V10-ART-027',
    requirementId: 'R-ARTIFACT-27',
    block: 'artifact',
    title:
      'Template fingerprint + reuse — structure-only deterministic hash + reuse-suggestion gate (Wave A seed)',
    description:
      'Pins the structure-only fingerprint so the next session can ' +
      'suggest reuse when the artifact skeleton matches an approved ' +
      'template. `computeTemplateFingerprint(artifactStructure)` is ' +
      'deterministic: same structure → same hash, ignoring every ' +
      'content payload. `assertFingerprintDeterministic` refuses ' +
      'any computation that diverges when called twice on the same ' +
      'input (`fingerprint_non_deterministic`). ' +
      '`assertFingerprintIgnoresContent` refuses a fingerprint that ' +
      'changes when only content fields change ' +
      '(`fingerprint_leaks_content`). ' +
      '`assertFingerprintDifferentiatesStructure` refuses a ' +
      'fingerprint that collides when section names / node kinds ' +
      'differ (`fingerprint_collision_on_structure`). ' +
      "`assertReuseSuggestion(fingerprint, libraryFingerprints)` " +
      "pins 'suggest only when ≥1 library template matches' — a " +
      'suggestion fired against an empty match set fails ' +
      '`suggestion_without_match`.',
    default: false,
    keys: ARTIFACT_TEMPLATE_FINGERPRINT_FLAG_KEYS,
    isEnabled: isArtifactTemplateFingerprintEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-interrupt-verbs',
    ticketId: 'V10-AGT-024',
    requirementId: 'R-AGENT-24',
    block: 'agent_runtime',
    title:
      '9 interrupt verbs — idempotent + compensation-implied (Wave A seed)',
    description:
      'Pins user control over running agents. Closed ordered ' +
      '9-entry `INTERRUPT_VERBS` = pause / resume / cancel / skip / ' +
      'redo / retry / reset / rewind / abort. Closed 7-entry ' +
      '`RUN_STATES` (idle / running / paused / completed / failed / ' +
      'cancelled / aborted). `VERB_LEGAL_STATES` pins which prior ' +
      'states each verb is legal against; `VERB_NEXT_STATE` pins ' +
      'the successor state. Pure reducer `applyInterrupt(state, ' +
      'verb)` returns a typed decision (`nextState`, ' +
      '`requiresCompensation`, `reason: noop|state_changed|illegal`). ' +
      "`assertVerbIdempotent(state, verb)` is the runtime mirror of " +
      "dev-plan 'every verb is idempotent' — applying the same verb " +
      'twice from a quiescent state must yield the same state ' +
      '(`verb_not_idempotent`). `COMPENSATION_VERBS` (cancel / ' +
      'abort / reset / rewind) carry compensation semantics; ' +
      "`assertCompensationImpliedByVerb` pins 'side effects of " +
      "partially-executed steps are compensated' — a compensating " +
      'verb with an empty compensation record fails ' +
      '`compensation_record_empty`.',
    default: false,
    keys: AGENT_INTERRUPT_VERBS_FLAG_KEYS,
    isEnabled: isAgentInterruptVerbsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-research-phase-machine',
    ticketId: 'V10-AGT-025',
    requirementId: 'R-AGENT-25',
    block: 'agent_runtime',
    title:
      'Research phase machine — 7 phases + artifact ledger per phase (Wave A seed)',
    description:
      'Pins the long-research-session state machine before the Wave B ' +
      'research runtime binds to it. Closed ordered 7-entry ' +
      '`RESEARCH_PHASES` = decomposing → retrieving → synthesising ' +
      '→ drafting → self_checking → awaiting_approval → finalising. ' +
      '`PHASE_ARTIFACT_KINDS` maps each phase to the intermediate ' +
      'artifact it MUST persist to the ledger (decomposition_plan / ' +
      'evidence_pack / synthesis_draft / draft / self_check_report ' +
      '/ approval_request / final_artifact). `PHASE_TRANSITIONS` ' +
      'encodes the legal (from, to) pairs including rewind edges. ' +
      'Pure reducer `advancePhase(current, event)` returns a typed ' +
      "`PhaseTransition`. `assertPhaseTransitionLegal` refuses any " +
      'edge not in the transition set (`illegal_transition`). ' +
      "`assertIntermediateArtifactPersisted(phase, ledgerRows)` pins " +
      "'each phase persists intermediate artifacts to the ledger' — " +
      'a completed phase without ≥1 matching ledger row fails ' +
      '`phase_artifact_missing` / ' +
      '`phase_artifact_wrong_kind`.',
    default: false,
    keys: AGENT_RESEARCH_PHASE_MACHINE_FLAG_KEYS,
    isEnabled: isAgentResearchPhaseMachineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-trace-collector',
    ticketId: 'V10-AGT-026',
    requirementId: 'R-AGENT-26',
    block: 'agent_runtime',
    title:
      'TraceCollector — OTel-compatible spans + per-span budget + acyclic tree (Wave A seed)',
    description:
      'Pins the OpenTelemetry-compatible trace shape before the Wave ' +
      'B exporter binds to Jaeger / Honeycomb / OTLP. Closed 4-entry ' +
      '`SPAN_KINDS` = llm_call / tool_call / db_op / side_effect. ' +
      '`Span` carries traceId / spanId / parentSpanId|null / kind / ' +
      'startedAt / endedAt / `budgetUsage: BudgetConsumed` / ' +
      'attributes. `buildTraceTree(spans)` is the O(n) pure parent-' +
      'child reconstruction; `collectBudgetPerSpan(spans)` returns a ' +
      'span-id → BudgetConsumed map. Five invariants mirror the ' +
      "dev-plan acceptance: `assertSpanStructural`, " +
      "`assertEveryRunHasCompleteTrace` (≥1 root + every parent " +
      "present — `no_root_span` / `orphan_span`), " +
      '`assertBudgetExposedPerSpan` (every span carries a non-null ' +
      '`budgetUsage` — `null_budget_usage`), `assertNoOrphanSpan`, ' +
      '`assertNoCycle` (self-cycle or mutual cycle fails ' +
      '`cycle_detected`).',
    default: false,
    keys: AGENT_TRACE_COLLECTOR_FLAG_KEYS,
    isEnabled: isAgentTraceCollectorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-notification-broker',
    ticketId: 'V10-AGT-027',
    requirementId: 'R-AGENT-27',
    block: 'agent_runtime',
    title:
      'NotificationBroker — 4 event kinds × 3 channels + per-user prefs + admin-safety override (Wave A seed)',
    description:
      'Pins the notification routing contract before the Wave B ' +
      'broker dispatches. Closed 4-entry ' +
      '`NOTIFICATION_EVENT_KINDS` = approval_required / ' +
      'run_completed / run_failed / budget_exceeded. Closed 3-entry ' +
      '`NOTIFICATION_CHANNELS` = email / in_app / webhook. ' +
      '`UserNotificationPreferences` is a per-user × per-event × ' +
      'per-channel opt-in map. Pure reducer `routeNotification' +
      '(event, preferences)` returns zero-or-more dispatches. ' +
      "`assertDispatchHonoursPreferences` refuses any dispatch on a " +
      'channel the user opted out of ' +
      '(`dispatch_violates_preferences`). ' +
      "`assertBudgetExceededReachesAdmin` pins the admin-safety " +
      "override — a `budget_exceeded` event with an empty dispatch " +
      'plan fails `budget_exceeded_not_delivered` so the per-user ' +
      'mute cannot silence a cost-alert reaching an admin channel.',
    default: false,
    keys: AGENT_NOTIFICATION_BROKER_FLAG_KEYS,
    isEnabled: isAgentNotificationBrokerEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-activation-kpi-dashboard',
    ticketId: 'V10-ONB-024',
    requirementId: 'R-ONBOARD-24',
    block: 'onboarding',
    title:
      'Activation KPI dashboard — 4 metrics × 7 columns + green/amber/red classification + tenant-tighten-only (Wave A seed)',
    description:
      'Pins the admin activation KPI dashboard contract. Closed ' +
      'ordered 6-entry `KPI_PERSONAS` (partner / cfo / ceo / coo / ' +
      'ciso / transformation) + "overall" column = 7 columns. Closed ' +
      'ordered 4-entry `KPI_METRICS` (activation_rate / ' +
      'median_time_to_first_artifact_seconds / ' +
      'connector_attach_at_aha_rate / first_artifact_approved_rate) ' +
      '× 7-persona-column target matrix is pinned against the ' +
      'dev-plan KPI table (overall activation ≥ 40 %, CFO ≤ 180 s ' +
      'median time-to-first-artifact, etc.). Closed 3-entry ' +
      '`KPI_STATUS` = green / amber / red. ' +
      '`LOWER_IS_BETTER_METRICS` inverts the comparator for median ' +
      'time-to-first-artifact. Pure reducer `classifyKpiCell(' +
      'metric, actual, target)` emits green (meets) / amber (within ' +
      '10 %) / red. `computeKpiSnapshotFromEvents(events)` ' +
      'aggregates a V10-ONB-023 onboarding-telemetry event stream. ' +
      'Five invariants: `assertKpiSnapshot` (structural); ' +
      '`assertTargetsCoverAllCells` (no gap in 7×4 matrix); ' +
      '`assertClassificationCorrect` (claimed status must match the ' +
      'pure reducer — `classification_disagrees_with_reducer`); ' +
      "`assertTenantOverridesOnlyTighten` pins dev-plan 'tenant " +
      "admin can tighten, not loosen globally' " +
      '(`tenant_override_loosens`); ' +
      "`assertRefreshCadenceWithinBudget` pins " +
      "'`KPI_DASHBOARD_MAX_STALENESS_MS = 1 h` or on-demand' — " +
      '`now - lastRefreshedAt > budget` fails ' +
      '`refresh_cadence_stale`.',
    default: false,
    keys: ONBOARD_ACTIVATION_KPI_DASHBOARD_FLAG_KEYS,
    isEnabled: isOnboardActivationKpiDashboardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'onboard-team-invite-after-aha',
    ticketId: 'V10-ONB-025',
    requirementId: 'R-ONBOARD-25',
    block: 'onboarding',
    title:
      'Team invite after aha — CTA gated on artifact_saved/approved + no pre-aha interactive invite UI (Wave A seed)',
    description:
      'Pins the team-invite timing rule so onboarding reaches ' +
      'personal aha before asking for social expansion. Closed ' +
      '2-entry `AHA_TRIGGER_EVENTS` = onboard.artifact_saved / ' +
      'onboard.artifact_approved (from V10-ONB-023 telemetry). ' +
      'Closed 3-entry `INVITE_CTA_STATES` = hidden_with_hint ' +
      '(pre-aha default) / visible_interactive (post-aha) / ' +
      'disabled_pre_aha (tenant-disabled invites). Pure reducer ' +
      '`resolveInviteCtaState(events, tenantPolicy, now)` returns ' +
      'an `InviteCtaDecision` with `landedAfterAhaAt` timestamp if ' +
      'any aha trigger fired. Four invariants: ' +
      "`assertInviteCtaDecision` (structural); " +
      "`assertCtaHiddenBeforeAha` pins dev-plan 'team invite CTA " +
      "appears only after artifact save or approval in 100 % of " +
      "first-run flows' — a `visible_interactive` decision without " +
      'any aha trigger event fails `cta_visible_before_aha`; ' +
      "`assertNoInteractivePreAhaElement` pins 'before aha, no " +
      "invite-related UI element is interactive' — any pre-aha " +
      'element with `interactive: true` fails ' +
      '`interactive_invite_element_pre_aha`; ' +
      "`assertCtaStateReachable` rejects decisions whose claimed " +
      'state is not reachable from the session event history ' +
      '(`state_not_reachable`).',
    default: false,
    keys: ONBOARD_TEAM_INVITE_AFTER_AHA_FLAG_KEYS,
    isEnabled: isOnboardTeamInviteAfterAhaEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-role-based-approval-gates',
    ticketId: 'V10-ART-028',
    requirementId: 'R-ARTIFACT-28',
    block: 'artifact',
    title:
      'Role-based approval gates — 5 reviewer roles + 4 match kinds + tenant-tighten-only override (Wave A seed)',
    description:
      'Pins the dev-plan "reviewer type varies by context" rule so ' +
      'the Wave B review workflow cannot hard-code a single ' +
      'reviewer. Closed 5-entry `REVIEWER_ROLES` = finance / legal ' +
      '/ ciso / operations / default. Closed 4-entry ' +
      '`ROUTING_MATCH_KINDS` = artifact_type / content_tag / ' +
      'classification / persona so every rule matches on exactly ' +
      'one closed-set dimension. `CFO_ARTIFACT_TYPES` = spreadsheet ' +
      '/ decision_doc / memo pins the CFO regulated subset; ' +
      '`LEGAL_CONTENT_TAG = "legal"` pins the legal tag literal. ' +
      'Pure `resolveRequiredReviewer(ctx, table)` picks the ' +
      'highest-priority matching rule (first-wins on ties) or ' +
      'falls back to `table.defaultRoute`. Six invariants mirror ' +
      'every dev-plan acceptance rail: `assertApprovalRoutingRule` ' +
      '(structural — empty ids / NaN priority / unknown match ' +
      'kinds / unknown reviewer roles fail); ' +
      '`assertApprovalRoutingTable` (structural + ' +
      '`duplicate_rule_id`); `assertRestrictedRequiresCiso` pins ' +
      "'Restricted artifacts require CISO' — any table that " +
      'resolves Restricted to a non-ciso role fails ' +
      '`restricted_without_ciso`; `assertLegalTagRequiresLegal` ' +
      "pins 'legal-tagged content requires Legal reviewer' — " +
      '`legal_tag_without_legal`; ' +
      "`assertCfoArtifactRequiresFinance` pins 'CFO artifact " +
      "types require Finance reviewer' across all three CFO " +
      'types — `cfo_artifact_without_finance`; ' +
      "`assertDefaultRoutesForStandardPersonas` pins 'default " +
      "routes for standard personas' so every persona in " +
      'STANDARD_PERSONAS (partner / cfo / ceo / coo / ciso / ' +
      'transformation) resolves to a role in REVIEWER_ROLES — ' +
      '`persona_without_default_route`; ' +
      "`assertTenantOverrideDoesNotWeakenBaseline` pins the " +
      'Wave A safety rule "tenant overrides may only tighten, ' +
      'never loosen" — any tenant table where a sensitive ' +
      'context (Restricted / legal tag / CFO type) resolves from ' +
      'a specialist role in the baseline to a non-specialist ' +
      'role in the tenant fails ' +
      '`tenant_override_weakens_baseline`; ' +
      "`assertRoutingCoverage` catches tables that lean on " +
      'defaults for sensitive contexts (missing explicit rule) — ' +
      '`routing_coverage_gap`.',
    default: false,
    keys: ARTIFACT_ROLE_BASED_APPROVAL_GATES_FLAG_KEYS,
    isEnabled: isArtifactRoleBasedApprovalGatesEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-anti-patterns',
    ticketId: 'V10-AGT-029',
    requirementId: 'R-AGENT-29',
    block: 'agent_runtime',
    title:
      '12 anti-patterns as lint + runtime rules — closed catalogue + 1:1 registry + named violations (Wave A seed)',
    description:
      'Codifies the twelve agent-runtime anti-patterns from the ' +
      'research doc so every violation lands with an explicit ' +
      'pattern name and every pattern has declared enforcement. ' +
      'Closed ordered 12-entry `AGENT_ANTI_PATTERNS` catalogue ' +
      '(llm_writes_directly_to_tenant_store / ' +
      'approval_happens_after_mutation / budget_cap_absent / ' +
      'no_compensating_op_for_s3_plus / tool_call_without_audit ' +
      '/ silent_source_fallback / sla_violation_unlogged / ' +
      'tenant_isolation_bypass / schedule_overlap_unguarded / ' +
      'citation_dropped_silently / ghost_capability_claim / ' +
      'retry_without_backoff_jitter). Closed 2-entry ' +
      '`ENFORCEMENT_KINDS` = lint / runtime so every pattern ' +
      'declares exactly one venue. `ANTI_PATTERN_CANONICAL_NAMES` ' +
      'pins a human-readable name per id; `ANTI_PATTERN_RULES` ' +
      'registers one rule per id (1:1 catalogue ↔ registry). ' +
      'Five invariants mirror the dev-plan acceptance: ' +
      "`assertAllTwelveHaveEnforcement` pins 'all 12 anti-" +
      "patterns have automated enforcement' — a missing / blank " +
      'registry row fails `<antiPatternId>` as the error reason; ' +
      "`assertAntiPatternNamedInViolation` pins 'violation names " +
      "the anti-pattern explicitly' — a violation whose message " +
      'does not contain the canonical name verbatim fails with ' +
      'the anti-pattern id as reason; `assertEnforcementKindClosed` ' +
      'refuses any rule kind outside lint / runtime; ' +
      '`assertViolationReferencesCatalogue` refuses violations ' +
      'whose id has no registry row (`unknown_anti_pattern`); ' +
      '`assertRegistryCoversCatalogueOneToOne` catches both ' +
      '"catalogue grew without registry" and "registry grew ' +
      'without catalogue" drift (`registry_mismatch`).',
    default: false,
    keys: AGENT_ANTI_PATTERNS_FLAG_KEYS,
    isEnabled: isAgentAntiPatternsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-workload-class-registry',
    ticketId: 'V10-RSN-001',
    requirementId: 'R-REASON-1',
    block: 'reasoning',
    title:
      'Workload class registry + router — 7 closed workload classes + pure `routeRequest` (Wave A seed)',
    description:
      'Opens the reasoning block seed. Closed 7-entry ' +
      '`WORKLOAD_CLASSES` + 4-entry `HEDGING_LEVELS` + ' +
      '`WORKLOAD_CLASS_REGISTRY` pin every class → spec mapping. ' +
      'Pure `routeRequest(req)` is deterministic and falls through ' +
      'to a default class when hints are unknown. Four invariants ' +
      'mirror dev-plan acceptance: `assertRegistryComplete` ' +
      '(catalogue ↔ registry 1:1), ' +
      '`assertRequestResolvesToOneClass` (single winner per ' +
      'request), `assertUnknownHintFallsThrough` (no throw on ' +
      'unknown hint), `assertEveryClassHasSpec` (every class has ' +
      'a pinned spec). UI / telemetry emitter / Stage-2 ML ' +
      'classifier are Wave B.',
    default: false,
    keys: REASONING_WORKLOAD_CLASS_REGISTRY_FLAG_KEYS,
    isEnabled: isReasoningWorkloadClassRegistryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-intent-classifier',
    ticketId: 'V10-RSN-002',
    requirementId: 'R-REASON-2',
    block: 'reasoning',
    title:
      'Intent classifier — 7 intent kinds + low-confidence fallback + latency cap (Wave A seed)',
    description:
      'Pins the shape every request is classified into. Closed ' +
      '7-entry `INTENT_KINDS`, `LOW_CONFIDENCE_THRESHOLD = 0.6`, ' +
      '`LATENCY_CAP_MS = 150`. Pure `classifyIntent` + ' +
      '`applyConfidenceFallback` keep the decision deterministic. ' +
      'Four invariants: `assertIntentInCatalogue`, ' +
      '`assertEveryRequestHasIntent`, ' +
      '`assertLowConfidenceFallbackApplied` (below-threshold ' +
      'decisions must declare fallback), `assertClassificationTimely` ' +
      '(rejects non-finite / over-budget latency at the contract ' +
      'boundary). P90 SLA verification + LLM classifier accuracy ' +
      'harness land in Wave B.',
    default: false,
    keys: REASONING_INTENT_CLASSIFIER_FLAG_KEYS,
    isEnabled: isReasoningIntentClassifierEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-scope-resolver',
    ticketId: 'V10-RSN-003',
    requirementId: 'R-REASON-3',
    block: 'reasoning',
    title:
      'Scope resolver — 3-kind discriminated result + ACL union + no silent orphan refs (Wave A seed)',
    description:
      'Contract for the "what entities / sources / artifacts are ' +
      'in scope" resolver. Closed 3-entry ' +
      '`SCOPE_RESOLUTION_KINDS` (resolved / ambiguous / empty) ' +
      'as a discriminated union. Branded `ScopeId`. Pure ' +
      '`resolveScope` is deterministic; ambiguous results carry ' +
      'a clarification payload. Four invariants: ' +
      '`assertScopeDeterministic` (same input → same output), ' +
      '`assertAmbiguousTriggersClarification` (no ambiguous ' +
      'scope leaks downstream), `assertAclUnionCovers` (every ' +
      'entity ref is ACL-permitted), `assertNoSilentOrphanRefs` ' +
      '(unknown refs fail hard instead of being dropped). ' +
      'Clarification UI + connector ACL integration + ' +
      'fuzzy-match/alias resolution land in Wave B.',
    default: false,
    keys: REASONING_SCOPE_RESOLVER_FLAG_KEYS,
    isEnabled: isReasoningScopeResolverEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-plan-formulator',
    ticketId: 'V10-RSN-004',
    requirementId: 'R-REASON-4',
    block: 'reasoning',
    title:
      'Plan formulator + BudgetV1 attachment — 5 step kinds + multi-step flag + approval barriers (Wave A seed)',
    description:
      'Pins the shape of the execution plan produced after ' +
      'classification + scoping. Closed catalogues: ' +
      '`PLAN_STEP_KINDS` (5), `CHECKPOINT_CADENCES` (2), ' +
      '`PLANNING_WORKLOAD_CLASSES` (4). Branded `PlanId`, ' +
      '`PlanStepId`. Every plan attaches a finite `BudgetV1` ' +
      '(V10-AGT-002). Pure `formulatePlan` is deterministic. ' +
      'Four invariants: `assertMultiStepPlanFlagged` (any plan ' +
      'with >1 step must declare `isMultiStep = true`), ' +
      '`assertPlanHasBudget` (rejects missing/zero budget), ' +
      '`assertPlanStepsNonEmpty` (rejects empty step arrays), ' +
      '`assertApprovalBarriersValid` (barriers reference known ' +
      'steps). Plan UI / Run Ledger budget enforcement / ' +
      'execution-loop checkpoints are Wave B.',
    default: false,
    keys: REASONING_PLAN_FORMULATOR_FLAG_KEYS,
    isEnabled: isReasoningPlanFormulatorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-typed-consent',
    ticketId: 'V10-LRN-001',
    requirementId: 'R-LEARN-1',
    block: 'learning',
    title:
      'Typed consent — scope × state × channel lattice with explicit opt-in default (Wave A seed)',
    description:
      'Opens the learning block seed. Closed `CONSENT_SCOPES` × ' +
      '`CONSENT_STATES` × `DEFAULT_CONSENT_CHANNELS` make ' +
      'consent a typed lattice instead of a boolean. Default ' +
      'state is `denied` (explicit opt-in per GDPR posture). ' +
      'Pure `resolveConsent`, `buildRevokedConsent`, ' +
      '`updateConsentChannel` are deterministic. Invariants: ' +
      '`assertTypedConsent` (structural), `assertNotRevoked` ' +
      '(consumers must check before sampling), ' +
      '`assertConsentGranted`, `isConsentRevoked`. Revocation ' +
      'triggering MemoryPack purge lands in V10-LRN-008 ' +
      '(Wave B store).',
    default: false,
    keys: LEARNING_TYPED_CONSENT_FLAG_KEYS,
    isEnabled: isLearningTypedConsentEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-feedback-signal',
    ticketId: 'V10-LRN-002',
    requirementId: 'R-LEARN-2',
    block: 'learning',
    title:
      '`FeedbackSignalV1` — typed signal envelope + rating bounds + consent-gated (Wave A seed)',
    description:
      'Pins the wire shape for every feedback signal the product ' +
      'collects. Closed `FEEDBACK_KINDS`, `SIGNAL_VALENCES`, ' +
      '`LEARNING_CHANNELS`, `SIGNAL_SUBJECTS`; ' +
      '`RATING_MIN`/`RATING_MAX` bound numeric ratings. Branded ' +
      '`SignalId`. Invariants: `assertFeedbackSignalV1` ' +
      '(structural — every signal carries tenant + user + ' +
      'sessionRef + kind from closed set), ' +
      '`assertSignalHasConsent` (cross-dep on V10-LRN-001 ' +
      '`TypedConsent`), `assertSignalRedacted` (rejects known ' +
      'PII attributes before admission). Full PII redactor + ' +
      'signal persistence store land in Wave B.',
    default: false,
    keys: LEARNING_FEEDBACK_SIGNAL_FLAG_KEYS,
    isEnabled: isLearningFeedbackSignalEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-feedback-collector',
    ticketId: 'V10-LRN-003',
    requirementId: 'R-LEARN-3',
    block: 'learning',
    title:
      'Feedback collector — admission policy + dedup + capacity bounds (Wave A seed)',
    description:
      'Pins the admission contract for `FeedbackSignalV1` before ' +
      'the collector hands signals off to storage. Closed ' +
      '`FEEDBACK_CATEGORIES`, `DEFAULT_COLLECTOR_POLICY`, ' +
      '`AdmissionDecision` discriminated union + ' +
      '`AdmissionRejectionReason`. Pure `admit(signal, policy)`, ' +
      '`isDuplicateSignal`, `countUserSignalsInWindow` are ' +
      'deterministic. Invariants: `assertCollectorPolicy` ' +
      '(structural — capacity/window bounds finite), ' +
      'no-admit-without-consent cross-check with V10-LRN-001, ' +
      'dedup pure helper, capacity-per-window enforcement. ' +
      'Queue flush mechanics + ≤200 ms SLA verification are ' +
      'Wave B.',
    default: false,
    keys: LEARNING_FEEDBACK_COLLECTOR_FLAG_KEYS,
    isEnabled: isLearningFeedbackCollectorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-behavioural-signals',
    ticketId: 'V10-LRN-004',
    requirementId: 'R-LEARN-4',
    block: 'learning',
    title:
      'Behavioural signals — undo/edit thresholds + PII-strip + anonymised session ref on deny (Wave A seed)',
    description:
      'Pins the behavioural-telemetry envelope. Closed ' +
      '`BEHAVIOURAL_EVENT_TYPES`, threshold constants ' +
      '`UNDO_THRESHOLD_MS` / `EDIT_THRESHOLD_MS`, ' +
      '`PII_ATTRIBUTE_KEYS`, `ANON_SESSION_SENTINEL`. Pure ' +
      '`anonymiseSessionRef`, `redactBehaviouralSignal`. ' +
      'Invariants: `assertBehaviouralSignalV1` (structural), ' +
      '`assertUndoWithinThreshold`, `assertEditWithinThreshold`, ' +
      '`assertAnonymisedWhenDenied` (consent=denied → session ' +
      'ref replaced by sentinel), `assertPiiStripped` (no PII ' +
      'key leaks), `assertSessionRefPresent` (stripped events ' +
      'still carry a session ref for activation analysis). ' +
      'Emitter wiring + KPI delta calculation land in Wave B.',
    default: false,
    keys: LEARNING_BEHAVIOURAL_SIGNALS_FLAG_KEYS,
    isEnabled: isLearningBehaviouralSignalsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission',
    ticketId: 'V10-RSR-001',
    requirementId: 'R-RESEARCH-1',
    block: 'research',
    title:
      '`ResearchMissionV1` — 9-state FSM + immutable MissionId + finite budget (Wave A seed)',
    description:
      'Opens the research block seed. Branded `MissionId`. ' +
      'Closed 9-entry `MISSION_STATES`, 4-entry ' +
      '`FRESHNESS_POLICIES`, and `MISSION_STATE_TRANSITIONS` ' +
      'table (15 sanctioned pairs). Shape carries tenant + ' +
      'user + objective + scope + budget + status + createdAt. ' +
      'Invariants: `assertResearchMissionV1` (structural), ' +
      '`assertMissionIdImmutable` (id never mutates between ' +
      'snapshots), `assertMissionStateTransition` (only ' +
      'closed-table transitions allowed), `assertMissionBudget` ' +
      '(finite + non-negative caps). Long-session persistence + ' +
      'phase machine wiring land in Wave B.',
    default: false,
    keys: RESEARCH_MISSION_FLAG_KEYS,
    isEnabled: isResearchMissionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission-scope',
    ticketId: 'V10-RSR-002',
    requirementId: 'R-RESEARCH-2',
    block: 'research',
    title:
      '`MissionScopeV1` — time window + source classes + bounded depth + persona (Wave A seed)',
    description:
      'Pins the scope envelope consumed by the scoping UI. ' +
      'Closed 5-entry `SOURCE_CLASSES`, 3-entry `DEPTH_LEVELS`, ' +
      '4-entry `RESEARCH_PERSONAS`, `MAX_DEPTH = 5`. Invariants: ' +
      '`assertMissionScopeV1` (composite), ' +
      '`assertTimeWindowNonEmpty` (from < to), ' +
      '`assertAtLeastOneSourceClass`, `assertDepthInBounds` ' +
      '(integer 1..5). Pure `depthLevelToNumber` converter. ' +
      'The React scoping wizard UI + objective-suggestion LLM ' +
      'call + scope-diff UI + comparative scope mode are Wave B.',
    default: false,
    keys: RESEARCH_MISSION_SCOPE_FLAG_KEYS,
    isEnabled: isResearchMissionScopeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-retrieval-policy',
    ticketId: 'V10-RSR-003',
    requirementId: 'R-RESEARCH-3',
    block: 'research',
    title:
      'Retrieval policy — 3-tier + immutable tier + maxSources ≥ 1 + open_web admin opt-in (Wave A seed)',
    description:
      'Pins the retrieval-policy contract. Closed 3-entry ' +
      '`RETRIEVAL_POLICIES` (tenant_only / enterprise_search / ' +
      'open_web). Invariants: `assertRetrievalPolicyConfig` ' +
      '(structural), `assertPolicyImmutable` (tier cannot be ' +
      'rewritten — create a new policy), ' +
      '`assertMaxSourcesAtLeastOne` (finite ≥ 1), ' +
      '`assertPolicyNamesUniqueInTenant` (no duplicates), ' +
      '`assertOpenWebRequiresAdminOptIn` (open_web must carry ' +
      'an explicit admin-grant flag). Runtime retrieval fetcher ' +
      '+ freshness checker land in Wave B.',
    default: false,
    keys: RESEARCH_RETRIEVAL_POLICY_FLAG_KEYS,
    isEnabled: isResearchRetrievalPolicyEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-source-allow-block-list',
    ticketId: 'V10-RSR-004',
    requirementId: 'R-RESEARCH-4',
    block: 'research',
    title:
      'Source allow/block list — disjoint lists + block-wins precedence + pure isAllowed (Wave A seed)',
    description:
      'Pins the tenant allow/block model the retrieval layer ' +
      'consults. Closed 3-entry `SOURCE_RULE_KINDS`. Pure ' +
      '`isAllowed(source, list)` is deterministic. Invariants: ' +
      '`assertSourceAllowBlockList` (structural), ' +
      '`assertListsDisjoint` (same pattern+kind cannot be both ' +
      'allowed and blocked), `assertBlockWinsOnConflict` ' +
      '(explicit precedence rule — block overrides allow). ' +
      'Tenant admin UI, CSV import/export, runtime fetch ' +
      'interceptor and wildcard glob matching are Wave B.',
    default: false,
    keys: RESEARCH_SOURCE_ALLOW_BLOCK_LIST_FLAG_KEYS,
    isEnabled: isResearchSourceAllowBlockListEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-connector-interface',
    ticketId: 'V10-CON-001',
    requirementId: 'R-CONNECT-1',
    block: 'connectors',
    title:
      '`Connector` interface — closed kinds + auth kinds + ≥1 capability (Wave A seed)',
    description:
      'Opens the connectors block seed. Branded `ConnectorId`. ' +
      'Closed catalogues: `CONNECTOR_KINDS`, `AUTH_KINDS`, ' +
      '`CAPABILITY_FLAGS`. Every connector declares a ' +
      'non-empty capability set and an auth kind from the ' +
      'closed set. Invariants: `assertConnector` (structural), ' +
      '`assertConnectorHasCapabilities` (≥1 declared), ' +
      '`assertConnectorAuthKind`. OAuth providers, token vault, ' +
      '`ConnectorSession` + ACL/search/read/write/sync/health ' +
      'implementations are Wave B.',
    default: false,
    keys: CONNECTORS_CONNECTOR_INTERFACE_FLAG_KEYS,
    isEnabled: isConnectorsConnectorInterfaceEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-registry',
    ticketId: 'V10-CON-002',
    requirementId: 'R-CONNECT-2',
    block: 'connectors',
    title:
      'Connector registry — per-tenant + no-duplicate-id + capability declarations (Wave A seed)',
    description:
      'Tenant-scoped `ConnectorRegistry`. Pure ' +
      '`resolveCapability(registry, kind)`, `resolveConnectorById`, ' +
      '`registerConnector` (throws on duplicate id). Invariants: ' +
      '`assertConnectorRegistry` (structural + no-duplicate-id + ' +
      'enabled-id cross-ref), `assertRegistryCapabilityDeclarations` ' +
      '(typed capabilities only — no ghost capabilities). ' +
      'Governance UI enable/disable per-tenant + connector ' +
      'telemetry + OAuth session lifecycle are Wave B.',
    default: false,
    keys: CONNECTORS_REGISTRY_FLAG_KEYS,
    isEnabled: isConnectorsRegistryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-signal',
    ticketId: 'V10-OUT-001',
    requirementId: 'R-OUTCOME-1',
    block: 'outcome',
    title:
      '`OutcomeSignalV1` — closed kinds + finite magnitude + evidence ref (Wave A seed)',
    description:
      'Opens the outcome block seed. Branded `OutcomeSignalId`. ' +
      'Closed catalogues: `OUTCOME_SOURCES`, `OUTCOME_KINDS`, ' +
      '`MAGNITUDE_UNITS`, `CONFIDENCE_LEVELS`. Every signal ' +
      'carries tenant + user + sessionRef + evidence + ' +
      'magnitude with a unit from the closed set. Invariants: ' +
      '`assertOutcomeSignalV1` (structural), ' +
      '`assertSignalKindClosed` (kind in `OUTCOME_KINDS`), ' +
      '`assertSignalMagnitudeFinite` (finite, non-negative). ' +
      'Attribution policy + dedup guard + signal emitters / ' +
      'event bus are Wave B.',
    default: false,
    keys: OUTCOME_SIGNAL_FLAG_KEYS,
    isEnabled: isOutcomeSignalEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-record',
    ticketId: 'V10-OUT-002',
    requirementId: 'R-OUTCOME-2',
    block: 'outcome',
    title:
      '`OutcomeRecordV1` — ≥1 signal + closed state FSM + attribution pinned (Wave A seed)',
    description:
      'Aggregates one or more `OutcomeSignalV1` into a tenant ' +
      'outcome record. Branded `OutcomeRecordId`. Closed 4-entry ' +
      '`RECORD_STATES` + `ALLOWED_TRANSITIONS` table (proposed ' +
      '→ confirmed/reversed; confirmed → reversed/redacted; ' +
      'reversed → redacted). Pure `applyStateTransition`. ' +
      'Invariants: `assertOutcomeRecordV1` (structural), ' +
      '`assertRecordHasSignals` (≥1 signal), ' +
      '`assertStateTransitionAllowed` (closed FSM), ' +
      '`assertRecordAttributionPinned` (method non-empty, ' +
      'fraction ∈ [0, 1]). Double-count guard + revert event ' +
      'emission + admin override/redaction with audit trail + ' +
      'ROI dashboard land in Wave B.',
    default: false,
    keys: OUTCOME_RECORD_FLAG_KEYS,
    isEnabled: isOutcomeRecordEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-tool-call-registry',
    ticketId: 'V10-RSN-005',
    requirementId: 'R-REASON-5',
    block: 'reasoning',
    title:
      'Tool-call registry — closed kinds + ACL + no-duplicate-id + side-effect class (Wave A seed)',
    description:
      'Pins the registry every agent/reasoning tool call consults. ' +
      'Closed `TOOL_CALL_KINDS` (7), `SIDE_EFFECT_CLASSES` (3), ' +
      '`SEVERITY_LEVELS` (4). Branded `ToolCallId`. Pure ' +
      '`resolveTool(registry, kind)` + `buildToolCallRegistry`. ' +
      'Invariants: `assertToolCallDescriptor` (structural), ' +
      '`assertToolRegistered` (kind ∈ catalogue), ' +
      '`assertToolAclSatisfied` (callers prove scope match), ' +
      '`assertNoDuplicateToolIds`. Runtime HTTP adapters + OTel ' +
      'span emission + retry policy per severity are Wave B.',
    default: false,
    keys: REASONING_TOOL_CALL_REGISTRY_FLAG_KEYS,
    isEnabled: isReasoningToolCallRegistryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-retrieval-layer',
    ticketId: 'V10-RSN-006',
    requirementId: 'R-REASON-6',
    block: 'reasoning',
    title:
      'Retrieval layer — 4 strategies × 3 policies, ACL-safe + fallback declared (Wave A seed)',
    description:
      'Retrieval contract that feeds the reasoning loop with ' +
      'tenant-scoped context. Closed `RETRIEVAL_STRATEGIES` (4), ' +
      '`RETRIEVAL_POLICIES` (3), `SOURCE_ORIGINS` (3). Pure ' +
      '`filterSourcesByPolicy`, `rankSources`. Invariants: ' +
      '`assertRetrievalResultAclSafe`, `assertPrivateOnlyPolicy` ' +
      '(rejects external origins), `assertMaxSourcesBound`, ' +
      '`assertFallbackDeclared`. ArtifactStore + Connector + ' +
      'research federations come in Wave B.',
    default: false,
    keys: REASONING_RETRIEVAL_LAYER_FLAG_KEYS,
    isEnabled: isReasoningRetrievalLayerEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-execution-loop',
    ticketId: 'V10-RSN-007',
    requirementId: 'R-REASON-7',
    block: 'reasoning',
    title:
      'Execution loop + checkpoints — 6-state FSM + monotonic budget + no-cycle checkpoint graph (Wave A seed)',
    description:
      'Pins the loop state machine that carries a plan through ' +
      'tool / retrieval / synthesis steps with resumable ' +
      'checkpoints. Closed `LOOP_STATES` (6), `LOOP_EVENTS` (6), ' +
      '`CHECKPOINT_KINDS` (4); `LOOP_TRANSITIONS` closed table. ' +
      'Pure `advanceLoop(state, event, { now, totalSteps })`. ' +
      'Invariants: `assertEveryStepHasCheckpoint`, ' +
      '`assertResumeIsIdempotent`, `assertBudgetMonotonic` ' +
      '(burns only down), `assertNoCycleInCheckpoints`. ' +
      'Real LLM/tool invocation, Run Ledger persistence, and ' +
      'interrupt-handler integration (V10-AGT-024) are Wave B.',
    default: false,
    keys: REASONING_EXECUTION_LOOP_FLAG_KEYS,
    isEnabled: isReasoningExecutionLoopEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-claim-extraction',
    ticketId: 'V10-RSN-008',
    requirementId: 'R-REASON-8',
    block: 'reasoning',
    title:
      'Claim extraction — 4 claim kinds + source-refs required + one plan step per claim (Wave A seed)',
    description:
      'Pins the envelope for claims extracted from model output. ' +
      'Closed `CLAIM_KINDS` (4: fact / opinion / instruction / ' +
      'recommendation). Branded `ClaimId`. Pure ' +
      '`filterFactualClaims`, `groupClaimsByStep`. Invariants: ' +
      '`assertClaimHasSourceRefs` (factual claims carry ≥1 ' +
      'source), `assertClaimAttributable` (exactly one plan ' +
      'step per claim), `assertNoOrphanClaims`, ' +
      '`assertNonFactualNotRequiresCitation` (opinion/ ' +
      'instruction/recommendation can ship without citation). ' +
      'Structured-output LLM extractor + citation binder ' +
      '(V10-RSN-009) are Wave B.',
    default: false,
    keys: REASONING_CLAIM_EXTRACTION_FLAG_KEYS,
    isEnabled: isReasoningClaimExtractionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-outcome-signals',
    ticketId: 'V10-LRN-005',
    requirementId: 'R-LEARN-5',
    block: 'learning',
    title:
      'Learning outcome observation — wraps OutcomeSignalV1 with weight + decay + context (Wave A seed)',
    description:
      'Learning-side wrapper around outcome-block ' +
      '`OutcomeSignalV1` (V10-OUT-001) so the learner consumes ' +
      'outcomes with an explicit weight, decay factor, and ' +
      'observation context. Closed `OBSERVATION_CONTEXTS` (4: ' +
      'routing / quality / coverage / connector), ' +
      '`OBSERVATION_EFFECTS` (3), `OUTCOME_LEARNING_MAP` ' +
      '(7-entry rule table). Invariants: weight ∈ [0,1], ' +
      'decayFactor ∈ (0,1], ' +
      '`assertOutcomeConsentGranted` (cross-dep on ' +
      'V10-LRN-001 `outcome` channel), closed catalogues. Pack ' +
      'reinforcement loop lands in V10-LRN-009.',
    default: false,
    keys: LEARNING_OUTCOME_SIGNALS_FLAG_KEYS,
    isEnabled: isLearningOutcomeSignalsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-memory-pack',
    ticketId: 'V10-LRN-006',
    requirementId: 'R-LEARN-6',
    block: 'learning',
    title:
      '`MemoryPackV1` — 6 scopes × 3 kinds + 32 KB size cap + provenance + PII deny (Wave A seed)',
    description:
      'Pins the tenant-scoped memory envelope. Branded ' +
      '`MemoryPackId`. Closed `PACK_SCOPES` (6) × `PACK_KINDS` ' +
      '(3). Hard caps `MAX_PACK_SIZE_BYTES` (32 KB), ' +
      '`MAX_PROVENANCE_ENTRIES` (256). Pure `bumpPackVersion` ' +
      '(monotonic), `dropOldestProvenance` (FIFO trim). ' +
      'Invariants: `assertMemoryPackV1` (structural — ttlAt ≥ ' +
      'createdAt, version ≥ 1), `assertPackSizeBounded`, ' +
      '`assertNoPackPii` (denies known PII attribute keys). ' +
      'Persistence + store eviction land in Wave B.',
    default: false,
    keys: LEARNING_MEMORY_PACK_FLAG_KEYS,
    isEnabled: isLearningMemoryPackEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-ttl-forgetting',
    ticketId: 'V10-LRN-007',
    requirementId: 'R-LEARN-7',
    block: 'learning',
    title:
      'TTL + forgetting — per-scope defaults/floors, 180 d backstop, deterministic shouldForget (Wave A seed)',
    description:
      'Pins the retention contract for memory packs. Constants ' +
      '`TTL_30_DAYS_MS` / `TTL_60_DAYS_MS` / `TTL_90_DAYS_MS`, ' +
      '`MAX_PACK_TTL_MS` (180 d), per-scope ' +
      '`DEFAULT_TTL_MS` + `TTL_FLOORS_MS` tables. Pure ' +
      '`computeRetentionCutoff`, `shouldForget(pack, now, ' +
      'policy)`, `extendTtl` (capped at 180 d). Invariants: ' +
      '`assertTtlValid` (finite + positive + ≤ 180 d), ' +
      '`assertTtlMeetsFloor` (per-scope minimum). Eviction ' +
      'scheduler + read-path integration land in Wave B.',
    default: false,
    keys: LEARNING_TTL_FORGETTING_FLAG_KEYS,
    isEnabled: isLearningTtlForgettingEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-revocation',
    ticketId: 'V10-LRN-008',
    requirementId: 'R-LEARN-8',
    block: 'learning',
    title:
      'Revocation — admin/user scopes + 24h admin halt-ingest + deterministic purge set + no-leak (Wave A seed)',
    description:
      'Pins the revocation contract that flows from TypedConsent ' +
      'to MemoryPack purge. Branded `RevocationId`. Closed ' +
      '`REVOCATION_SCOPES` (user / admin), `REVOCATION_REASONS` ' +
      '(5). `ADMIN_HALT_INGEST_MS` = 24 h. Pure ' +
      '`computePurgeSet(packs, revocation)` (admin → all tenant ' +
      'packs; user → user-owned only), `buildHaltIngestUntil`. ' +
      'Invariants: `assertRevocationEvent` (admin scope requires ' +
      'halt-ingest window), `assertNoPurgedPackResurrected` ' +
      '(no-leak). Audit emission (V10-LRN-017) + store purge ' +
      'wiring land in Wave B.',
    default: false,
    keys: LEARNING_REVOCATION_FLAG_KEYS,
    isEnabled: isLearningRevocationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission-plan-formulator',
    ticketId: 'V10-RSR-005',
    requirementId: 'R-RESEARCH-5',
    block: 'research',
    title:
      'Mission plan formulator — 6 research step kinds + deterministic ids + budget mirror (Wave A seed)',
    description:
      'Formulates a research mission plan from (mission, scope, ' +
      'policy). Branded `PlanId`. Closed 6-entry ' +
      '`PLAN_STEP_KINDS` (retrieve / extract / dedup / ' +
      'graph_update / synthesise / validate). Pure ' +
      '`formulateMissionPlan` — step/plan ids derived ' +
      'deterministically from mission + objective ids + now. ' +
      'Invariants: `assertMissionPlanV1` (structural), ' +
      '`assertPlanHasSteps` (≥ 1), ' +
      '`assertStepsReferenceMission` (all steps carry the same ' +
      'missionId), `assertPlanBudgetMatchesMission`. LLM-driven ' +
      'objective expansion is Wave B.',
    default: false,
    keys: RESEARCH_MISSION_PLAN_FORMULATOR_FLAG_KEYS,
    isEnabled: isResearchMissionPlanFormulatorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission-budget',
    ticketId: 'V10-RSR-006',
    requirementId: 'R-RESEARCH-6',
    block: 'research',
    title:
      '`MissionBudgetV1` — 4 cost kinds + monotonic burn + assertNotOverCap at boundary (Wave A seed)',
    description:
      'Canonical full mission-budget contract. Closed 4-entry ' +
      '`COST_KINDS` (model_tokens / fetch_bytes / wallclock_ms ' +
      '/ vendor_cost_usd). Pure `burnBudget` (monotonic), ' +
      '`isOverCap`, factory `makeMissionBudgetV1`. Invariants: ' +
      '`assertMissionBudgetV1` (every cap finite + positive), ' +
      '`assertBurnMonotonic` (burn cannot decrease), ' +
      '`assertNotOverCap` (fires at `burned >= limit`). Keeps ' +
      'the embedded `MissionBudget` in `ResearchMissionV1` ' +
      'untouched — this is the standalone authoritative module.',
    default: false,
    keys: RESEARCH_MISSION_BUDGET_FLAG_KEYS,
    isEnabled: isResearchMissionBudgetEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-executor',
    ticketId: 'V10-RSR-007',
    requirementId: 'R-RESEARCH-7',
    block: 'research',
    title:
      'Research executor — 6-state FSM + pause/resume budget snapshot + every terminal reachable (Wave A seed)',
    description:
      'State machine over mission-plan execution. Branded ' +
      '`ExecutorRunId`. Closed `EXECUTOR_STATES` (6: pending / ' +
      'running / suspended / completed / failed / cancelled), ' +
      '`EXECUTOR_EVENTS` (6), `EXECUTOR_TRANSITIONS` table, ' +
      '`EXECUTOR_TERMINAL_STATES`. Pure `advanceExecutor`. ' +
      'Invariants: `assertExecutorTransition` (only sanctioned ' +
      '(state, event) pairs), `assertResearchExecutorState` ' +
      '(structural), every terminal reachable from running ' +
      '(verified by transition table), pause captures ' +
      '`BudgetSnapshot` and resume restores it unchanged. ' +
      'QueueExecutor wiring + Run Ledger persistence are ' +
      'Wave B.',
    default: false,
    keys: RESEARCH_EXECUTOR_FLAG_KEYS,
    isEnabled: isResearchExecutorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-source-fetcher',
    ticketId: 'V10-RSR-008',
    requirementId: 'R-RESEARCH-8',
    block: 'research',
    title:
      'Source fetcher contract — allow/block list gate + bounded retries + timeout cap + private_only gate (Wave A seed)',
    description:
      'Shape for every outbound fetch issued by the research ' +
      'executor. Branded `FetchRequestId`. Closed 3-entry ' +
      '`FETCH_METHODS` (GET / POST / HEAD). Hard caps ' +
      '`MAX_RETRY_ATTEMPTS` (10), `MAX_TIMEOUT_MS` (300 000). ' +
      'Invariants: `assertFetchRequest` (structural), ' +
      '`assertSourcePassesAllowBlockList` (cross-call to ' +
      'V10-RSR-004 `isAllowed`), `assertPolicyAllowsFetch` ' +
      '(private_only policy never fetches external http/https). ' +
      'Concrete adapters (workspace / connector / curated web) ' +
      '+ rate limiting land in Wave B.',
    default: false,
    keys: RESEARCH_SOURCE_FETCHER_FLAG_KEYS,
    isEnabled: isResearchSourceFetcherEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-oauth-layer',
    ticketId: 'V10-CON-003',
    requirementId: 'R-CONNECT-3',
    block: 'connectors',
    title:
      'OAuth layer — 3 flow kinds + PKCE gate + state+nonce + no-plaintext-token in config (Wave A seed)',
    description:
      'OAuth contract shape. Closed `OAUTH_FLOW_KINDS` (3: ' +
      'authorization_code / client_credentials / device_code), ' +
      '`OAUTH_GRANT_TYPES` (4), `PKCE_CHALLENGE_METHODS` (2), ' +
      '`CLIENT_TYPES` (2). Pure `buildScopeString`. Invariants: ' +
      '`assertOAuthConfig` (structural), ' +
      '`assertOAuthFlowSecured` (state + nonce + PKCE on ' +
      'public authorization_code clients), ' +
      '`assertNoPlaintextTokenInConfig` (tokens live only in ' +
      'the vault, configs carry refs), ' +
      '`assertScopeEnvelopeNonEmpty` (≥ 1 read scope). ' +
      'Runtime WebCrypto flow + callback exchange are Wave B.',
    default: false,
    keys: CONNECTORS_OAUTH_LAYER_FLAG_KEYS,
    isEnabled: isConnectorsOAuthLayerEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-token-vault',
    ticketId: 'V10-CON-004',
    requirementId: 'R-CONNECT-4',
    block: 'connectors',
    title:
      'Token vault — opaque VaultKeyRef + tenant isolation + expiry + finite rotation (Wave A seed)',
    description:
      'Vault envelope. Branded opaque `VaultKeyRef`. Closed ' +
      '`VAULT_ENTRY_STATES` (3). Pure `isExpired(entry, now)` / ' +
      '`isExpiredRef(ref, expiresAt, now)`. Invariants: ' +
      '`assertVaultEntry` (structural), ' +
      '`assertRotationScheduleFinite` (positive interval, ' +
      'maxRotations bounded), ' +
      '`assertNoPlaintextTokenInEntry` (entries carry only ' +
      'refs), `assertSameTenant` (cross-tenant ref is a hard ' +
      'error). KMS-backed encryption + refresh/revocation ' +
      '(V10-CON-005) are Wave B.',
    default: false,
    keys: CONNECTORS_TOKEN_VAULT_FLAG_KEYS,
    isEnabled: isConnectorsTokenVaultEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-taxonomy',
    ticketId: 'V10-OUT-003',
    requirementId: 'R-OUTCOME-3',
    block: 'outcome',
    title:
      'Outcome taxonomy — acyclic tree + every OUTCOME_KIND → exactly one leaf (Wave A seed)',
    description:
      'Hierarchical taxonomy (tree) over outcome categories. ' +
      'Branded `TaxonomyNodeId`. Closed `TAXONOMY_NODE_KINDS` ' +
      '(2). Pure `resolveKindToNode(kind, taxonomy)`, ' +
      '`buildDefaultTaxonomy` (12-node tree). Invariants: ' +
      '`assertTaxonomyAcyclic`, `assertTaxonomyNodeIdsUnique`, ' +
      '`assertNoOrphanNodes`, `assertAllKindsMapped` (every ' +
      '`OUTCOME_KIND` resolves to exactly one leaf), ' +
      '`assertTaxonomyContainsKind`. Admin taxonomy editor + ' +
      'versioning / migration are Wave B.',
    default: false,
    keys: OUTCOME_TAXONOMY_FLAG_KEYS,
    isEnabled: isOutcomeTaxonomyEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-attribution-policy',
    ticketId: 'V10-OUT-004',
    requirementId: 'R-OUTCOME-4',
    block: 'outcome',
    title:
      '`AttributionPolicyV1` — 4 methods + weights sum to 1 + conservative-by-default (Wave A seed)',
    description:
      'Branded `AttributionPolicyId`. Closed `ATTRIBUTION_METHODS` ' +
      '(4: first_touch / last_touch / even_split / ' +
      'custom_weighted), `DOUBLE_COUNT_POLICIES` (2). Pure ' +
      '`computeAttribution(signals, policy)` — deterministic ' +
      'across all four method branches. Invariants: ' +
      '`assertAttributionMethodClosed`, ' +
      '`assertWeightsSumToOne` (ε = 0.001 for custom_weighted), ' +
      '`assertSignalsNonEmpty`, `assertPolicyConservative` ' +
      '(`conservativeByDefault === true` — double-count guard ' +
      'leans to safer side). Passive decay scheduler + admin ' +
      'audit (V10-OUT-020) are Wave B.',
    default: false,
    keys: OUTCOME_ATTRIBUTION_POLICY_FLAG_KEYS,
    isEnabled: isOutcomeAttributionPolicyEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-citation-binder',
    ticketId: 'V10-RSN-009',
    requirementId: 'R-REASON-9',
    block: 'reasoning',
    title:
      'Citation binder — 4 styles + every factual claim cited + deterministic binding ids (Wave A seed)',
    description:
      'Binds factual `Claim` objects to citation spans with ' +
      'source refs. Closed 4-entry `CITATION_STYLES` ' +
      '(inline / footnote / endnote / parenthetical). Branded ' +
      '`CitationId` — deterministically derived as ' +
      '`cit_<claimId>_<sourceId>`. Pure `bindCitations(claims, ' +
      'sources, style)`. Invariants: ' +
      '`assertEveryFactualClaimHasCitation`, ' +
      '`assertNoBindingWithUnknownSource`, `assertCitationStyle`, ' +
      '`assertCitationBinding`. LLM-based anchoring + UI ' +
      'footnote renderer are Wave B.',
    default: false,
    keys: REASONING_CITATION_BINDER_FLAG_KEYS,
    isEnabled: isReasoningCitationBinderEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-evidence-coverage-scorer',
    ticketId: 'V10-RSN-010',
    requirementId: 'R-REASON-10',
    block: 'reasoning',
    title:
      'Evidence coverage scorer — 3-level catalogue, score ∈ [0,1], zero↔no-citations bijection (Wave A seed)',
    description:
      'Scores how much of the factual-claim set is backed by ' +
      'citations. Closed 3-entry `COVERAGE_LEVELS` ' +
      '(none / partial / full). Branded `CoverageReportId`. ' +
      'Pure `scoreCoverage(claims, citations)` — counts only ' +
      '`kind === "fact"` claims; `score = covered/total` (0 ' +
      'when total = 0). Invariants: `assertScoreInRange`, ' +
      '`assertAllFactualClaimsCounted`, ' +
      '`assertZeroScoreIffNoCitations`, ' +
      '`assertFullScoreIffAllCovered`. Threshold policy ' +
      'enforcement + per-claim evidence-gap report are Wave B.',
    default: false,
    keys: REASONING_EVIDENCE_COVERAGE_SCORER_FLAG_KEYS,
    isEnabled: isReasoningEvidenceCoverageScorerEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-hedging-calibration',
    ticketId: 'V10-RSN-011',
    requirementId: 'R-REASON-11',
    block: 'reasoning',
    title:
      'Hedging calibration — 12-entry closed (HEDGING_LEVELS × COVERAGE_BUCKETS) table (Wave A seed)',
    description:
      'Maps (coverage score, hedging level) → hedging decision ' +
      'via a closed 12-entry table. Closed 4-entry ' +
      '`HEDGING_DECISIONS` (assert / qualify / hedge / ' +
      'disclaim), closed 3-entry `COVERAGE_BUCKETS` (high ≥ ' +
      '0.7 / medium ≥ 0.3 / low). `CALIBRATION_TABLE` pins ' +
      'every `HEDGING_LEVELS` × `COVERAGE_BUCKETS` cell. Pure ' +
      '`calibrateHedging(score, level)`. Invariants: ' +
      '`assertCalibrationTableComplete`, ' +
      '`assertKnownHedgingLevel`, `assertHedgingDecision`, ' +
      '`assertScoreForCalibration`. Dynamic thresholds + ' +
      'personalised profiles are Wave B.',
    default: false,
    keys: REASONING_HEDGING_CALIBRATION_FLAG_KEYS,
    isEnabled: isReasoningHedgingCalibrationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-hallucination-filter',
    ticketId: 'V10-RSN-012',
    requirementId: 'R-REASON-12',
    block: 'reasoning',
    title:
      'Hallucination filter — 3 actions × 3 policies, opinions/recs kept, uncited facts stripped/flagged (Wave A seed)',
    description:
      'Filters claims lacking citation evidence according to a ' +
      'policy. Closed 3-entry `FILTER_ACTIONS` (keep / strip / ' +
      'flag), closed 3-entry `FILTER_POLICIES` (strict / ' +
      'lenient / audit). Branded `FilterResultId`. Pure ' +
      '`filterHallucinations(claims, citations, policy)` — ' +
      'opinion/recommendation always `keep`; uncited facts ' +
      '`strip` (strict) or `flag` (lenient/audit); instructions ' +
      '`flag` in audit only. Invariants: ' +
      '`assertFactualClaimsWithoutCitationAreFiltered`, ' +
      '`assertOpinionRecommendationAlwaysKept`, ' +
      '`assertFilterAction`, `assertFilterResult`. LLM grounding ' +
      'verifier + automatic policy from workload class are ' +
      'Wave B.',
    default: false,
    keys: REASONING_HALLUCINATION_FILTER_FLAG_KEYS,
    isEnabled: isReasoningHallucinationFilterEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-routing-adjustment',
    ticketId: 'V10-LRN-009',
    requirementId: 'R-LEARN-9',
    block: 'learning',
    title:
      'Routing adjustment — bounded weight delta ∈ [-0.5, +0.5], ignores neutral obs (Wave A seed)',
    description:
      'Consumes `LearningOutcomeObservation`s (V10-LRN-005) + ' +
      '`MemoryPackV1` (V10-LRN-006) and emits a workload-class ' +
      'routing adjustment. Branded `RoutingAdjustmentId`. ' +
      'Closed `ADJUSTMENT_KINDS` (promote / demote / neutral). ' +
      'Hard bound `MAX_WEIGHT_DELTA = 0.5`. Pure ' +
      '`computeRoutingAdjustment(observations, pack, workloadClass, id, now)`. ' +
      'Invariants: `assertRoutingAdjustment` — weight delta ' +
      'clamped to [-0.5, +0.5]; kind derived deterministically ' +
      'from delta sign; ignores neutral-effect + non-routing ' +
      'observations; workload class ∈ `WORKLOAD_CLASSES`. ' +
      'Live online A/B test + router write path are Wave B.',
    default: false,
    keys: LEARNING_ROUTING_ADJUSTMENT_FLAG_KEYS,
    isEnabled: isLearningRoutingAdjustmentEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-pii-redaction',
    ticketId: 'V10-LRN-010',
    requirementId: 'R-LEARN-10',
    block: 'learning',
    title:
      'PII redaction — 5 categories × 3 actions + no-leak invariant + deterministic regex (Wave A seed)',
    description:
      'Pins the redaction contract for every string that can ' +
      'end up in a memory pack or telemetry payload. Closed ' +
      '`PII_CATEGORIES` (email / phone / ssn / name / address), ' +
      '`REDACTION_ACTIONS` (mask / remove / hash). ' +
      '`DEFAULT_REDACTION_POLICY` pins per-category default ' +
      'action. Pure `redactPii(input, policy)` — deterministic ' +
      'regex detection, overlap resolution, three replacement ' +
      'strategies. Invariants: `assertNoPiiLeak` — a redacted ' +
      'output re-scanned yields zero matches. Learning-side ' +
      '(V10-LRN-012 telemetry) cross-imports this module. ' +
      'ML-based entity detection is Wave B.',
    default: false,
    keys: LEARNING_PII_REDACTION_FLAG_KEYS,
    isEnabled: isLearningPiiRedactionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-never-override-invariants',
    ticketId: 'V10-LRN-011',
    requirementId: 'R-LEARN-11',
    block: 'learning',
    title:
      'Never-override invariants — 4 protected kinds (safety/compliance/privacy/tenant_isolation) as hard floor (Wave A seed)',
    description:
      'Lists the invariant kinds that learning-driven ' +
      'adjustments (V10-LRN-009 and onward) can NEVER override. ' +
      'Closed 4-entry `PROTECTED_INVARIANT_KINDS` (safety / ' +
      'compliance / privacy / tenant_isolation). Shapes: ' +
      '`ProtectedInvariant`, `AdjustmentTarget`. Pure ' +
      '`assertAdjustmentRespectsInvariants(target, list)` — ' +
      'rejects any adjustment whose target is a protected kind. ' +
      '`assertProtectedInvariantList` (non-empty + closed). ' +
      '`buildDefaultProtectedList()` factory. Runtime wiring to ' +
      'every learning reducer is Wave B.',
    default: false,
    keys: LEARNING_NEVER_OVERRIDE_INVARIANTS_FLAG_KEYS,
    isEnabled: isLearningNeverOverrideInvariantsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-telemetry',
    ticketId: 'V10-LRN-012',
    requirementId: 'R-LEARN-12',
    block: 'learning',
    title:
      'Learning telemetry — 8 closed event kinds + tenantId/consentRef mandatory + PII deny cross-check (Wave A seed)',
    description:
      'Pins the telemetry event envelope every learning reducer ' +
      'emits. Closed 8-entry `LEARNING_EVENTS` (signal ingest, ' +
      'pack write, revocation, adjustment applied, ttl purge, ' +
      'consent change, never-override rejection, telemetry ' +
      'emitted). `TelemetryPayload` carries `tenantId` + ' +
      'optional `consentRef`. `TELEMETRY_PII_DENY_KEYS` = ' +
      'union of PII categories (V10-LRN-010) + MemoryPack deny ' +
      'keys (V10-LRN-006). Pure ' +
      '`buildLearningTelemetryEvent(kind, payload, now, id)`. ' +
      'Invariants: `assertPayloadNoPii`, `assertTelemetryEvent`. ' +
      'OTel span emission + admin dashboard are Wave B.',
    default: false,
    keys: LEARNING_TELEMETRY_FLAG_KEYS,
    isEnabled: isLearningTelemetryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-curated-web-source-provider',
    ticketId: 'V10-RSR-009',
    requirementId: 'R-RESEARCH-9',
    block: 'research',
    title:
      'Curated web source provider — 3-tier catalogue + allow-list ref + deterministic enumeration (Wave A seed)',
    description:
      'Contract for a curated-source provider (names a set of ' +
      'trusted domains per mission scope). Branded ' +
      '`SourceProviderId`. Closed `PROVIDER_TIERS` (gold / ' +
      'silver / bronze). `CuratedWebSourceProvider` carries ' +
      '`allowBlockListId` ref → V10-RSR-004. Pure ' +
      '`enumerateSources(provider, list)` — deterministic, ' +
      'filters domains through `isAllowed`. Invariants: ' +
      '`assertCuratedWebSourceProvider`. Concrete provider ' +
      'registry + domain ingest pipeline are Wave B.',
    default: false,
    keys: RESEARCH_CURATED_WEB_SOURCE_PROVIDER_FLAG_KEYS,
    isEnabled: isResearchCuratedWebSourceProviderEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-content-extractor',
    ticketId: 'V10-RSR-010',
    requirementId: 'R-RESEARCH-10',
    block: 'research',
    title:
      'Content extractor — 4 content kinds + char-offset spans consistent with text slice (Wave A seed)',
    description:
      'Pure HTML/doc → structured text reducer. Branded ' +
      '`ExtractedContentId`. Closed `CONTENT_KINDS` (html / ' +
      'pdf / markdown / text). `TextSpan` carries char offsets; ' +
      '`ExtractedContent` binds `sourceRef` + spans + ' +
      '`charCount`. Pure `extractContent(raw, kind, opts)` — ' +
      'HTML tag-stripping, Markdown syntax removal, whitespace ' +
      'normalisation, paragraph span builder. Invariants: ' +
      '`assertExtractedContent` — `span.start ≤ span.end`, ' +
      '`span.text === text.slice(start, end)`. PDF binary ' +
      'adapter + vendor OCR integration are Wave B.',
    default: false,
    keys: RESEARCH_CONTENT_EXTRACTOR_FLAG_KEYS,
    isEnabled: isResearchContentExtractorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-dedup-near-duplicate',
    ticketId: 'V10-RSR-011',
    requirementId: 'R-RESEARCH-11',
    block: 'research',
    title:
      'Dedup + near-duplicate — 3 strategies, first-occurrence order, Jaccard shingles (Wave A seed)',
    description:
      'Deduplication reducer over `ExtractedContent`. Closed ' +
      '`DEDUP_STRATEGIES` (exact_url / content_hash / ' +
      'shingle_similarity). Pure `dedup(contents, strategy, ' +
      'threshold)`. Invariants: first-occurrence ordering ' +
      'preserved; threshold ∈ [0, 1] for similarity strategy; ' +
      'strategy from closed catalogue; deterministic given ' +
      '(contents, strategy, threshold). Cluster provenance ' +
      'preserved in `DedupResult`. Jaccard character-shingle ' +
      'similarity for near-dup. Persistent pairwise cache is ' +
      'Wave B.',
    default: false,
    keys: RESEARCH_DEDUP_NEAR_DUPLICATE_FLAG_KEYS,
    isEnabled: isResearchDedupNearDuplicateEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-evidence-graph',
    ticketId: 'V10-RSR-012',
    requirementId: 'R-RESEARCH-12',
    block: 'research',
    title:
      '`EvidenceGraphV1` — DAG over source/claim/extract/citation nodes + edge catalogue (Wave A seed)',
    description:
      'Pins the evidence-graph contract that binds sources → ' +
      'extracts → claims → citations. Branded ' +
      '`EvidenceGraphId`, `EvidenceNodeId`. Closed ' +
      '`EVIDENCE_NODE_KINDS` (source / claim / extract / ' +
      'citation), `EDGE_KINDS` (supports / contradicts / ' +
      'derives_from). Pure `buildEvidenceGraph(...)`, ' +
      '`assertEvidenceGraphAcyclic` (Kahn BFS topological ' +
      'sort — rejects cycles including self-loops). Invariants: ' +
      'DAG; every edge references existing nodes; every edge ' +
      'kind ∈ `EDGE_KINDS`. Graph persistence + Neo4j adapter ' +
      'are Wave B.',
    default: false,
    keys: RESEARCH_EVIDENCE_GRAPH_FLAG_KEYS,
    isEnabled: isResearchEvidenceGraphEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-token-refresh-revocation',
    ticketId: 'V10-CON-005',
    requirementId: 'R-CONNECT-5',
    block: 'connectors',
    title:
      'Token refresh + revocation — monotonic expiry, no-resurrection, cross-tenant hard error (Wave A seed)',
    description:
      'Event shapes for vault refresh + revoke. Branded ' +
      '`RefreshEventId` / `RevocationEventId`. Closed ' +
      '`REFRESH_OUTCOMES` (success / retry / failed_permanent ' +
      '/ revoked_by_provider), `REVOCATION_SOURCES` (user / ' +
      'admin / provider / expiry). Pure `applyRefreshEvent` — ' +
      'monotonic expiry; terminal-state guard. ' +
      '`applyRevocationEvent` — terminal, no resurrection. ' +
      '`assertRefreshEvent` + `assertRevocationEvent`. ' +
      'Invariants: only `active` vault entries can refresh; ' +
      'expiry only moves forward; revocation is terminal; ' +
      'cross-tenant refresh/revoke is a hard error. ' +
      'Concrete IdP integrations + scheduled refresh worker ' +
      'are Wave B.',
    default: false,
    keys: CONNECTORS_TOKEN_REFRESH_REVOCATION_FLAG_KEYS,
    isEnabled: isConnectorsTokenRefreshRevocationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-session',
    ticketId: 'V10-CON-006',
    requirementId: 'R-CONNECT-6',
    block: 'connectors',
    title:
      '`ConnectorSession` — 4-state FSM + tenant-scoped + terminal states never transition (Wave A seed)',
    description:
      'Session envelope pinning connector + vault + user + ' +
      'tenant for the duration of a task. Branded ' +
      '`ConnectorSessionId`. Closed `SESSION_STATES` (pending / ' +
      'active / expired / revoked), `SESSION_EVENTS` (4). ' +
      '`SESSION_TRANSITIONS` closed table. Pure ' +
      '`advanceSession(state, event, now)` — unknown event, ' +
      'terminal state, and missing transition all throw. ' +
      'Invariants: tenant-scoped; references a valid vault ' +
      'ref; expiry from closed policy; terminal (expired / ' +
      'revoked) cannot transition. `assertSessionTenant`, ' +
      '`assertSessionNotExpired`. Cookie + SSR adapters land ' +
      'in Wave B.',
    default: false,
    keys: CONNECTORS_SESSION_FLAG_KEYS,
    isEnabled: isConnectorsSessionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-lineage-binding',
    ticketId: 'V10-OUT-005',
    requirementId: 'R-OUTCOME-5',
    block: 'outcome',
    title:
      'Lineage binding — DAG over signal → source edges, 3 edge kinds (Wave A seed)',
    description:
      'Binds `OutcomeSignalV1` to upstream artifacts / ' +
      'decisions that caused it. Branded `LineageEdgeId`. ' +
      'Closed `LINEAGE_EDGE_KINDS` (caused_by / ' +
      'contributed_to / attributed_to). Pure ' +
      '`buildLineage(signal, sources, now)` — accepts plain ' +
      'strings or `[ref, kind]` tuples. ' +
      '`assertLineageAcyclic` — DFS coloring cycle detection. ' +
      'Invariants: DAG; every edge carries signal ref + ' +
      'source ref; edge kind ∈ closed catalogue; ' +
      'deterministic. Cross-tenant lineage guards + lineage ' +
      'query API are Wave B.',
    default: false,
    keys: OUTCOME_LINEAGE_BINDING_FLAG_KEYS,
    isEnabled: isOutcomeLineageBindingEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-time-saved-calibration',
    ticketId: 'V10-OUT-006',
    requirementId: 'R-OUTCOME-6',
    block: 'outcome',
    title:
      'Time-saved calibration — 3 methods, non-negative finite output, model_estimate confidence ∈ [0,1] (Wave A seed)',
    description:
      'Calibrates `time_saved_ms` magnitudes across methods. ' +
      'Branded `CalibrationId`. Closed `CALIBRATION_METHODS` ' +
      '(self_report / observed / model_estimate). Pure ' +
      '`calibrateTimeSaved(signal, baseline, method)` — ' +
      'per-method semantics. Invariants: method from closed ' +
      'set; calibrated magnitude finite + non-negative; ' +
      'baseline non-negative; `model_estimate` carries ' +
      '`confidence ∈ [0,1]`; deterministic. Calibration ' +
      'curve fitting + admin override are Wave B.',
    default: false,
    keys: OUTCOME_TIME_SAVED_CALIBRATION_FLAG_KEYS,
    isEnabled: isOutcomeTimeSavedCalibrationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-trust-bundle',
    ticketId: 'V10-RSN-013',
    requirementId: 'R-REASON-13',
    block: 'reasoning',
    title:
      'TrustBundleV1 schema + emitter — claims + citations + coverage + hedging + filter bundle (Wave A seed)',
    description:
      'Envelope bundling factual claims, vetoed claims, ' +
      'citations, coverage, hedging decision, filter result, ' +
      'workload class, tenantId into one emittable object. ' +
      'Branded `TrustBundleId`. Closed `BUNDLE_VERSIONS = [1]`. ' +
      'Pure `emitTrustBundle(params)` — sets `hash = ""` (sealed ' +
      'later by RSN-014). Invariants: ' +
      '`assertEveryFactualClaimHasCitationInBundle`, ' +
      '`assertBundleHasTenantId`, ' +
      '`assertBundleVersionFromCatalogue`, structural ' +
      '`assertTrustBundleV1`. Forwarding to ' +
      'MutationProposal is Wave B.',
    default: false,
    keys: REASONING_TRUST_BUNDLE_FLAG_KEYS,
    isEnabled: isReasoningTrustBundleEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-trust-bundle-hash',
    ticketId: 'V10-RSN-014',
    requirementId: 'R-REASON-14',
    block: 'reasoning',
    title:
      'TrustBundle hash — deterministic 64-char fingerprint, sorted-key canonicalization (Wave A seed)',
    description:
      'Branded `TrustBundleHash` (64-char hex). Multi-accumulator ' +
      'djb2 variant (8 prime-seeded 32-bit words) — fully ' +
      'synchronous / deterministic, defers Web Crypto SHA-256 ' +
      'to Wave B. Pure `canonicalize()` recursively sorts keys ' +
      'and strips the `hash` field. `sealTrustBundle`, ' +
      '`assertTrustBundleIntegrity`, `verifyTrustBundleHash`. ' +
      'Invariants: hash stable across key ordering; hash changes ' +
      'when any field changes; length = 64 chars hex.',
    default: false,
    keys: REASONING_TRUST_BUNDLE_HASH_FLAG_KEYS,
    isEnabled: isReasoningTrustBundleHashEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-fast-chat',
    ticketId: 'V10-RSN-015',
    requirementId: 'R-REASON-15',
    block: 'reasoning',
    title:
      'fast_chat — budget-bound lane, skips retrieval + grounding, emitsTrustBundle=false (Wave A seed)',
    description:
      'Workload-class-specific contract for the `fast_chat` ' +
      'lane. `FAST_CHAT_BUDGET_TIERS = [standard, minimal]`. ' +
      '`FAST_CHAT_BUDGETS` aligned to ' +
      '`WORKLOAD_CLASS_REGISTRY.fast_chat`. Pure ' +
      '`buildFastChatRequest` — forces `excludeRetrieval = ' +
      'true, excludeGrounding = true, requiresGrounding = ' +
      'false, emitsTrustBundle = false` regardless of caller ' +
      'scope. Invariants: budget bounded, workload class = ' +
      '`fast_chat`, deterministic.',
    default: false,
    keys: REASONING_FAST_CHAT_FLAG_KEYS,
    isEnabled: isReasoningFastChatEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-grounded-chat',
    ticketId: 'V10-RSN-016',
    requirementId: 'R-REASON-16',
    block: 'reasoning',
    title:
      'grounded_chat — requires ≥1 citation, minCoverage=0.70, 20s/$0.20/40k-token ceiling (Wave A seed)',
    description:
      'Workload-class contract for `grounded_chat`. ' +
      '`GROUNDED_CHAT_BUDGET_TIERS = [standard, extended]`. ' +
      '`GROUNDED_CHAT_MIN_COVERAGE = 0.70`. Pure ' +
      '`buildGroundedChatRequest` — requires ' +
      '`citations.length ≥ 1`; forces `requiresGrounding = ' +
      'true`, `minCoverage = 0.70`. Budget ceiling: 20 s / ' +
      '$0.20 / 10 tool calls / 40 k tokens. Invariants: ' +
      'workload class = `grounded_chat`, deterministic.',
    default: false,
    keys: REASONING_GROUNDED_CHAT_FLAG_KEYS,
    isEnabled: isReasoningGroundedChatEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-adaptive-coverage-threshold',
    ticketId: 'V10-LRN-013',
    requirementId: 'R-LEARN-13',
    block: 'learning',
    title:
      'Adaptive coverage threshold — 3 strategies (static/decay/ema), [0,1] bound, never-override gated (Wave A seed)',
    description:
      'Adapts coverage threshold from RSN-010 using observation ' +
      'history. Branded `ThresholdId`. Closed ' +
      '`THRESHOLD_STRATEGIES` (static / decay / ema). Pure ' +
      '`computeAdaptiveThreshold(observations, baseline, ' +
      'strategy, now): number`. Invariants: threshold ∈ [0, 1]; ' +
      '`decay` strategy monotonic non-decreasing when no ' +
      'negative observations; deterministic; calls ' +
      '`assertAdjustmentRespectsInvariants` (LRN-011) for ' +
      'never-override protection.',
    default: false,
    keys: LEARNING_ADAPTIVE_COVERAGE_THRESHOLD_FLAG_KEYS,
    isEnabled: isLearningAdaptiveCoverageThresholdEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-tenant-prompt-snippets',
    ticketId: 'V10-LRN-014',
    requirementId: 'R-LEARN-14',
    block: 'learning',
    title:
      'Tenant prompt snippets — 3 scopes, 4 KiB cap, PII-free, tenant-scoped (Wave A seed)',
    description:
      'Tenant-scoped prompt augmentations. Branded ' +
      '`PromptSnippetId`. Closed `SNIPPET_SCOPES` (persona / ' +
      'terminology / constraints). `MAX_SNIPPET_BYTES = 4096`. ' +
      'Pure `buildSnippet(text, scope, tenantId)` — runs ' +
      '`redactPii` + `assertNoPiiLeak` (cross-dep on LRN-010) ' +
      'before accepting the text; rejects PII, unknown scopes, ' +
      'oversized text. Invariants: scope from closed catalogue, ' +
      'tenant-scoped, size bounded.',
    default: false,
    keys: LEARNING_TENANT_PROMPT_SNIPPETS_FLAG_KEYS,
    isEnabled: isLearningTenantPromptSnippetsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-connector-ranking',
    ticketId: 'V10-LRN-015',
    requirementId: 'R-LEARN-15',
    block: 'learning',
    title:
      'Connector ranking — stable sort, scores ∈ [0,1], unique connectors, total ≤ 10 (Wave A seed)',
    description:
      'Ranks connectors by observed interaction utility. ' +
      'Branded `ConnectorRankingId`. Pure `rankConnectors(' +
      'observations, baselineRanking)` — stable descending ' +
      'sort; deterministic. Each entry carries `score ∈ [0, 1]` ' +
      'per connector. Invariants: same input → same output; ' +
      'scores clamped to [0, 1]; uniqueness (no connector ' +
      'twice); ignores non-`connector`-context observations; ' +
      '`MAX_TOTAL_RANKING_SCORE = 10`; tenant-scoped.',
    default: false,
    keys: LEARNING_CONNECTOR_RANKING_FLAG_KEYS,
    isEnabled: isLearningConnectorRankingEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-drift-detection',
    ticketId: 'V10-LRN-016',
    requirementId: 'R-LEARN-16',
    block: 'learning',
    title:
      'Drift detection — 3 kinds × 3 metrics, deterministic per-window score, tenant-scoped (Wave A seed)',
    description:
      'Detects drift in observation distributions across ' +
      'windows. Closed `DRIFT_KINDS` (none / warning / ' +
      'severe), `DRIFT_METRICS` (ks_test / psi / ' +
      'accuracy_drop). Branded `DriftReportId`. Pure ' +
      '`detectDrift(windowA, windowB, metric, now)`. ' +
      'Invariants: kind & metric from closed catalogues; drift ' +
      'score finite + non-negative; report carries both window ' +
      'refs; deterministic; tenant-scoped.',
    default: false,
    keys: LEARNING_DRIFT_DETECTION_FLAG_KEYS,
    isEnabled: isLearningDriftDetectionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-claim-node-source-edge',
    ticketId: 'V10-RSR-013',
    requirementId: 'R-RESEARCH-13',
    block: 'research',
    title:
      'Claim-node + source-edge primitive — derives_from edge, confidence ∈ [0,1] (Wave A seed)',
    description:
      'Pins shape of a `claim`-kind node + its `derives_from` ' +
      'edge to a `source`-kind node within `EvidenceGraphV1`. ' +
      'Branded `ClaimNodeId`. `ClaimNode` carries ' +
      '`sourceNodeId`; `SourceEdge` pinned to `derives_from` + ' +
      'requires `confidence ∈ [0,1]`. Pure ' +
      '`buildClaimNodeWithSourceEdge(claimParams, ' +
      'sourceParams)`. Invariants: edge kind = `derives_from`; ' +
      'both nodes in `EVIDENCE_NODE_KINDS`; claim carries ' +
      'source ref; confidence bounded; deterministic.',
    default: false,
    keys: RESEARCH_CLAIM_NODE_SOURCE_EDGE_FLAG_KEYS,
    isEnabled: isResearchClaimNodeSourceEdgeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-support-contradict-edges',
    ticketId: 'V10-RSR-014',
    requirementId: 'R-RESEARCH-14',
    block: 'research',
    title:
      'Support + contradict edges — 3 strengths, mutually-exclusive per ordered pair, claim-kind endpoints (Wave A seed)',
    description:
      'Pins shape of `supports` / `contradicts` edges between ' +
      'two `claim` nodes. Closed 3-entry `SUPPORT_STRENGTHS` ' +
      '(strong / moderate / weak). `SupportEdge` + ' +
      '`ContradictEdge` discriminated union. Pure ' +
      '`buildSupportEdge`, `buildContradictEdge`. ' +
      '`assertNoConflictingEdges` enforces mutual exclusion ' +
      'per ordered pair. Invariants: both endpoints ' +
      '`claim`-kind; strength from closed catalogue; no ' +
      'self-edge; no (A supports B) + (A contradicts B).',
    default: false,
    keys: RESEARCH_SUPPORT_CONTRADICT_EDGES_FLAG_KEYS,
    isEnabled: isResearchSupportContradictEdgesEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-synthesis',
    ticketId: 'V10-RSR-015',
    requirementId: 'R-RESEARCH-15',
    block: 'research',
    title:
      'Research synthesis — 5 closed sections, ≥1 citation per section, tenant-scoped (Wave A seed)',
    description:
      'Synthesises evidence graph into a narrative outline. ' +
      'Branded `SynthesisId`. Closed 5-entry ' +
      '`SYNTHESIS_SECTIONS` (summary / key_findings / ' +
      'contradictions / gaps / limitations). Pure ' +
      '`synthesise(graph, scope)` — builds one section per ' +
      'catalogue entry. `assertSynthesis(s, graph?)` — ≥1 ' +
      'citation per section, non-empty `missionId` / ' +
      '`tenantId`, optional cross-graph node-ID validation. ' +
      'Invariants: deterministic, tenant-scoped, references ' +
      '`MissionId`.',
    default: false,
    keys: RESEARCH_SYNTHESIS_FLAG_KEYS,
    isEnabled: isResearchSynthesisEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-claim-validator',
    ticketId: 'V10-RSR-016',
    requirementId: 'R-RESEARCH-16',
    block: 'research',
    title:
      'Claim validator — 4 verdicts derived from edge-kind counts, justifying edges required (Wave A seed)',
    description:
      'Validates a claim against its evidence-graph edges. ' +
      'Branded `ValidationReportId`. Closed ' +
      '`VALIDATION_VERDICTS` (supported / contradicted / ' +
      'insufficient_evidence / ambiguous). Pure ' +
      '`validateClaim(claim, graph, params)` — verdict derived ' +
      'from edge counts: supports-only → `supported`, ' +
      'contradicts-only → `contradicted`, mix → `ambiguous`, ' +
      'none or derives_from-only → `insufficient_evidence`. ' +
      '`assertValidationReport` — verdict from catalogue; ' +
      '`justifyingEdges` non-empty for all non-' +
      '`insufficient_evidence` verdicts.',
    default: false,
    keys: RESEARCH_CLAIM_VALIDATOR_FLAG_KEYS,
    isEnabled: isResearchClaimValidatorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-read-write-scopes',
    ticketId: 'V10-CON-007',
    requirementId: 'R-CONNECT-7',
    block: 'connectors',
    title:
      'Read vs write scopes split — 3 classes, default read-only, write requires explicit consent (Wave A seed)',
    description:
      'Splits connector scopes into `read / write / admin`. ' +
      'Closed `SCOPE_CLASSES`. Shapes `ScopeAssignment`, ' +
      '`ReadWriteScopeMap`. Pure `assertReadWriteSplit(scopes)`, ' +
      '`requiredWriteScopes(capabilities)`, ' +
      '`defaultScopeClass`. Invariants: every scope belongs to ' +
      'exactly one class; write scopes require consent with ' +
      'explicit `write` opt-in; admin scopes require tenant-' +
      'admin role ref; default read-only when unspecified.',
    default: false,
    keys: CONNECTORS_READ_WRITE_SCOPES_FLAG_KEYS,
    isEnabled: isConnectorsReadWriteScopesEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-source-ref-provenance',
    ticketId: 'V10-CON-008',
    requirementId: 'R-CONNECT-8',
    block: 'connectors',
    title:
      'SourceRef provenance schema — immutable, tenant-scoped, no-write-in-retrieval invariant (Wave A seed)',
    description:
      'Branded `SourceRefId`. Closed `ACCESS_CLASSES` (read / ' +
      'write). `SourceRef` carries `connectorId`, `sessionId?`, ' +
      '`tenantId`, `fetchedAt`, `hash`, `accessClass`. ' +
      'Invariants: `assertSourceRef` (structural), ' +
      '`assertSourceRefTenant` (cross-tenant is a hard error), ' +
      '`assertSourceRefHashStable`, ' +
      '`assertSourceRefNotWriteAccess` (a `write`-class ref ' +
      'cannot be used in retrieval ops). Immutable; stable ' +
      'hash.',
    default: false,
    keys: CONNECTORS_SOURCE_REF_PROVENANCE_FLAG_KEYS,
    isEnabled: isConnectorsSourceRefProvenanceEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-user-confirmation-surface',
    ticketId: 'V10-OUT-007',
    requirementId: 'R-OUTCOME-7',
    block: 'outcome',
    title:
      'User confirmation surface — 4-state FSM + 3 surface kinds, TTL ≤ 3600s, terminal-immutable (Wave A seed)',
    description:
      'Shape for the surface asking a user to confirm an ' +
      'outcome. Branded `ConfirmationId`. Closed ' +
      '`CONFIRMATION_STATES` (pending / confirmed / dismissed ' +
      '/ expired), `CONFIRMATION_EVENTS` (3), ' +
      '`CONFIRMATION_TRANSITIONS` table. Closed `SURFACE_KINDS` ' +
      '(inline / toast / modal). `TTL_MAX_SECONDS = 3600`. ' +
      'Pure `advanceConfirmation(state, event, now)`. ' +
      'Invariants: ttl bounded; terminal states immutable; ' +
      'tenant-scoped; carries `OutcomeSignalV1` + lineage ref.',
    default: false,
    keys: OUTCOME_USER_CONFIRMATION_SURFACE_FLAG_KEYS,
    isEnabled: isOutcomeUserConfirmationSurfaceEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-passive-outcome-emission',
    ticketId: 'V10-OUT-008',
    requirementId: 'R-OUTCOME-8',
    block: 'outcome',
    title:
      'Passive outcome emission — 4 triggers, deterministic kind/source inference, PII-free metadata (Wave A seed)',
    description:
      'Shape for passively-emitted outcomes (no user ' +
      'confirmation). Branded `PassiveEmissionId`. Closed ' +
      '4-entry `PASSIVE_TRIGGERS` (activation / ' +
      'kpi_threshold / retention_delta / connector_success). ' +
      '`TRIGGER_TO_KIND` + `TRIGGER_TO_SOURCE` tables map ' +
      'trigger → `OUTCOME_KINDS` / `OUTCOME_SOURCES` ' +
      'deterministically. `PII_FIELD_DENY_LIST`. Pure ' +
      '`emitPassiveOutcome(trigger, context, now): ' +
      'OutcomeSignalV1`. Invariants: ' +
      '`assertPassiveEmissionContext`, ' +
      '`assertNoPiiInMetadata`, tenant-scoped, carries ' +
      'lineage ref.',
    default: false,
    keys: OUTCOME_PASSIVE_OUTCOME_EMISSION_FLAG_KEYS,
    isEnabled: isOutcomePassiveOutcomeEmissionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-on-workspace',
    ticketId: 'V10-RSN-017',
    requirementId: 'R-REASON-17',
    block: 'reasoning',
    title:
      'reasoning_on_workspace — ≥1 connector, minCoverage=0.80, 60s/$1/60k ceiling (Wave A seed)',
    description:
      'Workload-class contract for `reasoning_on_workspace` ' +
      '(queries bounded to tenant connectors). ' +
      '`REASONING_ON_WORKSPACE_BUDGET_TIERS` (standard / ' +
      'extended). `MIN_COVERAGE = 0.80`. Pure ' +
      '`buildReasoningOnWorkspaceRequest(scope, connectors, ' +
      'tier?)`. Invariants: tenant scope required; ≥1 ' +
      'connector; budget ceiling 60 s / $1.00 / 20 calls / ' +
      '60 k tokens; workload class pinned. Multi-step ' +
      'execution + TrustBundle wiring are Wave B.',
    default: false,
    keys: REASONING_ON_WORKSPACE_FLAG_KEYS,
    isEnabled: isReasoningOnWorkspaceEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-decision-review',
    ticketId: 'V10-RSN-018',
    requirementId: 'R-REASON-18',
    block: 'reasoning',
    title:
      'decision_review — sealed TrustBundle required, emitsTrustBundle=true, 120s/$2/100k ceiling (Wave A seed)',
    description:
      'Workload-class contract for `decision_review`. ' +
      '`DECISION_REVIEW_BUDGET_TIERS` (standard / extended). ' +
      '`MIN_COVERAGE = 0.80`. Pure ' +
      '`buildDecisionReviewRequest(scope, trustBundle, ' +
      'tier?)`. Invariants: sealed TrustBundle (hash = ' +
      '64-char hex); `minCoverage ≥ 0.80`; budget ceiling ' +
      '120 s / $2.00 / 30 calls / 100 k tokens; ' +
      'emitsTrustBundle = true. Decision-analysis pipeline + ' +
      '`decision_doc` artifact are Wave B.',
    default: false,
    keys: REASONING_DECISION_REVIEW_FLAG_KEYS,
    isEnabled: isReasoningDecisionReviewEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-artifact-build',
    ticketId: 'V10-RSN-019',
    requirementId: 'R-REASON-19',
    block: 'reasoning',
    title:
      'artifact_build — 5 target kinds, minCoverage=0.85, emitsTrustBundle=true (Wave A seed)',
    description:
      'Workload-class contract for `artifact_build`. Closed ' +
      '`ARTIFACT_TARGET_KINDS` (slide_deck / memo / ' +
      'spreadsheet / report / dashboard). ' +
      '`ARTIFACT_BUILD_BUDGET_TIERS`. `MIN_COVERAGE = 0.85`. ' +
      'Pure `buildArtifactBuildRequest(scope, artifactKind, ' +
      'tier?)`. Invariants: artifact kind from closed ' +
      'catalogue; workload class pinned; emitsTrustBundle = ' +
      'true; budget ceiling 120 s / $2.00 / 30 calls / 100 k ' +
      'tokens. Generation pipeline + MutationProposal ' +
      'emission are Wave B.',
    default: false,
    keys: REASONING_ARTIFACT_BUILD_FLAG_KEYS,
    isEnabled: isReasoningArtifactBuildEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-deep-research-stub',
    ticketId: 'V10-RSN-020',
    requirementId: 'R-REASON-20',
    block: 'reasoning',
    title:
      'deep_research (stub) — references MissionId, 4 closed states (Wave A seed)',
    description:
      'Reasoning-side stub that forwards to the research ' +
      'pipeline. Closed `DEEP_RESEARCH_STUB_STATES` (pending ' +
      '/ dispatched / completed / failed). Pure ' +
      '`buildDeepResearchStub(scope, missionId, now)` — ' +
      'always initialises state to `pending`. Invariants: ' +
      '`MissionId` non-empty; tenant-scoped; state from ' +
      'closed catalogue; deterministic (`now` injected); ' +
      'workload class = `deep_research`. Research-block ' +
      'dispatch + state transitions are Wave B.',
    default: false,
    keys: REASONING_DEEP_RESEARCH_STUB_FLAG_KEYS,
    isEnabled: isReasoningDeepResearchStubEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-audit-export',
    ticketId: 'V10-LRN-017',
    requirementId: 'R-LEARN-17',
    block: 'learning',
    title:
      'Learning audit export — tenant-scoped, PII-free, contiguous range, 3 formats (Wave A seed)',
    description:
      'Exports tenant-scoped audit of learning events. ' +
      'Branded `AuditExportId`. Closed `AUDIT_EXPORT_FORMATS` ' +
      '(json / ndjson / csv). Pure ' +
      '`buildLearningAuditExport(events, tenantId, range, ' +
      'format, now)`. Invariants: all events tenant-scoped ' +
      '(cross-tenant is a hard error); PII-free (via ' +
      '`assertPayloadNoPii`); format from closed catalogue; ' +
      'range contiguous; deterministic.',
    default: false,
    keys: LEARNING_AUDIT_EXPORT_FLAG_KEYS,
    isEnabled: isLearningAuditExportEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'learning-per-tenant-kill-switch',
    ticketId: 'V10-LRN-018',
    requirementId: 'R-LEARN-18',
    block: 'learning',
    title:
      'Per-tenant kill switch — default disabled (learning OFF), 4 scopes, all-scope wildcard (Wave A seed)',
    description:
      'Per-tenant kill switch for learning-driven ' +
      'adjustments. Branded `KillSwitchId`. Closed ' +
      '`KILL_SWITCH_STATES` (enabled / disabled), ' +
      '`KILL_SWITCH_SCOPES` (all / routing / telemetry / ' +
      'snippets), `KILL_SWITCH_EVENTS`. ' +
      '`KillSwitchRecord`, `KillSwitchRegistry`. Pure ' +
      '`advanceKillSwitch` reducer; ' +
      '`isLearningPermittedFor(tenantId, scope, registry)` — ' +
      '`all`-scope acts as wildcard. Default state: ' +
      '`disabled` (learning OFF). Tenant-scoped; ' +
      'deterministic.',
    default: false,
    keys: LEARNING_PER_TENANT_KILL_SWITCH_FLAG_KEYS,
    isEnabled: isLearningPerTenantKillSwitchEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-disagreement-presentation',
    ticketId: 'V10-RSR-017',
    requirementId: 'R-RESEARCH-17',
    block: 'research',
    title:
      'Disagreement presentation — 3 modes, every ContradictEdge rendered, mission-scoped (Wave A seed)',
    description:
      'Pins shape of how contradictions from RSR-014 surface ' +
      'to the user. Branded `DisagreementPresentationId`. ' +
      'Closed `PRESENTATION_MODES` (side_by_side / ' +
      'hierarchical / confidence_weighted). Pure ' +
      '`presentDisagreements(contradictEdges, graph, ' +
      'params)`. Mode-aware ordering (strength ↓ for ' +
      'hierarchical; weight ↓ for confidence-weighted; ' +
      'insertion order for side-by-side). Invariants: every ' +
      '`ContradictEdge` rendered ≥1 time; mode from ' +
      'catalogue; carries `MissionId`; deterministic; ' +
      'tenant-scoped.',
    default: false,
    keys: RESEARCH_DISAGREEMENT_PRESENTATION_FLAG_KEYS,
    isEnabled: isResearchDisagreementPresentationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-hedging-calibration',
    ticketId: 'V10-RSR-018',
    requirementId: 'R-RESEARCH-18',
    block: 'research',
    title:
      'Research hedging calibration — reuses HEDGING_DECISIONS, 12-entry table on verdict buckets (Wave A seed)',
    description:
      'Applies RSN-011-style hedging in research context: ' +
      'uses validator verdicts instead of coverage score. ' +
      'Imports `HEDGING_DECISIONS` from reasoning ' +
      '(`HedgingCalibration.ts`) — not duplicated. Closed ' +
      '`VERDICT_MIX_BUCKETS` (high_support / mixed / ' +
      'low_support), closed 12-entry ' +
      '`RESEARCH_CALIBRATION_TABLE`. Pure ' +
      '`calibrateResearchHedging(verdictCounts, ' +
      'hedgingLevel)`. Bucket derivation: ' +
      '`supported/(supported + contradicted)` ≥ 0.6 / ≥ ' +
      '0.3 / < 0.3. Invariants: complete closed table; ' +
      'deterministic.',
    default: false,
    keys: RESEARCH_HEDGING_CALIBRATION_FLAG_KEYS,
    isEnabled: isResearchHedgingCalibrationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-report-artifact',
    ticketId: 'V10-RSR-019',
    requirementId: 'R-RESEARCH-19',
    block: 'research',
    title:
      'research_report artifact — 3 formats, mission-scoped, references synthesis + graph + validator (Wave A seed)',
    description:
      'Contract for emitting `research_report` as a ' +
      'persistent artifact. Branded `ResearchReportId`. ' +
      'Closed `REPORT_FORMATS` (markdown / pdf_hint / ' +
      'html_hint). Pure `buildResearchReport(synthesis, ' +
      'graph, validator, params)`. Invariants: ' +
      '`ResearchReportArtifact` carries `tenantId + ' +
      'missionId + graphId + validationReportId + ' +
      'referencedSections`; format from closed catalogue; ' +
      'references ≥1 synthesis section; tenant/mission ' +
      'mismatch = hard error; deterministic.',
    default: false,
    keys: RESEARCH_REPORT_ARTIFACT_FLAG_KEYS,
    isEnabled: isResearchReportArtifactEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission-trust-bundle',
    ticketId: 'V10-RSR-020',
    requirementId: 'R-RESEARCH-20',
    block: 'research',
    title:
      'Mission TrustBundle — reuses TrustBundleV1 version + djb2 hash, workloadClass=deep_research (Wave A seed)',
    description:
      'TrustBundle variant for research missions. Wraps ' +
      '`research_report` + evidence graph + validator ' +
      'report. Branded `MissionTrustBundleId`. Reuses ' +
      '`BUNDLE_VERSIONS` from reasoning `TrustBundleV1`. ' +
      'Pure `emitMissionTrustBundle`, ' +
      '`sealMissionTrustBundle`, `hashMissionTrustBundle` ' +
      '(multi-accumulator djb2 from RSN-014 — 64-char hex, ' +
      'deterministic, key-order stable). ' +
      '`assertMissionTrustBundleIntegrity`, ' +
      '`verifyMissionTrustBundleHash`. Invariants: every ' +
      'claim has citation binding (via graph); tenant-scoped; ' +
      'workloadClass = `deep_research`.',
    default: false,
    keys: RESEARCH_MISSION_TRUST_BUNDLE_FLAG_KEYS,
    isEnabled: isResearchMissionTrustBundleEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission-interrupt-verbs',
    ticketId: 'V10-RSR-021',
    requirementId: 'R-RESEARCH-21',
    block: 'research',
    title:
      'Mission interrupt verbs — 4 closed verbs, terminal states reject, explicit transition table (Wave A seed)',
    description:
      'Verbs that interrupt a running research mission. ' +
      'Closed 4-entry `MISSION_INTERRUPT_VERBS` (pause / ' +
      'cancel / budget_exceeded / revoked). ' +
      '`MISSION_TERMINAL_STATES` (completed / stopped / ' +
      'failed). `MISSION_INTERRUPT_TRANSITIONS` table ' +
      '(MissionState × Verb) → MissionState. Pure ' +
      '`applyMissionInterrupt(state, verb, now)` returning ' +
      '`{ nextState, verb, outcome, appliedAt }` with ' +
      '`applied / illegal_terminal / illegal_state_for_verb`. ' +
      'Invariants: closed verb catalogue; terminal states ' +
      'reject all verbs; deterministic.',
    default: false,
    keys: RESEARCH_MISSION_INTERRUPT_VERBS_FLAG_KEYS,
    isEnabled: isResearchMissionInterruptVerbsEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission-resume',
    ticketId: 'V10-RSR-022',
    requirementId: 'R-RESEARCH-22',
    block: 'research',
    title:
      'Mission resume — 4 outcomes × 3 reasons, paused-only, token tenant-scoped (Wave A seed)',
    description:
      'Contract to resume an interrupted mission. Branded ' +
      '`MissionResumeTokenId`. Closed 4-entry ' +
      '`RESUME_OUTCOMES`, closed 3-entry `RESUME_REASONS` ' +
      '(paused / budget_exceeded / revoked). Pure ' +
      '`resumeMission(state, token, now)` — paused + ' +
      '`paused` → resumed/running; paused + ' +
      '`budget_exceeded` → rejected_budget_exceeded; ' +
      'paused + `revoked` → rejected_revoked; non-paused ' +
      '→ rejected_state_invalid. ' +
      '`assertMissionResumeToken` with 5 closed error ' +
      'reasons. Tenant-scoped.',
    default: false,
    keys: RESEARCH_MISSION_RESUME_FLAG_KEYS,
    isEnabled: isResearchMissionResumeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-acl-probe',
    ticketId: 'V10-CON-009',
    requirementId: 'R-CONNECT-9',
    block: 'connectors',
    title:
      'ACL probe — 3 outcomes, write-class always denied (read-only in Wave A), tenant-scoped (Wave A seed)',
    description:
      'Probes a connector ACL to confirm a user can access ' +
      'a specific resource. Branded `AclProbeId`. Closed ' +
      '3-entry `ACL_PROBE_OUTCOMES` (permitted / denied / ' +
      'unknown). Pure `probeAcl(connector, session, ' +
      'resourceRef, tenantId, now)`. Invariants: ' +
      'tenant-scoped; outcome from closed set; ' +
      'deterministic; `write`-class resources always ' +
      '`denied` (Wave-A read-only probe contract).',
    default: false,
    keys: CONNECTORS_ACL_PROBE_FLAG_KEYS,
    isEnabled: isConnectorsAclProbeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-federated-search',
    ticketId: 'V10-CON-010',
    requirementId: 'R-CONNECT-10',
    block: 'connectors',
    title:
      'Federated search — 3 modes, active session required, deterministic sort, non-empty query (Wave A seed)',
    description:
      'Unified search across connectors. Branded ' +
      '`FederatedSearchId`. Closed 3-entry `SEARCH_MODES` ' +
      '(exact / fuzzy / hybrid). Pure ' +
      '`buildFederatedSearch(query, entries, mode, ' +
      'tenantId, now)`, `sortFederatedResults`. Invariants: ' +
      'every connector ref has an active session; query ' +
      'non-empty; mode from catalogue; deterministic sort ' +
      '(score desc → source-ref); tenant-scoped.',
    default: false,
    keys: CONNECTORS_FEDERATED_SEARCH_FLAG_KEYS,
    isEnabled: isConnectorsFederatedSearchEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-decision-shipped-detector',
    ticketId: 'V10-OUT-009',
    requirementId: 'R-OUTCOME-9',
    block: 'outcome',
    title:
      'Decision-shipped detector — 3 triggers, deterministic kind mapping, null-on-no-match (Wave A seed)',
    description:
      'Detects a "decision shipped" outcome from a sequence ' +
      'of `OutcomeSignalV1`s. Closed 3-entry ' +
      '`DECISION_SHIPPED_TRIGGERS` (artifact_published / ' +
      'external_action / status_change). Frozen ' +
      '`TRIGGER_TO_SOURCE`, `TRIGGER_TO_KIND`, ' +
      '`SOURCE_TO_TRIGGER` reverse map. Pure ' +
      '`detectDecisionShipped(signals, tenantId, now): ' +
      'OutcomeSignalV1 | null`. Invariants: returns `null` ' +
      'if no trigger matches; emitted outcome kind ' +
      'deterministically mapped from trigger; tenant-scoped.',
    default: false,
    keys: OUTCOME_DECISION_SHIPPED_DETECTOR_FLAG_KEYS,
    isEnabled: isOutcomeDecisionShippedDetectorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-kpi-accept-outcome',
    ticketId: 'V10-OUT-010',
    requirementId: 'R-OUTCOME-10',
    block: 'outcome',
    title:
      'KPI-accept outcome — 4 domains, per-domain cap, PII-free metadata (Wave A seed)',
    description:
      'Outcome captured when a user accepts a KPI-bearing ' +
      'output. Branded `KpiAcceptId`. Closed 4-entry ' +
      '`KPI_DOMAINS` (revenue / retention / cost / time). ' +
      'Frozen `KPI_DOMAIN_CAPS`. `KpiDescriptor`. Pure ' +
      '`buildKpiAcceptOutcome(signal, kpi, magnitude, ' +
      'tenantId, now)`. Invariants: magnitude finite + ' +
      'bounded by per-domain cap; domain from catalogue; ' +
      'tenant-scoped; no PII in metadata.',
    default: false,
    keys: OUTCOME_KPI_ACCEPT_OUTCOME_FLAG_KEYS,
    isEnabled: isOutcomeKpiAcceptOutcomeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-background-agent-stub',
    ticketId: 'V10-RSN-021',
    requirementId: 'R-REASON-21',
    block: 'reasoning',
    title:
      'background_agent (stub) — 5 closed states, deterministic stub id, RunId-referencing (Wave A seed)',
    description:
      'Reasoning-side stub forwarding to background agent ' +
      'runtime. Closed 5-entry `BACKGROUND_AGENT_STATES` ' +
      '(pending / dispatched / running / completed / failed). ' +
      'Branded `RunId` + `BackgroundAgentStubId`. Stub id ' +
      'deterministic (`ba_stub__{tenantId}__{runId}__{now}`). ' +
      'Pure `buildBackgroundAgentStub(scope, runId, now)`. ' +
      'Invariants: references `RunId`/agent-run; tenant-' +
      'scoped; state from closed set; workload class = ' +
      '`background_agent`; deterministic.',
    default: false,
    keys: REASONING_BACKGROUND_AGENT_STUB_FLAG_KEYS,
    isEnabled: isReasoningBackgroundAgentStubEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-presentation-layer',
    ticketId: 'V10-RSN-022',
    requirementId: 'R-REASON-22',
    block: 'reasoning',
    title:
      'Presentation layer — 4 formats, every factual claim cited, hedging applied (Wave A seed)',
    description:
      'Rendered-response envelope binding `TrustBundleV1` + ' +
      'scope + format. Branded `PresentationId`. Closed ' +
      '4-entry `PRESENTATION_FORMATS` (text / markdown / ' +
      'cards / artifact_preview). Pure ' +
      '`buildPresentation(trustBundle, format, scope, now)`. ' +
      'Enforces "every factual claim cited" via delegation to ' +
      '`assertEveryFactualClaimHasCitationInBundle`. Forwards ' +
      '`citations` + `hedging.decision`. Wave-A leaves `text` ' +
      'blank (rendering is Wave B); invariants: tenant-scoped, ' +
      'format from catalogue, deterministic.',
    default: false,
    keys: REASONING_PRESENTATION_LAYER_FLAG_KEYS,
    isEnabled: isReasoningPresentationLayerEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-telemetry',
    ticketId: 'V10-RSN-023',
    requirementId: 'R-REASON-23',
    block: 'reasoning',
    title:
      'Reasoning telemetry — 6 closed event kinds + tenantId + PII-free payload (Wave A seed)',
    description:
      'Telemetry envelope for every reasoning reducer. Closed ' +
      '6-entry `REASONING_EVENTS` (workload_class_selected / ' +
      'plan_formulated / tool_call_emitted / ' +
      'trust_bundle_sealed / hallucination_filtered / ' +
      'presentation_rendered). Branded ' +
      '`ReasoningTelemetryEventId`. Pure ' +
      '`buildReasoningTelemetryEvent(kind, payload, now, id, ' +
      'traceId?)`. Imports `assertPayloadNoPii` from learning ' +
      'and re-throws as ' +
      '`ReasoningTelemetryError(\'pii_in_payload\')`. ' +
      'Invariants: event kind from closed set; tenantId ' +
      'mandatory; no PII in payload; deterministic.',
    default: false,
    keys: REASONING_TELEMETRY_FLAG_KEYS,
    isEnabled: isReasoningTelemetryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-edge-case-matrix',
    ticketId: 'V10-RSN-024',
    requirementId: 'R-REASON-24',
    block: 'reasoning',
    title:
      'Edge-case matrix — complete 42-entry (7 × 6) table, 10 outcomes, runtime completeness check (Wave A seed)',
    description:
      'Closed matrix mapping (workload class × failure mode) ' +
      '→ pinned outcome. Closed 6-entry `FAILURE_MODES` ' +
      '(no_scope / budget_exceeded / grounding_unavailable / ' +
      'tool_denied / tenant_isolation_violation / ' +
      'consent_missing). Closed 10-entry `EDGE_CASE_OUTCOMES`. ' +
      'Complete 42-entry matrix (7 workload classes × 6 ' +
      'failure modes). Pure `resolveEdgeCase(workloadClass, ' +
      'failureMode)`. Runtime ' +
      '`assertEdgeCaseMatrixComplete` verifies every ' +
      'combination. Invariants: matrix complete; unknown ' +
      'inputs throw; deterministic.',
    default: false,
    keys: REASONING_EDGE_CASE_MATRIX_FLAG_KEYS,
    isEnabled: isReasoningEdgeCaseMatrixEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-mission-audit-log',
    ticketId: 'V10-RSR-023',
    requirementId: 'R-RESEARCH-23',
    block: 'research',
    title:
      'Mission audit log — 13 event kinds, append-only, occurredAt non-decreasing (Wave A seed)',
    description:
      'Append-only audit log of mission lifecycle events. ' +
      'Branded `MissionAuditLogId` + `MissionAuditEntryId`. ' +
      'Closed 13-entry `MISSION_AUDIT_EVENTS` (mission_' +
      'created, scope_set, plan_formulated, ' +
      'budget_allocated, source_fetched, claim_extracted, ' +
      'claim_validated, report_emitted, bundle_sealed, ' +
      'interrupt_applied, resume_attempted, mission_completed, ' +
      'mission_failed). Pure `appendMissionAuditEntry(log, ' +
      'event, now, entryId)` enforces append-only ' +
      '(`ordering_violation` if `occurredAt` decreases). ' +
      '`assertMissionAuditLog` enforces tenant-scoping + ' +
      'entry/log missionId consistency.',
    default: false,
    keys: RESEARCH_MISSION_AUDIT_LOG_FLAG_KEYS,
    isEnabled: isResearchMissionAuditLogEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-telemetry',
    ticketId: 'V10-RSR-024',
    requirementId: 'R-RESEARCH-24',
    block: 'research',
    title:
      'Research telemetry — 7 closed event kinds + PII-free + tenantId mandatory (Wave A seed)',
    description:
      'Telemetry envelope for research reducers. Branded ' +
      '`ResearchTelemetryEventId`. Closed 7-entry ' +
      '`RESEARCH_EVENTS` (mission_started, source_fetched, ' +
      'extract_emitted, claim_validated, budget_breach, ' +
      'disagreement_surfaced, report_emitted). Pure ' +
      '`buildResearchTelemetryEvent(kind, payload, now, id)`. ' +
      'Delegates PII guard to `assertPayloadNoPii` ' +
      '(LearningTelemetry) re-throwing as ' +
      '`ResearchTelemetryError(\'pii_in_payload\')`. ' +
      'Invariants: event kind from closed set; tenantId ' +
      'mandatory; deterministic.',
    default: false,
    keys: RESEARCH_TELEMETRY_FLAG_KEYS,
    isEnabled: isResearchTelemetryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-cost-dashboard',
    ticketId: 'V10-RSR-025',
    requirementId: 'R-RESEARCH-25',
    block: 'research',
    title:
      'Research cost dashboard — 5 cost buckets, total = sum(non-total), per-mission rollup (Wave A seed)',
    description:
      'Rolled-up mission cost aggregation. Branded ' +
      '`CostDashboardId`. Closed 5-entry `COST_BUCKETS` ' +
      '(tool_calls / source_fetches / llm_tokens / storage / ' +
      'total). Pure `rollUpMissionCosts(telemetry, budgets, ' +
      'id, tenantId, missionId, now)` — `tool_calls` + ' +
      '`source_fetches` from telemetry event counts; ' +
      '`llm_tokens` + `storage` from ' +
      '`MissionBudgetV1.caps.burn`. `assertCostDashboard` ' +
      'enforces `total === sum(non-total)` within ' +
      'tolerance 1e-9. Invariants: every bucket ≥ 0; ' +
      'tenant-scoped; deterministic.',
    default: false,
    keys: RESEARCH_COST_DASHBOARD_FLAG_KEYS,
    isEnabled: isResearchCostDashboardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-scheduled-watches',
    ticketId: 'V10-RSR-026',
    requirementId: 'R-RESEARCH-26',
    block: 'research',
    title:
      'Scheduled watches — 4 cadences × 3 states, deterministic nextRunAt, `disabled` terminal (Wave A seed)',
    description:
      'Scheduled recurring research runs. Branded ' +
      '`ScheduledWatchId`. Closed 4-entry `WATCH_CADENCES` ' +
      '(hourly / daily / weekly / monthly), 3-entry ' +
      '`WATCH_STATES` (enabled / paused / disabled), 3-entry ' +
      '`WATCH_TRANSITION_EVENTS`. `disabled` is the only ' +
      'terminal state. Pure `advanceWatchState(state, event, ' +
      'now)` — `illegal_terminal` on `disabled`; ' +
      '`illegal_transition` on unsanctioned pairs. Pure ' +
      '`nextRunAt(cadence, now)` — hourly=1h, daily=24h, ' +
      'weekly=7d, monthly=30d deterministic offset. ' +
      'Watch references `MissionScopeV1`. Tenant-scoped.',
    default: false,
    keys: RESEARCH_SCHEDULED_WATCHES_FLAG_KEYS,
    isEnabled: isResearchScheduledWatchesEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-incremental-sync',
    ticketId: 'V10-CON-011',
    requirementId: 'R-CONNECT-11',
    block: 'connectors',
    title:
      'Incremental sync — 3 modes, cursor monotonic ≥, full resets to "0" (Wave A seed)',
    description:
      'Cursor-based incremental sync. Closed 3-entry ' +
      '`SYNC_MODES` (full / delta / cursor). Branded ' +
      '`SyncCursorId`. `SyncCursor`, `SyncProgress`. Pure ' +
      '`advanceSyncCursor(current, progress, now)`. ' +
      'Invariants: cursor monotonic ≥; `full` mode resets to ' +
      '`"0"`; mode from closed set; cursor stored per ' +
      'connector+session; tenant-scoped; deterministic.',
    default: false,
    keys: CONNECTORS_INCREMENTAL_SYNC_FLAG_KEYS,
    isEnabled: isConnectorsIncrementalSyncEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-freshness-slo',
    ticketId: 'V10-CON-012',
    requirementId: 'R-CONNECT-12',
    block: 'connectors',
    title:
      'Freshness SLO — 3 states × per-connector TTL buckets, deterministic evaluation (Wave A seed)',
    description:
      'Freshness evaluation per source. Closed 3-entry ' +
      '`FRESHNESS_STATES` (fresh / stale / expired). ' +
      '`FreshnessSlo`, `FRESHNESS_SLO_BUCKETS` per all 7 ' +
      'connector kinds. `FreshnessCheck`. Pure ' +
      '`evaluateFreshness(fetchedAt, now, slo)` — ' +
      '`expired > hardTtlMs`, `stale > softTtlMs`. ' +
      '`assertFreshnessCheck`. Invariants: state from closed ' +
      'catalogue; deterministic; per-kind TTLs bounded.',
    default: false,
    keys: CONNECTORS_FRESHNESS_SLO_FLAG_KEYS,
    isEnabled: isConnectorsFreshnessSloEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-rate-limit-backoff',
    ticketId: 'V10-CON-013',
    requirementId: 'R-CONNECT-13',
    block: 'connectors',
    title:
      'Rate-limit backoff — 3 strategies, monotonic-non-decreasing delay, capped at maxMs (Wave A seed)',
    description:
      'Retry-delay contract per attempt. Closed 3-entry ' +
      '`BACKOFF_STRATEGIES` (linear / exponential / fixed). ' +
      'Branded `RateLimitDecisionId`. Pure ' +
      '`nextRetryDelay(attempt, strategy, baseMs, maxMs)`. ' +
      '`assertRateLimitDecision`. Invariants: delay ' +
      'monotonic non-decreasing in attempt for linear / ' +
      'exponential; delay ≤ maxMs; strategy from closed set; ' +
      'attempt ≥ 0; deterministic.',
    default: false,
    keys: CONNECTORS_RATE_LIMIT_BACKOFF_FLAG_KEYS,
    isEnabled: isConnectorsRateLimitBackoffEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-acl-propagation',
    ticketId: 'V10-CON-014',
    requirementId: 'R-CONNECT-14',
    block: 'connectors',
    title:
      'ACL propagation — 3 change kinds, revoke terminal per-subject, retrieval-cache invalidation plan (Wave A seed)',
    description:
      'Propagates ACL changes to retrieval-cache ' +
      'invalidations. Closed 3-entry `ACL_CHANGE_KINDS` ' +
      '(grant / revoke / scope_change). Branded ' +
      '`AclPropagationId`. `AclChangeEvent`, `PropagationPlan` ' +
      '(`action: invalidate | warm`). Pure ' +
      '`planAclPropagation(change, connector, scope)`. ' +
      '`assertPropagationPlan`. Invariants: revoke is ' +
      'terminal per-subject (via `revokedSubjects` guard set ' +
      '— no resurrection); cross-tenant rejection; every ' +
      'change tenant-scoped; plan references affected ' +
      '`SourceRefId`s; deterministic.',
    default: false,
    keys: CONNECTORS_ACL_PROPAGATION_FLAG_KEYS,
    isEnabled: isConnectorsAclPropagationEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-double-count-guard',
    ticketId: 'V10-OUT-011',
    requirementId: 'R-OUTCOME-11',
    block: 'outcome',
    title:
      'Double-count guard — 4-part dedup key (lineage + kind + tenant + bucket), 3 decisions (Wave A seed)',
    description:
      'Prevents counting the same outcome twice under ' +
      'different signals. Branded `DoubleCountGuardId`. ' +
      'Closed 3-entry `GUARD_DECISIONS` (first_seen / ' +
      'duplicate / distinct). Pure ' +
      '`assertNotDoubleCounted(record, known)`. Dedup keyed ' +
      'by `(lineageRef | kind | tenantId | magnitudeBucket)`. ' +
      'Invariants: full-key match → `duplicate`; partial ' +
      'match (lineage differs) → `distinct`; no match → ' +
      '`first_seen`; tenant-scoped; deterministic.',
    default: false,
    keys: OUTCOME_DOUBLE_COUNT_GUARD_FLAG_KEYS,
    isEnabled: isOutcomeDoubleCountGuardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-reversal',
    ticketId: 'V10-OUT-012',
    requirementId: 'R-OUTCOME-12',
    block: 'outcome',
    title:
      'Outcome reversal — 4 reasons, terminal on reversed/redacted, negated-magnitude signal (Wave A seed)',
    description:
      'Reverses a previously-accepted outcome. Branded ' +
      '`OutcomeReversalId`. Closed 4-entry `REVERSAL_REASONS` ' +
      '(user_rejected / data_correction / policy_override / ' +
      'consent_withdrawn). `ReversalSignal` (kind ' +
      '`"reversal"`), `ReversalResult`. Pure ' +
      '`reverseOutcome(record, reason, now)` — transitions ' +
      'record to `reversed` via `applyStateTransition` and ' +
      'emits `ReversalSignal` with original magnitude. ' +
      '`assertReversalAllowed`. Invariants: reversed & ' +
      'redacted records rejected (terminal, no resurrection); ' +
      'tenant-scoped; deterministic.',
    default: false,
    keys: OUTCOME_REVERSAL_FLAG_KEYS,
    isEnabled: isOutcomeReversalEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-per-team-roi-dashboard',
    ticketId: 'V10-OUT-013',
    requirementId: 'R-OUTCOME-13',
    block: 'outcome',
    title:
      'Per-team ROI dashboard — 4 metrics, attribution-fraction respected, reversed/redacted excluded (Wave A seed)',
    description:
      'Rollup of ROI by team. Branded ' +
      '`PerTeamRoiDashboardId`. Closed 4-entry `ROI_METRICS` ' +
      '(time_saved_ms / revenue_cents / cost_saved_cents / ' +
      'decisions_shipped). `TeamRecord`, `TeamRoiEntry`. ' +
      'Pure `rollUpPerTeamRoi(records, now)`. ' +
      '`assertAllRecordsTenantScoped`. Invariants: metric ' +
      'from closed catalogue; every record tenant-scoped; ' +
      'attribution respects `AttributionPolicyV1` ref; ' +
      'reversed & redacted records excluded; deterministic ' +
      'lexicographic ordering by team id.',
    default: false,
    keys: OUTCOME_PER_TEAM_ROI_DASHBOARD_FLAG_KEYS,
    isEnabled: isOutcomePerTeamRoiDashboardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-per-persona-breakdown',
    ticketId: 'V10-OUT-014',
    requirementId: 'R-OUTCOME-14',
    block: 'outcome',
    title:
      'Per-persona breakdown — 4 personas, sum ≤ grandTotal, sharePercent computed, deterministic (Wave A seed)',
    description:
      'Rollup by persona. Branded ' +
      '`PerPersonaBreakdownId`. Closed 4-entry `PERSONA_KINDS` ' +
      '(executive / operator / analyst / ic). ' +
      '`PersonaRecord`, `PersonaEntry`. Pure ' +
      '`rollUpPerPersona(records, now)`. ' +
      '`assertPersonaKindClosed`, ' +
      '`assertAllRecordsHavePersona`, ' +
      '`assertBreakdownTotals`. Invariants: persona from ' +
      'closed catalogue; every record has a persona ' +
      'assignment (via lineage / attribution); sum across ' +
      'personas ≤ grand total; attribution fraction ' +
      'respected; reversed & redacted excluded; ' +
      'deterministic.',
    default: false,
    keys: OUTCOME_PER_PERSONA_BREAKDOWN_FLAG_KEYS,
    isEnabled: isOutcomePerPersonaBreakdownEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'reasoning-quality-dashboard',
    ticketId: 'V10-RSN-025',
    requirementId: 'R-REASON-25',
    block: 'reasoning',
    title:
      'Reasoning quality dashboard — coverage / hedging / veto metrics, closed catalogue, deterministic (Wave A seed)',
    description:
      'Observability surface for reasoning outputs. Branded ' +
      '`ReasoningQualityDashboardId`. Closed metric catalogue ' +
      '(coverage / hedging_rate / veto_rate). Pure ' +
      '`buildReasoningQualityDashboard(records, window, now)`. ' +
      '`assertReasoningQualityDashboard`. Invariants: metric ' +
      'from closed catalogue; tenant-scoped; every sample ' +
      'references `RunId`; deterministic ordering.',
    default: false,
    keys: REASONING_QUALITY_DASHBOARD_FLAG_KEYS,
    isEnabled: isReasoningQualityDashboardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-watch-delta-report',
    ticketId: 'V10-RSR-027',
    requirementId: 'R-RESEARCH-27',
    block: 'research',
    title:
      'Watch delta report — changed-since-last-run diff, lineage-bound, deterministic (Wave A seed)',
    description:
      'Summary of what changed between two scheduled-watch ' +
      'runs of the same mission. Branded ' +
      '`WatchDeltaReportId`. Closed change-kind catalogue ' +
      '(added / removed / modified / unchanged). Pure ' +
      '`buildWatchDeltaReport(prev, next, now)`. ' +
      '`assertWatchDeltaReport`. Invariants: both runs ' +
      'reference same `MissionScopeV1`; tenant-scoped; ' +
      'deterministic ordering; no cross-tenant leak.',
    default: false,
    keys: RESEARCH_WATCH_DELTA_REPORT_FLAG_KEYS,
    isEnabled: isResearchWatchDeltaReportEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-cross-mission-memory',
    ticketId: 'V10-RSR-028',
    requirementId: 'R-RESEARCH-28',
    block: 'research',
    title:
      'Cross-mission memory — pointer-only (not training), tenant-scoped, revocable (Wave A seed)',
    description:
      'Lets a new mission reuse evidence discovered in a ' +
      'prior mission via pointers (never by training or ' +
      'copy). Branded `CrossMissionMemoryId`, ' +
      '`MemoryPointerId`. Pure `buildCrossMissionMemory` / ' +
      '`resolveMemoryPointer`. `assertCrossMissionMemory`. ' +
      'Invariants: pointer only — no evidence content; ' +
      'tenant-scoped; revocation propagated; deterministic.',
    default: false,
    keys: RESEARCH_CROSS_MISSION_MEMORY_FLAG_KEYS,
    isEnabled: isResearchCrossMissionMemoryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-comparative-mission-mode',
    ticketId: 'V10-RSR-029',
    requirementId: 'R-RESEARCH-29',
    block: 'research',
    title:
      'Comparative mission mode — A-vs-B, shared evidence graph, disagreement preserved (Wave A seed)',
    description:
      'Runs two missions in parallel with shared scope and ' +
      'presents their outputs side-by-side. Branded ' +
      '`ComparativeMissionModeId`, `ComparativeSlotId` ' +
      '(A / B). Pure `buildComparativeMission`. ' +
      '`assertComparativeMission`. Invariants: both slots ' +
      'reference `MissionScopeV1`; same tenant; disagreement ' +
      'surfaced (not merged); deterministic slot ordering.',
    default: false,
    keys: RESEARCH_COMPARATIVE_MISSION_MODE_FLAG_KEYS,
    isEnabled: isResearchComparativeMissionModeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'research-quality-dashboard',
    ticketId: 'V10-RSR-030',
    requirementId: 'R-RESEARCH-30',
    block: 'research',
    title:
      'Research quality dashboard — coverage / disagreement / veto metrics, tenant-scoped (Wave A seed)',
    description:
      'Observability surface for research outputs. Branded ' +
      '`ResearchQualityDashboardId`. Closed metric catalogue ' +
      '(coverage / disagreement_rate / veto_rate). Pure ' +
      '`buildResearchQualityDashboard(records, window, now)`. ' +
      '`assertResearchQualityDashboard`. Invariants: metric ' +
      'from closed catalogue; tenant-scoped; every sample ' +
      'references `MissionPlanId`; deterministic.',
    default: false,
    keys: RESEARCH_QUALITY_DASHBOARD_FLAG_KEYS,
    isEnabled: isResearchQualityDashboardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-health-dashboard',
    ticketId: 'V10-CON-015',
    requirementId: 'R-CONNECT-15',
    block: 'connectors',
    title:
      'Connector health dashboard — per-connector uptime / error rate / freshness (Wave A seed)',
    description:
      'Per-connector observability surface. Branded ' +
      '`ConnectorHealthDashboardId`. Closed health-metric ' +
      'catalogue (uptime / error_rate / freshness_seconds). ' +
      'Pure `buildConnectorHealthDashboard(probes, window, ' +
      'now)`. `assertConnectorHealthDashboard`. Invariants: ' +
      'metric from closed catalogue; tenant-scoped; every ' +
      'probe references `ConnectorId`; deterministic.',
    default: false,
    keys: CONNECTORS_HEALTH_DASHBOARD_FLAG_KEYS,
    isEnabled: isConnectorsHealthDashboardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-google-drive',
    ticketId: 'V10-CON-016',
    requirementId: 'R-CONNECT-16',
    block: 'connectors',
    title:
      'Google Drive connector (MVP schema) — capability + scope catalogue, ingest-plan shape (Wave A seed)',
    description:
      'Schema-level MVP contract for the Google Drive ' +
      'connector. Branded `GoogleDriveConnectorId`. Closed ' +
      'capability catalogue, closed OAuth scope catalogue. ' +
      '`GoogleDriveIngestPlan` shape + pure ' +
      '`buildGoogleDriveIngestPlan`. ' +
      '`assertGoogleDriveConnector`. Invariants: capability / ' +
      'scope from closed catalogues; tenant-scoped; ' +
      'references `ConnectorId`; deterministic. No network ' +
      'I/O — Wave B wires the real fetcher.',
    default: false,
    keys: CONNECTORS_GOOGLE_DRIVE_FLAG_KEYS,
    isEnabled: isConnectorsGoogleDriveEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-slack',
    ticketId: 'V10-CON-017',
    requirementId: 'R-CONNECT-17',
    block: 'connectors',
    title:
      'Slack connector (MVP, read-only schema) — capability + scope catalogue, ingest-plan shape (Wave A seed)',
    description:
      'Schema-level MVP read-only contract for the Slack ' +
      'connector. Branded `SlackConnectorId`. Closed ' +
      'capability catalogue (read-only), closed OAuth scope ' +
      'catalogue. `SlackIngestPlan` shape + pure ' +
      '`buildSlackIngestPlan`. `assertSlackConnector`. ' +
      'Invariants: read-only capability set; capability / ' +
      'scope from closed catalogues; tenant-scoped; ' +
      'deterministic. No network I/O — Wave B wires the ' +
      'real fetcher.',
    default: false,
    keys: CONNECTORS_SLACK_FLAG_KEYS,
    isEnabled: isConnectorsSlackEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-notion-connector',
    ticketId: 'V10-CON-018',
    requirementId: 'R-CONNECT-18',
    block: 'connectors',
    title:
      'Notion connector (MVP schema) — capability + scope catalogue, ingest-plan shape (Wave A seed)',
    description:
      'Schema-level MVP contract for the Notion connector. ' +
      'Branded `NotionConnectorId`. Closed capability ' +
      'catalogue, closed OAuth scope catalogue. ' +
      '`NotionIngestPlan` shape + pure ' +
      '`buildNotionIngestPlan`. `assertNotionConnector`. ' +
      'Invariants: capability / scope from closed ' +
      'catalogues; tenant-scoped; references `ConnectorId`; ' +
      'deterministic. No network I/O — Wave B wires the ' +
      'real fetcher.',
    default: false,
    keys: CONNECTORS_NOTION_CONNECTOR_FLAG_KEYS,
    isEnabled: isConnectorsNotionConnectorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-email-connector',
    ticketId: 'V10-CON-019',
    requirementId: 'R-CONNECT-19',
    block: 'connectors',
    title:
      'Email connector (Gmail + O365, read-only schema) — provider catalogue, scope + ingest plan (Wave A seed)',
    description:
      'Schema-level MVP read-only contract for email ' +
      '(Gmail + O365). Branded `EmailConnectorId`. Closed ' +
      'provider catalogue (gmail / o365), closed OAuth scope ' +
      'catalogue (read-only), closed capability set. ' +
      '`EmailIngestPlan` shape + pure `buildEmailIngestPlan`. ' +
      '`assertEmailConnector`. Invariants: provider & scope ' +
      'from closed catalogues; read-only only; tenant-' +
      'scoped; deterministic. No network I/O — Wave B wires ' +
      'the real fetcher.',
    default: false,
    keys: CONNECTORS_EMAIL_CONNECTOR_FLAG_KEYS,
    isEnabled: isConnectorsEmailConnectorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-calendar-connector',
    ticketId: 'V10-CON-020',
    requirementId: 'R-CONNECT-20',
    block: 'connectors',
    title:
      'Calendar connector (Google + O365, read-only schema) — provider catalogue, scope + ingest plan (Wave A seed)',
    description:
      'Schema-level MVP read-only contract for calendar ' +
      '(Google + O365). Branded `CalendarConnectorId`. ' +
      'Closed provider catalogue (google / o365), closed ' +
      'OAuth scope catalogue (read-only), closed capability ' +
      'set. `CalendarIngestPlan` shape + pure ' +
      '`buildCalendarIngestPlan`. `assertCalendarConnector`. ' +
      'Invariants: provider & scope from closed catalogues; ' +
      'read-only only; tenant-scoped; deterministic. No ' +
      'network I/O — Wave B wires the real fetcher.',
    default: false,
    keys: CONNECTORS_CALENDAR_CONNECTOR_FLAG_KEYS,
    isEnabled: isConnectorsCalendarConnectorEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-connector-governance-ui',
    ticketId: 'V10-CON-021',
    requirementId: 'R-CONNECT-21',
    block: 'connectors',
    title:
      'Connector governance UI — per-tenant enable/disable + scope gates, audit-event shape (Wave A seed)',
    description:
      'Admin control surface for connectors. Branded ' +
      '`ConnectorGovernanceUiId`, `GovernanceDecisionId`. ' +
      'Closed decision catalogue (enable / disable / ' +
      'revoke_scope / grant_scope). Pure ' +
      '`applyGovernanceDecision`. Audit-event shape + ' +
      '`assertGovernanceDecisionAllowed`. Invariants: ' +
      'decision from closed catalogue; tenant-scoped; every ' +
      'decision emits audit event; deterministic state ' +
      'machine. No React component — Wave B.',
    default: false,
    keys: CONNECTORS_CONNECTOR_GOVERNANCE_UI_FLAG_KEYS,
    isEnabled: isConnectorsConnectorGovernanceUiEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-per-workload-breakdown',
    ticketId: 'V10-OUT-015',
    requirementId: 'R-OUTCOME-15',
    block: 'outcome',
    title:
      'Per-workload breakdown — 7 workload classes, sum ≤ grand total, attribution respected (Wave A seed)',
    description:
      'Rollup by workload class (fast / grounded / ' +
      'workspace / research / artifact / decision / agent). ' +
      'Branded `PerWorkloadBreakdownId`. Closed 7-entry ' +
      'workload catalogue. Pure `rollUpPerWorkload(records, ' +
      'now)`. `assertPerWorkloadBreakdown`. Invariants: ' +
      'workload class from closed catalogue; sum across ' +
      'workloads ≤ grand total; attribution fraction ' +
      'respected; reversed & redacted excluded; ' +
      'tenant-scoped; deterministic.',
    default: false,
    keys: OUTCOME_PER_WORKLOAD_BREAKDOWN_FLAG_KEYS,
    isEnabled: isOutcomePerWorkloadBreakdownEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-cfo-narrative-export',
    ticketId: 'V10-OUT-016',
    requirementId: 'R-OUTCOME-16',
    block: 'outcome',
    title:
      'CFO narrative export — structured JSON + PDF-summary shape, never-invent-metric (Wave A seed)',
    description:
      'Finance-grade outcome pack. Branded ' +
      '`CfoNarrativeExportId`. Closed export-format ' +
      'catalogue (json / pdf_summary). Pure ' +
      '`buildCfoNarrativeExport(rollups, window, now)`. ' +
      '`assertCfoNarrativeExport`. Invariants: metrics ' +
      'reference existing V1 fields only (never invent); ' +
      'tenant-scoped; window-bound; deterministic; ' +
      'reversed/redacted excluded.',
    default: false,
    keys: OUTCOME_CFO_NARRATIVE_EXPORT_FLAG_KEYS,
    isEnabled: isOutcomeCfoNarrativeExportEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-audit-log',
    ticketId: 'V10-OUT-017',
    requirementId: 'R-OUTCOME-17',
    block: 'outcome',
    title:
      'Outcome audit log — admin-exportable, closed action catalogue, append-only (Wave A seed)',
    description:
      'Append-only audit log for outcome records. Branded ' +
      '`OutcomeAuditLogId`, `AuditEntryId`. Closed action ' +
      'catalogue (accept / reverse / redact / reassign / ' +
      'override). Pure `appendOutcomeAuditEntry`. ' +
      '`assertOutcomeAuditEntry`. Invariants: append-only; ' +
      'action from closed catalogue; tenant-scoped; every ' +
      'entry references actor identity + before/after; ' +
      'deterministic ordering.',
    default: false,
    keys: OUTCOME_AUDIT_LOG_FLAG_KEYS,
    isEnabled: isOutcomeAuditLogEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-telemetry',
    ticketId: 'V10-OUT-018',
    requirementId: 'R-OUTCOME-18',
    block: 'outcome',
    title:
      'Outcome telemetry — closed event-kind catalogue, never-invent-metric, tenant-scoped (Wave A seed)',
    description:
      'Observability events for the outcome block. Branded ' +
      '`OutcomeTelemetryEventId`. Closed event-kind ' +
      'catalogue (accept / reverse / redact / export / ' +
      'rollup). Pure `emitOutcomeTelemetryEvent`. ' +
      '`assertOutcomeTelemetryEvent`. Invariants: event ' +
      'kind from closed catalogue; payload references ' +
      'existing V1 record fields only (never-invent-metric); ' +
      'tenant-scoped; deterministic.',
    default: false,
    keys: OUTCOME_TELEMETRY_FLAG_KEYS,
    isEnabled: isOutcomeTelemetryEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-user-disconnect',
    ticketId: 'V10-CON-022',
    requirementId: 'R-CONNECT-22',
    block: 'connectors',
    title:
      'User-level connector disconnect + token forgetting — closed 4-stage forgetting plan, terminal (Wave A seed)',
    description:
      'Lets a user disconnect a connector and forget their ' +
      'tokens/cache/ACL. Branded ' +
      '`UserDisconnectForgettingId`, `ForgettingPlanId`. ' +
      'Closed 4-stage catalogue (revoke_tokens / purge_cache ' +
      '/ redact_acl / emit_audit). Pure ' +
      '`buildForgettingPlan` / `applyForgettingStep`. ' +
      '`assertUserDisconnectForgetting`. Invariants: stage ' +
      'from closed catalogue; terminal on completion (no ' +
      'resurrection); tenant-scoped; user-scoped; ' +
      'deterministic.',
    default: false,
    keys: CONNECTORS_USER_DISCONNECT_FLAG_KEYS,
    isEnabled: isConnectorsUserDisconnectEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-telemetry-full',
    ticketId: 'V10-CON-023',
    requirementId: 'R-CONNECT-23',
    block: 'connectors',
    title:
      'Connector telemetry — closed event-kind catalogue, tenant-scoped, deterministic (Wave A seed)',
    description:
      'Observability events for connector operations. ' +
      'Branded `ConnectorTelemetryEventId`. Closed ' +
      'event-kind catalogue (read_call / write_call / ' +
      'latency_sample / failure). Pure ' +
      '`emitConnectorTelemetryEvent`. ' +
      '`assertConnectorTelemetryEvent`. Invariants: event ' +
      'kind from closed catalogue; payload fields from ' +
      'closed catalogue; references `ConnectorId`; ' +
      'tenant-scoped; deterministic.',
    default: false,
    keys: CONNECTORS_TELEMETRY_FULL_FLAG_KEYS,
    isEnabled: isConnectorsTelemetryFullEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'connectors-write-framework',
    ticketId: 'V10-CON-024',
    requirementId: 'R-CONNECT-24',
    block: 'connectors',
    title:
      'Write-scope framework — gated behind ExecutionProposal, closed capability catalogue (Wave A seed · Wave C gated)',
    description:
      'Schema contract for connector write operations. ' +
      'Branded `WriteScopeFrameworkId`, `WriteRequestId`. ' +
      'Closed write-capability catalogue. `WriteRequest` ' +
      'shape referencing `executionProposalId`. Pure ' +
      '`requireWriteApproval`. ' +
      '`assertWriteScopeFramework`. Invariants: write ' +
      'rejected without approved ExecutionProposal ref; ' +
      'capability from closed catalogue; tenant-scoped; ' +
      'deterministic. Wave C wires the real write adapter.',
    default: false,
    keys: CONNECTORS_WRITE_FRAMEWORK_FLAG_KEYS,
    isEnabled: isConnectorsWriteFrameworkEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-never-invent-metric',
    ticketId: 'V10-OUT-019',
    requirementId: 'R-OUTCOME-19',
    block: 'outcome',
    title:
      'Never-invent-metric invariant — closed metric-field allowlist, CI utility (Wave A seed · on-by-construction policy)',
    description:
      'Core CI utility that rejects outcome events whose ' +
      'payload references metric fields not present in the ' +
      'V1 record registry. Branded ' +
      '`NeverInventMetricPolicyId`. Closed metric-field ' +
      'allowlist. Pure `assertMetricFromRegistry(event)`. ' +
      '`NeverInventMetricError` with closed reason codes. ' +
      'Invariants: every emitted metric field ∈ allowlist; ' +
      'tenant-scoped; deterministic. Per-file flag default ' +
      'OFF; the policy runs regardless of flag — the flag ' +
      'gates the admin UI surface.',
    default: false,
    keys: OUTCOME_NEVER_INVENT_METRIC_FLAG_KEYS,
    isEnabled: isOutcomeNeverInventMetricEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-admin-overrides',
    ticketId: 'V10-OUT-020',
    requirementId: 'R-OUTCOME-20',
    block: 'outcome',
    title:
      'Outcome admin overrides — redact/reassign, audit-bound, terminal redact (Wave A seed)',
    description:
      'Admin actions that modify an outcome record. Branded ' +
      '`OutcomeAdminOverrideId`. Closed override catalogue ' +
      '(redact / reassign). Pure `applyAdminOverride` ' +
      'returning updated record + audit entry. ' +
      '`assertAdminOverrideAllowed`. Invariants: admin ' +
      'identity required; before/after captured; tenant-' +
      'scoped; redact is terminal (no resurrection); ' +
      'reassign respects closed persona catalogue; ' +
      'deterministic.',
    default: false,
    keys: OUTCOME_ADMIN_OVERRIDES_FLAG_KEYS,
    isEnabled: isOutcomeAdminOverridesEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-revenue-margin-attribution',
    ticketId: 'V10-OUT-021',
    requirementId: 'R-OUTCOME-21',
    block: 'outcome',
    title:
      'Revenue / margin attribution — CRM signal sources, ISO-4217 subset, cents precision (Wave A seed)',
    description:
      'Attributes revenue / margin to outcomes via CRM ' +
      'signals. Branded `RevenueMarginAttributionId`. ' +
      'Closed signal-source catalogue (crm_opportunity / ' +
      'crm_invoice / manual). Pure ' +
      '`buildRevenueMarginAttribution`. ' +
      '`assertRevenueMarginAttribution`. Invariants: ' +
      'currency code from closed ISO-4217 subset; cents-' +
      'precision integers only; attribution respects ' +
      '`AttributionPolicyV1`; reversed/redacted excluded; ' +
      'tenant-scoped; deterministic.',
    default: false,
    keys: OUTCOME_REVENUE_MARGIN_ATTRIBUTION_FLAG_KEYS,
    isEnabled: isOutcomeRevenueMarginAttributionEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-risk-avoided',
    ticketId: 'V10-OUT-022',
    requirementId: 'R-OUTCOME-22',
    block: 'outcome',
    title:
      'Risk-avoided outcomes — decision_review lineage, closed risk-kind catalogue (Wave A seed)',
    description:
      'Outcomes derived from decision_review lineage where ' +
      'a risk was avoided. Branded `RiskAvoidedOutcomeId`. ' +
      'Closed risk-kind catalogue (compliance / financial / ' +
      'reputational / security). Pure ' +
      '`buildRiskAvoidedOutcome`. `assertRiskAvoidedOutcome`.' +
      ' Invariants: requires `decision_review` lineage ref; ' +
      'risk kind from closed catalogue; magnitude ≥ 0; ' +
      'attribution respects `AttributionPolicyV1`; reversed/' +
      'redacted excluded; tenant-scoped; deterministic.',
    default: false,
    keys: OUTCOME_RISK_AVOIDED_OUTCOME_FLAG_KEYS,
    isEnabled: isOutcomeRiskAvoidedOutcomeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-cohort-benchmark',
    ticketId: 'V10-OUT-023',
    requirementId: 'R-OUTCOME-23',
    block: 'outcome',
    title:
      'Cohort benchmarking — anonymised, opt-in, k-anonymity threshold (Wave A seed)',
    description:
      'Benchmarks tenant outcomes against an anonymised ' +
      'cohort. Branded `CohortBenchmarkId`, ' +
      '`CohortDefinitionId`. Closed cohort-dimension ' +
      'catalogue (industry / size / persona). Pure ' +
      '`buildCohortBenchmark`. `assertCohortBenchmark`. ' +
      'Invariants: per-tenant opt-in required; output ' +
      'anonymised (no tenantId, min k-anonymity); ' +
      'dimension from closed catalogue; tenant-scoped ' +
      'input; deterministic.',
    default: false,
    keys: OUTCOME_COHORT_BENCHMARK_FLAG_KEYS,
    isEnabled: isOutcomeCohortBenchmarkEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'outcome-quality-dashboard',
    ticketId: 'V10-OUT-024',
    requirementId: 'R-OUTCOME-24',
    block: 'outcome',
    title:
      'Outcome quality dashboard — confirmation / reversal / coverage metrics (Wave A seed)',
    description:
      'Observability surface for outcome quality. Branded ' +
      '`OutcomeQualityDashboardId`. Closed metric catalogue ' +
      '(confirmation_rate / reversal_rate / ' +
      'attribution_coverage). Pure ' +
      '`buildOutcomeQualityDashboard(records, window, now)`. ' +
      '`assertOutcomeQualityDashboard`. Invariants: metric ' +
      'from closed catalogue; window-bound; tenant-scoped; ' +
      'reversed/redacted excluded from confirmation-rate ' +
      'denominator; deterministic.',
    default: false,
    keys: OUTCOME_OUTCOME_QUALITY_DASHBOARD_FLAG_KEYS,
    isEnabled: isOutcomeOutcomeQualityDashboardEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'agent-runtime-time-travel-replay',
    ticketId: 'V10-AGT-028',
    requirementId: 'R-AGENT-28',
    block: 'agent_runtime',
    title:
      'Agent time-travel + replay — forensic replay timeline, closed event-kind catalogue (Wave C seed)',
    description:
      'Operator-side replay contract for executed agent ' +
      'runs. Branded `AgentTimeTravelReplayId`. Closed ' +
      'event-kind catalogue (step_forward / step_backward / ' +
      'snapshot / diverge). Pure `buildReplayTimeline`. ' +
      '`assertReplayTimeline`. Invariants: events ordered ' +
      'monotonically; tenant-scoped; references `RunId`; ' +
      'deterministic. Wave C — paired with Run Ledger.',
    default: false,
    keys: AGENT_RUNTIME_TIME_TRAVEL_REPLAY_FLAG_KEYS,
    isEnabled: isAgentRuntimeTimeTravelReplayEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-crdt-replicated-state',
    ticketId: 'V10-ART-029',
    requirementId: 'R-ARTIFACT-29',
    block: 'artifact',
    title:
      'CRDT replicated state — vendor-agnostic abstraction, closed op-kind catalogue (Wave C seed)',
    description:
      'Vendor-agnostic CRDT contract per ADR-V10-004 (no ' +
      'Yjs/Automerge import). Branded `ReplicaId`, ' +
      '`VectorClock`. Closed op-kind catalogue ' +
      '(insert / delete / set / move). Pure `buildCrdtOp` / ' +
      '`mergeCrdtStates`. `assertCrdtReplicatedState`. ' +
      'Invariants: vector-clock monotone; tenant-scoped; ' +
      'deterministic. Wave C — vendor choice deferred.',
    default: false,
    keys: ARTIFACT_CRDT_REPLICATED_STATE_FLAG_KEYS,
    isEnabled: isArtifactCrdtReplicatedStateEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-presence',
    ticketId: 'V10-ART-030',
    requirementId: 'R-ARTIFACT-30',
    block: 'artifact',
    title:
      'Artifact presence — multiplayer cursor/awareness schema, 3-state catalogue (Wave C seed)',
    description:
      'Schema contract for real-time multiplayer presence. ' +
      'Branded `PresenceSessionId`. Closed presence-state ' +
      'catalogue (active / idle / disconnected). Pure ' +
      '`buildPresenceSnapshot`. `assertArtifactPresence`. ' +
      'Invariants: tenant-scoped; user-scoped; deterministic.' +
      ' Wave C — no network wire here.',
    default: false,
    keys: ARTIFACT_PRESENCE_FLAG_KEYS,
    isEnabled: isArtifactPresenceEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'artifact-cross-replica-merge',
    ticketId: 'V10-ART-031',
    requirementId: 'R-ARTIFACT-31',
    block: 'artifact',
    title:
      'Cross-replica merge — conflict-marker catalogue, CRDT-backed, deterministic (Wave C seed)',
    description:
      'Merge semantics for concurrent artifact edits. ' +
      'Branded `CrossReplicaMergeId`. Closed conflict-marker ' +
      'catalogue (both_deleted / concurrent_edit / ' +
      'causal_reorder). Builds on `CrdtReplicatedState`. ' +
      'Pure `computeMergeResult`. ' +
      '`assertCrossReplicaMerge`. Invariants: deterministic; ' +
      'tenant-scoped; references `ReplicaId`.',
    default: false,
    keys: ARTIFACT_CROSS_REPLICA_MERGE_FLAG_KEYS,
    isEnabled: isArtifactCrossReplicaMergeEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-reasoning-fast-chat',
    ticketId: 'V10-PIP-001',
    requirementId: 'R-PIPELINE-1',
    block: 'reasoning',
    title:
      'ReasoningFastChatPipeline — composes WorkloadClass + Intent + Scope + FastChat + Presentation (Wave-B bridge)',
    description:
      'Cross-block integration pipeline wiring reasoning ' +
      'Wave-A seeds into a pure, deterministic fast-chat ' +
      'contract. Composes `WorkloadClassRegistry` (class = ' +
      '`fast_chat`), `IntentClassifier`, `ScopeResolver`, ' +
      '`FastChat`, `PresentationLayer`. Runtime invariants: ' +
      'tenant-scoped; workload class fixed to fast_chat; ' +
      'closed-catalogue intent; deterministic. Wave-B bridge —' +
      ' proves reasoning seeds compose. Wave B will wrap ' +
      'this with route + UI.',
    default: false,
    keys: PIPELINES_REASONING_FAST_CHAT_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesReasoningFastChatPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-reasoning-grounded-chat',
    ticketId: 'V10-PIP-002',
    requirementId: 'R-PIPELINE-2',
    block: 'reasoning',
    title:
      'ReasoningGroundedChatPipeline — retrieval + claim extraction + hallucination veto + TrustBundle (Wave-B bridge)',
    description:
      'Cross-block pipeline for grounded reasoning. ' +
      'Composes `WorkloadClassRegistry` (class = ' +
      '`grounded_chat`), intent/scope/plan stack, ' +
      '`RetrievalLayer`, `ClaimExtraction`, ' +
      '`HallucinationFilter` (veto path), `TrustBundleV1`, ' +
      '`PresentationLayer`. Invariants: TrustBundle ' +
      'references upstream retrieval query id; veto ' +
      'terminal; tenant-scoped; deterministic.',
    default: false,
    keys: PIPELINES_REASONING_GROUNDED_CHAT_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesReasoningGroundedChatPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-research-mission',
    ticketId: 'V10-PIP-003',
    requirementId: 'R-PIPELINE-3',
    block: 'research',
    title:
      'ResearchMissionPipeline — plan → executor → claims → evidence graph → trust bundle (Wave-B bridge)',
    description:
      'Cross-block pipeline for a complete research mission ' +
      'run. Composes `ResearchMissionV1`, `MissionScopeV1`, ' +
      '`MissionPlanFormulator`, `MissionBudget`, ' +
      '`ResearchExecutor`, `ContentExtractor`, ' +
      '`ClaimValidator`, `DedupNearDuplicate`, ' +
      '`EvidenceGraphV1`, `MissionTrustBundle`, ' +
      '`DisagreementPresentation`. Invariants: mission-' +
      'scope tenancy propagated; disagreement preserved not ' +
      'merged; deterministic.',
    default: false,
    keys: PIPELINES_RESEARCH_MISSION_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesResearchMissionPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-research-watch',
    ticketId: 'V10-PIP-004',
    requirementId: 'R-PIPELINE-4',
    block: 'research',
    title:
      'ResearchWatchPipeline — scheduled watch → mission → delta report → audit (Wave-B bridge)',
    description:
      'Cross-block pipeline wiring scheduled watches into ' +
      'mission runs + delta reports. Composes ' +
      '`ScheduledWatches`, research mission seeds, ' +
      '`WatchDeltaReport`, `MissionAuditLog`. Invariants: ' +
      'mission scope stable across runs; delta kinds from ' +
      'closed catalogue; tenant-scoped; deterministic.',
    default: false,
    keys: PIPELINES_RESEARCH_WATCH_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesResearchWatchPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-artifact-mutation',
    ticketId: 'V10-PIP-005',
    requirementId: 'R-PIPELINE-5',
    block: 'artifact',
    title:
      'ArtifactMutationPipeline — proposal → FSM → partial accept → audit (Wave-B bridge)',
    description:
      'Cross-block pipeline for artifact mutation. ' +
      'Composes the Artifact unified model + type registry + ' +
      'review FSM + `MutationProposalV1` + typed ops + ' +
      'no-silent-writes + approve/edit/reject + partial ' +
      'accept + one-step undo + audit trail. Invariants: ' +
      'approved immutability; tenant-scoped; every mutation ' +
      'emits an audit entry; deterministic.',
    default: false,
    keys: PIPELINES_ARTIFACT_MUTATION_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesArtifactMutationPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-artifact-export',
    ticketId: 'V10-PIP-006',
    requirementId: 'R-PIPELINE-6',
    block: 'artifact',
    title:
      'ArtifactExportPipeline — approved → manifest + SHA-256 + watermark + lineage (Wave-B bridge)',
    description:
      'Cross-block pipeline for artifact export. Composes ' +
      'unified model + review FSM + `ExportManifest` + ' +
      'watermark footer + version + lineage graph. ' +
      'Invariants: export requires approved state; SHA-256 ' +
      'deterministic over canonical bytes; lineage pointer ' +
      'preserved; tenant-scoped.',
    default: false,
    keys: PIPELINES_ARTIFACT_EXPORT_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesArtifactExportPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-agent-execution',
    ticketId: 'V10-PIP-007',
    requirementId: 'R-PIPELINE-7',
    block: 'agent_runtime',
    title:
      'AgentExecutionPipeline — proposal → severity → approval → run ledger (Wave-B bridge)',
    description:
      'Cross-block pipeline for agent execution. Composes ' +
      '`ExecutionProposalV1` + severity ladder + approval ' +
      'gate + run ledger + anti-patterns. Invariants: ' +
      'severity from closed ladder; approval required for ' +
      'S2+; run-ledger append-only; tenant-scoped; ' +
      'deterministic.',
    default: false,
    keys: PIPELINES_AGENT_EXECUTION_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesAgentExecutionPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-agent-schedule',
    ticketId: 'V10-PIP-008',
    requirementId: 'R-PIPELINE-8',
    block: 'agent_runtime',
    title:
      'AgentSchedulePipeline — schedule → run → ledger → replay (Wave-B bridge)',
    description:
      'Cross-block pipeline for scheduled agent runs. ' +
      'Composes schedule definition + run ledger + time-' +
      'travel replay (V10-AGT-028). Invariants: schedule ' +
      'tenant-scoped; run references schedule id; ledger ' +
      'append-only; replay timeline monotone.',
    default: false,
    keys: PIPELINES_AGENT_SCHEDULE_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesAgentSchedulePipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-outcome-rollup',
    ticketId: 'V10-PIP-009',
    requirementId: 'R-PIPELINE-9',
    block: 'outcome',
    title:
      'OutcomeRollupPipeline — signals → dedup → records → team/persona/workload rollups (Wave-B bridge)',
    description:
      'Cross-block pipeline for outcome rollups. Composes ' +
      '`OutcomeSignalV1` + `OutcomeRecordV1` + taxonomy + ' +
      '`AttributionPolicyV1` + `LineageBinding` + ' +
      '`DoubleCountGuard` + `OutcomeReversal` + per-team / ' +
      'per-persona / per-workload rollups + audit + ' +
      'telemetry. Invariants: reversed/redacted excluded; ' +
      'attribution fraction respected; tenant-scoped; ' +
      'deterministic.',
    default: false,
    keys: PIPELINES_OUTCOME_ROLLUP_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesOutcomeRollupPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-learning-feedback',
    ticketId: 'V10-PIP-010',
    requirementId: 'R-PIPELINE-10',
    block: 'learning',
    title:
      'LearningFeedbackPipeline — consent → collector → memory pack → TTL → revocation (Wave-B bridge)',
    description:
      'Cross-block pipeline for learning feedback capture. ' +
      'Composes `TypedConsent` + `FeedbackSignalV1` + ' +
      '`FeedbackCollector` + `BehaviouralSignals` + ' +
      '`MemoryPackV1` + `TtlForgetting` + `Revocation`. ' +
      'Invariants: consent required before collection; TTL ' +
      'enforced; revocation propagated; tenant-scoped.',
    default: false,
    keys: PIPELINES_LEARNING_FEEDBACK_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesLearningFeedbackPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-connectors-ingest',
    ticketId: 'V10-PIP-011',
    requirementId: 'R-PIPELINE-11',
    block: 'connectors',
    title:
      'ConnectorsIngestPipeline — oauth → sync → ACL → freshness → telemetry (Wave-B bridge)',
    description:
      'Cross-block pipeline for connector ingest ticks. ' +
      'Composes connector interface + registry + session + ' +
      'OAuth layer + token vault + incremental sync + ' +
      'rate-limit backoff + ACL propagation + freshness ' +
      'SLO + telemetry. Invariants: token vault pinned; ' +
      'ACL propagated; tenant-scoped; deterministic.',
    default: false,
    keys: PIPELINES_CONNECTORS_INGEST_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesConnectorsIngestPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
  {
    id: 'pipelines-onboarding-persona',
    ticketId: 'V10-PIP-012',
    requirementId: 'R-PIPELINE-12',
    block: 'onboarding',
    title:
      'OnboardingPersonaPipeline — persona → trust banner → conservative defaults → CFO bootstrap (Wave-B bridge)',
    description:
      'Cross-block pipeline for new-user onboarding. ' +
      'Composes persona capture + trust-first banner + ' +
      'conservative defaults + CFO workspace bootstrap + ' +
      'telemetry. Invariants: persona from closed ' +
      'catalogue; trust banner before any CTA; defaults ' +
      'conservative by construction; tenant-scoped.',
    default: false,
    keys: PIPELINES_ONBOARDING_PERSONA_PIPELINE_FLAG_KEYS,
    isEnabled: isPipelinesOnboardingPersonaPipelineEnabled,
    telemetry: [],
    testId: null,
    specDocs: [
      'docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md',
      'docs/Chat V9/ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md',
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// §4 — Accessors.
// ---------------------------------------------------------------------------

export interface ChatV10FlagSnapshotEntry {
  readonly id: string;
  readonly ticketId: TicketId;
  readonly requirementId: RequirementId;
  readonly block: ChatV10Block;
  readonly enabled: boolean;
  readonly default: boolean;
  readonly matchesDefault: boolean;
}

/**
 * Returns the current resolved state of every registered V10 flag. Safe
 * to call from SSR — each resolver falls back to the hardcoded default
 * when `window` is unavailable. With the registry empty, returns `[]`.
 */
export function getChatV10FlagSnapshot(): ChatV10FlagSnapshotEntry[] {
  return CHAT_V10_FLAGS.map((flag) => {
    const enabled = flag.isEnabled();
    return {
      id: flag.id,
      ticketId: flag.ticketId,
      requirementId: flag.requirementId,
      block: flag.block,
      enabled,
      default: flag.default,
      matchesDefault: enabled === flag.default,
    };
  });
}

export function findChatV10Flag(id: string): ChatV10FlagDescriptor | undefined {
  return CHAT_V10_FLAGS.find((f) => f.id === id);
}

export function findChatV10FlagByTicket(ticketId: TicketId): ChatV10FlagDescriptor | undefined {
  return CHAT_V10_FLAGS.find((f) => f.ticketId === ticketId);
}

export function findChatV10FlagByRequirement(
  requirementId: RequirementId,
): ChatV10FlagDescriptor | undefined {
  return CHAT_V10_FLAGS.find((f) => f.requirementId === requirementId);
}

export function getChatV10FlagOverrides(): ChatV10FlagSnapshotEntry[] {
  return getChatV10FlagSnapshot().filter((entry) => !entry.matchesDefault);
}

// ---------------------------------------------------------------------------
// §5 — Write-side helpers.
// ---------------------------------------------------------------------------
// All three write helpers delegate into `chatFlagsShared` so V9 and V10
// cannot drift (e.g. one registry writing `'true'` while the other
// writes `'1'`).

export function getChatV10FlagOverrideState(id: string): FlagOverrideState {
  const flag = findChatV10Flag(id);
  if (!flag) return null;
  return readFlagOverrideState(flag.keys.localStorage);
}

/**
 * Sets the `localStorage` override for a V10 flag. Pass `null` to clear
 * the override and fall back to env / default. Returns `false` when the
 * flag is unknown or the environment rejects the write (SSR,
 * private-mode quota).
 */
export function setChatV10FlagOverride(id: string, next: FlagOverrideState): boolean {
  const flag = findChatV10Flag(id);
  if (!flag) return false;
  return writeFlagOverride(flag.keys.localStorage, encodeFlagOverrideState(next));
}

export function clearChatV10FlagOverride(id: string): boolean {
  return setChatV10FlagOverride(id, null);
}

/**
 * Clears overrides for every registered V10 flag. Returns the number of
 * successful clears — useful for the "Reset V10 to defaults" toast.
 * With an empty registry the return value is always `0`.
 */
export function resetAllChatV10FlagOverrides(): number {
  let cleared = 0;
  for (const flag of CHAT_V10_FLAGS) {
    if (writeFlagOverride(flag.keys.localStorage, null)) {
      cleared += 1;
    }
  }
  return cleared;
}
