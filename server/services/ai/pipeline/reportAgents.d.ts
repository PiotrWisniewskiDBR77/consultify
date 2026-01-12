declare namespace _default {
    export { REPORT_AGENTS };
    export { getAgent };
    export { getAgentsInOrder };
    export { getAgentPrompt };
    export { validateAgentOutput };
    export { getAgentMetadata };
    export { getAllAgentsMetadata };
}
export default _default;
/**
 * Report Agents
 *
 * Multi-agent definitions for enterprise report generation pipeline.
 * Each agent specializes in a specific aspect of strategic consulting.
 *
 * Part of the Enterprise AI Consulting System.
 */
/**
 * Agent Definitions
 * Each agent has:
 * - name: Identifier
 * - role: Professional title
 * - expertise: Areas of specialization
 * - systemPrompt: Instructions for the agent
 * - outputSchema: Expected output structure
 */
export const REPORT_AGENTS: ({
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        keyFindings: {
            finding: string;
            evidence: string;
            significance: string;
            confidence: string;
        }[];
        gapAnalysis: {
            criticalGaps: string[];
            gapDrivers: string[];
            correlations: string[];
        };
        benchmarkComparison: {
            overallPosition: string;
            percentile: string;
            strengthAreas: string[];
            weaknessAreas: string[];
        };
        dataQualityNotes: string[];
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        strategicAssessment: {
            currentPositioning: string;
            targetState: string;
            transformationGap: string;
        };
        recommendations: {
            title: string;
            description: string;
            rationale: string;
            impact: string;
            effort: string;
            investmentThesis: string;
            estimatedBudget: string;
            expectedROI: string;
            timeframe: string;
            keyRisks: string[];
        }[];
        roadmap: {
            phase1: {
                name: string;
                duration: string;
                initiatives: string[];
            };
            phase2: {
                name: string;
                duration: string;
                initiatives: string[];
            };
            phase3: {
                name: string;
                duration: string;
                initiatives: string[];
            };
        };
        successMetrics: {
            metric: string;
            baseline: string;
            target: string;
            timeframe: string;
        }[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        validationScore: string;
        validationLevel: string;
        logicValidation: {
            score: string;
            issues: string[];
            strengths: string[];
        };
        feasibilityAssessment: {
            budgetRealism: string;
            timelineRealism: string;
            capabilityFit: string;
            concerns: string[];
        };
        riskAssessment: {
            overallRiskLevel: string;
            keyRisks: {
                risk: string;
                likelihood: string;
                impact: string;
                mitigation: string;
            }[];
        };
        recommendations: string[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        executiveSummary: {
            headline: string;
            keyMessage: string;
            topFindings: string[];
            topRecommendations: string[];
            callToAction: string;
        };
        reportSections: {
            sectionId: string;
            title: string;
            narrative: string;
            keyTakeaways: string[];
            visualizationType: string;
            visualizationSpec: string;
        }[];
        appendices: {
            title: string;
            content: string;
        }[];
        keyMessageCallouts: string[];
        readingTime: string;
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
    };
})[];
/**
 * Get agent by name
 */
export function getAgent(agentName: any): {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        keyFindings: {
            finding: string;
            evidence: string;
            significance: string;
            confidence: string;
        }[];
        gapAnalysis: {
            criticalGaps: string[];
            gapDrivers: string[];
            correlations: string[];
        };
        benchmarkComparison: {
            overallPosition: string;
            percentile: string;
            strengthAreas: string[];
            weaknessAreas: string[];
        };
        dataQualityNotes: string[];
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        strategicAssessment: {
            currentPositioning: string;
            targetState: string;
            transformationGap: string;
        };
        recommendations: {
            title: string;
            description: string;
            rationale: string;
            impact: string;
            effort: string;
            investmentThesis: string;
            estimatedBudget: string;
            expectedROI: string;
            timeframe: string;
            keyRisks: string[];
        }[];
        roadmap: {
            phase1: {
                name: string;
                duration: string;
                initiatives: string[];
            };
            phase2: {
                name: string;
                duration: string;
                initiatives: string[];
            };
            phase3: {
                name: string;
                duration: string;
                initiatives: string[];
            };
        };
        successMetrics: {
            metric: string;
            baseline: string;
            target: string;
            timeframe: string;
        }[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        validationScore: string;
        validationLevel: string;
        logicValidation: {
            score: string;
            issues: string[];
            strengths: string[];
        };
        feasibilityAssessment: {
            budgetRealism: string;
            timelineRealism: string;
            capabilityFit: string;
            concerns: string[];
        };
        riskAssessment: {
            overallRiskLevel: string;
            keyRisks: {
                risk: string;
                likelihood: string;
                impact: string;
                mitigation: string;
            }[];
        };
        recommendations: string[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        executiveSummary: {
            headline: string;
            keyMessage: string;
            topFindings: string[];
            topRecommendations: string[];
            callToAction: string;
        };
        reportSections: {
            sectionId: string;
            title: string;
            narrative: string;
            keyTakeaways: string[];
            visualizationType: string;
            visualizationSpec: string;
        }[];
        appendices: {
            title: string;
            content: string;
        }[];
        keyMessageCallouts: string[];
        readingTime: string;
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
    };
} | null;
/**
 * Get all agents in execution order
 */
export function getAgentsInOrder(): ({
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        keyFindings: {
            finding: string;
            evidence: string;
            significance: string;
            confidence: string;
        }[];
        gapAnalysis: {
            criticalGaps: string[];
            gapDrivers: string[];
            correlations: string[];
        };
        benchmarkComparison: {
            overallPosition: string;
            percentile: string;
            strengthAreas: string[];
            weaknessAreas: string[];
        };
        dataQualityNotes: string[];
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        strategicAssessment: {
            currentPositioning: string;
            targetState: string;
            transformationGap: string;
        };
        recommendations: {
            title: string;
            description: string;
            rationale: string;
            impact: string;
            effort: string;
            investmentThesis: string;
            estimatedBudget: string;
            expectedROI: string;
            timeframe: string;
            keyRisks: string[];
        }[];
        roadmap: {
            phase1: {
                name: string;
                duration: string;
                initiatives: string[];
            };
            phase2: {
                name: string;
                duration: string;
                initiatives: string[];
            };
            phase3: {
                name: string;
                duration: string;
                initiatives: string[];
            };
        };
        successMetrics: {
            metric: string;
            baseline: string;
            target: string;
            timeframe: string;
        }[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        validationScore: string;
        validationLevel: string;
        logicValidation: {
            score: string;
            issues: string[];
            strengths: string[];
        };
        feasibilityAssessment: {
            budgetRealism: string;
            timelineRealism: string;
            capabilityFit: string;
            concerns: string[];
        };
        riskAssessment: {
            overallRiskLevel: string;
            keyRisks: {
                risk: string;
                likelihood: string;
                impact: string;
                mitigation: string;
            }[];
        };
        recommendations: string[];
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        executiveSummary?: undefined;
        reportSections?: undefined;
        appendices?: undefined;
        keyMessageCallouts?: undefined;
        readingTime?: undefined;
    };
} | {
    name: string;
    role: string;
    expertise: string[];
    order: number;
    systemPrompt: string;
    outputSchema: {
        executiveSummary: {
            headline: string;
            keyMessage: string;
            topFindings: string[];
            topRecommendations: string[];
            callToAction: string;
        };
        reportSections: {
            sectionId: string;
            title: string;
            narrative: string;
            keyTakeaways: string[];
            visualizationType: string;
            visualizationSpec: string;
        }[];
        appendices: {
            title: string;
            content: string;
        }[];
        keyMessageCallouts: string[];
        readingTime: string;
        keyFindings?: undefined;
        gapAnalysis?: undefined;
        benchmarkComparison?: undefined;
        dataQualityNotes?: undefined;
        strategicAssessment?: undefined;
        recommendations?: undefined;
        roadmap?: undefined;
        successMetrics?: undefined;
        validationScore?: undefined;
        validationLevel?: undefined;
        logicValidation?: undefined;
        feasibilityAssessment?: undefined;
        riskAssessment?: undefined;
    };
})[];
/**
 * Get agent system prompt with context injection
 */
export function getAgentPrompt(agentName: any, context?: {}): string | null;
/**
 * Validate agent output against schema
 */
export function validateAgentOutput(agentName: any, output: any): {
    valid: boolean;
    issues: any[];
};
/**
 * Get agent metadata (without prompts)
 */
export function getAgentMetadata(agentName: any): {
    name: string;
    role: string;
    expertise: string[];
    order: number;
} | null;
/**
 * Get all agents metadata
 */
export function getAllAgentsMetadata(): {
    name: string;
    role: string;
    expertise: string[];
    order: number;
}[];
//# sourceMappingURL=reportAgents.d.ts.map