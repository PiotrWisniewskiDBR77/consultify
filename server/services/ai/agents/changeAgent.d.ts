export class ChangeAgent extends BaseAgent {
    getKeywords(): string[];
    process(query: any, context: any): Promise<{
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        adkarAnalysis: null;
        stakeholderStrategy: string;
        stakeholderRisks: string[];
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
        adkarAnalysis: {
            awareness: {
                score: null;
                notes: string;
            };
            desire: {
                score: null;
                notes: string;
            };
            knowledge: {
                score: null;
                notes: string;
            };
            ability: {
                score: null;
                notes: string;
            };
            reinforcement: {
                score: null;
                notes: string;
            };
        };
        stakeholderStrategy: any;
        stakeholderRisks: any;
        recommendations: any;
        confidence: number;
        agentId: string;
        agentName: any;
        domain: any;
    }>;
    buildChangePrompt(query: any, context: any): string;
    parseResponse(response: any): {
        mainInsight: any;
        fullAnalysis: any;
        adkarAnalysis: {
            awareness: {
                score: null;
                notes: string;
            };
            desire: {
                score: null;
                notes: string;
            };
            knowledge: {
                score: null;
                notes: string;
            };
            ability: {
                score: null;
                notes: string;
            };
            reinforcement: {
                score: null;
                notes: string;
            };
        };
        stakeholderStrategy: any;
        stakeholderRisks: any;
        recommendations: any;
        confidence: number;
    };
    extractADKAR(text: any): {
        awareness: {
            score: null;
            notes: string;
        };
        desire: {
            score: null;
            notes: string;
        };
        knowledge: {
            score: null;
            notes: string;
        };
        ability: {
            score: null;
            notes: string;
        };
        reinforcement: {
            score: null;
            notes: string;
        };
    };
    assessADKAR(readiness: any): {
        scores: {};
        gaps: {
            component: string;
            severity: string;
            score: any;
        }[];
        overallReadiness: number;
        primaryBarrier: string | null;
    };
    getFallbackResponse(query: any, context: any): {
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        adkarAnalysis: null;
        stakeholderStrategy: string;
        stakeholderRisks: string[];
        recommendations: string[];
        confidence: number;
        error: boolean;
    };
    /**
     * Generate stakeholder engagement plan
     */
    generateEngagementPlan(initiative: any, stakeholders: any, context: any): Promise<{
        agentId: string;
        initiative: any;
        engagementPlan: any;
        timestamp: string;
        error?: undefined;
        message?: undefined;
    } | {
        error: boolean;
        message: any;
        agentId?: undefined;
        initiative?: undefined;
        engagementPlan?: undefined;
        timestamp?: undefined;
    }>;
}
export default ChangeAgent;
import { BaseAgent } from './baseAgent.js';
//# sourceMappingURL=changeAgent.d.ts.map