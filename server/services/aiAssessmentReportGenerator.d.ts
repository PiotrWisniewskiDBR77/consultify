declare namespace _default {
    export { AIAssessmentReportGenerator };
    export { aiAssessmentReportGenerator };
    export { REPORT_TYPES };
    export { STAKEHOLDER_ROLES };
}
export default _default;
export class AIAssessmentReportGenerator {
    aiPartner: import("./aiAssessmentPartnerService.js").AIAssessmentPartnerService;
    /**
     * Generate a complete assessment report
     * Combines multiple sections into one comprehensive document
     */
    generateFullReport(assessment: any, options?: {}): Promise<{
        reportType: string;
        generatedAt: string;
        organizationName: any;
        industry: any;
        language: any;
        sections: ({
            id: string;
            title: string;
            content: any;
            metrics: {
                averageMaturity: any;
                averageTarget: any;
                overallGap: string;
            } | {
                averageMaturity: string;
                averageTarget: string;
                overallGap: string;
                axesAssessed: number;
            } | undefined;
            data?: undefined;
        } | {
            id: string;
            title: string;
            content: {
                axisId: string;
                axisName: any;
                currentScore: any;
                targetScore: any;
                currentDescription: any;
                targetDescription: any;
                justification: any;
                gap: number;
                pathway: {
                    level: any;
                    description: any;
                    estimatedMonths: number;
                    keyActivities: any;
                }[] | null;
                recommendations: any;
            }[];
            metrics?: undefined;
            data?: undefined;
        } | {
            id: string;
            title: string;
            content: {
                prioritizedGaps: {
                    axis: string;
                    axisName: any;
                    gap: number;
                    current: any;
                    target: any;
                }[];
                totalAxesWithGaps: number;
                averageGap: string;
                largestGap: {
                    axis: string;
                    axisName: any;
                    gap: number;
                    current: any;
                    target: any;
                };
                smallestGap: {
                    axis: string;
                    axisName: any;
                    gap: number;
                    current: any;
                    target: any;
                };
                quickWins: {
                    axis: string;
                    axisName: any;
                    gap: number;
                    current: any;
                    target: any;
                }[];
                majorTransformations: {
                    axis: string;
                    axisName: any;
                    gap: number;
                    current: any;
                    target: any;
                }[];
            };
            metrics?: undefined;
            data?: undefined;
        } | {
            id: string;
            title: string;
            content: {
                total: number;
                byPriority: {
                    high: any[];
                    medium: any[];
                    low: any[];
                };
                all: any[];
            };
            metrics?: undefined;
            data?: undefined;
        } | {
            id: string;
            title: string;
            content: any;
            data: {
                axis: string;
                name: any;
                actual: any;
                benchmark: any;
                vsIndustry: number | null;
            }[] | undefined;
            metrics?: undefined;
        } | {
            id: string;
            title: string;
            content: {
                totalDuration: number;
                phases: {
                    axis: any;
                    axisId: string;
                    startMonth: number;
                    endMonth: number;
                    duration: number | undefined;
                    pathway: {
                        level: any;
                        description: any;
                        estimatedMonths: number;
                        keyActivities: any;
                    }[] | undefined;
                    milestones: {
                        level: any;
                        month: number;
                        description: any;
                    }[];
                }[];
                summary: {
                    totalAxes: number;
                    parallelExecution: boolean;
                    startDate: string;
                    projectedEndDate: string;
                };
            };
            metrics?: undefined;
            data?: undefined;
        })[];
        metadata: {
            axesAssessed: number;
            averageMaturity: any;
            averageTarget: any;
        };
    }>;
    /**
     * Generate stakeholder-specific report
     */
    generateStakeholderReport(assessment: any, stakeholderRole: any, options?: {}): Promise<{
        error: string;
        reportType?: undefined;
        stakeholderRole?: undefined;
        generatedAt?: undefined;
        organizationName?: undefined;
        mainView?: undefined;
        focusAreas?: undefined;
        keyInsights?: undefined;
        recommendations?: undefined;
        language?: undefined;
    } | {
        reportType: string;
        stakeholderRole: any;
        generatedAt: string;
        organizationName: any;
        mainView: any;
        focusAreas: any;
        keyInsights: any;
        recommendations: {
            focusAreas: any;
            keyActions: string[];
        };
        language: any;
        error?: undefined;
    }>;
    /**
     * Generate benchmark comparison report
     */
    generateBenchmarkReport(assessment: any, benchmarks: any, options?: {}): Promise<{
        reportType: string;
        generatedAt: string;
        industry: any;
        commentary: any;
        summary: {
            axesAboveIndustry: number;
            axesBelowIndustry: number;
            axesAtIndustry: number;
        } | undefined;
        detailedComparison: {
            axisId: string;
            axisName: any;
            score: any;
            industryAverage: any;
            difference: string;
            position: string;
            percentile: number | null;
        }[];
        competitiveInsights: {
            type: string;
            title: string;
            description: string;
            axes: string[];
        }[];
        language: any;
    }>;
    /**
     * Generate transformation initiative plan
     */
    generateInitiativePlan(assessment: any, constraints?: {}, options?: {}): Promise<{
        reportType: string;
        generatedAt: string;
        gapAnalysis: {
            axis: string;
            axisName: any;
            currentScore: any;
            targetScore: any;
            gap: number;
        }[];
        initiatives: any;
        prioritizedList: any;
        roiEstimates: any[];
        timeline: {
            initiative: any;
            rank: any;
            startQuarter: string;
            endQuarter: string;
            durationMonths: number;
            priority: any;
        }[];
        constraints: {};
        language: any;
    }>;
    _generateAxisAnalysis(assessment: any, options?: {}): Promise<{
        axisId: string;
        axisName: any;
        currentScore: any;
        targetScore: any;
        currentDescription: any;
        targetDescription: any;
        justification: any;
        gap: number;
        pathway: {
            level: any;
            description: any;
            estimatedMonths: number;
            keyActivities: any;
        }[] | null;
        recommendations: any;
    }[]>;
    _generateGapSummary(assessment: any, options?: {}): Promise<{
        prioritizedGaps: {
            axis: string;
            axisName: any;
            gap: number;
            current: any;
            target: any;
        }[];
        totalAxesWithGaps: number;
        averageGap: string;
        largestGap: {
            axis: string;
            axisName: any;
            gap: number;
            current: any;
            target: any;
        };
        smallestGap: {
            axis: string;
            axisName: any;
            gap: number;
            current: any;
            target: any;
        };
        quickWins: {
            axis: string;
            axisName: any;
            gap: number;
            current: any;
            target: any;
        }[];
        majorTransformations: {
            axis: string;
            axisName: any;
            gap: number;
            current: any;
            target: any;
        }[];
    }>;
    _generateRecommendations(assessment: any, options?: {}): Promise<{
        total: number;
        byPriority: {
            high: any[];
            medium: any[];
            low: any[];
        };
        all: any[];
    }>;
    _generateTransformationRoadmap(assessment: any, options?: {}): Promise<{
        totalDuration: number;
        phases: {
            axis: any;
            axisId: string;
            startMonth: number;
            endMonth: number;
            duration: number | undefined;
            pathway: {
                level: any;
                description: any;
                estimatedMonths: number;
                keyActivities: any;
            }[] | undefined;
            milestones: {
                level: any;
                month: number;
                description: any;
            }[];
        }[];
        summary: {
            totalAxes: number;
            parallelExecution: boolean;
            startDate: string;
            projectedEndDate: string;
        };
    }>;
    _filterInsightsForStakeholder(insights: any, stakeholderRole: any): any;
    _getStakeholderRecommendations(assessment: any, stakeholderRole: any, options?: {}): Promise<{
        focusAreas: any;
        keyActions: string[];
    }>;
    _calculateDetailedBenchmarks(assessment: any, benchmarks: any): {
        axisId: string;
        axisName: any;
        score: any;
        industryAverage: any;
        difference: string;
        position: string;
        percentile: number | null;
    }[];
    _calculatePercentile(score: any, benchmark: any): 10 | 50 | 25 | 75 | 90 | 95;
    _generateCompetitiveInsights(assessment: any, benchmarks: any, options?: {}): Promise<{
        type: string;
        title: string;
        description: string;
        axes: string[];
    }[]>;
    _generateImplementationTimeline(prioritizedList: any, initiatives: any): {
        initiative: any;
        rank: any;
        startQuarter: string;
        endQuarter: string;
        durationMonths: number;
        priority: any;
    }[];
}
export const aiAssessmentReportGenerator: AIAssessmentReportGenerator;
export namespace REPORT_TYPES {
    let EXECUTIVE_SUMMARY: string;
    let FULL_ASSESSMENT: string;
    let STAKEHOLDER_VIEW: string;
    let BENCHMARK_COMPARISON: string;
    let GAP_ANALYSIS: string;
    let TRANSFORMATION_ROADMAP: string;
    let INITIATIVE_PLAN: string;
}
export namespace STAKEHOLDER_ROLES {
    let CTO: string;
    let CFO: string;
    let COO: string;
    let CEO: string;
    let BOARD: string;
    let PROJECT_MANAGER: string;
    let CONSULTANT: string;
}
//# sourceMappingURL=aiAssessmentReportGenerator.d.ts.map