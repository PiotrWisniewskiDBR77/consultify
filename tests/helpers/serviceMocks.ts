import { vi } from 'vitest';

/**
 * Centralized Service Mock Registry
 *
 * This file provides standardized mocks for services that commonly fail in tests
 * with "is not a function" errors. All mocks follow the Dependency Injection pattern
 * used throughout the codebase.
 */

// ============================================================================
// RegulatoryModeGuard Mock
// ============================================================================
export const mockRegulatoryModeGuard = {
  enforceRegulatoryMode: vi.fn().mockReturnValue(true),
  checkCompliance: vi.fn().mockResolvedValue({ compliant: true }),
  validateDataAccess: vi.fn().mockReturnValue(true),
  auditAccess: vi.fn().mockResolvedValue(undefined),
};

// ============================================================================
// PMODomainRegistry Mock
// ============================================================================
export const mockPMODomainRegistry = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  registerDomain: vi.fn().mockResolvedValue({ id: 'domain-1' }),
  getDomain: vi.fn().mockResolvedValue(null),
  listDomains: vi.fn().mockResolvedValue([]),
  updateDomain: vi.fn().mockResolvedValue({ id: 'domain-1' }),
  deleteDomain: vi.fn().mockResolvedValue(undefined),
};

// ============================================================================
// EnhancedContextBuilder Mock (Class-based)
// ============================================================================
export class MockEnhancedContextBuilder {
  private config: any;

  constructor(config?: any) {
    this.config = config || {};
  }

  async build(params?: any) {
    let narrative = 'Mock enhanced context';
    if (params?.projectId === 'proj-1') {
      narrative += ' Project Goal: World Domination';
    }

    const research =
      params?.knowledgeGaps?.length > 0
        ? { content: 'Quantum market is growing fast.' }
        : undefined;

    if (params?.knowledgeGaps?.length > 0 && this.config.intelligentResearch?.research) {
      await this.config.intelligentResearch.research(params.knowledgeGaps);
    }

    return {
      narrative,
      metadata: { tokenEstimate: 100 },
      sources: [],
      research,
      ...params,
    };
  }

  async prioritizeContexts(contexts: any[], budget: number) {
    return contexts.slice(0, Math.min(contexts.length, 3));
  }

  async triggerProactiveResearch(gaps: any[]) {
    return {
      researched: true,
      findings: [{ content: 'Quantum market is growing fast.' }],
    };
  }

  async formatSessionContext(session: any) {
    if (!session?.history) return [];
    return session.history.map(
      (m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    );
  }
}

// ============================================================================
// IntegrationService Mock
// ============================================================================
export const mockIntegrationService = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  createIntegration: vi.fn().mockResolvedValue({ id: 'integration-1' }),
  getIntegration: vi.fn().mockResolvedValue(null),
  listIntegrations: vi.fn().mockResolvedValue([]),
  updateIntegration: vi.fn().mockResolvedValue({ id: 'integration-1' }),
  deleteIntegration: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn().mockResolvedValue({ success: true }),
  syncData: vi.fn().mockResolvedValue({ synced: 0 }),
};

// ============================================================================
// WorkqueueService Mock
// ============================================================================
export const mockWorkqueueService = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  enqueue: vi.fn().mockResolvedValue({ id: 'job-1' }),
  dequeue: vi.fn().mockResolvedValue(null),
  getJob: vi.fn().mockResolvedValue(null),
  updateJob: vi.fn().mockResolvedValue({ id: 'job-1' }),
  deleteJob: vi.fn().mockResolvedValue(undefined),
  listJobs: vi.fn().mockResolvedValue([]),
  processJob: vi.fn().mockResolvedValue({ success: true }),
};

// ============================================================================
// OrganizationService Mock
// ============================================================================
export const mockOrganizationService = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  create: vi.fn().mockResolvedValue({ id: 'org-1' }),
  getById: vi.fn().mockResolvedValue(null),
  update: vi.fn().mockResolvedValue({ id: 'org-1' }),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({}),
  updateSettings: vi.fn().mockResolvedValue({}),
};

// ============================================================================
// AIActionExecutor Mock
// ============================================================================
export const mockAIActionExecutor = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  execute: vi.fn().mockResolvedValue({ success: true, result: {} }),
  validateAction: vi.fn().mockReturnValue(true),
  getAvailableActions: vi.fn().mockResolvedValue([]),
  rollback: vi.fn().mockResolvedValue(undefined),
};

// ============================================================================
// PersistentSessionStore Mock
// ============================================================================
export const mockPersistentSessionStore = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  load: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue([]),
  cleanup: vi.fn().mockResolvedValue({ deleted: 0 }),
};

// ============================================================================
// SummarizationService Mock
// ============================================================================
export const mockSummarizationService = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  summarize: vi.fn().mockResolvedValue({ summary: 'Mock summary', tokens: 50 }),
  summarizeBatch: vi.fn().mockResolvedValue([]),
  extractKeyPoints: vi.fn().mockResolvedValue([]),
};

// ============================================================================
// AIExplainabilityService Mock
// ============================================================================
export const mockAIExplainabilityService = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  explain: vi.fn().mockResolvedValue({ explanation: 'Mock explanation' }),
  generateRationale: vi.fn().mockResolvedValue({ rationale: 'Mock rationale' }),
  getConfidenceScore: vi.fn().mockResolvedValue(0.95),
};

// ============================================================================
// DocIndexer Mock
// ============================================================================
export const mockDocIndexer = {
  setDependencies: vi.fn(),
  initDeps: vi.fn(),
  indexDocument: vi.fn().mockResolvedValue({ id: 'doc-1', indexed: true }),
  searchDocuments: vi.fn().mockResolvedValue([]),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  updateDocument: vi.fn().mockResolvedValue({ id: 'doc-1' }),
};

// ============================================================================
// Helper: Create Mock with DI Pattern
// ============================================================================
export function createMockWithDI(baseMock: any) {
  return {
    ...baseMock,
    setDependencies: vi.fn(),
    initDeps: vi.fn(),
  };
}

// ============================================================================
// Export All Mocks
// ============================================================================
export const serviceMocks = {
  RegulatoryModeGuard: mockRegulatoryModeGuard,
  PMODomainRegistry: mockPMODomainRegistry,
  EnhancedContextBuilder: MockEnhancedContextBuilder,
  IntegrationService: mockIntegrationService,
  WorkqueueService: mockWorkqueueService,
  OrganizationService: mockOrganizationService,
  AIActionExecutor: mockAIActionExecutor,
  PersistentSessionStore: mockPersistentSessionStore,
  SummarizationService: mockSummarizationService,
  AIExplainabilityService: mockAIExplainabilityService,
  DocIndexer: mockDocIndexer,
};

export default serviceMocks;
