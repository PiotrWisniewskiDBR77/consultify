/**
 * World-Class AI Services Index
 * 
 * Central export for all AI-native consulting ecosystem services.
 * These services implement the Consultify transformation roadmap:
 * 
 * Q1: AI Intelligence Foundation
 * - Multi-Agent Architecture (Strategy, Finance, Change, Risk, PMO)
 * - Knowledge Graph & RAG 2.0
 * - Predictive Analytics Engine
 * 
 * Q2: Proactive Intelligence
 * - AI Watchdog (Autonomous Monitoring)
 * - Pattern Recognition & Cross-project Learning
 * - Competitive Intelligence Module
 * 
 * Q3: Collaborative Intelligence
 * - Multi-Stakeholder Perspectives (CEO, CFO, CTO, CHRO)
 * - Real-time Collaboration AI
 * - Integration Hub
 * 
 * Q4: Market Leadership
 * - Industry-Specific AI Models
 * - Global Benchmarking & DTI
 * - Platform Ecosystem
 */

// Q1: AI Intelligence Foundation
const { getCoordinator, getAllAgentMetadata, createAgent } = require('../ai/agents');
const KnowledgeGraphService = require('../knowledgeGraphService');
const RagEnhancedService = require('../ragEnhancedService');
const PredictiveService = require('../predictiveService');

// Q2: Proactive Intelligence
const AIWatchdog = require('../../jobs/aiWatchdog');
const PatternRecognitionService = require('../patternRecognitionService');
const CompetitiveIntelligenceService = require('../competitiveIntelligenceService');

// Q3: Collaborative Intelligence
const StakeholderPerspectiveService = require('../stakeholderPerspectiveService');
const CollaborationAIService = require('../collaborationAIService');
const IntegrationHubService = require('../integrationHubService');

// Q4: Market Leadership
const IndustryAIModelsService = require('../industryAIModelsService');
const BenchmarkingService = require('../benchmarkingService');
const PlatformEcosystemService = require('../platformEcosystemService');

/**
 * Initialize all world-class AI services
 */
const initializeAllServices = async () => {
    const results = {
        initialized: [],
        errors: []
    };

    const services = [
        { name: 'KnowledgeGraph', init: () => KnowledgeGraphService.initialize() },
        { name: 'Predictive', init: () => PredictiveService.initialize() },
        { name: 'AIWatchdog', init: () => AIWatchdog.initialize() },
        { name: 'PatternRecognition', init: () => PatternRecognitionService.initialize() },
        { name: 'CompetitiveIntelligence', init: () => CompetitiveIntelligenceService.initialize() },
        { name: 'CollaborationAI', init: () => CollaborationAIService.initialize() },
        { name: 'IntegrationHub', init: () => IntegrationHubService.initialize() },
        { name: 'Benchmarking', init: () => BenchmarkingService.initialize() },
        { name: 'PlatformEcosystem', init: () => PlatformEcosystemService.initialize() }
    ];

    for (const service of services) {
        try {
            await service.init();
            results.initialized.push(service.name);
            console.log(`[WorldClassAI] ✓ ${service.name} initialized`);
        } catch (error) {
            results.errors.push({ service: service.name, error: error.message });
            console.error(`[WorldClassAI] ✗ ${service.name} failed:`, error.message);
        }
    }

    console.log(`[WorldClassAI] Initialization complete: ${results.initialized.length} services ready`);
    return results;
};

/**
 * Get system health for all AI services
 */
const getSystemHealth = async () => {
    return {
        agents: {
            available: getAllAgentMetadata(),
            coordinatorMetrics: getCoordinator().getMetrics()
        },
        watchdog: AIWatchdog.getStatus(),
        knowledgeGraph: KnowledgeGraphService.getStats(),
        patternRecognition: await PatternRecognitionService.getPatternStats(),
        community: await PlatformEcosystemService.getCommunityStats(),
        timestamp: new Date().toISOString()
    };
};

/**
 * Quick access to common operations
 */
const QuickAccess = {
    // Multi-agent query
    askAgents: async (query, context) => {
        const coordinator = getCoordinator();
        return coordinator.processQuery(query, context);
    },

    // Predictive analysis
    analyzeProjectRisks: async (projectId) => {
        return PredictiveService.analyzeProject(projectId);
    },

    // Stakeholder perspectives
    getExecutivePerspectives: async (topic, context) => {
        return StakeholderPerspectiveService.generateAllPerspectives(topic, context);
    },

    // Industry analysis
    getIndustryInsights: async (industryId, query, context) => {
        return IndustryAIModelsService.analyzeWithIndustryContext(industryId, query, context);
    },

    // Benchmarking
    calculateDTI: async (organizationId) => {
        return BenchmarkingService.calculateDTI(organizationId);
    },

    // Hybrid search
    searchKnowledge: async (query, options) => {
        return RagEnhancedService.hybridSearch(query, options);
    }
};

module.exports = {
    // Q1: AI Intelligence Foundation
    getCoordinator,
    createAgent,
    getAllAgentMetadata,
    KnowledgeGraphService,
    RagEnhancedService,
    PredictiveService,

    // Q2: Proactive Intelligence
    AIWatchdog,
    PatternRecognitionService,
    CompetitiveIntelligenceService,

    // Q3: Collaborative Intelligence
    StakeholderPerspectiveService,
    CollaborationAIService,
    IntegrationHubService,

    // Q4: Market Leadership
    IndustryAIModelsService,
    BenchmarkingService,
    PlatformEcosystemService,

    // Utilities
    initializeAllServices,
    getSystemHealth,
    QuickAccess
};







