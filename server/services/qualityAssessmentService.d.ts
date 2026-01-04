export default QualityAssessmentService;
declare namespace QualityAssessmentService {
    /**
     * Calculate forecast accuracy score (0-100)
     * Based on variance between planned and actual values
     */
    function calculateForecastAccuracy(planned: any, actual: any): {
        score: number;
        costVariancePercent: number;
        benefitVariancePercent: number;
        timelineVariancePercent: number;
    } | null;
    /**
     * Calculate methodology quality score (0-100)
     * Based on completeness and rigor of financial analysis
     */
    function calculateMethodologyScore(financials: any): {
        score: number;
        details: {};
    } | {
        score: number;
        details: {
            costAnalysis: string;
            contingencyIncluded: boolean;
            benefitAnalysis: string;
            implementationTimeline: boolean;
            benefitRealizationTimeline: boolean;
            adequateHorizon: boolean;
            npvCalculated: boolean;
            irrCalculated: boolean;
            paybackCalculated: boolean;
            roiCalculated: boolean;
            assumptionsDocumented: boolean;
            assumptionsCount: any;
            assumptionsPartial: boolean;
            sensitivityAnalysis: boolean;
        };
    };
    /**
     * Calculate documentation completeness score (0-100)
     */
    function calculateDocumentationScore(analysis: any, financials: any, benefitTracking: any): {
        score: number;
        details: {
            descriptionComplete: boolean;
            descriptionPartial: boolean;
            assumptionsComplete: boolean;
            assumptionsPartial: boolean;
            cashFlowDocumented: boolean;
            trackingComplete: boolean;
            trackingPartial: boolean;
            trackingStarted: boolean;
            trackingRecords: any;
            evidenceComplete: boolean;
            evidencePartial: boolean;
            evidenceCount: any;
            verificationComplete: boolean;
            verificationPartial: boolean;
            verificationRate: number;
        };
    };
    /**
     * Calculate data quality score (0-100)
     */
    function calculateDataQualityScore(benefitTracking: any): {
        score: number;
        details: {
            message: string;
        };
    } | {
        score: number;
        details: {
            completenessRate: number;
            consistentPeriods: boolean;
            mostlyConsistent: boolean;
            periodTypes: any[];
            timely: boolean;
            recentRecords: any;
            varianceNotesRate: number;
        };
    };
    /**
     * Determine overall quality rating
     */
    function determineOverallRating(scores: any): {
        score: number;
        rating: string;
    };
    /**
     * Extract lessons learned from assessment data
     */
    function extractLessonsLearned(assessmentData: any): {
        category: string;
        type: string;
        lesson: string;
        impact: string;
    }[];
    /**
     * Analyze benefit tracking patterns for insights
     */
    function analyzeTrackingPatterns(trackingData: any): {
        commonChallenges: any;
        successFactors: any;
        totalChallenges: number;
        totalSuccesses: number;
    };
    /**
     * Find common themes in text array (simplified)
     */
    function findCommonThemes(textArray: any, maxThemes?: number): any;
    /**
     * Generate improvement recommendations
     */
    function generateImprovementRecommendations(scores: any, lessons: any): {
        area: string;
        priority: string;
        recommendation: string;
        actions: string[];
    }[];
    /**
     * Get quality assessment for an initiative
     */
    function getQualityAssessment(initiativeId: any, organizationId: any): Promise<{
        id: any;
        initiativeId: any;
        financialId: any;
        organizationId: any;
        forecastAccuracyScore: any;
        costVariancePercent: any;
        benefitVariancePercent: any;
        timelineVariancePercent: any;
        methodologyScore: any;
        dataQualityScore: any;
        assumptionValidityScore: any;
        documentationScore: any;
        evidenceCompletenessPercent: any;
        lessonsLearned: any;
        improvementRecommendations: any;
        bestPracticesIdentified: any;
        overallQualityRating: any;
        overallQualityScore: any;
        assessmentType: any;
        assessmentNotes: any;
        assessedBy: any;
        assessedAt: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Create quality assessment
     */
    function createQualityAssessment(initiativeId: any, data: any, organizationId: any, userId: any): Promise<{
        id: any;
        initiativeId: any;
        financialId: any;
        organizationId: any;
        forecastAccuracyScore: any;
        costVariancePercent: any;
        benefitVariancePercent: any;
        timelineVariancePercent: any;
        methodologyScore: any;
        dataQualityScore: any;
        assumptionValidityScore: any;
        documentationScore: any;
        evidenceCompletenessPercent: any;
        lessonsLearned: any;
        improvementRecommendations: any;
        bestPracticesIdentified: any;
        overallQualityRating: any;
        overallQualityScore: any;
        assessmentType: any;
        assessmentNotes: any;
        assessedBy: any;
        assessedAt: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Update quality assessment
     */
    function updateQualityAssessment(initiativeId: any, data: any, organizationId: any, userId: any): Promise<{
        id: any;
        initiativeId: any;
        financialId: any;
        organizationId: any;
        forecastAccuracyScore: any;
        costVariancePercent: any;
        benefitVariancePercent: any;
        timelineVariancePercent: any;
        methodologyScore: any;
        dataQualityScore: any;
        assumptionValidityScore: any;
        documentationScore: any;
        evidenceCompletenessPercent: any;
        lessonsLearned: any;
        improvementRecommendations: any;
        bestPracticesIdentified: any;
        overallQualityRating: any;
        overallQualityScore: any;
        assessmentType: any;
        assessmentNotes: any;
        assessedBy: any;
        assessedAt: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Recalculate quality scores based on current data
     */
    function recalculateQualityScores(initiativeId: any, organizationId: any): Promise<{
        id: any;
        initiativeId: any;
        financialId: any;
        organizationId: any;
        forecastAccuracyScore: any;
        costVariancePercent: any;
        benefitVariancePercent: any;
        timelineVariancePercent: any;
        methodologyScore: any;
        dataQualityScore: any;
        assumptionValidityScore: any;
        documentationScore: any;
        evidenceCompletenessPercent: any;
        lessonsLearned: any;
        improvementRecommendations: any;
        bestPracticesIdentified: any;
        overallQualityRating: any;
        overallQualityScore: any;
        assessmentType: any;
        assessmentNotes: any;
        assessedBy: any;
        assessedAt: any;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Get lessons learned for an initiative
     */
    function getLessonsLearned(initiativeId: any, organizationId: any): Promise<any>;
    function transformAssessmentRow(row: any): {
        id: any;
        initiativeId: any;
        financialId: any;
        organizationId: any;
        forecastAccuracyScore: any;
        costVariancePercent: any;
        benefitVariancePercent: any;
        timelineVariancePercent: any;
        methodologyScore: any;
        dataQualityScore: any;
        assumptionValidityScore: any;
        documentationScore: any;
        evidenceCompletenessPercent: any;
        lessonsLearned: any;
        improvementRecommendations: any;
        bestPracticesIdentified: any;
        overallQualityRating: any;
        overallQualityScore: any;
        assessmentType: any;
        assessmentNotes: any;
        assessedBy: any;
        assessedAt: any;
        createdAt: any;
        updatedAt: any;
    } | null;
}
//# sourceMappingURL=qualityAssessmentService.d.ts.map