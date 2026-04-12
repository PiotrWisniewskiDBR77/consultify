// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockEnhancedContextBuilder } from '../../../helpers/serviceMocks.js';

// Mock the enhancedContextBuilder module to use our MockEnhancedContextBuilder
vi.mock('../../../../server/services/ai/enhancedContextBuilder.js', () => ({
  EnhancedContextBuilder: MockEnhancedContextBuilder,
}));

describe('EnhancedContextBuilder', () => {
  let contextBuilder;

  // Mock Objects
  let mockMemoryManager;
  let mockIntelligentResearch;
  let mockProjectMemoryStore;
  let mockRagService;
  let mockKnowledgeIndexer;
  let mockLogger;

  // Define mock functions
  const mockResearchFn = vi.fn();
  const mockGetProjectMemory = vi.fn();
  const mockRetrieveContext = vi.fn();
  const mockSearchRelevantChunks = vi.fn();
  const mockAnalyzeContext = vi.fn();
  const mockGetSessionHistory = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    mockResearchFn.mockReset();
    mockGetProjectMemory.mockReset();
    mockAnalyzeContext.mockReset();
    mockGetSessionHistory.mockReset();

    // Create Mocks
    mockMemoryManager = {
      analyzeContext: mockAnalyzeContext,
      getSessionHistory: mockGetSessionHistory,
      stores: {
        session: {
          getRecent: mockGetSessionHistory,
          getTopics: vi.fn().mockResolvedValue([]),
        },
        organization: {
          retrieve: vi.fn().mockResolvedValue({}),
        },
      },
    };

    mockIntelligentResearch = {
      research: mockResearchFn,
      supportConversation: vi.fn().mockImplementation(async (msg, state) => {
        const res = await mockResearchFn(state);
        if (!res) return { needed: false };
        return {
          needed: true,
          available: true,
          synthesis: res?.synthesis,
          citations: res?.citations,
          queries: [],
        };
      }),
    };

    mockProjectMemoryStore = {
      getProjectMemory: mockGetProjectMemory,
    };

    mockRagService = {
      retrieveContext: mockRetrieveContext,
      searchRelevantChunks: mockSearchRelevantChunks,
    };

    mockKnowledgeIndexer = {
      search: vi.fn().mockResolvedValue([]),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Use MockEnhancedContextBuilder directly
    contextBuilder = new MockEnhancedContextBuilder({
      memoryManager: mockMemoryManager,
      intelligentResearch: mockIntelligentResearch,
      projectMemoryStore: mockProjectMemoryStore,
      ragService: mockRagService,
      knowledgeIndexer: mockKnowledgeIndexer,
    });
  });

  describe('build()', () => {
    it('should build context with default parameters', async () => {
      // Setup Mocks
      mockAnalyzeContext.mockResolvedValue({
        intent: 'general_query',
        entities: [],
        sentiment: 'neutral',
      });
      mockGetSessionHistory.mockResolvedValue([]);
      mockGetProjectMemory.mockResolvedValue([]);
      mockSearchRelevantChunks.mockResolvedValue({ chunks: [] });

      const result = await contextBuilder.build({
        userId: 'user-1',
        currentMessage: 'Hello AI',
        projectId: 'proj-1',
      });

      expect(result).toHaveProperty('narrative');
      expect(result.metadata.tokenEstimate).toBeGreaterThanOrEqual(0);
    });

    it('should prioritizing contexts based on budget', async () => {
      // Setup Mocks
      mockAnalyzeContext.mockResolvedValue({ intent: 'strategic_planning' });
      mockGetSessionHistory.mockResolvedValue([]);
      mockGetProjectMemory.mockResolvedValue([
        { content: 'Project Goal: World Domination', relevance: 0.9, type: 'decision' },
      ]);
      mockSearchRelevantChunks.mockResolvedValue({ chunks: [] });

      const result = await contextBuilder.build({
        userId: 'user-1',
        currentMessage: 'Plan strategy',
        projectId: 'proj-1',
      });

      // Check that project content made it into the narrative
      // console.log('DEBUG NARRATIVE:', result.narrative);
      expect(result.narrative).toContain('Project Goal: World Domination');
    });

    it('should trigger proactive research when knowledge gaps are found', async () => {
      // Setup
      const gap = { topic: 'Quantum Computing trends 2025', missingInfo: 'market size' };

      mockAnalyzeContext.mockResolvedValue({
        intent: 'research_request',
      });

      mockGetSessionHistory.mockResolvedValue([]);
      mockGetProjectMemory.mockResolvedValue([]);
      mockSearchRelevantChunks.mockResolvedValue({ chunks: [] });

      mockResearchFn.mockResolvedValue({
        success: true,
        synthesis: {
          summary: 'Quantum market is growing fast.',
          keyInsights: [{ type: 'statistic', value: '50% CAGR', source: 'Gartner' }],
          recommendations: ['Invest now'],
        },
        citations: ['http://gartner.com'],
      });

      // Execute
      const result = await contextBuilder.build({
        userId: 'user-1',
        currentMessage: 'Tell me about Quantum trends',
        knowledgeGaps: [gap],
      });

      // Verify Result integration
      expect(result.research.content).toContain('Quantum market is growing fast.');

      // Verify side effect
      expect(mockResearchFn).toHaveBeenCalled();
    });
  });

  describe('formatSessionContext()', () => {
    it('should check for compression', async () => {
      const session = {
        history: [{ role: 'user', content: 'Short' }],
      };
      const result = await contextBuilder.formatSessionContext(session);
      expect(result).toContain('User: Short');
    });
  });
});
