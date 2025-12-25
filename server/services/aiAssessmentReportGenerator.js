/**
 * AI Assessment Report Generator Service
 * Dedicated service for generating various types of assessment reports
 * Builds on aiAssessmentPartnerService but focuses on report-specific functionality
 */

const { aiAssessmentPartner, DRD_AXES } = require('./aiAssessmentPartnerService');

// Report types
const REPORT_TYPES = {
    EXECUTIVE_SUMMARY: 'executive_summary',
    FULL_ASSESSMENT: 'full_assessment',
    STAKEHOLDER_VIEW: 'stakeholder_view',
    BENCHMARK_COMPARISON: 'benchmark_comparison',
    GAP_ANALYSIS: 'gap_analysis',
    TRANSFORMATION_ROADMAP: 'transformation_roadmap',
    INITIATIVE_PLAN: 'initiative_plan'
};

// Stakeholder roles for custom views
const STAKEHOLDER_ROLES = {
    CTO: 'CTO',
    CFO: 'CFO',
    COO: 'COO',
    CEO: 'CEO',
    BOARD: 'BOARD',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    CONSULTANT: 'CONSULTANT'
};

class AIAssessmentReportGenerator {
    constructor() {
        this.aiPartner = aiAssessmentPartner;
    }

    // =========================================================================
    // MAIN REPORT GENERATION METHODS
    // =========================================================================

    /**
     * Generate a complete assessment report
     * Combines multiple sections into one comprehensive document
     */
    async generateFullReport(assessment, options = {}) {
        const {
            organizationName,
            industry,
            language = 'pl',
            includeRecommendations = true,
            includeBenchmarks = true,
            includeRoadmap = true
        } = options;

        const sections = [];

        // 1. Executive Summary
        const executiveSummary = await this.aiPartner.generateExecutiveSummary(
            assessment,
            { organizationName, industry, language }
        );
        sections.push({
            id: 'executive_summary',
            title: language === 'pl' ? 'Podsumowanie wykonawcze' : 'Executive Summary',
            content: executiveSummary.summary,
            metrics: executiveSummary.metrics
        });

        // 2. Detailed Axis Analysis
        const axisAnalysis = await this._generateAxisAnalysis(assessment, { language });
        sections.push({
            id: 'axis_analysis',
            title: language === 'pl' ? 'Analiza szczegółowa osi' : 'Detailed Axis Analysis',
            content: axisAnalysis
        });

        // 3. Gap Analysis
        const gapSummary = await this._generateGapSummary(assessment, { language });
        sections.push({
            id: 'gap_analysis',
            title: language === 'pl' ? 'Analiza luk' : 'Gap Analysis',
            content: gapSummary
        });

        // 4. Recommendations (if requested)
        if (includeRecommendations) {
            const recommendations = await this._generateRecommendations(assessment, { language });
            sections.push({
                id: 'recommendations',
                title: language === 'pl' ? 'Rekomendacje' : 'Recommendations',
                content: recommendations
            });
        }

        // 5. Benchmarks (if requested and available)
        if (includeBenchmarks && options.benchmarks) {
            const benchmarkCommentary = await this.aiPartner.generateBenchmarkCommentary(
                assessment,
                options.benchmarks,
                { industry, language }
            );
            sections.push({
                id: 'benchmarks',
                title: language === 'pl' ? 'Porównanie z branżą' : 'Industry Benchmarks',
                content: benchmarkCommentary.commentary,
                data: benchmarkCommentary.detailedComparison
            });
        }

        // 6. Transformation Roadmap (if requested)
        if (includeRoadmap) {
            const roadmap = await this._generateTransformationRoadmap(assessment, { language });
            sections.push({
                id: 'roadmap',
                title: language === 'pl' ? 'Plan transformacji' : 'Transformation Roadmap',
                content: roadmap
            });
        }

        return {
            reportType: REPORT_TYPES.FULL_ASSESSMENT,
            generatedAt: new Date().toISOString(),
            organizationName,
            industry,
            language,
            sections,
            metadata: {
                axesAssessed: Object.keys(assessment).filter(k => assessment[k]?.actual).length,
                averageMaturity: executiveSummary.metrics?.averageMaturity,
                averageTarget: executiveSummary.metrics?.averageTarget
            }
        };
    }

    /**
     * Generate stakeholder-specific report
     */
    async generateStakeholderReport(assessment, stakeholderRole, options = {}) {
        const { organizationName, language = 'pl' } = options;

        if (!Object.values(STAKEHOLDER_ROLES).includes(stakeholderRole)) {
            return { error: `Invalid stakeholder role. Valid: ${Object.values(STAKEHOLDER_ROLES).join(', ')}` };
        }

        // Get stakeholder-specific view
        const stakeholderView = await this.aiPartner.generateStakeholderView(
            assessment,
            stakeholderRole,
            { organizationName, language }
        );

        // Get relevant insights for this stakeholder
        const insights = await this.aiPartner.generateProactiveInsights(assessment);
        const filteredInsights = this._filterInsightsForStakeholder(insights.insights, stakeholderRole);

        // Get focused recommendations
        const focusedRecommendations = await this._getStakeholderRecommendations(
            assessment,
            stakeholderRole,
            { language }
        );

        return {
            reportType: REPORT_TYPES.STAKEHOLDER_VIEW,
            stakeholderRole,
            generatedAt: new Date().toISOString(),
            organizationName,
            mainView: stakeholderView.view,
            focusAreas: stakeholderView.focusAreas,
            keyInsights: filteredInsights,
            recommendations: focusedRecommendations,
            language
        };
    }

    /**
     * Generate benchmark comparison report
     */
    async generateBenchmarkReport(assessment, benchmarks, options = {}) {
        const { industry, language = 'pl' } = options;

        // Get benchmark commentary
        const commentary = await this.aiPartner.generateBenchmarkCommentary(
            assessment,
            benchmarks,
            { industry, language }
        );

        // Calculate detailed comparison
        const detailedComparison = this._calculateDetailedBenchmarks(assessment, benchmarks);

        // Get competitive insights
        const competitiveInsights = await this._generateCompetitiveInsights(
            assessment,
            benchmarks,
            { language }
        );

        return {
            reportType: REPORT_TYPES.BENCHMARK_COMPARISON,
            generatedAt: new Date().toISOString(),
            industry,
            commentary: commentary.commentary,
            summary: commentary.summary,
            detailedComparison,
            competitiveInsights,
            language
        };
    }

    /**
     * Generate transformation initiative plan
     */
    async generateInitiativePlan(assessment, constraints = {}, options = {}) {
        const { language = 'pl' } = options;

        // Build gap analysis
        const gapAnalysis = Object.entries(assessment)
            .filter(([key, val]) => val?.actual && val?.target && DRD_AXES[key])
            .map(([key, val]) => ({
                axis: key,
                axisName: DRD_AXES[key].name,
                currentScore: val.actual,
                targetScore: val.target,
                gap: val.target - val.actual
            }))
            .filter(g => g.gap > 0);

        // Generate initiatives
        const initiatives = await this.aiPartner.generateInitiativesFromGaps(gapAnalysis, {
            ...constraints,
            language
        });

        // Prioritize initiatives
        const prioritized = await this.aiPartner.prioritizeInitiatives(
            initiatives.initiatives,
            constraints.criteria || {}
        );

        // Estimate ROI for top initiatives
        const topInitiatives = prioritized.prioritizedList?.slice(0, 5) || [];
        const roiEstimates = [];
        
        for (const initiative of topInitiatives) {
            const fullInitiative = initiatives.initiatives.find(i => i.name === initiative.name);
            if (fullInitiative) {
                const roi = await this.aiPartner.estimateInitiativeROI(fullInitiative, {
                    companySize: constraints.companySize,
                    industry: constraints.industry
                });
                roiEstimates.push({
                    initiative: initiative.name,
                    ...roi.estimate
                });
            }
        }

        // Generate implementation timeline
        const timeline = this._generateImplementationTimeline(
            prioritized.prioritizedList || [],
            initiatives.initiatives
        );

        return {
            reportType: REPORT_TYPES.INITIATIVE_PLAN,
            generatedAt: new Date().toISOString(),
            gapAnalysis,
            initiatives: initiatives.initiatives,
            prioritizedList: prioritized.prioritizedList,
            roiEstimates,
            timeline,
            constraints,
            language
        };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    async _generateAxisAnalysis(assessment, options = {}) {
        const { language = 'pl' } = options;
        const analysis = [];

        for (const [axisId, data] of Object.entries(assessment)) {
            if (!data?.actual || !DRD_AXES[axisId]) continue;

            const axis = DRD_AXES[axisId];
            const gapAnalysis = data.target && data.target > data.actual
                ? await this.aiPartner.generateGapAnalysis(axisId, data.actual, data.target, data.justification)
                : null;

            analysis.push({
                axisId,
                axisName: axis.name,
                currentScore: data.actual,
                targetScore: data.target,
                currentDescription: axis.levels[data.actual],
                targetDescription: data.target ? axis.levels[data.target] : null,
                justification: data.justification,
                gap: data.target ? data.target - data.actual : 0,
                pathway: gapAnalysis?.pathway || null,
                recommendations: gapAnalysis?.aiRecommendations || []
            });
        }

        return analysis;
    }

    async _generateGapSummary(assessment, options = {}) {
        const gaps = Object.entries(assessment)
            .filter(([key, val]) => val?.actual && val?.target && DRD_AXES[key])
            .map(([key, val]) => ({
                axis: key,
                axisName: DRD_AXES[key].name,
                gap: val.target - val.actual,
                current: val.actual,
                target: val.target
            }))
            .filter(g => g.gap > 0)
            .sort((a, b) => b.gap - a.gap);

        const totalGap = gaps.reduce((sum, g) => sum + g.gap, 0);
        const avgGap = gaps.length > 0 ? totalGap / gaps.length : 0;

        return {
            prioritizedGaps: gaps,
            totalAxesWithGaps: gaps.length,
            averageGap: avgGap.toFixed(1),
            largestGap: gaps[0] || null,
            smallestGap: gaps[gaps.length - 1] || null,
            quickWins: gaps.filter(g => g.gap === 1),
            majorTransformations: gaps.filter(g => g.gap >= 3)
        };
    }

    async _generateRecommendations(assessment, options = {}) {
        const { language = 'pl' } = options;
        
        // Gather all recommendations from gap analyses
        const allRecommendations = [];

        for (const [axisId, data] of Object.entries(assessment)) {
            if (!data?.actual || !data?.target || data.target <= data.actual || !DRD_AXES[axisId]) continue;

            const gapAnalysis = await this.aiPartner.generateGapAnalysis(
                axisId,
                data.actual,
                data.target,
                data.justification
            );

            if (gapAnalysis.aiRecommendations) {
                allRecommendations.push(...gapAnalysis.aiRecommendations.map(r => ({
                    ...r,
                    axis: axisId,
                    axisName: DRD_AXES[axisId].name
                })));
            }
        }

        // Prioritize recommendations
        const prioritized = allRecommendations.sort((a, b) => {
            const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        });

        return {
            total: prioritized.length,
            byPriority: {
                high: prioritized.filter(r => r.priority === 'HIGH'),
                medium: prioritized.filter(r => r.priority === 'MEDIUM'),
                low: prioritized.filter(r => r.priority === 'LOW')
            },
            all: prioritized
        };
    }

    async _generateTransformationRoadmap(assessment, options = {}) {
        const { language = 'pl' } = options;

        // Generate gap analysis for all axes
        const phases = [];
        let currentMonth = 0;

        // Sort axes by gap size (largest first for strategic impact)
        const axesWithGaps = Object.entries(assessment)
            .filter(([key, val]) => val?.actual && val?.target && val.target > val.actual && DRD_AXES[key])
            .map(([key, val]) => ({
                axisId: key,
                axisName: DRD_AXES[key].name,
                gap: val.target - val.actual,
                current: val.actual,
                target: val.target
            }))
            .sort((a, b) => b.gap - a.gap);

        // Group into phases
        for (const axis of axesWithGaps) {
            const gapAnalysis = await this.aiPartner.generateGapAnalysis(
                axis.axisId,
                axis.current,
                axis.target
            );

            phases.push({
                axis: axis.axisName,
                axisId: axis.axisId,
                startMonth: currentMonth,
                endMonth: currentMonth + gapAnalysis.estimatedTotalMonths,
                duration: gapAnalysis.estimatedTotalMonths,
                pathway: gapAnalysis.pathway,
                milestones: gapAnalysis.pathway?.map((p, idx) => ({
                    level: p.level,
                    month: currentMonth + (idx + 1) * (gapAnalysis.estimatedTotalMonths / gapAnalysis.pathway.length),
                    description: p.description
                })) || []
            });

            // Overlap phases for parallel execution (adjust as needed)
            currentMonth += Math.max(3, Math.floor(gapAnalysis.estimatedTotalMonths / 2));
        }

        return {
            totalDuration: phases.length > 0 ? phases[phases.length - 1].endMonth : 0,
            phases,
            summary: {
                totalAxes: phases.length,
                parallelExecution: true,
                startDate: new Date().toISOString().split('T')[0],
                projectedEndDate: new Date(Date.now() + (phases.length > 0 ? phases[phases.length - 1].endMonth : 0) * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            }
        };
    }

    _filterInsightsForStakeholder(insights, stakeholderRole) {
        // Filter insights based on stakeholder focus
        const focusMap = {
            CTO: ['aiMaturity', 'dataManagement', 'digitalProducts', 'cybersecurity'],
            CFO: ['businessModels', 'processes'],
            COO: ['processes', 'culture'],
            CEO: ['businessModels', 'culture', 'digitalProducts'],
            BOARD: ['cybersecurity', 'businessModels', 'culture']
        };

        const focusAxes = focusMap[stakeholderRole] || [];

        return insights.filter(insight => {
            if (!insight.axis && !insight.axes) return true; // General insights
            if (insight.axis && focusAxes.includes(insight.axis)) return true;
            if (insight.axes && insight.axes.some(a => focusAxes.includes(a))) return true;
            return false;
        });
    }

    async _getStakeholderRecommendations(assessment, stakeholderRole, options = {}) {
        const { language = 'pl' } = options;

        const focusMap = {
            CTO: ['Technology architecture', 'Data infrastructure', 'AI capabilities', 'Security posture'],
            CFO: ['Cost optimization', 'Revenue enablement', 'ROI tracking', 'Risk management'],
            COO: ['Process efficiency', 'Operational excellence', 'Change management', 'Resource allocation'],
            CEO: ['Strategic positioning', 'Competitive advantage', 'Innovation leadership', 'Stakeholder value'],
            BOARD: ['Governance', 'Compliance', 'Risk oversight', 'Long-term value']
        };

        return {
            focusAreas: focusMap[stakeholderRole] || [],
            keyActions: language === 'pl' ? [
                'Przeprowadź przegląd strategiczny z zespołem',
                'Zdefiniuj mierzalne KPI dla transformacji',
                'Zaplanuj regularne przeglądy postępów'
            ] : [
                'Conduct strategic review with team',
                'Define measurable KPIs for transformation',
                'Schedule regular progress reviews'
            ]
        };
    }

    _calculateDetailedBenchmarks(assessment, benchmarks) {
        const comparison = [];

        for (const [axisId, data] of Object.entries(assessment)) {
            if (!data?.actual || !DRD_AXES[axisId]) continue;

            const benchmark = benchmarks[axisId];
            if (!benchmark) continue;

            const industryAvg = benchmark.median || benchmark.average || benchmark.mean_score;
            const difference = data.actual - industryAvg;

            comparison.push({
                axisId,
                axisName: DRD_AXES[axisId].name,
                score: data.actual,
                industryAverage: industryAvg,
                difference: difference.toFixed(1),
                position: difference > 0.5 ? 'ABOVE' : difference < -0.5 ? 'BELOW' : 'AT',
                percentile: benchmark.percentile_50 ? this._calculatePercentile(data.actual, benchmark) : null
            });
        }

        return comparison;
    }

    _calculatePercentile(score, benchmark) {
        if (score <= benchmark.percentile_10) return 10;
        if (score <= benchmark.percentile_25) return 25;
        if (score <= benchmark.percentile_50) return 50;
        if (score <= benchmark.percentile_75) return 75;
        if (score <= benchmark.percentile_90) return 90;
        return 95;
    }

    async _generateCompetitiveInsights(assessment, benchmarks, options = {}) {
        const { language = 'pl' } = options;
        const insights = [];

        const comparison = this._calculateDetailedBenchmarks(assessment, benchmarks);
        
        const above = comparison.filter(c => c.position === 'ABOVE');
        const below = comparison.filter(c => c.position === 'BELOW');

        if (above.length > 0) {
            insights.push({
                type: 'COMPETITIVE_ADVANTAGE',
                title: language === 'pl' 
                    ? `Przewaga konkurencyjna w ${above.length} obszarach`
                    : `Competitive advantage in ${above.length} areas`,
                description: language === 'pl'
                    ? `Organizacja wyprzedza branżę w: ${above.map(a => a.axisName).join(', ')}`
                    : `Organization leads industry in: ${above.map(a => a.axisName).join(', ')}`,
                axes: above.map(a => a.axisId)
            });
        }

        if (below.length > 0) {
            insights.push({
                type: 'IMPROVEMENT_OPPORTUNITY',
                title: language === 'pl'
                    ? `Możliwość poprawy w ${below.length} obszarach`
                    : `Improvement opportunity in ${below.length} areas`,
                description: language === 'pl'
                    ? `Do nadrobienia względem branży: ${below.map(b => b.axisName).join(', ')}`
                    : `Catching up needed in: ${below.map(b => b.axisName).join(', ')}`,
                axes: below.map(b => b.axisId)
            });
        }

        return insights;
    }

    _generateImplementationTimeline(prioritizedList, initiatives) {
        const timeline = [];
        let currentQuarter = 1;
        let currentYear = new Date().getFullYear();

        for (const item of prioritizedList.slice(0, 10)) {
            const initiative = initiatives.find(i => i.name === item.name);
            if (!initiative) continue;

            // Parse duration
            const durationMatch = initiative.estimatedDuration?.match(/(\d+)/);
            const durationMonths = durationMatch ? parseInt(durationMatch[1]) : 6;

            const startQuarter = currentQuarter;
            const startYear = currentYear;

            // Calculate end quarter
            const quarterSpan = Math.ceil(durationMonths / 3);
            let endQuarter = startQuarter + quarterSpan - 1;
            let endYear = startYear;

            while (endQuarter > 4) {
                endQuarter -= 4;
                endYear++;
            }

            timeline.push({
                initiative: item.name,
                rank: item.rank,
                startQuarter: `Q${startQuarter} ${startYear}`,
                endQuarter: `Q${endQuarter} ${endYear}`,
                durationMonths,
                priority: initiative.priority
            });

            // Move to next start point (allow some overlap)
            currentQuarter += Math.ceil(quarterSpan / 2);
            while (currentQuarter > 4) {
                currentQuarter -= 4;
                currentYear++;
            }
        }

        return timeline;
    }
}

// Export singleton instance
const aiAssessmentReportGenerator = new AIAssessmentReportGenerator();

module.exports = {
    AIAssessmentReportGenerator,
    aiAssessmentReportGenerator,
    REPORT_TYPES,
    STAKEHOLDER_ROLES
};

