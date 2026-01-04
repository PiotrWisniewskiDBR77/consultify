export class RiskAgent extends BaseAgent {
    riskCategories: string[];
    getKeywords(): string[];
    process(query: any, context: any): Promise<{
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        risks: never[];
        earlyWarnings: string[];
        contingencies: never[];
        recommendations: string[];
        confidence: number;
        error: boolean;
    } | {
        metadata: {
            model: any;
            timestamp: string;
        };
        mainInsight: any;
        fullAnalysis: any;
        risks: any[];
        earlyWarnings: any;
        contingencies: any;
        recommendations: any;
        confidence: number;
        agentId: string;
        agentName: any;
        domain: any;
    }>;
    buildRiskPrompt(query: any, context: any): string;
    parseResponse(response: any): {
        mainInsight: any;
        fullAnalysis: any;
        risks: any[];
        earlyWarnings: any;
        contingencies: any;
        recommendations: any;
        confidence: number;
    };
    extractRisksFromTable(text: any): any[];
    buildRiskMatrix(risks: any): {
        critical: never[];
        high: never[];
        medium: never[];
        low: never[];
    };
    calculateOverallRisk(risks: any): {
        score: number;
        level: string;
    };
    getFallbackResponse(query: any, context: any): {
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        risks: never[];
        earlyWarnings: string[];
        contingencies: never[];
        recommendations: string[];
        confidence: number;
        error: boolean;
    };
    /**
     * Perform comprehensive risk assessment for an initiative
     */
    assessInitiativeRisks(initiative: any, context: any): Promise<{
        agentId: string;
        initiative: any;
        riskAssessment: any;
        timestamp: string;
        error?: undefined;
        message?: undefined;
    } | {
        error: boolean;
        message: any;
        agentId?: undefined;
        initiative?: undefined;
        riskAssessment?: undefined;
        timestamp?: undefined;
    }>;
}
export default RiskAgent;
import { BaseAgent } from './baseAgent.js';
//# sourceMappingURL=riskAgent.d.ts.map