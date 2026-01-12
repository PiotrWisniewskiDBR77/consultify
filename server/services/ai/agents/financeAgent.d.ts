export class FinanceAgent extends BaseAgent {
    getKeywords(): string[];
    process(query: any, context: any): Promise<{
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        recommendations: string[];
        financialMetrics: {};
        financialImpact: string;
        confidence: number;
        error: boolean;
    } | {
        metadata: {
            model: any;
            timestamp: string;
        };
        mainInsight: any;
        fullAnalysis: any;
        recommendations: any;
        financialMetrics: {
            roi: number;
            npv: number;
            paybackMonths: number;
            riskLevel: any;
        };
        financialImpact: string;
        confidence: number;
        agentId: string;
        agentName: any;
        domain: any;
    }>;
    buildFinancePrompt(query: any, context: any): string;
    parseResponse(response: any): {
        mainInsight: any;
        fullAnalysis: any;
        recommendations: any;
        financialMetrics: {
            roi: number;
            npv: number;
            paybackMonths: number;
            riskLevel: any;
        };
        financialImpact: string;
        confidence: number;
    };
    extractMetrics(text: any): {
        roi: number;
        npv: number;
        paybackMonths: number;
        riskLevel: any;
    };
    categorizeImpact(metrics: any): "unknown" | "low" | "high" | "medium" | "transformational" | "negative";
    performCalculations(economics: any): {
        roi: number;
        paybackYears: number;
        paybackMonths: number;
        npv: number;
    };
    formatCurrency(value: any): string;
    getFallbackResponse(query: any, context: any): {
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        recommendations: string[];
        financialMetrics: {};
        financialImpact: string;
        confidence: number;
        error: boolean;
    };
    /**
     * Generate detailed ROI analysis for an initiative
     */
    analyzeROI(initiative: any, context: any): Promise<{
        agentId: string;
        initiative: any;
        analysis: any;
        timestamp: string;
        error?: undefined;
        message?: undefined;
    } | {
        error: boolean;
        message: any;
        agentId?: undefined;
        initiative?: undefined;
        analysis?: undefined;
        timestamp?: undefined;
    }>;
}
export default FinanceAgent;
import { BaseAgent } from './baseAgent.js';
//# sourceMappingURL=financeAgent.d.ts.map