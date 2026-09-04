import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ALLOWED_RUNTIME_DDL_BY_FILE: Record<string, number> = {
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
  "server/src/services/ai/llmConfigService.ts": 7,
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
  "server/src/services/workbook/workbookSchemaGuard.ts": 1
};

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}

describe('runtime DDL schema guard', () => {
  it('rejects every new CREATE TABLE in services outside the explicit legacy allowlist', () => {
    const actual: Record<string, number> = {};
    for (const file of files(path.join(process.cwd(), 'server/src/services'))) {
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
