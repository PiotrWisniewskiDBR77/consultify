import { createHash } from 'node:crypto';

import express, { type Express } from 'express';
import JSZip from 'jszip';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FILE_UPLOAD_SIGNATURE_MISMATCH_CODE } from '../../../middleware/fileUpload.middleware.js';
import { inputSanitizationMiddleware } from '../../../middleware/inputSanitization.middleware.js';
import { V8_FINANCE_READ_CONTRACT } from '../finance.routes.js';

const mockFinanceEditorGate = vi.hoisted(() => vi.fn());
vi.mock('../../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireFinanceEditorMembership: (...args: unknown[]) => mockFinanceEditorGate(...args),
}));

const mockGetFinanceDashboard = vi.fn();
const mockGetStatementPackDetail = vi.fn();
const mockGetStatementDetail = vi.fn();
const mockListStatements = vi.fn();
const mockListStatementPacks = vi.fn();
const mockCreateModel = vi.fn();
const mockAddEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockListModels = vi.fn();
const mockGetModel = vi.fn();
const mockApproveModel = vi.fn();
const mockComputeModel = vi.fn();
const mockUpdateModel = vi.fn();
const mockGetOutputs = vi.fn();
const mockGetValidations = vi.fn();
const mockListEvents = vi.fn();
const mockListValuations = vi.fn();
const mockListBudgets = vi.fn();
const mockRegisterBudget = vi.fn();
const mockApplyBudgetLineCommand = vi.fn();
const mockProjectBudgetScenario = vi.fn();
const mockUpdateBudgetScenarioAdjustments = vi.fn();
const mockApproveBudgetCommand = vi.fn();
const mockDiscardBudgetCommand = vi.fn();
const mockArchiveDigitizationAnalysisCommand = vi.fn();
const mockRegisterDigitizationAnalysis = vi.fn();
const mockUpdateDigitizationAnalysisCommand = vi.fn();
const mockLinkDigitizationAnalysisInitiativeCommand = vi.fn();
const mockImportBudgetDocumentCommand = vi.fn();
const mockLinkBudgetInitiativeCommand = vi.fn();
const mockUnlinkBudgetInitiativeCommand = vi.fn();
const mockExtractDocumentTextFromBuffer = vi.fn();
const mockListAnalyses = vi.fn();
const mockGetAnalysisRatios = vi.fn();
const mockGetAnalysisInsights = vi.fn();
const mockApproveAnalysis = vi.fn();
const mockCreateAnalysis = vi.fn();
const mockUpdateAnalysis = vi.fn();
const mockComputeRatios = vi.fn();
const mockBuildStatementAnalytics = vi.fn();
const mockSearchStatementDocumentIntelligence = vi.fn();
const mockClassifyStatementDocument = vi.fn();
const mockConfirmStatement = vi.fn();
const mockCreateStatement = vi.fn();
const mockDetectStatementType = vi.fn();
const mockEvaluateStatementReadiness = vi.fn();
const mockEnsureCanonicalRegistryInDatabase = vi.fn();
const mockExtractFinancialLines = vi.fn();
const mockAnalyzeAndExtractFullDocument = vi.fn();
const mockGetLatestStatementIngestRun = vi.fn();
const mockLoadPersistedStatementCandidateRows = vi.fn();
const mockLoadStatementSourceText = vi.fn();
const mockLocateStatementSections = vi.fn();
const mockPersistStatementCandidateRows = vi.fn();
const mockPersistStatementExtractedSections = vi.fn();
const mockPersistStatementMappingCandidates = vi.fn();
const mockPersistStatementValidationLedger = vi.fn();
const mockRecordStatementQualityRun = vi.fn();
const mockRecordStatementSourceArtifact = vi.fn();
const mockResolveStatementColumnSelection = vi.fn();
const mockResolveDuplicateSuggestedMappings = vi.fn();
const mockRecomputeStatementPackForOrganization = vi.fn();
const mockSaveStatementValues = vi.fn();
const mockSnapshotCanonicalStatementVersion = vi.fn();
const mockStartStatementIngestRun = vi.fn();
const mockUpdateStatementMetadata = vi.fn();
const mockUpdateStatementReadinessState = vi.fn();
const mockUpdateStatementStatus = vi.fn();
const mockUpdateStatementIngestRun = vi.fn();
const mockValidateStatement = vi.fn();
const mockSaveStatementValuesFlow = vi.fn();
const mockRunFullAnalysis = vi.fn();
const mockGetFinanceTraceId = vi.fn();
const mockLogFinanceError = vi.fn();
const mockLogFinanceEvent = vi.fn();
const mockApplyLlmProposals = vi.fn();
const mockApplySecondPassProposals = vi.fn();
const mockMapDuplicateConflictLinesWithLLM = vi.fn();
const mockMapUnmappedLinesWithLLM = vi.fn();
const mockAssessCoverage = vi.fn();
const mockClassifyMappingTier = vi.fn();
const mockIsLikelySubtotalOrAggregate = vi.fn();
const mockIsNonFinancialByPolicy = vi.fn();
const mockExtractFinancialLinesWithAnthropic = vi.fn();
const mockExtractFinancialLinesWithOpenAI = vi.fn();
const mockPdfExtractText = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockSyncStatementToPack = vi.fn();
const mockAutoMapLines = vi.fn();
const mockAppendCfoDerivedMappingSuggestions = vi.fn();
const mockBackfillStatementValueSourcePages = vi.fn();
const mockStageSelectedStatementSections = vi.fn();
const mockConfirmGovernedStatement = vi.fn();
const mockPersistComputeResult = vi.fn();
// FIN-005 Fix 2: /statements/upload-and-analyze now goes through the same
// idempotency primitives /finance-statements/upload already used (moved to
// financialStatementService.ts). getIdempotencyKey defaults to "no header
// sent" (null) so the pre-existing unkeyed-request tests below exercise the
// same direct performUploadAndAnalyze() call they always did.
const mockGetIdempotencyKey = vi.fn(() => null);
const mockReserveIdempotentUpload = vi.fn();
const mockFinalizeIdempotentUpload = vi.fn();
const mockFailIdempotentUpload = vi.fn();
const mockCleanupUnpersistedUpload = vi.fn();
const mockSha256Hex = vi.fn();
const mockWithStatementUploadIdempotencyLock = vi.fn(
  (_organizationId: string, _key: string, work: () => Promise<unknown>) => work()
);

vi.mock('../../../services/v8/financeIntegrationService.js', () => ({
  getFinanceDashboard: (...args: unknown[]) => mockGetFinanceDashboard(...args),
}));

vi.mock('../../../services/financialAnalysisService.js', () => ({
  createAnalysis: (...args: unknown[]) => mockCreateAnalysis(...args),
  listAnalyses: (...args: unknown[]) => mockListAnalyses(...args),
  getAnalysisRatios: (...args: unknown[]) => mockGetAnalysisRatios(...args),
  getAnalysisInsights: (...args: unknown[]) => mockGetAnalysisInsights(...args),
  approveAnalysis: (...args: unknown[]) => mockApproveAnalysis(...args),
  runFullAnalysis: (...args: unknown[]) => mockRunFullAnalysis(...args),
  updateAnalysis: (...args: unknown[]) => mockUpdateAnalysis(...args),
}));

vi.mock('../../../services/financialModelingService.js', () => ({
  addEvent: (...args: unknown[]) => mockAddEvent(...args),
  approveModel: (...args: unknown[]) => mockApproveModel(...args),
  computeModel: (...args: unknown[]) => mockComputeModel(...args),
  createModel: (...args: unknown[]) => mockCreateModel(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  getModel: (...args: unknown[]) => mockGetModel(...args),
  getOutputs: (...args: unknown[]) => mockGetOutputs(...args),
  getValidations: (...args: unknown[]) => mockGetValidations(...args),
  listEvents: (...args: unknown[]) => mockListEvents(...args),
  listModels: (...args: unknown[]) => mockListModels(...args),
  persistComputeResult: (...args: unknown[]) => mockPersistComputeResult(...args),
  updateModel: (...args: unknown[]) => mockUpdateModel(...args),
}));

vi.mock('../../../services/financialStatementPackService.js', () => ({
  getStatementPackDetail: (...args: unknown[]) => mockGetStatementPackDetail(...args),
  listStatementPacks: (...args: unknown[]) => mockListStatementPacks(...args),
  recomputeStatementPackForOrganization: (...args: unknown[]) =>
    mockRecomputeStatementPackForOrganization(...args),
  syncStatementToPack: (...args: unknown[]) => mockSyncStatementToPack(...args),
}));

vi.mock('../../../services/financialStatementReadService.js', () => ({
  getStatementDetail: (...args: unknown[]) => mockGetStatementDetail(...args),
  listStatements: (...args: unknown[]) => mockListStatements(...args),
}));

vi.mock('../../../services/financeStatementAnalyticsService.js', () => ({
  buildStatementAnalytics: (...args: unknown[]) => mockBuildStatementAnalytics(...args),
}));

vi.mock('../../../services/financialStatementService.js', () => ({
  autoMapLines: (...args: unknown[]) => mockAutoMapLines(...args),
  appendCfoDerivedMappingSuggestions: (...args: unknown[]) =>
    mockAppendCfoDerivedMappingSuggestions(...args),
  backfillStatementValueSourcePages: (...args: unknown[]) =>
    mockBackfillStatementValueSourcePages(...args),
  classifyStatementDocument: (...args: unknown[]) => mockClassifyStatementDocument(...args),
  confirmStatement: (...args: unknown[]) => mockConfirmStatement(...args),
  createStatement: (...args: unknown[]) => mockCreateStatement(...args),
  detectContainedStatementTypes: vi.fn(() => ['P&L']),
  detectStatementType: (...args: unknown[]) => mockDetectStatementType(...args),
  evaluateStatementReadiness: (...args: unknown[]) => mockEvaluateStatementReadiness(...args),
  extractFinancialLines: (...args: unknown[]) => mockExtractFinancialLines(...args),
  getLatestStatementIngestRun: (...args: unknown[]) => mockGetLatestStatementIngestRun(...args),
  loadPersistedStatementCandidateRows: (...args: unknown[]) =>
    mockLoadPersistedStatementCandidateRows(...args),
  loadStatementSourceText: (...args: unknown[]) => mockLoadStatementSourceText(...args),
  locateStatementSections: (...args: unknown[]) => mockLocateStatementSections(...args),
  persistStatementCandidateRows: (...args: unknown[]) => mockPersistStatementCandidateRows(...args),
  persistStatementExtractedSections: (...args: unknown[]) =>
    mockPersistStatementExtractedSections(...args),
  persistStatementMappingCandidates: (...args: unknown[]) =>
    mockPersistStatementMappingCandidates(...args),
  persistStatementValidationLedger: (...args: unknown[]) =>
    mockPersistStatementValidationLedger(...args),
  recordStatementQualityRun: (...args: unknown[]) => mockRecordStatementQualityRun(...args),
  recordStatementSourceArtifact: (...args: unknown[]) => mockRecordStatementSourceArtifact(...args),
  resolveStatementColumnSelection: (...args: unknown[]) =>
    mockResolveStatementColumnSelection(...args),
  resolveDuplicateSuggestedMappings: (...args: unknown[]) =>
    mockResolveDuplicateSuggestedMappings(...args),
  saveStatementValues: (...args: unknown[]) => mockSaveStatementValues(...args),
  snapshotCanonicalStatementVersion: (...args: unknown[]) =>
    mockSnapshotCanonicalStatementVersion(...args),
  startStatementIngestRun: (...args: unknown[]) => mockStartStatementIngestRun(...args),
  updateStatementMetadata: (...args: unknown[]) => mockUpdateStatementMetadata(...args),
  updateStatementReadinessState: (...args: unknown[]) => mockUpdateStatementReadinessState(...args),
  updateStatementStatus: (...args: unknown[]) => mockUpdateStatementStatus(...args),
  updateStatementIngestRun: (...args: unknown[]) => mockUpdateStatementIngestRun(...args),
  validateStatement: (...args: unknown[]) => mockValidateStatement(...args),
  cleanupUnpersistedUpload: (...args: unknown[]) => mockCleanupUnpersistedUpload(...args),
  failIdempotentUpload: (...args: unknown[]) => mockFailIdempotentUpload(...args),
  finalizeIdempotentUpload: (...args: unknown[]) => mockFinalizeIdempotentUpload(...args),
  getIdempotencyKey: (...args: unknown[]) => mockGetIdempotencyKey(...args),
  IdempotencyKeyTooLongError: class IdempotencyKeyTooLongError extends Error {},
  isStructuredStatementInput: vi.fn(() => false),
  MAX_IDEMPOTENCY_KEY_CHARS: 200,
  reserveIdempotentUpload: (...args: unknown[]) => mockReserveIdempotentUpload(...args),
  sha256Hex: (...args: unknown[]) => mockSha256Hex(...args),
  withStatementUploadIdempotencyLock: (...args: unknown[]) =>
    mockWithStatementUploadIdempotencyLock(...(args as [string, string, () => Promise<unknown>])),
}));

vi.mock('../../../services/statementMultiSectionImportService.js', () => ({
  stageSelectedStatementSections: (...args: unknown[]) =>
    mockStageSelectedStatementSections(...args),
}));

vi.mock('../../../services/finance/canonical/statementGovernedConfirmationService.js', () => ({
  confirmGovernedStatement: (...args: unknown[]) => mockConfirmGovernedStatement(...args),
}));

vi.mock('../../../services/finance/canonical/statementManualMappingDecisionService.js', () => ({
  recordManualMappingDecision: vi.fn(),
}));

vi.mock('../../../services/finance/canonical/statementSourceReceiptService.js', () => ({
  readStatementSourceReceipt: vi.fn(),
  StatementGovernanceError: class StatementGovernanceError extends Error {
    status: number;
    code: string;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock('../../../services/financeCanonicalRegistrySyncService.js', () => ({
  ensureCanonicalRegistryInDatabase: (...args: unknown[]) =>
    mockEnsureCanonicalRegistryInDatabase(...args),
}));

vi.mock('../../../services/financeDiagnosticsService.js', () => ({
  getFinanceTraceId: (...args: unknown[]) => mockGetFinanceTraceId(...args),
  logFinanceError: (...args: unknown[]) => mockLogFinanceError(...args),
  logFinanceEvent: (...args: unknown[]) => mockLogFinanceEvent(...args),
}));

vi.mock('../../../services/llmFinancialMappingService.js', () => ({
  applyLlmProposals: (...args: unknown[]) => mockApplyLlmProposals(...args),
  applySecondPassProposals: (...args: unknown[]) => mockApplySecondPassProposals(...args),
  mapDuplicateConflictLinesWithLLM: (...args: unknown[]) =>
    mockMapDuplicateConflictLinesWithLLM(...args),
  mapUnmappedLinesWithLLM: (...args: unknown[]) => mockMapUnmappedLinesWithLLM(...args),
}));

vi.mock('../../../services/financeMappingPolicy.js', () => ({
  assessCoverage: (...args: unknown[]) => mockAssessCoverage(...args),
  classifyMappingTier: (...args: unknown[]) => mockClassifyMappingTier(...args),
  isLikelySubtotalOrAggregate: (...args: unknown[]) => mockIsLikelySubtotalOrAggregate(...args),
  isNonFinancialByPolicy: (...args: unknown[]) => mockIsNonFinancialByPolicy(...args),
}));

vi.mock('../../../services/openAIFinancialExtractionService.js', () => ({
  analyzeAndExtractFullDocument: (...args: unknown[]) => mockAnalyzeAndExtractFullDocument(...args),
  extractFinancialLinesWithAnthropic: (...args: unknown[]) =>
    mockExtractFinancialLinesWithAnthropic(...args),
  extractFinancialLinesWithOpenAI: (...args: unknown[]) =>
    mockExtractFinancialLinesWithOpenAI(...args),
}));

vi.mock('../../../services/pdfParserService.js', () => ({
  default: {
    extractText: (...args: unknown[]) => mockPdfExtractText(...args),
  },
}));

vi.mock('../../../services/valuationService.js', () => ({
  listValuations: (...args: unknown[]) => mockListValuations(...args),
}));

vi.mock('../../../services/budgetingService.js', () => ({
  listBudgets: (...args: unknown[]) => mockListBudgets(...args),
}));

vi.mock('../../../services/finance/canonical/budgetRegistrationService.js', () => ({
  BudgetRegistrationError: class BudgetRegistrationError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string
    ) {
      super(message);
    }
  },
  registerBudget: (...args: unknown[]) => mockRegisterBudget(...args),
}));

vi.mock('../../../services/finance/canonical/budgetLineCommandService.js', () => ({
  BudgetLineCommandError: class BudgetLineCommandError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  applyBudgetLineCommand: (...args: unknown[]) => mockApplyBudgetLineCommand(...args),
}));

vi.mock('../../../services/finance/canonical/budgetProjectionCommandService.js', () => ({
  BudgetProjectionCommandError: class BudgetProjectionCommandError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  projectBudgetScenario: (...args: unknown[]) => mockProjectBudgetScenario(...args),
  updateBudgetScenarioAdjustments: (...args: unknown[]) =>
    mockUpdateBudgetScenarioAdjustments(...args),
}));

vi.mock('../../../services/finance/canonical/budgetApprovalCommandService.js', () => ({
  BudgetApprovalCommandError: class BudgetApprovalCommandError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  approveBudgetCommand: (...args: unknown[]) => mockApproveBudgetCommand(...args),
}));
vi.mock('../../../services/finance/canonical/budgetDiscardCommandService.js', () => ({
  BudgetDiscardCommandError: class BudgetDiscardCommandError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  discardBudgetCommand: (...args: unknown[]) => mockDiscardBudgetCommand(...args),
}));
vi.mock('../../../services/finance/canonical/digitizationAnalysisArchiveCommandService.js', () => ({
  DigitizationAnalysisArchiveError: class DigitizationAnalysisArchiveError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  archiveDigitizationAnalysisCommand: (...args: unknown[]) =>
    mockArchiveDigitizationAnalysisCommand(...args),
}));
vi.mock('../../../services/finance/canonical/digitizationAnalysisRegistrationService.js', () => ({
  DigitizationAnalysisRegistrationError: class DigitizationAnalysisRegistrationError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string
    ) {
      super(message);
    }
  },
  registerDigitizationAnalysis: (...args: unknown[]) => mockRegisterDigitizationAnalysis(...args),
}));
vi.mock('../../../services/finance/canonical/digitizationAnalysisUpdateCommandService.js', () => ({
  DigitizationAnalysisUpdateError: class DigitizationAnalysisUpdateError extends Error {},
  updateDigitizationAnalysisCommand: (...args: unknown[]) =>
    mockUpdateDigitizationAnalysisCommand(...args),
}));
vi.mock(
  '../../../services/finance/canonical/digitizationAnalysisInitiativeLinkCommandService.js',
  () => ({
    DigitizationAnalysisInitiativeLinkError: class DigitizationAnalysisInitiativeLinkError extends Error {},
    linkDigitizationAnalysisInitiativeCommand: (...args: unknown[]) =>
      mockLinkDigitizationAnalysisInitiativeCommand(...args),
  })
);
vi.mock('../../../services/finance/canonical/budgetDocumentImportCommandService.js', () => ({
  BudgetDocumentImportCommandError: class BudgetDocumentImportCommandError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  importBudgetDocumentCommand: (...args: unknown[]) => mockImportBudgetDocumentCommand(...args),
}));
vi.mock('../../../services/finance/canonical/budgetInitiativeLinkCommandService.js', () => ({
  BudgetInitiativeLinkCommandError: class BudgetInitiativeLinkCommandError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  linkBudgetInitiativeCommand: (...args: unknown[]) => mockLinkBudgetInitiativeCommand(...args),
}));
vi.mock('../../../services/finance/canonical/budgetInitiativeUnlinkCommandService.js', () => ({
  BudgetInitiativeUnlinkCommandError: class BudgetInitiativeUnlinkCommandError extends Error {
    constructor(
      public code: string,
      public status: number,
      message: string,
      public details?: Record<string, unknown>
    ) {
      super(message);
    }
  },
  unlinkBudgetInitiativeCommand: (...args: unknown[]) => mockUnlinkBudgetInitiativeCommand(...args),
}));
vi.mock('../../../services/documentTextExtractor.js', () => ({
  extractTextFromBuffer: (...args: unknown[]) => mockExtractDocumentTextFromBuffer(...args),
}));

vi.mock('../../../services/ratioAnalysisService.js', () => ({
  computeRatios: (...args: unknown[]) => mockComputeRatios(...args),
}));

vi.mock('../../../services/documentIntelligenceService.js', () => ({
  searchStatementDocumentIntelligence: (...args: unknown[]) =>
    mockSearchStatementDocumentIntelligence(...args),
}));

vi.mock('../../../services/financialStatementValueWriteService.js', () => ({
  saveStatementValuesFlow: (...args: unknown[]) => mockSaveStatementValuesFlow(...args),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  validateOrgMembership: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

function createSanitizedApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(inputSanitizationMiddleware);
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000088';
const UID = 'user-finance-v8';

describe('V8 finance read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFinanceEditorGate.mockImplementation((_req: unknown, _res: unknown, next: () => void) =>
      next()
    );
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockGetFinanceDashboard.mockResolvedValue({
      ingestionPipeline: {
        totalCount: 0,
        byState: {},
        confidenceBands: { high: 0, medium: 0, low: 0, unknown: 0 },
        averageConfidence: null,
      },
      linkageHealth: {
        totalLinkages: 0,
        byLinkageType: {},
        unlinkedInitiativesCount: 0,
      },
      unresolvedEscalationsCount: 0,
      staleSourceRefreshesCount: 0,
      promotionGatePassRate: null,
    });
    mockGetStatementPackDetail.mockResolvedValue(null);
    mockGetStatementDetail.mockResolvedValue(null);
    mockListStatements.mockResolvedValue([]);
    mockListStatementPacks.mockResolvedValue([]);
    mockListModels.mockResolvedValue([]);
    mockListValuations.mockResolvedValue([]);
    mockListBudgets.mockResolvedValue([]);
    mockRegisterBudget.mockResolvedValue({
      budget: { id: 'budget-new', title: 'Test Budget', status: 'DRAFT' },
      lineCount: 15,
      scenarioCount: 3,
      replay: false,
    });
    mockApplyBudgetLineCommand.mockResolvedValue({
      budgetId: 'budget-new',
      line: {
        id: 'line-1',
        lineCode: 'REVENUE',
        baselineValue: '42',
        source: 'manual',
        driverKpiId: null,
        driverFormula: null,
        isLocked: false,
      },
      budgetVersion: 2,
      replay: false,
    });
    mockLinkBudgetInitiativeCommand.mockResolvedValue({
      budgetId: 'budget-new',
      initiativeId: 'initiative-1',
      budgetVersion: 2,
      snapshot: { revenueUplift: '0', costSavings: '0', capexRequired: '0' },
      replay: false,
    });
    mockUnlinkBudgetInitiativeCommand.mockResolvedValue({
      budgetId: 'budget-new',
      initiativeId: 'initiative-1',
      budgetVersion: 3,
      removedLinkSnapshot: { revenueUplift: '0', costSavings: '0', capexRequired: '0' },
      replay: false,
    });
    mockProjectBudgetScenario.mockResolvedValue({
      budgetId: 'budget-new',
      scenario: {
        id: 'scenario-1',
        scenarioType: 'base',
        projections: { periods: ['2028-01'], lines: { REVENUE: { '2028-01': 42 } } },
        summaryMetrics: { totalRevenue: 42 },
      },
      budgetVersion: 2,
      projectionSha256: 'a'.repeat(64),
      replay: false,
    });
    mockUpdateBudgetScenarioAdjustments.mockResolvedValue({
      budgetId: 'budget-new',
      scenario: {
        id: 'scenario-1',
        scenarioType: 'base',
        adjustments: { revenueGrowth: 7 },
      },
      budgetVersion: 2,
      adjustmentsSha256: 'b'.repeat(64),
      replay: false,
    });
    mockApproveBudgetCommand.mockResolvedValue({
      budgetId: 'budget-new',
      snapshotId: 'snapshot-1',
      status: 'APPROVED',
      budgetVersion: 2,
      snapshotSha256: 'c'.repeat(64),
      approvedBy: UID,
      approvedAt: '2026-08-20T10:00:00.000Z',
      replay: false,
    });
    mockDiscardBudgetCommand.mockResolvedValue({
      budgetId: 'budget-new',
      status: 'ARCHIVED',
      budgetVersion: 4,
      archivedBy: 'user-1',
      archivedAt: '2026-08-20T00:00:00.000Z',
      replay: false,
    });
    mockArchiveDigitizationAnalysisCommand.mockResolvedValue({
      analysisId: 'digitization-analysis-1',
      status: 'ARCHIVED',
      version: 2,
      archivedBy: UID,
      archivedAt: '2026-08-23T00:00:00.000Z',
      replay: false,
    });
    mockRegisterDigitizationAnalysis.mockResolvedValue({
      id: 'digitization-analysis-new',
      name: 'New analysis',
      status: 'DRAFT',
      version: 1,
      receiptId: 'receipt-new',
      replay: false,
    });
    mockListAnalyses.mockResolvedValue([]);
    mockGetAnalysisRatios.mockResolvedValue([]);
    mockGetAnalysisInsights.mockResolvedValue([]);
    mockApproveAnalysis.mockResolvedValue(undefined);
    mockCreateAnalysis.mockResolvedValue({
      id: 'analysis-created-1',
      title: 'Created analysis',
      status: 'DRAFT',
      analysisType: 'comprehensive',
      periods: [],
      currency: 'PLN',
      sourceStatementIds: [],
      createdAt: '2026-03-26T10:00:00.000Z',
      updatedAt: '2026-03-26T10:00:00.000Z',
    });
    mockComputeRatios.mockResolvedValue({
      statementId: 'statement-1',
      periodLabel: 'Q1 2026',
      ratios: [],
      coverageSummary: { total: 0, computed: 0, na: 0, coveragePct: 0 },
    });
    mockSearchStatementDocumentIntelligence.mockResolvedValue([]);
    mockClassifyStatementDocument.mockReturnValue({
      documentClass: 'financial_statement',
      extractionStrategy: 'table',
      templateFamily: 'standard',
    });
    mockConfirmStatement.mockResolvedValue(undefined);
    mockCreateStatement.mockResolvedValue('statement-1');
    mockDetectStatementType.mockReturnValue({
      statementType: 'P&L',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      periodLabel: 'Q1 2026',
      currency: 'PLN',
      scaling: 'units',
      confidence: 0.93,
      containedStatementTypes: ['P&L'],
    });
    mockEvaluateStatementReadiness.mockReturnValue({
      isReady: true,
      readinessStatus: 'ready',
      readinessScore: 100,
      summary: 'Ready to confirm',
      reasonCodes: [],
    });
    mockExtractFinancialLines.mockReturnValue({
      lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9, sourceRow: 1 }],
      rawTableCount: 1,
      warnings: [],
    });
    mockGetLatestStatementIngestRun.mockResolvedValue('ingest-run-1');
    mockGetFinanceTraceId.mockReturnValue('trace-1');
    mockLoadPersistedStatementCandidateRows.mockResolvedValue([]);
    mockLoadStatementSourceText.mockResolvedValue('Revenue 100');
    mockLocateStatementSections.mockReturnValue([{ sectionKey: 'primary', text: 'Revenue 100' }]);
    mockPersistStatementCandidateRows.mockResolvedValue([
      { candidateRowId: 'candidate-1', sourceRow: 1 },
    ]);
    mockPersistStatementExtractedSections.mockResolvedValue([
      { sectionKey: 'primary', sectionId: 'section-1' },
    ]);
    mockPersistStatementMappingCandidates.mockResolvedValue(undefined);
    mockRecordStatementQualityRun.mockResolvedValue(undefined);
    mockRecordStatementSourceArtifact.mockResolvedValue(undefined);
    mockResolveStatementColumnSelection.mockReturnValue({
      selectedPeriodLabel: 'Q1 2026',
    });
    mockResolveDuplicateSuggestedMappings.mockImplementation((lines: unknown[]) => lines);
    mockSnapshotCanonicalStatementVersion.mockResolvedValue(undefined);
    mockStartStatementIngestRun.mockResolvedValue('ingest-run-1');
    mockUpdateStatementMetadata.mockResolvedValue(undefined);
    mockUpdateStatementStatus.mockResolvedValue(undefined);
    mockUpdateStatementIngestRun.mockResolvedValue(undefined);
    mockSaveStatementValuesFlow.mockResolvedValue({
      statementId: 'statement-1',
      statementPackId: 'pack-1',
      ingestRunId: 'ingest-run-1',
      savedCount: 1,
      readiness: { readinessStatus: 'recoverable' },
      validation: { status: 'warnings', messages: [] },
    });
    mockEnsureCanonicalRegistryInDatabase.mockResolvedValue(undefined);
    mockAnalyzeAndExtractFullDocument.mockResolvedValue(null);
    mockPersistStatementValidationLedger.mockResolvedValue(undefined);
    mockRecomputeStatementPackForOrganization.mockResolvedValue(undefined);
    mockSaveStatementValues.mockResolvedValue(undefined);
    mockSyncStatementToPack.mockResolvedValue('pack-1');
    mockUpdateStatementReadinessState.mockResolvedValue(undefined);
    mockRunFullAnalysis.mockResolvedValue({ ratios: [] });
    mockValidateStatement.mockReturnValue({ status: 'warnings', messages: [] });
    mockApplyLlmProposals.mockReturnValue({ applied: 0, skipped: 0 });
    mockApplySecondPassProposals.mockReturnValue({ applied: 0, skipped: 0 });
    mockMapDuplicateConflictLinesWithLLM.mockResolvedValue({
      proposals: [],
      provider: 'openai',
      durationMs: 0,
    });
    mockMapUnmappedLinesWithLLM.mockResolvedValue({
      proposals: [],
      provider: 'openai',
      durationMs: 0,
    });
    mockAssessCoverage.mockReturnValue({ coveragePct: 100, total: 1, suggested: 1 });
    mockClassifyMappingTier.mockReturnValue({ tier: 'mapped' });
    mockIsLikelySubtotalOrAggregate.mockReturnValue(false);
    mockIsNonFinancialByPolicy.mockReturnValue(false);
    mockExtractFinancialLinesWithAnthropic.mockResolvedValue(null);
    mockExtractFinancialLinesWithOpenAI.mockResolvedValue(null);
    mockPdfExtractText.mockResolvedValue('Revenue 100');
    mockDbGet.mockResolvedValue(null);
    mockDbAll.mockResolvedValue([]);
    mockDbRun.mockResolvedValue(undefined);
    mockAutoMapLines.mockResolvedValue([
      {
        originalLabel: 'Revenue',
        value: 100,
        confidence: 0.9,
        sourceRow: 1,
        suggestedCanonicalId: 'line-1',
        mappingReason: 'alias_engine',
        isNonFinancial: false,
      },
    ]);
    mockAppendCfoDerivedMappingSuggestions.mockReturnValue(undefined);
    mockBackfillStatementValueSourcePages.mockResolvedValue(undefined);
    mockStageSelectedStatementSections.mockResolvedValue({
      selectedTypes: ['P&L'],
      statements: [
        {
          statementId: 'statement-1',
          statementType: 'P&L',
          periodLabel: 'Q1 2026',
          sourceReceiptId: 'receipt-1',
          lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9, sourceRow: 1 }],
        },
      ],
    });
    mockConfirmGovernedStatement.mockResolvedValue({
      statementPackId: 'pack-1',
      artifactId: 'artifact-1',
      businessVersionId: 'business-version-1',
      workingRevisionId: 'working-revision-1',
      replayed: false,
    });
  });

  it('GET /api/v8/finance/dashboard returns envelope and delegates to getFinanceDashboard', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/finance/dashboard');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.dashboard?.ingestionPipeline?.totalCount).toBe(0);
    expect(mockGetFinanceDashboard).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/finance/analyses returns envelope and delegates to listAnalyses', async () => {
    mockListAnalyses.mockResolvedValue([
      {
        id: 'analysis-1',
        title: 'Working capital analysis',
        description: null,
        status: 'DRAFT',
        analysisType: 'financial',
        periods: ['2025-Q4'],
        currency: 'PLN',
        sourceStatementIds: [],
        createdAt: '2026-03-26T10:00:00.000Z',
        updatedAt: '2026-03-26T10:05:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/analyses')
      .query({ status: 'DRAFT', projectId: 'project-1' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.analyses?.[0]?.title).toBe('Working capital analysis');
    expect(mockListAnalyses).toHaveBeenCalledWith(ORG, {
      status: 'DRAFT',
      projectId: 'project-1',
    });
  });

  it('GET /api/v8/finance/models returns envelope and delegates to listModels', async () => {
    mockListModels.mockResolvedValue([
      {
        id: 'model-1',
        name: 'Revenue forecast',
        status: 'draft',
        currency: 'PLN',
        horizon_months: 36,
        start_date: '2026-01-01',
        updated_at: '2026-03-27T09:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/models');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.models?.[0]?.name).toBe('Revenue forecast');
    expect(mockListModels).toHaveBeenCalledWith(ORG);
  });

  it('POST /api/v8/finance/models returns envelope and delegates to createModel', async () => {
    mockCreateModel.mockResolvedValue('model-1');
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Created model',
      status: 'draft',
      start_date: '2026-01-01',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/models').send({
      name: 'Created model',
      startDate: '2026-01-01',
      currency: 'PLN',
    });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.model?.name).toBe('Created model');
    expect(mockCreateModel).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        createdBy: UID,
        name: 'Created model',
        startDate: '2026-01-01',
        currency: 'PLN',
      })
    );
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
  });

  it('POST /models/:id/duplicate — stale source FK → kopiuje bez graftu (NIE 500) [BUG-09 regress]', async () => {
    // Model źródłowy wskazuje na usuniętą/syntetyczną inicjatywę (jak seed na demo).
    mockGetModel.mockImplementation((id: string) =>
      id === 'copy-1'
        ? Promise.resolve({
            id: 'copy-1',
            organization_id: ORG,
            name: 'Src (kopia)',
            start_date: '2026-01-01',
          })
        : Promise.resolve({
            id: 'src-1',
            organization_id: ORG,
            name: 'Src',
            initiative_id: 'ghost-initiative',
            start_date: '2026-01-01',
            currency: 'PLN',
          })
    );
    // 1. próba (z FK) rzuca guard cross-org; 2. (bez FK) sukces.
    mockCreateModel
      .mockRejectedValueOnce(new Error('Source initiative not found'))
      .mockResolvedValueOnce('copy-1');

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/models/src-1/duplicate').send({});

    expect(res.status).toBe(201); // KLUCZ: nie 500
    expect(mockCreateModel).toHaveBeenCalledTimes(2);
    // retry NIE grafuje martwego initiativeId
    expect(mockCreateModel.mock.calls[1][0]).not.toHaveProperty('initiativeId');
    expect(res.body.data?.model?.id).toBe('copy-1');
  });

  it('POST /models/:id/duplicate — stale FK + stale pack → retry bez obu (NIE 500) [BUG-09b regress]', async () => {
    // Model ma initiative_id (stale FK) + source_statement_pack_id (niekompletny pack).
    // 1. próba (z FK) rzuca "not found" → catch → retry BEZ initiativeId I BEZ pack → sukces.
    mockGetModel.mockImplementation((id: string) =>
      id === 'copy-2'
        ? Promise.resolve({
            id: 'copy-2',
            organization_id: ORG,
            name: 'Src2 (kopia)',
            start_date: '2026-01-01',
          })
        : Promise.resolve({
            id: 'src-2',
            organization_id: ORG,
            name: 'Src2',
            initiative_id: 'ghost-init-2',
            source_statement_pack_id: 'ghost-pack',
            start_date: '2026-01-01',
            currency: 'PLN',
          })
    );
    mockCreateModel
      .mockRejectedValueOnce(new Error('Source initiative not found'))
      .mockResolvedValueOnce('copy-2');

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/models/src-2/duplicate').send({});

    expect(res.status).toBe(201);
    expect(mockCreateModel).toHaveBeenCalledTimes(2);
    // retry NIE grafuje martwego initiativeId ANI pack (undefined = falsy → createModel pomija)
    expect(mockCreateModel.mock.calls[1][0]).not.toHaveProperty('initiativeId');
    expect(mockCreateModel.mock.calls[1][0].sourceStatementPackId).toBeUndefined();
    expect(res.body.data?.model?.id).toBe('copy-2');
  });

  it('POST /models/:id/duplicate — stale pack (bez FK) → retry bez pack (NIE 500) [BUG-09c regress]', async () => {
    // Model NIE ma stale FK ale pack jest niekompletny → 1. próba rzuca "must contain" → catch → retry bez pack.
    mockGetModel.mockImplementation((id: string) =>
      id === 'copy-3'
        ? Promise.resolve({
            id: 'copy-3',
            organization_id: ORG,
            name: 'Src3 (kopia)',
            start_date: '2026-01-01',
          })
        : Promise.resolve({
            id: 'src-3',
            organization_id: ORG,
            name: 'Src3',
            source_statement_pack_id: 'bad-pack',
            start_date: '2026-01-01',
            currency: 'PLN',
          })
    );
    mockCreateModel
      .mockRejectedValueOnce(
        new Error('Statement pack must contain P&L, Balance Sheet, and Cash Flow')
      )
      .mockResolvedValueOnce('copy-3');

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/models/src-3/duplicate').send({});

    expect(res.status).toBe(201);
    expect(mockCreateModel).toHaveBeenCalledTimes(2);
    expect(mockCreateModel.mock.calls[1][0].sourceStatementPackId).toBeUndefined();
    expect(res.body.data?.model?.id).toBe('copy-3');
  });

  it('GET /api/v8/finance/models/:id returns envelope and delegates to getModel', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
      status: 'draft',
      assumptions_json: { initialCash: 100 },
      source_statement_pack_id: 'pack-1',
    });
    mockDbGet.mockResolvedValue({
      id: 'pack-1',
      entity_name: 'Acme Sp. z o.o.',
      period_label: 'Q1 2026',
      pack_status: 'pending',
      pack_readiness_status: 'recoverable',
    });
    mockListEvents.mockResolvedValue([{ id: 'event-1', name: 'Revenue uplift' }]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/models/model-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.model?.id).toBe('model-1');
    expect(res.body.data?.model?.source_statement_pack?.entity_name).toBe('Acme Sp. z o.o.');
    expect(res.body.data?.model?.events).toHaveLength(1);
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
    expect(mockListEvents).toHaveBeenCalledWith('model-1');
  });

  it('GET /api/v8/finance/models/:id/validations returns envelope and delegates to getValidations', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
    });
    mockGetValidations.mockResolvedValue([
      {
        id: 'validation-1',
        check_code: 'BALANCE',
        check_name: 'Balance sheet balances',
        status: 'warning',
      },
      {
        id: 'validation-2',
        check_code: 'CASHFLOW',
        check_name: 'Cash flow reconciles',
        status: 'pass',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/models/model-1/validations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.validations).toHaveLength(2);
    expect(res.body.data?.summary).toEqual({ total: 2, pass: 1, fail: 0, warning: 1 });
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
    expect(mockGetValidations).toHaveBeenCalledWith('model-1');
  });

  it('GET /api/v8/finance/models/:id/outputs returns envelope and delegates to getOutputs', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
    });
    mockGetOutputs.mockResolvedValue([
      {
        period_label: '2026-01',
        statement_type: 'P&L',
        line_code: 'REV',
        line_name: 'Revenue',
        value: 100,
      },
      {
        period_label: '2026-01',
        statement_type: 'P&L',
        line_code: 'COGS',
        line_name: 'COGS',
        value: -40,
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/models/model-1/outputs')
      .query({ scenario: 'base' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.raw).toHaveLength(2);
    expect(res.body.data?.grouped?.['2026-01']?.['P&L']).toEqual([
      { lineCode: 'REV', lineName: 'Revenue', value: 100 },
      { lineCode: 'COGS', lineName: 'COGS', value: -40 },
    ]);
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
    expect(mockGetOutputs).toHaveBeenCalledWith('model-1', 'base');
  });

  describe('GET /api/v8/finance/models/:id/appraisal — FIN-005 round 8', () => {
    const REAL_MODEL_EVENTS_PERIODS = {
      // Real canonical Atelier FY2015/16/17 CF lines (verified against the
      // actual expandEventToAmounts/computeModel arithmetic, not invented).
      periods: [
        {
          date: '2015-12-31',
          label: 'FY2015',
          pl: {},
          bs: {},
          cf: { OPERATING_CF: 2_400_000, INVESTING_CF: -800_000, FINANCING_CF: 0 },
        },
        {
          date: '2016-12-31',
          label: 'FY2016',
          pl: {},
          bs: {},
          cf: { OPERATING_CF: 2_001_920, INVESTING_CF: 0, FINANCING_CF: 0 },
        },
        {
          date: '2017-12-31',
          label: 'FY2017',
          pl: {},
          bs: {},
          cf: { OPERATING_CF: 2_003_841.536, INVESTING_CF: 0, FINANCING_CF: 0 },
        },
      ],
      validations: [],
      overallStatus: 'pass',
    };

    it('requires discountRatePct — 400 without it, never calls computeModel', async () => {
      mockGetModel.mockResolvedValue({ id: 'model-1', organization_id: ORG });

      const app = createApp();
      const res = await request(app).get('/api/v8/finance/models/model-1/appraisal');

      expect(res.status).toBe(400);
      expect(mockComputeModel).not.toHaveBeenCalled();
    });

    it('404s for a model belonging to another organization — never calls computeModel', async () => {
      mockGetModel.mockResolvedValue({ id: 'model-1', organization_id: 'some-other-org' });

      const app = createApp();
      const res = await request(app)
        .get('/api/v8/finance/models/model-1/appraisal')
        .query({ discountRatePct: 10 });

      expect(res.status).toBe(404);
      expect(mockComputeModel).not.toHaveBeenCalled();
    });

    it('computes a real appraisal from computeModel() output — not hardcoded, hurdleRatePct defaults to discountRatePct', async () => {
      mockGetModel.mockResolvedValue({ id: 'model-1', organization_id: ORG });
      mockComputeModel.mockResolvedValue(REAL_MODEL_EVENTS_PERIODS);

      const app = createApp();
      const res = await request(app)
        .get('/api/v8/finance/models/model-1/appraisal')
        .query({ discountRatePct: 10 });

      expect(res.status).toBe(200);
      expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
      expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
      expect(mockComputeModel).toHaveBeenCalledWith('model-1');

      const { input, result, periodLabels } = res.body.data;
      expect(input.initialInvestment).toBeCloseTo(800_000, 0);
      expect(input.discountRatePct).toBe(10);
      expect(input.hurdleRatePct).toBe(10); // defaulted, not required twice
      expect(periodLabels).toEqual(['FY2015', 'FY2016', 'FY2017']);
      expect(Number.isFinite(result.npv)).toBe(true);
      expect(result.npv).not.toBe(1_820_000); // the unrelated hand-typed legacy figure
      expect(['go', 'conditional', 'no-go']).toContain(result.verdict);
    });

    it('a different discountRatePct changes the result — the rate is a real parameter, not decoration', async () => {
      mockGetModel.mockResolvedValue({ id: 'model-1', organization_id: ORG });
      mockComputeModel.mockResolvedValue(REAL_MODEL_EVENTS_PERIODS);

      const app = createApp();
      const at5 = await request(app)
        .get('/api/v8/finance/models/model-1/appraisal')
        .query({ discountRatePct: 5 });
      const at20 = await request(app)
        .get('/api/v8/finance/models/model-1/appraisal')
        .query({ discountRatePct: 20 });

      expect(at5.body.data.result.npv).not.toBeCloseTo(at20.body.data.result.npv, 0);
    });

    it('reopen determinism: identical query twice gives byte-identical data', async () => {
      mockGetModel.mockResolvedValue({ id: 'model-1', organization_id: ORG });
      mockComputeModel.mockResolvedValue(REAL_MODEL_EVENTS_PERIODS);

      const app = createApp();
      const first = await request(app)
        .get('/api/v8/finance/models/model-1/appraisal')
        .query({ discountRatePct: 10 });
      const second = await request(app)
        .get('/api/v8/finance/models/model-1/appraisal')
        .query({ discountRatePct: 10 });

      expect(second.body.data).toEqual(first.body.data);
    });

    // Added by the FIN-005 opex-sign-regression task (server/src/services/__tests__/financialModelOpexSignRegression.test.ts)
    // to cover assumptions_json-based rate resolution once the sibling agent's
    // route change landed. NOTE: at the time this test was written, the route
    // change (reading discountRatePct/hurdleRatePct from model.assumptions_json
    // when no query param is given — see the "Rate resolution" doc comment
    // above the handler, finance.routes.ts) had ALREADY landed in this shared
    // worktree, so this test is GREEN, not the "expected red until it lands"
    // placeholder originally anticipated. Kept as a permanent regression test
    // for that behavior; the integrator should not mistake a red run here as
    // this agent's own bug — if it's red, the route change may have moved.
    it('falls back to model.assumptions_json.discountRatePct/hurdleRatePct when no query param is given', async () => {
      mockGetModel.mockResolvedValue({
        id: 'model-1',
        organization_id: ORG,
        assumptions_json: { discountRatePct: 15, hurdleRatePct: 15 },
      });
      mockComputeModel.mockResolvedValue(REAL_MODEL_EVENTS_PERIODS);

      const app = createApp();
      const res = await request(app).get('/api/v8/finance/models/model-1/appraisal');

      expect(res.status).toBe(200);
      expect(mockComputeModel).toHaveBeenCalledWith('model-1');

      const { input, result } = res.body.data;
      expect(input.discountRatePct).toBe(15);
      expect(input.hurdleRatePct).toBe(15);
      expect(Number.isFinite(result.npv)).toBe(true);
    });
  });

  it('POST /api/v8/finance/models/:id/compute returns envelope and delegates to computeModel', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
      scenario: 'base',
    });
    mockComputeModel.mockResolvedValue({
      overallStatus: 'warning',
      periods: ['2026-01', '2026-02'],
      validations: [{ status: 'pass' }, { status: 'warning' }],
    });
    mockPersistComputeResult.mockResolvedValue(undefined);

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/models/model-1/compute').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({
      success: true,
      overallStatus: 'warning',
      periodCount: 2,
      validationSummary: { total: 2, pass: 1, fail: 0, warning: 1 },
    });
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
    expect(mockComputeModel).toHaveBeenCalledWith('model-1');
    expect(mockPersistComputeResult).toHaveBeenCalledWith(
      'model-1',
      expect.objectContaining({ overallStatus: 'warning' }),
      'base'
    );
  });

  it('POST /api/v8/finance/models/:id/approve stays retired and points at canonical approval', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
    });
    mockApproveModel.mockResolvedValue({ success: true });

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/models/model-1/approve').send({});

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({
      code: 'FINANCE_LEGACY_WRITER_DISABLED',
      successor: '/api/v8/finance-v2/models/:artifactId/approve',
    });
    expect(mockApproveModel).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/finance/models/:id returns envelope and delegates to updateModel', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
    });
    mockUpdateModel.mockResolvedValue({ success: true });

    const app = createApp();
    const res = await request(app)
      .put('/api/v8/finance/models/model-1')
      .send({
        assumptions: { initialCash: 1000 },
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({ success: true });
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
    expect(mockUpdateModel).toHaveBeenCalledWith(
      'model-1',
      { assumptions: { initialCash: 1000 } },
      { expectedVersion: undefined }
    );
  });

  it('POST /api/v8/finance/models/:id/events returns envelope and delegates to addEvent', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
    });
    mockAddEvent.mockResolvedValue('event-1');

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/models/model-1/events').send({
      eventType: 'revenue',
      name: 'New contract',
      amount: 120000,
      periodStart: '2026-01-01',
      cfClassification: 'operating',
    });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({ success: true, id: 'event-1' });
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
    expect(mockAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'model-1',
        eventType: 'revenue',
        name: 'New contract',
        amount: 120000,
        periodStart: '2026-01-01',
        cfClassification: 'operating',
        createdBy: UID,
      })
    );
  });

  it('DELETE /api/v8/finance/events/:id returns envelope and delegates to deleteEvent', async () => {
    mockDbGet.mockResolvedValue({ id: 'event-1' });
    mockDeleteEvent.mockResolvedValue(undefined);

    const app = createApp();
    const res = await request(app).delete('/api/v8/finance/events/event-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({ success: true, deleted: 'event-1' });
    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('FROM financial_model_events e'),
      ['event-1', ORG]
    );
    expect(mockDeleteEvent).toHaveBeenCalledWith('event-1');
  });

  it('DELETE /api/v8/finance/models/:id returns envelope and deletes model rows', async () => {
    mockGetModel.mockResolvedValue({
      id: 'model-1',
      organization_id: ORG,
      name: 'Revenue forecast',
      status: 'draft',
    });
    mockDbRun.mockResolvedValue({ changes: 1 });

    const app = createApp();
    const res = await request(app).delete('/api/v8/finance/models/model-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({ success: true, deleted: 'model-1' });
    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG);
    const modelDeleteCalls = mockDbRun.mock.calls.filter(([sql]) =>
      String(sql).startsWith('DELETE FROM financial_model')
    );
    expect(modelDeleteCalls).toEqual([
      ['DELETE FROM financial_model_outputs WHERE model_id = ?', ['model-1']],
      ['DELETE FROM financial_model_validations WHERE model_id = ?', ['model-1']],
      ['DELETE FROM financial_model_events WHERE model_id = ?', ['model-1']],
      ['DELETE FROM financial_models WHERE id = ?', ['model-1']],
    ]);
  });

  it('GET /api/v8/finance/statement-packs returns envelope and delegates to listStatementPacks', async () => {
    mockListStatementPacks.mockResolvedValue([
      {
        id: 'pack-1',
        entity_name: 'Acme Sp. z o.o.',
        period_start: '2026-01-01',
        period_end: '2026-03-31',
        period_label: 'Q1 2026',
        currency: 'PLN',
        pack_status: 'pending',
        pack_readiness_status: 'recoverable',
        source_statement_count: 2,
        updated_at: '2026-03-27T12:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/statement-packs')
      .query({ readiness: 'recoverable' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.statementPacks?.[0]?.entity_name).toBe('Acme Sp. z o.o.');
    expect(mockListStatementPacks).toHaveBeenCalledWith(ORG, 'recoverable');
  });

  it('GET /api/v8/finance/statement-packs/:id returns envelope and delegates to getStatementPackDetail', async () => {
    mockGetStatementPackDetail.mockResolvedValue({
      id: 'pack-1',
      entity_name: 'Acme Sp. z o.o.',
      period_label: 'Q1 2026',
      pack_status: 'pending',
      pack_readiness_status: 'recoverable',
      statements: [],
      validations: [],
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/statement-packs/pack-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.pack?.entity_name).toBe('Acme Sp. z o.o.');
    expect(mockGetStatementPackDetail).toHaveBeenCalledWith(ORG, 'pack-1');
  });

  it('GET /api/v8/finance/statements/:id returns envelope and delegates to getStatementDetail', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      period_label: 'Q1 2026',
      values: [],
      validationLedger: [],
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/statements/statement-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.statement?.id).toBe('statement-1');
    expect(res.body.data?.statement?.statement_type).toBe('P&L');
    expect(mockGetStatementDetail).toHaveBeenCalledWith(ORG, 'statement-1');
  });

  it('GET /api/v8/finance/statements/:id/analytics returns envelope and delegates to buildStatementAnalytics', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      period_label: 'Q1 2026',
      values: [],
      validationLedger: [],
    });
    mockBuildStatementAnalytics.mockResolvedValue({
      periods: [{ label: 'Q1 2026', index: 0 }],
      rows: [{ id: 'row-1', label: 'Revenue', value: 100 }],
    });

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/statements/statement-1/analytics')
      .query({ level: 3 });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.periods?.[0]?.label).toBe('Q1 2026');
    expect(res.body.data?.rows?.[0]?.id).toBe('row-1');
    expect(mockGetStatementDetail).toHaveBeenCalledWith(ORG, 'statement-1');
    expect(mockBuildStatementAnalytics).toHaveBeenCalledWith({
      statementId: 'statement-1',
      statementType: 'P&L',
      requestedLevel: 3,
      defaultPeriodLabel: 'Q1 2026',
    });
  });

  it('GET /api/v8/finance/statements returns envelope and delegates to listStatements', async () => {
    mockListStatements.mockResolvedValue([
      {
        id: 'statement-1',
        statement_type: 'P&L',
        period_label: 'Q1 2026',
        source_file_name: 'acme-q1.csv',
        readiness_status: 'recoverable',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/statements')
      .query({ readiness: 'recoverable' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.statements?.[0]?.id).toBe('statement-1');
    expect(mockListStatements).toHaveBeenCalledWith(ORG, 'recoverable');
  });

  it('keeps Statement reads mounted but denies mutations when Finance editor authority fails', async () => {
    mockListStatements.mockResolvedValue([]);
    const app = createApp();

    expect((await request(app).get('/api/v8/finance/statements')).status).toBe(200);
    expect(mockFinanceEditorGate).not.toHaveBeenCalled();

    mockFinanceEditorGate.mockImplementation((_req: unknown, res: any) =>
      res.status(403).json({ success: false, code: 'FINANCE_EDIT_FORBIDDEN' })
    );
    const denied = await request(app)
      .post('/api/v8/finance/statements/upload-and-analyze')
      .attach('file', Buffer.from('%PDF-1.4 denied'), {
        filename: 'denied.pdf',
        contentType: 'application/pdf',
      });

    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ success: false, code: 'FINANCE_EDIT_FORBIDDEN' });
    expect(mockCreateStatement).not.toHaveBeenCalled();
  });

  it('POST /api/v8/finance/statements/upload-and-analyze returns envelope and delegates to the governed upload seam', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/statements/upload-and-analyze')
      .attach('file', Buffer.from('%PDF-1.4 mock'), {
        filename: 'statement.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        success: true,
        mode: 'fallback',
        statementPackId: 'pack-1',
        statementIds: ['statement-1'],
      })
    );
    expect(mockEnsureCanonicalRegistryInDatabase).toHaveBeenCalled();
    expect(mockPdfExtractText).toHaveBeenCalled();
    expect(mockAnalyzeAndExtractFullDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'statement.pdf',
        traceId: 'trace-1',
      })
    );
    expect(mockDetectStatementType).toHaveBeenCalledWith('Revenue 100');
    expect(mockCreateStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        sourceFileName: 'statement.pdf',
        createdBy: UID,
      })
    );
    expect(mockSyncStatementToPack).toHaveBeenCalledWith('statement-1');
  });

  it('GET /api/v8/finance/statements/:id/ratios returns envelope and delegates to computeRatios', async () => {
    mockComputeRatios.mockResolvedValue({
      statementId: 'statement-1',
      periodLabel: 'Q1 2026',
      ratios: [{ code: 'CURRENT_RATIO', name: 'Current Ratio', value: 1.42, status: 'ok' }],
      coverageSummary: { total: 1, computed: 1, na: 0, coveragePct: 100 },
    });

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/statements/statement-1/ratios');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.ratios?.statementId).toBe('statement-1');
    expect(res.body.data?.ratios?.coverageSummary?.coveragePct).toBe(100);
    expect(mockComputeRatios).toHaveBeenCalledWith('statement-1', ORG);
  });

  it('GET /api/v8/finance/statements/:id/document-intelligence/search returns envelope and delegates to search service', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      period_label: 'Q1 2026',
      values: [],
      validationLedger: [],
    });
    mockSearchStatementDocumentIntelligence.mockResolvedValue([
      {
        chunkText: 'Revenue increased due to seasonality.',
        score: 0.91,
        metadata: { sourceType: 'financial_statement_document_intelligence' },
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .get('/api/v8/finance/statements/statement-1/document-intelligence/search')
      .query({ q: 'revenue', limit: 3 });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.statementId).toBe('statement-1');
    expect(res.body.data?.query).toBe('revenue');
    expect(res.body.data?.matches?.[0]?.chunkText).toBe('Revenue increased due to seasonality.');
    expect(res.body.data?.authoritativeForNumbers).toBe(false);
    expect(mockGetStatementDetail).toHaveBeenCalledWith(ORG, 'statement-1');
    expect(mockSearchStatementDocumentIntelligence).toHaveBeenCalledWith({
      statementId: 'statement-1',
      organizationId: ORG,
      query: 'revenue',
      limit: 3,
    });
  });

  it('POST /api/v8/finance/statements/:id/detect returns envelope and delegates to statement detect flow', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      source_file_name: 'acme-q1.csv',
      source_file_path: '/tmp/acme-q1.csv',
      parse_method: 'ocr',
      document_class: 'financial_statement',
      extraction_strategy: 'table',
      template_family: 'standard',
      notes: 'revenue data',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/statements/statement-1/detect').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.statementId).toBe('statement-1');
    expect(res.body.data?.ingestRunId).toBe('ingest-run-1');
    expect(res.body.data?.detection?.statementType).toBe('P&L');
    expect(mockGetStatementDetail).toHaveBeenCalledWith(ORG, 'statement-1');
    expect(mockLoadStatementSourceText).toHaveBeenCalledWith('statement-1', 'revenue data');
    expect(mockDetectStatementType).toHaveBeenCalledWith('Revenue 100');
    expect(mockResolveStatementColumnSelection).toHaveBeenCalledWith(
      'Revenue 100',
      expect.objectContaining({ statementType: 'P&L' })
    );
    expect(mockUpdateStatementMetadata).toHaveBeenCalledWith(
      'statement-1',
      expect.objectContaining({
        statementType: 'P&L',
        currency: 'PLN',
      })
    );
    expect(mockSyncStatementToPack).toHaveBeenCalledWith('statement-1');
    expect(mockRecordStatementSourceArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        artifactType: 'detection',
        stage: 'detect',
      })
    );
    expect(mockUpdateStatementIngestRun).toHaveBeenCalledWith(
      expect.objectContaining({
        ingestRunId: 'ingest-run-1',
        currentStage: 'detect',
        runStatus: 'running',
      })
    );
    expect(mockRecordStatementQualityRun).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        organizationId: ORG,
        stage: 'detect',
      })
    );
  });

  it('POST /api/v8/finance/statements/:id/extract returns envelope and delegates to statement extract flow', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      period_label: 'Q1 2026',
      currency: 'PLN',
      scaling: 'units',
      source_file_name: 'acme-q1.csv',
      source_file_path: '/tmp/acme-q1.csv',
      parse_method: 'ocr',
      document_class: 'financial_statement',
      extraction_strategy: 'table',
      template_family: 'standard',
      notes: 'revenue data',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/statements/statement-1/extract').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.statementId).toBe('statement-1');
    expect(res.body.data?.lineCount).toBe(1);
    expect(res.body.data?.lines?.[0]?.originalLabel).toBe('Revenue');
    expect(mockLoadStatementSourceText).toHaveBeenCalledWith('statement-1', 'revenue data');
    expect(mockLocateStatementSections).toHaveBeenCalledWith('Revenue 100', 'P&L');
    expect(mockPersistStatementExtractedSections).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        ingestRunId: 'ingest-run-1',
      })
    );
    expect(mockPersistStatementCandidateRows).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        statementType: 'P&L',
      })
    );
    expect(mockUpdateStatementStatus).toHaveBeenCalledWith('statement-1', 'imported');
    expect(mockRecordStatementSourceArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        artifactType: 'extraction',
        stage: 'extract',
      })
    );
    expect(mockRecordStatementQualityRun).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        organizationId: ORG,
        stage: 'extract',
      })
    );
  });

  it('preserves browser-selected P&L/BS/CF through the mounted global sanitizer boundary', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'BS',
      period_label: '2025',
      currency: 'PLN',
      scaling: 'thousands',
      source_file_name: 'official.pdf',
      source_file_path: '/tmp/official.pdf',
      parse_method: 'text_extraction',
      document_class: 'mixed_report',
      extraction_strategy: 'table',
      template_family: 'standard',
      notes: 'official statement text',
    });
    const statements = (['P&L', 'BS', 'CF'] as const).flatMap((statementType) =>
      ['2025', '2024'].map((periodLabel) => ({
        statementId: `${statementType}-${periodLabel}`,
        statementType,
        periodLabel,
        sourceReceiptId: `receipt-${statementType}-${periodLabel}`,
        lines: [],
      }))
    );
    mockStageSelectedStatementSections.mockResolvedValue({
      selectedTypes: ['P&L', 'BS', 'CF'],
      statements,
    });

    const res = await request(createSanitizedApp())
      .post('/api/v8/finance/statements/statement-1/extract')
      .send({
        statementType: 'BS',
        statementTypes: ['P&L', 'BS', 'CF'],
        periodLabel: '2025',
        currency: 'PLN',
        scaling: 'thousands',
        entityName: 'CD PROJEKT S.A.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.selectedStatementTypes).toEqual(['P&L', 'BS', 'CF']);
    expect(res.body.data.statements).toHaveLength(6);
    expect(mockStageSelectedStatementSections).toHaveBeenCalledWith(
      expect.objectContaining({ statementTypes: ['P&L', 'BS', 'CF'] })
    );
  });

  it('POST /api/v8/finance/statements/:id/map returns envelope and delegates to statement map flow', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      currency: 'PLN',
      scaling: 'units',
      source_file_name: 'acme-q1.csv',
      source_file_path: '/tmp/acme-q1.csv',
      parse_method: 'ocr',
      document_class: 'financial_statement',
      extraction_strategy: 'table',
      template_family: 'standard',
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/statements/statement-1/map')
      .send({
        lines: [{ originalLabel: 'Revenue', value: 100, confidence: 0.9, sourceRow: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.statementId).toBe('statement-1');
    expect(res.body.data?.mappedLines?.[0]?.suggestedCanonicalId).toBe('line-1');
    expect(mockAutoMapLines).toHaveBeenCalledWith(
      [{ originalLabel: 'Revenue', value: 100, confidence: 0.9, sourceRow: 1 }],
      'P&L',
      { organizationId: ORG, templateFamily: 'standard' }
    );
    expect(mockPersistStatementMappingCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        ingestRunId: 'ingest-run-1',
      })
    );
    expect(mockUpdateStatementStatus).toHaveBeenCalledWith('statement-1', 'mapped');
    expect(mockRecordStatementSourceArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        artifactType: 'mapping',
        stage: 'map',
      })
    );
    expect(mockRecordStatementQualityRun).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'statement-1',
        organizationId: ORG,
        stage: 'map',
      })
    );
    expect(mockAssessCoverage).toHaveBeenCalled();
  });

  it('POST /api/v8/finance/statements/:id/confirm returns envelope and delegates to statement confirm flow', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      status: 'mapped',
      validation_status: 'pass',
      currency: 'PLN',
      scaling: 'units',
      source_file_name: 'acme-q1.csv',
      source_file_path: '/tmp/acme-q1.csv',
      parse_method: 'ocr',
      document_class: 'financial_statement',
      extraction_strategy: 'table',
      template_family: 'standard',
      validationMessages: [],
      values: [{ canonicalLineId: 'line-1', value: 100, isNonFinancial: false }],
    });

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/statements/statement-1/confirm')
      .set('Idempotency-Key', 'confirm-statement-1-v1')
      .send({ sourceReceiptId: 'receipt-1', expectedValuesVersion: 0 });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.statementId).toBe('statement-1');
    expect(res.body.data?.status).toBe('confirmed');
    expect(res.body.data).toEqual(
      expect.objectContaining({
        statementPackId: 'pack-1',
        sourceReceiptId: 'receipt-1',
        valuesVersion: 0,
        canonicalArtifactId: 'artifact-1',
        canonicalBusinessVersionId: 'business-version-1',
        canonicalWorkingRevisionId: 'working-revision-1',
        canonicalReplay: false,
      })
    );
    expect(mockConfirmGovernedStatement).toHaveBeenCalledWith({
      statementId: 'statement-1',
      organizationId: ORG,
      userId: UID,
      sourceReceiptId: 'receipt-1',
      expectedValuesVersion: 0,
      idempotencyKey: 'confirm-statement-1-v1',
    });
    expect(mockConfirmStatement).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/finance/statements/:id/values returns envelope and delegates to shared values flow', async () => {
    mockGetStatementDetail.mockResolvedValue({
      id: 'statement-1',
      statement_type: 'P&L',
      status: 'draft',
      validation_status: 'pending',
      currency: 'PLN',
      scaling: 'units',
      source_file_name: 'acme-q1.csv',
      values: [],
    });

    const app = createApp();
    const res = await request(app)
      .put('/api/v8/finance/statements/statement-1/values')
      .send({
        values: [{ canonicalLineId: 'line-1', originalLabel: 'Revenue', value: 100 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.statementId).toBe('statement-1');
    expect(res.body.data?.savedCount).toBe(1);
    expect(mockSaveStatementValuesFlow).toHaveBeenCalledWith({
      statementId: 'statement-1',
      organizationId: ORG,
      userId: UID,
      statement: expect.objectContaining({ id: 'statement-1' }),
      values: [{ canonicalLineId: 'line-1', originalLabel: 'Revenue', value: 100 }],
    });
  });

  it('GET /api/v8/finance/canonical-lines returns envelope and delegates to the canonical line query', async () => {
    mockDbAll.mockResolvedValue([
      {
        id: 'line-1',
        statement_type: 'P&L',
        line_code: 'revenue',
        line_name: 'Revenue',
        line_name_pl: 'Przychody',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/canonical-lines');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.canonicalLines?.[0]?.line_name).toBe('Revenue');
    expect(mockDbAll).toHaveBeenCalledWith(
      expect.stringContaining('FROM financial_statement_lines'),
      [ORG]
    );
  });

  it('GET /api/v8/finance/valuations returns envelope and delegates to listValuations', async () => {
    mockListValuations.mockResolvedValue([
      {
        id: 'valuation-1',
        title: 'DCF valuation',
        status: 'draft',
        source_type: 'financial_model',
        currency: 'PLN',
        horizon_years: 5,
        updated_at: '2026-03-27T10:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/valuations');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.valuations?.[0]?.title).toBe('DCF valuation');
    expect(mockListValuations).toHaveBeenCalledWith(ORG);
  });

  it('GET /api/v8/finance/budgets returns envelope and delegates to listBudgets', async () => {
    mockListBudgets.mockResolvedValue([
      {
        id: 'budget-1',
        title: 'FY26 operating budget',
        status: 'draft',
        currency: 'PLN',
        granularity: 'monthly',
        period_start: '2026-01-01',
        period_end: '2026-12-31',
        updated_at: '2026-03-27T11:00:00.000Z',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/budgets');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.count).toBe(1);
    expect(res.body.data?.budgets?.[0]?.title).toBe('FY26 operating budget');
    expect(mockListBudgets).toHaveBeenCalledWith(ORG);
  });

  it('POST /api/v8/finance/budgets creates a budget and returns 201', async () => {
    mockRegisterBudget.mockResolvedValue({
      budget: {
        id: 'budget-created',
        organizationId: ORG,
        title: 'FY26 Budget',
        status: 'DRAFT',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        currency: 'PLN',
        granularity: 'monthly',
      },
      lineCount: 15,
      scenarioCount: 3,
      replay: false,
    });
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/budgets')
      .set('Idempotency-Key', 'budget-test-key')
      .send({
        title: 'FY26 Budget',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        sourceKind: 'manual',
      });
    // finance.routes.ts:982 explicitly returns 201 (standard REST for a
    // creation endpoint) — this test's expectation of 200 was simply wrong.
    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.budget?.id).toBe('budget-created');
    expect(mockRegisterBudget).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        userId: UID,
        title: 'FY26 Budget',
        periodStart: '2026-01-01',
        sourceKind: 'manual',
        idempotencyKey: 'budget-test-key',
      })
    );
  });

  it('POST /api/v8/finance/budgets returns 200 for an idempotent replay', async () => {
    mockRegisterBudget.mockResolvedValue({
      budget: { id: 'budget-created', title: 'FY26 Budget', status: 'DRAFT' },
      lineCount: 15,
      scenarioCount: 3,
      replay: true,
    });
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/budgets')
      .set('Idempotency-Key', 'budget-test-key')
      .send({
        title: 'FY26 Budget',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        sourceKind: 'manual',
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ replay: true, lineCount: 15, scenarioCount: 3 })
    );
  });

  it('POST /api/v8/finance/budgets — 400 and no write for unknown fields', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/budgets')
      .send({ title: 'No dates', unknown: true });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockRegisterBudget).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/finance/budgets/:budgetId/lines/:lineId binds CAS and idempotency', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/finance/budgets/budget-new/lines/line-1')
      .set('Idempotency-Key', 'line-command-key')
      .send({ expectedVersion: 1, baselineValue: '42' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ budgetVersion: 2, replay: false });
    expect(mockApplyBudgetLineCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      budgetId: 'budget-new',
      lineId: 'line-1',
      expectedVersion: 1,
      idempotencyKey: 'line-command-key',
      patch: { baselineValue: '42' },
    });
  });

  it('PUT /api/v8/finance/budgets/:budgetId/lines/:lineId rejects numeric transport', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/finance/budgets/budget-new/lines/line-1')
      .set('Idempotency-Key', 'line-command-key')
      .send({ expectedVersion: 1, baselineValue: 42 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockApplyBudgetLineCommand).not.toHaveBeenCalled();
  });

  it('POST /api/v8/finance/budgets/:budgetId/initiatives/:initiativeId binds CAS and idempotency', async () => {
    const res = await request(createApp())
      .post('/api/v8/finance/budgets/budget-new/initiatives/initiative-1')
      .set('Idempotency-Key', 'link-command-key')
      .send({ expectedVersion: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      budgetVersion: 2,
      initiativeId: 'initiative-1',
      replay: false,
    });
    expect(mockLinkBudgetInitiativeCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      budgetId: 'budget-new',
      initiativeId: 'initiative-1',
      expectedVersion: 1,
      idempotencyKey: 'link-command-key',
    });
  });

  it.each([
    [{}, 'INVALID_BODY'],
    [{ expectedVersion: 0 }, 'INVALID_EXPECTED_VERSION'],
    [{ expectedVersion: 1.5 }, 'INVALID_EXPECTED_VERSION'],
    [{ expectedVersion: '1' }, 'INVALID_EXPECTED_VERSION'],
    [{ expectedVersion: 1, extra: true }, 'INVALID_BODY'],
  ])('rejects invalid initiative-link body %j', async (body, code) => {
    const res = await request(createApp())
      .post('/api/v8/finance/budgets/budget-new/initiatives/initiative-1')
      .set('Idempotency-Key', 'link-command-key')
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(mockLinkBudgetInitiativeCommand).not.toHaveBeenCalled();
  });

  it('DELETE /api/v8/finance/budgets/:budgetId/initiatives/:initiativeId binds CAS and idempotency', async () => {
    const res = await request(createApp())
      .delete('/api/v8/finance/budgets/budget-new/initiatives/initiative-1')
      .set('Idempotency-Key', 'unlink-command-key')
      .send({ expectedVersion: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      budgetVersion: 3,
      initiativeId: 'initiative-1',
      replay: false,
    });
    expect(mockUnlinkBudgetInitiativeCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      budgetId: 'budget-new',
      initiativeId: 'initiative-1',
      expectedVersion: 2,
      idempotencyKey: 'unlink-command-key',
    });
  });

  it.each([
    [{}, 'INVALID_BODY'],
    [{ expectedVersion: 0 }, 'INVALID_EXPECTED_VERSION'],
    [{ expectedVersion: '2' }, 'INVALID_EXPECTED_VERSION'],
    [{ expectedVersion: 2, extra: true }, 'INVALID_BODY'],
  ])('rejects invalid initiative-unlink body %j', async (body, code) => {
    const res = await request(createApp())
      .delete('/api/v8/finance/budgets/budget-new/initiatives/initiative-1')
      .set('Idempotency-Key', 'unlink-command-key')
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
    expect(mockUnlinkBudgetInitiativeCommand).not.toHaveBeenCalled();
  });

  it('POST /api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/project binds CAS and idempotency', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/budgets/budget-new/scenarios/scenario-1/project')
      .set('Idempotency-Key', 'projection-command-key')
      .send({ expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ budgetVersion: 2, replay: false });
    expect(mockProjectBudgetScenario).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      budgetId: 'budget-new',
      scenarioId: 'scenario-1',
      expectedVersion: 1,
      idempotencyKey: 'projection-command-key',
    });
  });

  it('POST /api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/project rejects unknown fields', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/budgets/budget-new/scenarios/scenario-1/project')
      .set('Idempotency-Key', 'projection-command-key')
      .send({ expectedVersion: 1, projections: {} });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockProjectBudgetScenario).not.toHaveBeenCalled();
  });

  it('PUT /api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/adjustments binds CAS and idempotency', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/finance/budgets/budget-new/scenarios/scenario-1/adjustments')
      .set('Idempotency-Key', 'adjustment-command-key')
      .send({ expectedVersion: 1, adjustments: { revenueGrowth: 7 } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ budgetVersion: 2, replay: false });
    expect(mockUpdateBudgetScenarioAdjustments).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      budgetId: 'budget-new',
      scenarioId: 'scenario-1',
      expectedVersion: 1,
      idempotencyKey: 'adjustment-command-key',
      adjustments: { revenueGrowth: 7 },
    });
  });

  it('PUT /api/v8/finance/budgets/:budgetId/scenarios/:scenarioId/adjustments rejects unknown fields', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/finance/budgets/budget-new/scenarios/scenario-1/adjustments')
      .set('Idempotency-Key', 'adjustment-command-key')
      .send({ expectedVersion: 1, adjustments: {}, projections: {} });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockUpdateBudgetScenarioAdjustments).not.toHaveBeenCalled();
  });

  it('POST /api/v8/finance/budgets/:budgetId/approve binds CAS and idempotency', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/budgets/budget-new/approve')
      .set('Idempotency-Key', 'approval-command-key')
      .send({ expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'APPROVED', budgetVersion: 2, replay: false });
    expect(mockApproveBudgetCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      budgetId: 'budget-new',
      expectedVersion: 1,
      idempotencyKey: 'approval-command-key',
    });
  });

  it('POST /api/v8/finance/digitization-analyses/:id/archive binds tenant command fields', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v8/finance/digitization-analyses/digitization-analysis-1/archive')
      .set('Idempotency-Key', 'archive-key')
      .send({ expectedVersion: 1, reason: 'Remove from active workspace' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ status: 'ARCHIVED', version: 2, replay: false });
    expect(mockArchiveDigitizationAnalysisCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      analysisId: 'digitization-analysis-1',
      expectedVersion: 1,
      reason: 'Remove from active workspace',
      idempotencyKey: 'archive-key',
    });
  });

  it('POST /api/v8/finance/digitization-analyses binds registration and idempotency', async () => {
    const app = createApp();
    const body = {
      name: 'New analysis',
      analysisType: 'financial',
      sourceType: 'tool_session',
      sourceId: 'session-1',
    };
    const response = await request(app)
      .post('/api/v8/finance/digitization-analyses')
      .set('Idempotency-Key', 'analysis-register-key')
      .send(body);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ id: 'digitization-analysis-new', replay: false });
    expect(mockRegisterDigitizationAnalysis).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      idempotencyKey: 'analysis-register-key',
      body,
    });
  });

  it('PUT /api/v8/finance/digitization-analyses/:id binds optimistic update command', async () => {
    const app = createApp();
    mockUpdateDigitizationAnalysisCommand.mockResolvedValueOnce({
      analysisId: 'digitization-analysis-1',
      version: 2,
      receiptId: 'receipt-1',
      replay: false,
    });
    const response = await request(app)
      .put('/api/v8/finance/digitization-analyses/digitization-analysis-1')
      .set('Idempotency-Key', 'update-key')
      .send({ expectedVersion: 1, name: 'Updated' });
    expect(response.status).toBe(201);
    expect(mockUpdateDigitizationAnalysisCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      analysisId: 'digitization-analysis-1',
      idempotencyKey: 'update-key',
      body: { expectedVersion: 1, name: 'Updated' },
    });
  });

  it('POST /api/v8/finance/digitization-analyses/:id/initiative-link binds atomic command', async () => {
    const app = createApp();
    mockLinkDigitizationAnalysisInitiativeCommand.mockResolvedValueOnce({
      analysisId: 'digitization-analysis-1',
      initiativeId: 'initiative-1',
      projectId: 'project-1',
      financialsId: 'financials-1',
      version: 2,
      receiptId: 'receipt-1',
      replay: false,
    });
    const response = await request(app)
      .post('/api/v8/finance/digitization-analyses/digitization-analysis-1/initiative-link')
      .set('Idempotency-Key', 'link-key')
      .send({ initiativeId: 'initiative-1', expectedVersion: 1 });
    expect(response.status).toBe(201);
    expect(mockLinkDigitizationAnalysisInitiativeCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      analysisId: 'digitization-analysis-1',
      initiativeId: 'initiative-1',
      expectedVersion: 1,
      idempotencyKey: 'link-key',
    });
  });

  it('POST /api/v8/finance/digitization-analyses/:id/archive rejects unknown fields', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v8/finance/digitization-analyses/digitization-analysis-1/archive')
      .set('Idempotency-Key', 'archive-key')
      .send({ expectedVersion: 1, reason: 'Archive', hardDelete: true });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_BODY');
    expect(mockArchiveDigitizationAnalysisCommand).not.toHaveBeenCalled();
  });

  it('POST /api/v8/finance/budgets/:budgetId/approve rejects unknown fields', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/budgets/budget-new/approve')
      .set('Idempotency-Key', 'approval-command-key')
      .send({ expectedVersion: 1, approvedBy: 'spoofed' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_BODY');
    expect(mockApproveBudgetCommand).not.toHaveBeenCalled();
  });

  it('DELETE /api/v8/finance/budgets/:budgetId binds version, reason and idempotency', async () => {
    const app = createApp();
    const response = await request(app)
      .delete('/api/v8/finance/budgets/budget-new')
      .set('Idempotency-Key', 'discard-key')
      .send({ expectedVersion: 3, reason: 'Superseded draft' });
    expect(response.status).toBe(200);
    expect(mockDiscardBudgetCommand).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      budgetId: 'budget-new',
      expectedVersion: 3,
      reason: 'Superseded draft',
      idempotencyKey: 'discard-key',
    });
  });

  it('DELETE /api/v8/finance/budgets/:budgetId rejects unknown fields', async () => {
    const app = createApp();
    const response = await request(app)
      .delete('/api/v8/finance/budgets/budget-new')
      .set('Idempotency-Key', 'discard-key')
      .send({ expectedVersion: 3, reason: 'Superseded', hardDelete: true });
    expect(response.status).toBe(400);
    expect(mockDiscardBudgetCommand).not.toHaveBeenCalled();
  });

  it('POST /api/v8/finance/budgets/:budgetId/import-document extracts multipart and binds CAS', async () => {
    const csv = Buffer.from('Przychody;1 234,50');
    mockExtractDocumentTextFromBuffer.mockResolvedValue('Przychody;1 234,50');
    mockImportBudgetDocumentCommand.mockResolvedValue({
      budgetId: 'budget-new',
      budgetVersion: 4,
      linesImported: 1,
      replay: false,
    });
    const app = createApp();
    const response = await request(app)
      .post('/api/v8/finance/budgets/budget-new/import-document')
      .set('Idempotency-Key', 'document-import-key')
      .set('x-expected-budget-version', '3')
      .field('expectedVersion', '3')
      .attach('file', csv, {
        filename: 'budget.csv',
        contentType: 'text/csv',
      });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(mockExtractDocumentTextFromBuffer).toHaveBeenCalledWith(
      expect.any(Buffer),
      'budget.csv',
      'text/csv'
    );
    expect(mockImportBudgetDocumentCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        userId: UID,
        budgetId: 'budget-new',
        expectedVersion: 3,
        idempotencyKey: 'document-import-key',
        sourceFileName: 'budget.csv',
        sourceFileSize: csv.length,
        sourceFileSha256: createHash('sha256').update(csv).digest('hex'),
        documentText: 'Przychody;1 234,50',
      })
    );
  });

  it.each([
    ['body only', '5', undefined],
    ['header only', undefined, '6'],
  ])('accepts a literal positive expectedVersion from %s', async (_label, body, header) => {
    mockExtractDocumentTextFromBuffer.mockResolvedValue('Revenue,100');
    mockImportBudgetDocumentCommand.mockResolvedValue({
      budgetId: 'budget-new',
      budgetVersion: Number(body ?? header) + 1,
      linesImported: 1,
      replay: false,
    });
    let call = request(createApp())
      .post('/api/v8/finance/budgets/budget-new/import-document')
      .set('Idempotency-Key', `document-${_label}-key`);
    if (header) call = call.set('x-expected-budget-version', header);
    if (body) call = call.field('expectedVersion', body);
    const response = await call.attach('file', Buffer.from('Revenue,100'), {
      filename: 'budget.csv',
      contentType: 'text/csv',
    });
    expect(response.status).toBe(200);
    expect(mockImportBudgetDocumentCommand).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: Number(body ?? header) })
    );
  });

  it.each([
    ['spoofed PDF', 'fake.pdf', 'application/pdf', Buffer.from('not a pdf')],
    ['spoofed XLS', 'fake.xls', 'application/vnd.ms-excel', Buffer.from('not ole2')],
    ['spoofed CSV', 'fake.csv', 'text/csv', Buffer.from('%PDF-1.4 disguised')],
  ])('rejects %s before extraction', async (_label, filename, contentType, content) => {
    const response = await request(createApp())
      .post('/api/v8/finance/budgets/budget-new/import-document')
      .set('Idempotency-Key', 'document-negative-key')
      .set('x-expected-budget-version', '3')
      .attach('file', content, { filename, contentType });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(FILE_UPLOAD_SIGNATURE_MISMATCH_CODE);
    expect(mockExtractDocumentTextFromBuffer).not.toHaveBeenCalled();
    expect(mockImportBudgetDocumentCommand).not.toHaveBeenCalled();
  });

  it('rejects a ZIP that is not an XLSX workbook before extraction', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document/>');
    zip.file('[Content_Types].xml', '<Types/>');
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    const response = await request(createApp())
      .post('/api/v8/finance/budgets/budget-new/import-document')
      .set('Idempotency-Key', 'document-xlsx-negative-key')
      .set('x-expected-budget-version', '3')
      .attach('file', content, {
        filename: 'fake.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(FILE_UPLOAD_SIGNATURE_MISMATCH_CODE);
    expect(mockExtractDocumentTextFromBuffer).not.toHaveBeenCalled();
  });

  it('rejects DOCX even when its ZIP signature is genuine', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document/>');
    const content = await zip.generateAsync({ type: 'nodebuffer' });
    const response = await request(createApp())
      .post('/api/v8/finance/budgets/budget-new/import-document')
      .set('Idempotency-Key', 'document-docx-negative-key')
      .set('x-expected-budget-version', '3')
      .attach('file', content, {
        filename: 'fake.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(FILE_UPLOAD_SIGNATURE_MISMATCH_CODE);
    expect(mockExtractDocumentTextFromBuffer).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined, undefined, 'INVALID_EXPECTED_VERSION'],
    ['invalid header', undefined, '3.5', 'INVALID_EXPECTED_VERSION'],
    ['invalid body', '0', undefined, 'INVALID_EXPECTED_VERSION'],
    ['conflicting', '4', '3', 'EXPECTED_VERSION_CONFLICT'],
  ])('rejects %s expectedVersion before command execution', async (_label, body, header, code) => {
    let call = request(createApp())
      .post('/api/v8/finance/budgets/budget-new/import-document')
      .set('Idempotency-Key', 'document-version-negative-key');
    if (header) call = call.set('x-expected-budget-version', header);
    if (body !== undefined) call = call.field('expectedVersion', body);
    const response = await call.attach('file', Buffer.from('Revenue,100'), {
      filename: 'budget.csv',
      contentType: 'text/csv',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(code);
    expect(mockImportBudgetDocumentCommand).not.toHaveBeenCalled();
  });

  it('POST /api/v8/finance/analyses returns envelope and delegates to createAnalysis', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/finance/analyses').send({
      title: 'Created analysis',
      analysisType: 'comprehensive',
      currency: 'PLN',
    });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.analysis?.title).toBe('Created analysis');
    expect(mockCreateAnalysis).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({
        title: 'Created analysis',
        analysisType: 'comprehensive',
        currency: 'PLN',
      }),
      UID
    );
  });

  it('GET /api/v8/finance/analyses/:id/ratios returns envelope and delegates to getAnalysisRatios', async () => {
    mockListAnalyses.mockResolvedValue([
      {
        id: 'analysis-1',
        title: 'Working capital analysis',
      },
    ]);
    mockGetAnalysisRatios.mockResolvedValue([
      {
        category: 'liquidity',
        ratio_code: 'current_ratio',
        ratio_name: 'Current ratio',
        value: 1.42,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/analyses/analysis-1/ratios');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.ratios?.[0]?.ratio_code).toBe('current_ratio');
    expect(mockListAnalyses).toHaveBeenCalledWith(ORG);
    expect(mockGetAnalysisRatios).toHaveBeenCalledWith('analysis-1');
  });

  it('GET /api/v8/finance/analyses/:id/initiative-proposals returns filtered proposal envelope', async () => {
    mockListAnalyses.mockResolvedValue([
      {
        id: 'analysis-1',
        title: 'Working capital analysis',
      },
    ]);
    mockGetAnalysisInsights.mockResolvedValue([
      {
        id: 'insight-1',
        insight_type: 'action',
        title: 'Reduce overdue receivables',
        description: 'Shorten DSO with collections sprint',
        priority: 9,
      },
      {
        id: 'insight-2',
        insight_type: 'quality_note',
        title: 'Ignore me',
        description: 'Non-proposal insight',
        priority: 1,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/v8/finance/analyses/analysis-1/initiative-proposals');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.proposals).toHaveLength(1);
    expect(res.body.data?.proposals?.[0]?.title).toBe('Reduce overdue receivables');
    expect(mockListAnalyses).toHaveBeenCalledWith(ORG);
    expect(mockGetAnalysisInsights).toHaveBeenCalledWith('analysis-1');
  });

  it('POST /api/v8/finance/analyses/:id/initiatives stays retired without direct Initiative writes', async () => {
    mockDbGet.mockResolvedValue({
      id: 'analysis-1',
      organization_id: ORG,
      project_id: 'project-1',
      title: 'Working capital analysis',
    });
    mockDbAll.mockResolvedValue([
      {
        id: 'proposal-1',
        insight_type: 'action',
        title: 'Reduce overdue receivables',
        description: 'Shorten DSO with collections sprint',
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post('/api/v8/finance/analyses/analysis-1/initiatives')
      .send({ acceptedProposalIds: ['proposal-1'] });

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({ code: 'DIRECT_INITIATIVE_CREATION_DISABLED' });
    expect(mockDbGet).not.toHaveBeenCalled();
    expect(mockDbAll).not.toHaveBeenCalled();
    expect(
      mockDbRun.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO initiatives'))
    ).toBe(false);
  });

  it('POST /api/v8/finance/analyses/:id/run delegates to runFullAnalysis', async () => {
    mockRunFullAnalysis.mockResolvedValue({
      ratios: [{ ratio_code: 'current_ratio', value: 1.42 }],
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/finance/analyses/analysis-1/run').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockRunFullAnalysis).toHaveBeenCalledWith(ORG, 'analysis-1');
  });

  it('POST /api/v8/finance/analyses/:id/approve delegates to approveAnalysis', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/finance/analyses/analysis-1/approve').send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(mockApproveAnalysis).toHaveBeenCalledWith(ORG, 'analysis-1', UID);
  });

  it('PUT /api/v8/finance/analyses/:id validates and delegates the canonical update', async () => {
    mockDbGet.mockResolvedValue({ id: 'analysis-1' });
    const app = createApp();
    const body = {
      title: 'Updated analysis',
      currency: 'EUR',
      sourceStatementIds: ['statement-1'],
      rebuildFromStatements: true,
    };
    const res = await request(app).put('/api/v8/finance/analyses/analysis-1').send(body);

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({ success: true, analysisId: 'analysis-1' });
    expect(mockUpdateAnalysis).toHaveBeenCalledWith(ORG, 'analysis-1', body);

    const invalid = await request(app)
      .put('/api/v8/finance/analyses/analysis-1')
      .send({ title: '', unknownField: true });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('INVALID_BODY');
    expect(mockUpdateAnalysis).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/v8/finance/analyses/:id deletes a non-approved analysis', async () => {
    mockDbGet.mockResolvedValue({ id: 'analysis-1', status: 'DRAFT' });
    const app = createApp();
    const res = await request(app).delete('/api/v8/finance/analyses/analysis-1');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_FINANCE_READ_CONTRACT);
    expect(res.body.data).toEqual({ success: true, deleted: 'analysis-1' });
    expect(mockDbRun).toHaveBeenCalledWith(
      'DELETE FROM financial_analysis_insights WHERE analysis_id = ?',
      ['analysis-1']
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      'DELETE FROM financial_analysis_ratios WHERE analysis_id = ?',
      ['analysis-1']
    );
    expect(mockDbRun).toHaveBeenCalledWith('DELETE FROM financial_analyses WHERE id = ?', [
      'analysis-1',
    ]);
  });
});
