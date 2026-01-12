export class PMOAgent extends BaseAgent {
    getKeywords(): string[];
    process(query: any, context: any): Promise<{
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        healthDashboard: null;
        criticalPath: never[];
        blockers: string[];
        priorityActions: string[];
        portfolioStatus: string;
        confidence: number;
        error: boolean;
    } | {
        metadata: {
            model: any;
            timestamp: string;
        };
        mainInsight: any;
        fullAnalysis: any;
        healthDashboard: {
            schedule: {
                status: string;
                issue: string;
            };
            resources: {
                status: string;
                issue: string;
            };
            scope: {
                status: string;
                issue: string;
            };
            dependencies: {
                status: string;
                issue: string;
            };
            budget: {
                status: string;
                issue: string;
            };
        };
        criticalPath: any;
        blockers: any;
        priorityActions: any;
        portfolioStatus: string;
        confidence: number;
        agentId: string;
        agentName: any;
        domain: any;
    }>;
    buildPMOPrompt(query: any, context: any): string;
    parseResponse(response: any): {
        mainInsight: any;
        fullAnalysis: any;
        healthDashboard: {
            schedule: {
                status: string;
                issue: string;
            };
            resources: {
                status: string;
                issue: string;
            };
            scope: {
                status: string;
                issue: string;
            };
            dependencies: {
                status: string;
                issue: string;
            };
            budget: {
                status: string;
                issue: string;
            };
        };
        criticalPath: any;
        blockers: any;
        priorityActions: any;
        portfolioStatus: string;
        confidence: number;
    };
    extractHealthDashboard(text: any): {
        schedule: {
            status: string;
            issue: string;
        };
        resources: {
            status: string;
            issue: string;
        };
        scope: {
            status: string;
            issue: string;
        };
        dependencies: {
            status: string;
            issue: string;
        };
        budget: {
            status: string;
            issue: string;
        };
    };
    derivePortfolioStatus(dashboard: any): "healthy" | "attention" | "at_risk" | "mixed";
    calculateHealthScore(context: any): {
        score: number;
        level: string;
        deductions: string[];
    };
    getFallbackResponse(query: any, context: any): {
        agentId: string;
        agentName: any;
        domain: any;
        mainInsight: string;
        fullAnalysis: string;
        healthDashboard: null;
        criticalPath: never[];
        blockers: string[];
        priorityActions: string[];
        portfolioStatus: string;
        confidence: number;
        error: boolean;
    };
    /**
     * Generate project status report
     */
    generateStatusReport(project: any, context: any): Promise<{
        agentId: string;
        project: any;
        statusReport: any;
        timestamp: string;
        error?: undefined;
        message?: undefined;
    } | {
        error: boolean;
        message: any;
        agentId?: undefined;
        project?: undefined;
        statusReport?: undefined;
        timestamp?: undefined;
    }>;
    /**
     * Analyze resource allocation across portfolio
     */
    analyzeResourceAllocation(resources: any, initiatives: any, context: any): Promise<{
        agentId: string;
        resourceAnalysis: any;
        timestamp: string;
        error?: undefined;
        message?: undefined;
    } | {
        error: boolean;
        message: any;
        agentId?: undefined;
        resourceAnalysis?: undefined;
        timestamp?: undefined;
    }>;
}
export default PMOAgent;
import { BaseAgent } from './baseAgent.js';
//# sourceMappingURL=pmoAgent.d.ts.map