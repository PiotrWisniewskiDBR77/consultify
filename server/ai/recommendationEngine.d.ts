export default RecommendationEngine;
declare namespace RecommendationEngine {
    namespace deps {
        export { aiPipeline };
        export { db };
    }
    /**
     * Override dependencies for testing
     */
    function setDependencies(deps: any): void;
    /**
     * Clear cache and stores for testing
     */
    function clearCache(): void;
    function generateRecommendations(signalsOrContext: any[] | Object): Promise<any>;
    function _mapSignalToRecommendations(signal: any): {
        signal_type: any;
        entity_id: any;
        title: string;
        action: string;
        reasoning: string;
        category: string;
        priority: number;
        impact: string;
        confidence: number;
        effort: string;
    }[] | null;
    function prioritizeRecommendations(recommendations: any): any[];
    function filterRecommendations(recommendations: any, criteria: any): any[];
    function validateRecommendation(rec: any): void;
    function storeRecommendations(recommendations: any, userId: any): Promise<boolean>;
    function getRecommendationHistory(id: any, filter: any): Promise<any>;
    function trackRecommendationUsage(interaction: any): Promise<boolean>;
    function calculateRecommendationROI(implemented: any): number;
}
declare const aiPipeline: any;
declare const db: import("../src/database/IDatabase.js").IDatabase;
//# sourceMappingURL=recommendationEngine.d.ts.map