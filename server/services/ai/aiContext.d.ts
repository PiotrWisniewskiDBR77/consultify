/**
 * AI Context Builder - Enhanced Version
 *
 * Responsibility: Build comprehensive context for AI-powered report generation
 * Including:
 * - User and organization context
 * - Company profile with industry specifics
 * - Regulatory and compliance context
 * - Assessment data with gap analysis
 * - Industry benchmarks integration
 */
export interface IndustryProfile {
    name: string;
    namePl: string;
    regulations: string[];
    keyTransformationAreas: string[];
    typicalChallenges: string[];
    benchmarkSources: string[];
    averageMaturity: {
        global: number;
        poland: number;
        leader: number;
    };
    transformationHorizon: string;
}
export interface CompanySizeProfile {
    range: string;
    characteristics: string[];
    transformationApproach: string;
    budgetIndicator: string;
    teamCapacity: string;
}
export interface RegulatoryContext {
    name: string;
    fullName: string;
    relevance: string[];
    keyRequirements: string[];
    penalties?: string;
    deadline?: string;
    timeline?: string;
    impactOnTransformation: string;
    applicability?: string;
}
export interface DrdAxis {
    name: string;
    namePl: string;
    maxLevel: number;
}
export interface BuildContextParams {
    userId?: string;
    organizationId?: string;
    projectId?: string;
    screenContext?: Record<string, unknown>;
    capability?: string;
    assessmentId?: string;
}
export interface BuildReportContextParams {
    assessmentId: string;
    organizationId?: string;
    projectId?: string;
    language?: string;
}
export interface CompanyProfile {
    industry: string;
    industryProfile: IndustryProfile;
    size: string;
    sizeProfile: CompanySizeProfile;
    location: string;
    founded?: string;
    revenue?: string;
    employees?: string | number;
    digitalMaturitySelfAssessment?: number;
    strategicPriorities: string[];
    currentInitiatives: string[];
    constraints: {
        budget?: string;
        timeline?: string;
        resources?: string;
    };
    rawContext: Record<string, unknown>;
}
export interface AssessmentAxis {
    id: string;
    name: string;
    namePl: string;
    maxLevel: number;
    actual: number;
    target: number;
    gap: number;
    justification?: string | null;
    areaScores?: Record<string, unknown> | null;
}
export interface AssessmentContext {
    axes: AssessmentAxis[];
    summary: {
        axesAssessed: number;
        totalAxes: number;
        averageMaturity: string;
        averageTarget: string;
        averageGap: string;
        totalGapPoints: number;
    };
    highlights: {
        strongest: {
            axis: string;
            score: number;
        } | null;
        weakest: {
            axis: string;
            score: number;
        } | null;
        largestGap: {
            axis: string;
            gap: number;
        } | null;
    };
    hasJustifications: boolean;
    hasAreaScores: boolean;
}
export interface GapAnalysisResult {
    axis: string;
    axisName: string;
    current: number;
    target: number;
    gap: number;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    estimatedMonths: number;
    complexity: 'HIGH' | 'MEDIUM' | 'LOW';
}
export interface GapAnalysis {
    totalGaps: number;
    criticalGaps: GapAnalysisResult[];
    highPriorityGaps: GapAnalysisResult[];
    mediumPriorityGaps: GapAnalysisResult[];
    lowPriorityGaps: GapAnalysisResult[];
    allGaps: GapAnalysisResult[];
    estimatedTotalTransformationMonths: number;
}
export interface MaturityAnalysis {
    averageMaturity: string;
    industryBenchmark: string;
    positioning: 'LEADER' | 'ABOVE_AVERAGE' | 'AT_AVERAGE' | 'BELOW_AVERAGE' | 'LAGGARD';
    positioningLabel: string;
    areasAboveIndustry: string[];
    areasBelowIndustry: string[];
}
export interface ContextConfigurations {
    industries: string[];
    companySizes: string[];
    regulations: string[];
    axes: string[];
}
declare const INDUSTRY_PROFILES: Record<string, IndustryProfile>;
declare const COMPANY_SIZE_PROFILES: Record<string, CompanySizeProfile>;
declare const REGULATORY_CONTEXT: Record<string, RegulatoryContext>;
declare const DRD_AXES: Record<string, DrdAxis>;
declare class ContextBuilder {
    private industryProfiles;
    private sizeProfiles;
    private regulations;
    constructor();
    /**
     * Build comprehensive context for AI operations
     */
    build(params: BuildContextParams): Promise<{
        user: {
            id: string | undefined;
            name: any;
            role: any;
            email: any;
        };
        organization: {
            industry: string;
            industryProfile: IndustryProfile;
            size: string;
            sizeProfile: CompanySizeProfile;
            location: string;
            founded?: string;
            revenue?: string;
            employees?: string | number;
            digitalMaturitySelfAssessment?: number;
            strategicPriorities: string[];
            currentInitiatives: string[];
            constraints: {
                budget?: string;
                timeline?: string;
                resources?: string;
            };
            rawContext: Record<string, unknown>;
            id: string | undefined;
            name: any;
        };
        project: {
            id: string | undefined;
            name: any;
            status: any;
            phase: any;
        };
        industryContext: IndustryProfile & {
            key: string;
            isKnownIndustry: boolean;
            maturityBenchmark: {
                description: string;
                global: number;
                poland: number;
                leader: number;
                gap: number;
            };
        };
        regulatoryContext: {
            location: string;
            jurisdiction: string;
            applicableRegulations: {
                applicability: string;
                name: string;
                fullName: string;
                relevance: string[];
                keyRequirements: string[];
                penalties?: string;
                deadline?: string;
                timeline?: string;
                impactOnTransformation: string;
            }[];
            industrySpecificRegulations: string[];
            complianceRecommendation: string;
        };
        assessmentContext: AssessmentContext | null;
        screen: Record<string, unknown>;
        capability: string | undefined;
        timestamp: string;
        contextVersion: string;
    }>;
    /**
     * Build context specifically for comprehensive report generation
     */
    buildReportContext(params: BuildReportContextParams): Promise<{
        assessment: {
            id: string;
            name: any;
            completedAt: any;
            isComplete: any;
        };
        company: {
            industry: string;
            industryProfile: IndustryProfile;
            size: string;
            sizeProfile: CompanySizeProfile;
            location: string;
            founded?: string;
            revenue?: string;
            employees?: string | number;
            digitalMaturitySelfAssessment?: number;
            strategicPriorities: string[];
            currentInitiatives: string[];
            constraints: {
                budget?: string;
                timeline?: string;
                resources?: string;
            };
            rawContext: Record<string, unknown>;
            name: any;
        };
        industry: IndustryProfile & {
            key: string;
            isKnownIndustry: boolean;
            maturityBenchmark: {
                description: string;
                global: number;
                poland: number;
                leader: number;
                gap: number;
            };
        };
        regulations: {
            location: string;
            jurisdiction: string;
            applicableRegulations: {
                applicability: string;
                name: string;
                fullName: string;
                relevance: string[];
                keyRequirements: string[];
                penalties?: string;
                deadline?: string;
                timeline?: string;
                impactOnTransformation: string;
            }[];
            industrySpecificRegulations: string[];
            complianceRecommendation: string;
        };
        maturity: AssessmentContext;
        gaps: GapAnalysis;
        positioning: MaturityAnalysis;
        config: {
            language: string;
            generatedAt: string;
            reportType: string;
        };
    }>;
    private _buildCompanyProfile;
    private _inferIndustry;
    private _determineCompanySize;
    private _buildIndustryContext;
    private _buildRegulatoryContext;
    private _generateComplianceRecommendation;
    private _buildAssessmentContext;
    private _performGapAnalysis;
    private _calculateGapPriority;
    private _estimateTransformationTime;
    private _assessComplexity;
    private _analyzeMaturityProfile;
    private _fetchUser;
    private _fetchOrganization;
    private _fetchProject;
    private _fetchAssessment;
    private _fetchFullAssessment;
    private _parseJSON;
    /**
     * Get available configurations
     */
    getConfigurations(): ContextConfigurations;
}
declare const contextBuilder: ContextBuilder;
export { COMPANY_SIZE_PROFILES, ContextBuilder, contextBuilder, DRD_AXES, INDUSTRY_PROFILES, REGULATORY_CONTEXT };
export default contextBuilder;
//# sourceMappingURL=aiContext.d.ts.map