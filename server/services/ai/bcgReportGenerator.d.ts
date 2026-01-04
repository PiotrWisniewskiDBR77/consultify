declare const _default: BCGReportGenerator;
export default _default;
declare class BCGReportGenerator {
    reportId: string | null;
    assessmentData: any;
    orgContext: Object | null;
    /**
     * Generate complete BCG-style report
     * @param {Object} params - Generation parameters
     * @returns {Promise<Object>} Generated report with all sections
     */
    generateReport({ assessmentId, projectId, organizationId, userId, options }: Object): Promise<Object>;
    /**
     * Load assessment data from database
     */
    _loadAssessmentData(assessmentId: any, projectId: any): Promise<any>;
    /**
     * Calculate comprehensive maturity metrics
     */
    _calculateMaturityMetrics(): {
        axes: {};
        overallActual: number;
        overallTarget: number;
        overallGap: number;
        gaps: never[];
        strengths: never[];
        quickWins: never[];
        strategicPriorities: never[];
    };
    /**
     * Get maturity label based on level
     */
    _getMaturityLabel(level: any): any;
    /**
     * Get axis status (red/yellow/green)
     */
    _getAxisStatus(actual: any, target: any, maxLevel: any): "green" | "yellow" | "red";
    /**
     * Calculate gap priority score
     */
    _calculateGapPriority(axisKey: any, gap: any, actual: any, target: any, maxLevel: any): number;
    /**
     * Generate Executive Summary using AI
     */
    _generateExecutiveSummary(metrics: any): Promise<any>;
    /**
     * Generate fallback executive summary (deterministic)
     */
    _generateFallbackExecutiveSummary(metrics: any): {
        type: string;
        generated: boolean;
        verdict: string;
        keyFindings: string[];
        strategicImplications: string;
        immediateActions: string[];
    };
    /**
     * Build AI context string from organization data
     */
    _buildAIContext(metrics: any): string;
    /**
     * Generate Maturity Overview section
     */
    _generateMaturityOverview(metrics: any): {
        type: string;
        overall: {
            actual: any;
            target: any;
            gap: any;
            maturityLabel: any;
        };
        axes: {
            id: string;
            name: any;
            bcgLabel: any;
            icon: any;
            color: any;
            actual: any;
            target: any;
            gap: any;
            maxLevel: any;
            actualPercent: any;
            targetPercent: any;
            maturityLabel: any;
            status: any;
        }[];
        summary: {
            axesAssessed: number;
            axesOnTrack: number;
            axesAtRisk: number;
            axesCritical: number;
        };
    };
    /**
     * Generate Axis Deep Dives
     */
    _generateAxisDeepDives(metrics: any): Promise<{
        axis: string;
        name: any;
        bcgLabel: any;
        scores: {
            actual: any;
            target: any;
            gap: any;
            maxLevel: any;
        };
        maturityLabel: any;
        status: any;
        areaScores: any;
        keyFindings: {
            type: string;
            message: string;
        }[];
        recommendations: {
            priority: string;
            action: string;
        }[];
    }[]>;
    /**
     * Generate findings for specific axis
     */
    _generateAxisFindings(axisKey: any, axisMetrics: any): {
        type: string;
        message: string;
    }[];
    /**
     * Generate recommendations for specific axis
     */
    _generateAxisRecommendations(axisKey: any, axisMetrics: any): {
        priority: string;
        action: string;
    }[];
    /**
     * Generate Gap Analysis section
     */
    _generateGapAnalysis(metrics: any): {
        type: string;
        totalGaps: any;
        criticalGaps: any;
        quickWins: any;
        gaps: any;
        heatmap: {
            axis: string;
            name: any;
            actual: any;
            target: any;
            gap: any;
            color: string;
        }[];
    };
    /**
     * Generate gap heatmap data
     */
    _generateGapHeatmap(metrics: any): {
        axis: string;
        name: any;
        actual: any;
        target: any;
        gap: any;
        color: string;
    }[];
    /**
     * Generate Strategic Recommendations using AI
     */
    _generateStrategicRecommendations(metrics: any): Promise<{
        type: string;
        count: number;
        recommendations: {
            id: string;
            priority: string;
            category: string;
            title: string;
            description: string;
            expectedOutcome: string;
            timeframe: string;
            effort: string;
            dependencies: never[];
        }[];
        priorityMatrix: {
            critical: number;
            high: number;
            medium: number;
            low: number;
        };
    }>;
    /**
     * Generate Transformation Roadmap
     */
    _generateTransformationRoadmap(metrics: any): {
        type: string;
        totalDuration: string;
        phases: {
            id: string;
            name: string;
            duration: string;
            focus: string;
            objectives: string[];
            expectedOutcome: string;
            keyMilestones: {
                week: number;
                milestone: string;
            }[];
        }[];
        criticalPath: any;
        riskFactors: string[];
    };
    /**
     * Generate Appendix
     */
    _generateAppendix(): {
        type: string;
        methodology: {
            framework: string;
            version: string;
            basedOn: string;
            axes: number;
            totalAreas: number;
        };
        glossary: {
            term: string;
            definition: string;
        }[];
        dataTimestamp: string;
        assessmentId: any;
    };
    /**
     * Generate Spider Chart data
     */
    _generateSpiderChartData(metrics: any): {
        labels: any[];
        datasets: ({
            label: string;
            data: any[];
            backgroundColor: string;
            borderColor: string;
            borderWidth: number;
            borderDash?: undefined;
        } | {
            label: string;
            data: any[];
            backgroundColor: string;
            borderColor: string;
            borderWidth: number;
            borderDash: number[];
        })[];
    };
    /**
     * Generate Gap Chart data
     */
    _generateGapChartData(metrics: any): {
        labels: any[];
        datasets: {
            label: string;
            data: any[];
            backgroundColor: string;
        }[];
    };
    /**
     * Generate Roadmap Timeline data
     */
    _generateRoadmapTimeline(metrics: any): {
        startDate: string;
        endDate: string;
        phases: {
            name: string;
            start: number;
            end: number;
            color: string;
        }[];
    };
    /**
     * Save report to database
     */
    _saveReport(report: any): Promise<any>;
}
export namespace REPORT_SECTIONS {
    let EXECUTIVE_SUMMARY: string;
    let MATURITY_OVERVIEW: string;
    let AXIS_DEEP_DIVE: string;
    let GAP_ANALYSIS: string;
    let STRATEGIC_RECOMMENDATIONS: string;
    let TRANSFORMATION_ROADMAP: string;
    let INITIATIVE_PORTFOLIO: string;
    let APPENDIX: string;
}
export namespace DRD_AXES_CONFIG {
    namespace processes {
        let name: string;
        let bcgLabel: string;
        let icon: string;
        let color: string;
        let maxLevel: number;
        let areas: string[];
    }
    namespace digitalProducts {
        let name_1: string;
        export { name_1 as name };
        let bcgLabel_1: string;
        export { bcgLabel_1 as bcgLabel };
        let icon_1: string;
        export { icon_1 as icon };
        let color_1: string;
        export { color_1 as color };
        let maxLevel_1: number;
        export { maxLevel_1 as maxLevel };
        let areas_1: string[];
        export { areas_1 as areas };
    }
    namespace businessModels {
        let name_2: string;
        export { name_2 as name };
        let bcgLabel_2: string;
        export { bcgLabel_2 as bcgLabel };
        let icon_2: string;
        export { icon_2 as icon };
        let color_2: string;
        export { color_2 as color };
        let maxLevel_2: number;
        export { maxLevel_2 as maxLevel };
        let areas_2: string[];
        export { areas_2 as areas };
    }
    namespace dataManagement {
        let name_3: string;
        export { name_3 as name };
        let bcgLabel_3: string;
        export { bcgLabel_3 as bcgLabel };
        let icon_3: string;
        export { icon_3 as icon };
        let color_3: string;
        export { color_3 as color };
        let maxLevel_3: number;
        export { maxLevel_3 as maxLevel };
        let areas_3: string[];
        export { areas_3 as areas };
    }
    namespace culture {
        let name_4: string;
        export { name_4 as name };
        let bcgLabel_4: string;
        export { bcgLabel_4 as bcgLabel };
        let icon_4: string;
        export { icon_4 as icon };
        let color_4: string;
        export { color_4 as color };
        let maxLevel_4: number;
        export { maxLevel_4 as maxLevel };
        let areas_4: string[];
        export { areas_4 as areas };
    }
    namespace cybersecurity {
        let name_5: string;
        export { name_5 as name };
        let bcgLabel_5: string;
        export { bcgLabel_5 as bcgLabel };
        let icon_5: string;
        export { icon_5 as icon };
        let color_5: string;
        export { color_5 as color };
        let maxLevel_5: number;
        export { maxLevel_5 as maxLevel };
        let areas_5: string[];
        export { areas_5 as areas };
    }
    namespace aiMaturity {
        let name_6: string;
        export { name_6 as name };
        let bcgLabel_6: string;
        export { bcgLabel_6 as bcgLabel };
        let icon_6: string;
        export { icon_6 as icon };
        let color_6: string;
        export { color_6 as color };
        let maxLevel_6: number;
        export { maxLevel_6 as maxLevel };
        let areas_6: string[];
        export { areas_6 as areas };
    }
}
export const MATURITY_LEVELS: {
    1: {
        label: string;
        bcgLabel: string;
        description: string;
    };
    2: {
        label: string;
        bcgLabel: string;
        description: string;
    };
    3: {
        label: string;
        bcgLabel: string;
        description: string;
    };
    4: {
        label: string;
        bcgLabel: string;
        description: string;
    };
    5: {
        label: string;
        bcgLabel: string;
        description: string;
    };
    6: {
        label: string;
        bcgLabel: string;
        description: string;
    };
    7: {
        label: string;
        bcgLabel: string;
        description: string;
    };
};
//# sourceMappingURL=bcgReportGenerator.d.ts.map