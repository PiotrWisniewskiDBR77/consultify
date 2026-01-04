export class StrategyAgent extends BaseAgent {
    getKeywords(): string[];
    process(query: any, context: any): Promise<{
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        recommendations: string[];
        risks: string[];
        confidence: number;
        frameworks: never[];
        error: boolean;
    } | {
        metadata: {
            model: any;
            timestamp: string;
        };
        mainInsight: any;
        fullAnalysis: any;
        recommendations: any;
        risks: any;
        confidence: number;
        frameworks: string[];
        agentId: string;
        agentName: any;
        domain: any;
    }>;
    buildStrategyPrompt(query: any, context: any): string;
    parseResponse(response: any): {
        mainInsight: any;
        fullAnalysis: any;
        recommendations: any;
        risks: any;
        confidence: number;
        frameworks: string[];
    };
    detectFrameworks(text: any): string[];
    getFallbackResponse(query: any, context: any): {
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        recommendations: string[];
        risks: string[];
        confidence: number;
        frameworks: never[];
        error: boolean;
    };
    /**
     * Generate strategic initiative recommendations
     */
    recommendInitiatives(context: any): Promise<{
        agentId: string;
        recommendations: any;
        timestamp: string;
        error?: undefined;
        message?: undefined;
    } | {
        error: boolean;
        message: any;
        agentId?: undefined;
        recommendations?: undefined;
        timestamp?: undefined;
    }>;
}
export default StrategyAgent;
import { BaseAgent } from './baseAgent.js';
//# sourceMappingURL=strategyAgent.d.ts.map