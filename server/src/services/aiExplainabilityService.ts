/**
 * AiExplainability Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Stub implementation for missing JS service module.
 */

const AiExplainabilityService = {
    buildAIExplanation: async (projectId: string, response: any, context: any) => {
        return {
            reasoning: "Mocked reasoning for AI decision",
            dataSources: ["project_context", "pmo_standards"],
            confidence: 0.95,
            limitations: ["Based on available project data only"]
        };
    },
    
    getExplanationHistory: async (projectId: string) => {
        return [];
    }
};

export default AiExplainabilityService;
