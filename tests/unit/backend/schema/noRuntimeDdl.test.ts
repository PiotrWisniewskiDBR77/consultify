import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ALLOWED_RUNTIME_DDL_BY_FILE: Record<string, number> = {
  "server/src/controllers/DecisionController.ts": 2,
  "server/src/controllers/InterviewController.ts": 8,
  "server/src/controllers/SuperAdminController.ts": 11,
  "server/src/controllers/ToolController.ts": 6,
  "server/src/controllers/UserController.ts": 1,
  "server/src/cron/AIOpsReportCron.ts": 1,
  "server/src/database/DatabaseInitializer.ts": 67,
  "server/src/database/PostgresDatabase.ts": 73,
  "server/src/database/migrations/add_resource_tables.sql": 2,
  "server/src/index.ts": 1,
  "server/src/jobs/aiWatchdog.ts": 2,
  "server/src/middleware/demoGuard.middleware.ts": 1,
  "server/src/routes/admin/domains.routes.ts": 1,
  "server/src/routes/adminP32.routes.ts": 8,
  "server/src/routes/aiSettingsFallback.ts": 1,
  "server/src/routes/assessment-reports.routes.ts": 3,
  "server/src/routes/assessment/assessment-level-attachments.routes.ts": 1,
  "server/src/routes/assessment/assessment-workflow.routes.ts": 3,
  "server/src/routes/chat-projects.routes.ts": 2,
  "server/src/routes/client-errors.routes.ts": 1,
  "server/src/routes/compliance.routes.ts": 1,
  "server/src/routes/consultant-project-access.routes.ts": 1,
  "server/src/routes/discovery.routes.ts": 1,
  "server/src/routes/featureFlags.routes.ts": 2,
  "server/src/routes/featureUpdates.routes.ts": 3,
  "server/src/routes/feedback.routes.ts": 4,
  "server/src/routes/integrations/scim.routes.ts": 5,
  "server/src/routes/integrations/sso.routes.ts": 1,
  "server/src/routes/integrations/webhooks.routes.ts": 1,
  "server/src/routes/intelligence.routes.ts": 2,
  "server/src/routes/llm.routes.ts": 7,
  "server/src/routes/module-access.routes.ts": 1,
  "server/src/routes/organization/approved-domains.routes.ts": 1,
  "server/src/routes/organization/branding.routes.ts": 1,
  "server/src/routes/organization/organization-data.routes.ts": 1,
  "server/src/routes/organization/ownership.routes.ts": 1,
  "server/src/routes/organization/rbac.routes.ts": 3,
  "server/src/routes/pmo/pmoRoles.routes.ts": 2,
  "server/src/routes/pmo/workstreams.routes.ts": 1,
  "server/src/routes/public-contact.routes.ts": 1,
  "server/src/routes/resultsStrategic.routes.ts": 5,
  "server/src/routes/security/roles.routes.ts": 1,
  "server/src/routes/securityPolicies.routes.ts": 1,
  "server/src/routes/share.routes.ts": 2,
  "server/src/routes/superadmin.routes.ts": 2,
  "server/src/routes/systemHealth.routes.ts": 1,
  "server/src/routes/testSupport.routes.ts": 11,
  "server/src/routes/user/user-keyboard-shortcuts.routes.ts": 1,
  "server/src/routes/v8/execution-control.routes.ts": 2,
  "server/src/routes/v8/interview.routes.ts": 4,
  "server/src/routes/webhooks/stripe.routes.ts": 1,
  "server/src/routes/work-canvas.routes.ts": 4,
  "server/src/routes/workbook.routes.ts": 1,
  "server/src/scripts/a03PlanningClarificationRealDbProof.ts": 2,
  "server/src/scripts/t01FinalOutputRealDbProof.ts": 7,
  "server/src/services/AuditLogger.ts": 1,
  "server/src/services/InterviewAssignmentService.ts": 3,
  "server/src/services/InterviewInsightService.ts": 1,
  "server/src/services/KnowledgeService.ts": 5,
  "server/src/services/ai/aiCostAlertsService.ts": 1,
  "server/src/services/ai/aiRoutingBootstrapService.ts": 2,
  "server/src/services/ai/chatTraceService.ts": 2,
  "server/src/services/ai/documentGovernance.ts": 1,
  "server/src/services/ai/embeddingService": 1,
  "server/src/services/ai/embeddingService.ts": 1,
  "server/src/services/ai/evalHarnessService.ts": 2,
  "server/src/services/ai/knowledgeGraphService.ts": 2,
  "server/src/services/ai/knowledgeIndexer.ts": 2,
  "server/src/services/ai/organizationMemoryStore.ts": 1,
  "server/src/services/ai/routingRulesService.ts": 1,
  "server/src/services/aiBudgetService.ts": 3,
  "server/src/services/aiGovernanceService.ts": 3,
  "server/src/services/aiOperatorService.ts": 4,
  "server/src/services/aiRunLedgerService.ts": 2,
  "server/src/services/aiSettingsService.ts": 2,
  "server/src/services/artifacts/ArtifactConversionService.ts": 1,
  "server/src/services/assessment/AssessmentDefinitionService.ts": 1,
  "server/src/services/assessmentPermissionService.ts": 3,
  "server/src/services/auditProgramService.ts": 2,
  "server/src/services/backupService.ts": 5,
  "server/src/services/brandVoiceProfileService.ts": 1,
  "server/src/services/canvasMaterialize.ts": 1,
  "server/src/services/caseWorkspace/adapters/assessmentAdapter.ts": 1,
  "server/src/services/conclusions/ConclusionReadoutService.ts": 1,
  "server/src/services/conclusions/ConclusionService.ts": 3,
  "server/src/services/deliverables/deliverablesTelemetryService.ts": 1,
  "server/src/services/demo/demoSessionService.ts": 3,
  "server/src/services/demoTrialTelemetryService.ts": 1,
  "server/src/services/effectiveAccessService.ts": 3,
  "server/src/services/emailVerificationService.ts": 1,
  "server/src/services/executiveAggregateService.ts": 3,
  "server/src/services/executiveInsightsService.ts": 1,
  "server/src/services/health/healthProbeService.ts": 1,
  "server/src/services/initiative/initiativeWizardService.ts": 3,
  "server/src/services/initiative/suggestedChangesService.ts": 2,
  "server/src/services/insightSourceBasketService.ts": 2,
  "server/src/services/integrationConnectionLogService.ts": 1,
  "server/src/services/integrationHubService.ts": 1,
  "server/src/services/integrationOAuthEngine.ts": 1,
  "server/src/services/integrationOwnershipService.ts": 1,
  "server/src/services/interviewInsightReportPackService.ts": 4,
  "server/src/services/legacyCutover/registry/settings.ts": 1,
  "server/src/services/meetingBoundary/meetingBoundaryService.ts": 1,
  "server/src/services/meetingService.ts": 2,
  "server/src/services/notebookService.ts": 2,
  "server/src/services/notificationOutboxService.ts": 1,
  "server/src/services/notificationService.ts": 1,
  "server/src/services/organizationContext/ContextDocumentService.ts": 7,
  "server/src/services/partnerApplicationIntakeService.ts": 1,
  "server/src/services/partnerPayoutSettingsService.ts": 1,
  "server/src/services/partnerProgramLedgerService.ts": 2,
  "server/src/services/partnerReferralService.ts": 5,
  "server/src/services/releaseGate/sqlChainChecksumPolicy.ts": 1,
  "server/src/services/reportBuilderService.ts": 1,
  "server/src/services/researchSessionService.ts": 4,
  "server/src/services/resultsVnext/roi/roiLegacyArchiveRepository.ts": 1,
  "server/src/services/securityIncidentService.ts": 1,
  "server/src/services/slack/slackRouter.ts": 1,
  "server/src/services/supportTicketService.ts": 2,
  "server/src/services/tablePlatform/migrationIdentity.ts": 1,
  "server/src/services/tablePlatform/migrationRunner.ts": 1,
  "server/src/services/v8/interviewInsightCandidateService.ts": 1,
  "server/src/services/v8/interviewInsightFindingsService.ts": 4,
  "server/src/services/v8/teresaCopilotService.ts": 4,
  "server/src/services/valueLedgerService.ts": 2,
  "server/src/services/vault/vaultDocumentVersionService.ts": 1,
  "server/src/services/wave5ArtifactRuntimeService.ts": 3,
  "server/src/services/wave6ContextLearningService.ts": 4,
  "server/src/services/wave7ConnectorRuntimeService.ts": 2,
  "server/src/services/wave8AgentRuntimeService.ts": 5,
  "server/src/services/wave9OutcomeRuntimeService.ts": 7,
  "server/src/services/workCanvasService.ts": 3,
  "server/src/services/workbook/workbookCommandService.ts": 1,
  "server/src/services/workbook/workbookSchemaGuard.ts": 1,
  "server/src/utils/ensureUserOnboardingStatusTable.ts": 1
};

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // Owner/WIP backups are explicitly outside this guard's readable scope.
    if (entry.isDirectory() && entry.name === '_backup') return [];
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}

describe('runtime DDL schema guard', () => {
  it('rejects every new CREATE TABLE in server/src outside the explicit legacy allowlist', () => {
    const actual: Record<string, number> = {};
    for (const file of files(path.join(process.cwd(), 'server/src'))) {
      if (file.includes('/__tests__/')) continue;
      const content = fs.readFileSync(file, 'utf8');
      const count = content.match(/CREATE TABLE IF NOT EXISTS/g)?.length ?? 0;
      if (count > 0) actual[path.relative(process.cwd(), file)] = count;
    }
    expect(actual).toEqual(ALLOWED_RUNTIME_DDL_BY_FILE);
  });

  it('keeps SQLite AUTOINCREMENT out of service runtime DDL', () => {
    const offenders = files(path.join(process.cwd(), 'server/src/services'))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('AUTOINCREMENT'))
      .map((file) => path.relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
