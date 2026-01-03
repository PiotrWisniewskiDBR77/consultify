/**
 * BCG Report Generator
 * 
 * Generates professional BCG/McKinsey-level assessment reports.
 * Uses AI to create strategic narratives, insights, and recommendations.
 * 
 * Report Structure:
 * 1. Executive Summary (1-page overview)
 * 2. Maturity Spider Chart (radar visualization)
 * 3. Axis Deep Dive (per-axis analysis)
 * 4. Gap Analysis (prioritized gaps)
 * 5. Strategic Recommendations
 * 6. Transformation Roadmap
 * 7. Initiative Portfolio
 * 8. Appendix (detailed data)
 */

const db = require('../../database');
const { v4: uuidv4 } = require('uuid');
const AiService = require('../aiService');
const ContextService = require('../contextService');

// Report section types
const REPORT_SECTIONS = {
    EXECUTIVE_SUMMARY: 'executive_summary',
    MATURITY_OVERVIEW: 'maturity_overview',
    AXIS_DEEP_DIVE: 'axis_deep_dive',
    GAP_ANALYSIS: 'gap_analysis',
    STRATEGIC_RECOMMENDATIONS: 'strategic_recommendations',
    TRANSFORMATION_ROADMAP: 'transformation_roadmap',
    INITIATIVE_PORTFOLIO: 'initiative_portfolio',
    APPENDIX: 'appendix'
};

// DRD Axis Configuration with BCG/McKinsey terminology
const DRD_AXES_CONFIG = {
    processes: {
        name: 'Digital Processes',
        bcgLabel: 'Operational Excellence',
        icon: '⚙️',
        color: '#3B82F6',
        maxLevel: 7,
        areas: ['sales', 'marketing', 'rd', 'purchasing', 'logistics', 'production', 'quality', 'finance', 'hr']
    },
    digitalProducts: {
        name: 'Digital Products & Services',
        bcgLabel: 'Digital Value Proposition',
        icon: '📱',
        color: '#6366F1',
        maxLevel: 5,
        areas: ['digital_products', 'community_based', 'ict_based', 'customer_alignment', 'scalability']
    },
    businessModels: {
        name: 'Digital Business Models',
        bcgLabel: 'Business Model Innovation',
        icon: '💼',
        color: '#8B5CF6',
        maxLevel: 5,
        areas: ['ecommerce', 'platforms', 'as_a_service', 'asset_sharing', 'data_monetization']
    },
    dataManagement: {
        name: 'Data & Analytics',
        bcgLabel: 'Data-Driven Organization',
        icon: '📊',
        color: '#06B6D4',
        maxLevel: 7,
        areas: ['data_collection', 'data_storage', 'data_quality', 'analytics', 'data_governance']
    },
    culture: {
        name: 'Organizational Culture',
        bcgLabel: 'Digital Culture & Capability',
        icon: '🏢',
        color: '#F59E0B',
        maxLevel: 5,
        areas: ['leadership', 'skills', 'collaboration', 'innovation', 'change_readiness']
    },
    cybersecurity: {
        name: 'Cybersecurity & Risk',
        bcgLabel: 'Digital Risk Management',
        icon: '🔒',
        color: '#EF4444',
        maxLevel: 5,
        areas: ['security_governance', 'threat_management', 'identity_access', 'incident_response', 'compliance']
    },
    aiMaturity: {
        name: 'AI & Machine Learning',
        bcgLabel: 'AI Readiness & Integration',
        icon: '🤖',
        color: '#10B981',
        maxLevel: 5,
        areas: ['data_foundations', 'ai_processes', 'ai_products', 'ai_governance', 'ai_skills']
    }
};

// BCG-style maturity level descriptions
const MATURITY_LEVELS = {
    1: { label: 'Initial', bcgLabel: 'Ad-hoc', description: 'Fragmented, reactive, no standardization' },
    2: { label: 'Developing', bcgLabel: 'Emerging', description: 'Basic processes, limited integration' },
    3: { label: 'Defined', bcgLabel: 'Standardized', description: 'Documented processes, consistent execution' },
    4: { label: 'Managed', bcgLabel: 'Optimized', description: 'Measured, controlled, data-driven' },
    5: { label: 'Optimizing', bcgLabel: 'Leading', description: 'Continuous improvement, industry benchmark' },
    6: { label: 'Advanced', bcgLabel: 'Transformational', description: 'AI-augmented, predictive capabilities' },
    7: { label: 'World-Class', bcgLabel: 'Visionary', description: 'Autonomous, market-defining innovation' }
};

class BCGReportGenerator {
    constructor() {
        this.reportId = null;
        this.assessmentData = null;
        this.orgContext = null;
    }

    /**
     * Generate complete BCG-style report
     * @param {Object} params - Generation parameters
     * @returns {Promise<Object>} Generated report with all sections
     */
    async generateReport({
        assessmentId,
        projectId,
        organizationId,
        userId,
        options = {}
    }) {
        try {
            this.reportId = uuidv4();
            const generatedAt = new Date().toISOString();

            // 1. Load assessment data
            this.assessmentData = await this._loadAssessmentData(assessmentId, projectId);
            if (!this.assessmentData) {
                throw new Error('Assessment not found');
            }

            // 2. Load organization context
            this.orgContext = await ContextService.getFullContext(projectId, organizationId);

            // 3. Calculate maturity metrics
            const maturityMetrics = this._calculateMaturityMetrics();

            // 4. Generate all report sections
            const sections = {};

            // Executive Summary
            sections[REPORT_SECTIONS.EXECUTIVE_SUMMARY] = await this._generateExecutiveSummary(maturityMetrics);

            // Maturity Overview with Spider Chart data
            sections[REPORT_SECTIONS.MATURITY_OVERVIEW] = this._generateMaturityOverview(maturityMetrics);

            // Axis Deep Dives
            sections[REPORT_SECTIONS.AXIS_DEEP_DIVE] = await this._generateAxisDeepDives(maturityMetrics);

            // Gap Analysis
            sections[REPORT_SECTIONS.GAP_ANALYSIS] = this._generateGapAnalysis(maturityMetrics);

            // Strategic Recommendations
            sections[REPORT_SECTIONS.STRATEGIC_RECOMMENDATIONS] = await this._generateStrategicRecommendations(maturityMetrics);

            // Transformation Roadmap
            sections[REPORT_SECTIONS.TRANSFORMATION_ROADMAP] = this._generateTransformationRoadmap(maturityMetrics);

            // Initiative Portfolio (placeholder for generated initiatives)
            sections[REPORT_SECTIONS.INITIATIVE_PORTFOLIO] = { initiatives: [], summary: null };

            // Appendix
            sections[REPORT_SECTIONS.APPENDIX] = this._generateAppendix();

            // 5. Compile final report
            const report = {
                id: this.reportId,
                assessmentId,
                projectId,
                organizationId,
                generatedAt,
                generatedBy: userId,
                status: 'DRAFT',
                version: 1,
                metadata: {
                    framework: 'DRD',
                    frameworkVersion: '2.0',
                    reportType: 'BCG_STYLE',
                    generationTimestamp: generatedAt,
                    aiModelsUsed: ['gemini-2.0-flash'],
                    contextScore: this.orgContext?.readiness?.score || 0
                },
                organization: {
                    name: this.orgContext?._orgProfile?.name || 'Organization',
                    industry: this.orgContext?.industry || 'Unknown',
                    size: this.orgContext?.companySize || 'Unknown'
                },
                summary: {
                    overallMaturity: maturityMetrics.overallActual,
                    targetMaturity: maturityMetrics.overallTarget,
                    overallGap: maturityMetrics.overallGap,
                    maturityLabel: this._getMaturityLabel(maturityMetrics.overallActual),
                    topStrengths: maturityMetrics.strengths.slice(0, 3),
                    criticalGaps: maturityMetrics.gaps.slice(0, 3)
                },
                sections,
                charts: {
                    spiderChart: this._generateSpiderChartData(maturityMetrics),
                    gapChart: this._generateGapChartData(maturityMetrics),
                    roadmapTimeline: this._generateRoadmapTimeline(maturityMetrics)
                }
            };

            // 6. Save report to database
            await this._saveReport(report);

            return report;
        } catch (error) {
            console.error('[BCGReportGenerator] Error:', error);
            throw error;
        }
    }

    /**
     * Load assessment data from database
     */
    async _loadAssessmentData(assessmentId, projectId) {
        return new Promise((resolve, reject) => {
            const sql = assessmentId
                ? `SELECT * FROM maturity_assessments WHERE id = ?`
                : `SELECT * FROM maturity_assessments WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1`;
            const params = [assessmentId || projectId];

            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                // Parse JSON fields
                try {
                    row.axis_scores = JSON.parse(row.axis_scores || '[]');
                    row.prioritized_gaps = JSON.parse(row.prioritized_gaps || '[]');
                } catch (e) {
                    row.axis_scores = [];
                    row.prioritized_gaps = [];
                }

                resolve(row);
            });
        });
    }

    /**
     * Calculate comprehensive maturity metrics
     */
    _calculateMaturityMetrics() {
        const axisScores = this.assessmentData.axis_scores || [];
        const metrics = {
            axes: {},
            overallActual: 0,
            overallTarget: 0,
            overallGap: 0,
            gaps: [],
            strengths: [],
            quickWins: [],
            strategicPriorities: []
        };

        let totalActual = 0;
        let totalTarget = 0;
        let axisCount = 0;

        // Process each axis
        Object.keys(DRD_AXES_CONFIG).forEach(axisKey => {
            const axisConfig = DRD_AXES_CONFIG[axisKey];
            const axisData = axisScores.find(a => a.axis === axisKey) || {};

            const actual = axisData.asIs || axisData.actual || 0;
            const target = axisData.toBe || axisData.target || 0;
            const gap = Math.max(0, target - actual);
            const maxLevel = axisConfig.maxLevel;

            // Normalize to percentage for comparison
            const actualPercent = (actual / maxLevel) * 100;
            const targetPercent = (target / maxLevel) * 100;

            metrics.axes[axisKey] = {
                ...axisConfig,
                actual,
                target,
                gap,
                maxLevel,
                actualPercent: Math.round(actualPercent),
                targetPercent: Math.round(targetPercent),
                gapPercent: Math.round(targetPercent - actualPercent),
                maturityLabel: this._getMaturityLabel(actual),
                status: this._getAxisStatus(actual, target, maxLevel),
                areaScores: axisData.areaScores || {}
            };

            if (actual > 0 || target > 0) {
                totalActual += actualPercent;
                totalTarget += targetPercent;
                axisCount++;
            }

            // Identify gaps
            if (gap > 0) {
                const priority = this._calculateGapPriority(axisKey, gap, actual, target, maxLevel);
                metrics.gaps.push({
                    axis: axisKey,
                    axisName: axisConfig.name,
                    bcgLabel: axisConfig.bcgLabel,
                    actual,
                    target,
                    gap,
                    gapPercent: Math.round((gap / maxLevel) * 100),
                    priority,
                    isQuickWin: gap <= 2 && actual >= 2,
                    isStrategic: gap >= 3 || target >= maxLevel - 1
                });

                if (gap <= 2 && actual >= 2) {
                    metrics.quickWins.push(axisKey);
                }
                if (gap >= 3 || target >= maxLevel - 1) {
                    metrics.strategicPriorities.push(axisKey);
                }
            }

            // Identify strengths
            if (actualPercent >= 60) {
                metrics.strengths.push({
                    axis: axisKey,
                    axisName: axisConfig.name,
                    bcgLabel: axisConfig.bcgLabel,
                    actual,
                    actualPercent: Math.round(actualPercent),
                    maturityLabel: this._getMaturityLabel(actual)
                });
            }
        });

        // Calculate overall metrics
        metrics.overallActual = axisCount > 0 ? Math.round(totalActual / axisCount) : 0;
        metrics.overallTarget = axisCount > 0 ? Math.round(totalTarget / axisCount) : 0;
        metrics.overallGap = metrics.overallTarget - metrics.overallActual;

        // Sort gaps by priority
        metrics.gaps.sort((a, b) => b.priority - a.priority);

        // Sort strengths by actual score
        metrics.strengths.sort((a, b) => b.actualPercent - a.actualPercent);

        return metrics;
    }

    /**
     * Get maturity label based on level
     */
    _getMaturityLabel(level) {
        const rounded = Math.round(level);
        return MATURITY_LEVELS[rounded]?.bcgLabel || MATURITY_LEVELS[1].bcgLabel;
    }

    /**
     * Get axis status (red/yellow/green)
     */
    _getAxisStatus(actual, target, maxLevel) {
        const gap = target - actual;
        const gapPercent = (gap / maxLevel) * 100;

        if (gap <= 0) return 'green';
        if (gapPercent <= 20) return 'yellow';
        return 'red';
    }

    /**
     * Calculate gap priority score
     */
    _calculateGapPriority(axisKey, gap, actual, target, maxLevel) {
        let priority = 0;

        // Base priority from gap size (0-40 points)
        priority += (gap / maxLevel) * 40;

        // Strategic importance boost (0-30 points)
        const strategicAxes = ['processes', 'dataManagement', 'aiMaturity'];
        if (strategicAxes.includes(axisKey)) {
            priority += 30;
        }

        // Target ambition boost (0-20 points)
        if (target >= maxLevel - 1) {
            priority += 20;
        }

        // Quick win penalty (reduce priority for easy wins)
        if (gap <= 2 && actual >= 2) {
            priority -= 10;
        }

        return Math.round(Math.max(0, Math.min(100, priority)));
    }

    /**
     * Generate Executive Summary using AI
     */
    async _generateExecutiveSummary(metrics) {
        const context = this._buildAIContext(metrics);

        const prompt = `As a BCG/McKinsey senior consultant, write an executive summary for this digital maturity assessment report.

ORGANIZATION CONTEXT:
${context}

ASSESSMENT RESULTS:
- Overall Maturity: ${metrics.overallActual}% (${this._getMaturityLabel(metrics.overallActual * 7 / 100)})
- Target Maturity: ${metrics.overallTarget}%
- Gap to Target: ${metrics.overallGap} percentage points

TOP STRENGTHS:
${metrics.strengths.slice(0, 3).map(s => `- ${s.bcgLabel}: ${s.actualPercent}%`).join('\n')}

CRITICAL GAPS:
${metrics.gaps.slice(0, 3).map(g => `- ${g.bcgLabel}: Gap ${g.gapPercent}% (from ${g.actual} to ${g.target})`).join('\n')}

Write a concise, impactful executive summary (300-400 words) that includes:
1. Overall assessment verdict
2. Key findings (2-3 bullet points)
3. Strategic implications
4. Recommended immediate actions

Use professional consulting language. Be direct about challenges but constructive.
Format the response as JSON with fields: verdict, keyFindings (array), strategicImplications, immediateActions (array).`;

        try {
            const response = await AiService.generateStructuredContent(prompt, 'assessment_report');
            return {
                type: 'executive_summary',
                generated: true,
                ...JSON.parse(response)
            };
        } catch (error) {
            console.error('[BCGReportGenerator] Executive summary generation failed:', error);
            return this._generateFallbackExecutiveSummary(metrics);
        }
    }

    /**
     * Generate fallback executive summary (deterministic)
     */
    _generateFallbackExecutiveSummary(metrics) {
        const maturityLabel = this._getMaturityLabel(metrics.overallActual * 7 / 100);

        return {
            type: 'executive_summary',
            generated: false,
            verdict: `The organization demonstrates ${maturityLabel} digital maturity at ${metrics.overallActual}%, with a ${metrics.overallGap} percentage point gap to target state.`,
            keyFindings: [
                metrics.strengths.length > 0
                    ? `Strengths identified in ${metrics.strengths.slice(0, 2).map(s => s.bcgLabel).join(' and ')}`
                    : 'No significant digital strengths identified - foundational work required',
                metrics.gaps.length > 0
                    ? `Critical gaps in ${metrics.gaps.slice(0, 2).map(g => g.bcgLabel).join(' and ')} require immediate attention`
                    : 'Gap analysis indicates alignment between current and target state',
                metrics.quickWins.length > 0
                    ? `${metrics.quickWins.length} quick-win opportunities identified for rapid value creation`
                    : 'Strategic transformation required - no quick wins available'
            ],
            strategicImplications: `Digital transformation investment of ${metrics.overallGap > 30 ? 'significant' : 'moderate'} scope is required to achieve target maturity. Focus areas should prioritize ${metrics.strategicPriorities.slice(0, 2).map(p => DRD_AXES_CONFIG[p]?.bcgLabel).join(' and ')}.`,
            immediateActions: [
                'Establish digital transformation governance',
                metrics.gaps[0] ? `Address ${metrics.gaps[0].bcgLabel} gap as top priority` : 'Maintain current trajectory',
                'Define 90-day quick-win roadmap'
            ]
        };
    }

    /**
     * Build AI context string from organization data
     */
    _buildAIContext(metrics) {
        const parts = [];

        if (this.orgContext?.industry) {
            parts.push(`Industry: ${this.orgContext.industry}`);
        }
        if (this.orgContext?.companySize) {
            parts.push(`Company Size: ${this.orgContext.companySize}`);
        }
        if (this.orgContext?.strategicGoals) {
            const goals = Array.isArray(this.orgContext.strategicGoals)
                ? this.orgContext.strategicGoals.join(', ')
                : this.orgContext.strategicGoals;
            parts.push(`Strategic Goals: ${goals}`);
        }
        if (this.orgContext?.challenges) {
            const challenges = Array.isArray(this.orgContext.challenges)
                ? this.orgContext.challenges.join(', ')
                : this.orgContext.challenges;
            parts.push(`Key Challenges: ${challenges}`);
        }

        return parts.length > 0 ? parts.join('\n') : 'No organization context available';
    }

    /**
     * Generate Maturity Overview section
     */
    _generateMaturityOverview(metrics) {
        return {
            type: 'maturity_overview',
            overall: {
                actual: metrics.overallActual,
                target: metrics.overallTarget,
                gap: metrics.overallGap,
                maturityLabel: this._getMaturityLabel(metrics.overallActual * 7 / 100)
            },
            axes: Object.entries(metrics.axes).map(([key, axis]) => ({
                id: key,
                name: axis.name,
                bcgLabel: axis.bcgLabel,
                icon: axis.icon,
                color: axis.color,
                actual: axis.actual,
                target: axis.target,
                gap: axis.gap,
                maxLevel: axis.maxLevel,
                actualPercent: axis.actualPercent,
                targetPercent: axis.targetPercent,
                maturityLabel: axis.maturityLabel,
                status: axis.status
            })),
            summary: {
                axesAssessed: Object.keys(metrics.axes).length,
                axesOnTrack: Object.values(metrics.axes).filter(a => a.status === 'green').length,
                axesAtRisk: Object.values(metrics.axes).filter(a => a.status === 'yellow').length,
                axesCritical: Object.values(metrics.axes).filter(a => a.status === 'red').length
            }
        };
    }

    /**
     * Generate Axis Deep Dives
     */
    async _generateAxisDeepDives(metrics) {
        const deepDives = [];

        for (const [axisKey, axisMetrics] of Object.entries(metrics.axes)) {
            const deepDive = {
                axis: axisKey,
                name: axisMetrics.name,
                bcgLabel: axisMetrics.bcgLabel,
                scores: {
                    actual: axisMetrics.actual,
                    target: axisMetrics.target,
                    gap: axisMetrics.gap,
                    maxLevel: axisMetrics.maxLevel
                },
                maturityLabel: axisMetrics.maturityLabel,
                status: axisMetrics.status,
                areaScores: axisMetrics.areaScores,
                keyFindings: this._generateAxisFindings(axisKey, axisMetrics),
                recommendations: this._generateAxisRecommendations(axisKey, axisMetrics)
            };

            deepDives.push(deepDive);
        }

        return deepDives;
    }

    /**
     * Generate findings for specific axis
     */
    _generateAxisFindings(axisKey, axisMetrics) {
        const findings = [];

        if (axisMetrics.actual >= axisMetrics.maxLevel * 0.6) {
            findings.push({
                type: 'strength',
                message: `${axisMetrics.bcgLabel} demonstrates strong maturity at level ${axisMetrics.actual}/${axisMetrics.maxLevel}`
            });
        }

        if (axisMetrics.gap > 0) {
            findings.push({
                type: 'gap',
                message: `Gap of ${axisMetrics.gap} levels to reach target state (${axisMetrics.target})`
            });
        }

        if (axisMetrics.gap > axisMetrics.maxLevel * 0.4) {
            findings.push({
                type: 'critical',
                message: `Significant investment required - gap exceeds 40% of maximum maturity`
            });
        }

        return findings;
    }

    /**
     * Generate recommendations for specific axis
     */
    _generateAxisRecommendations(axisKey, axisMetrics) {
        const recommendations = [];
        const config = DRD_AXES_CONFIG[axisKey];

        if (axisMetrics.gap <= 0) {
            recommendations.push({
                priority: 'LOW',
                action: 'Maintain current practices and focus on continuous improvement'
            });
        } else if (axisMetrics.gap <= 2) {
            recommendations.push({
                priority: 'MEDIUM',
                action: `Implement incremental improvements in ${config.bcgLabel} to close ${axisMetrics.gap}-level gap`
            });
        } else {
            recommendations.push({
                priority: 'HIGH',
                action: `Launch strategic transformation program for ${config.bcgLabel}`
            });
        }

        return recommendations;
    }

    /**
     * Generate Gap Analysis section
     */
    _generateGapAnalysis(metrics) {
        return {
            type: 'gap_analysis',
            totalGaps: metrics.gaps.length,
            criticalGaps: metrics.gaps.filter(g => g.priority >= 70).length,
            quickWins: metrics.quickWins.length,
            gaps: metrics.gaps.map((gap, index) => ({
                rank: index + 1,
                ...gap,
                recommendedAction: gap.isQuickWin
                    ? 'Quick Win - Implement within 90 days'
                    : gap.isStrategic
                        ? 'Strategic Priority - 6-12 month initiative'
                        : 'Standard Improvement - Include in annual roadmap'
            })),
            heatmap: this._generateGapHeatmap(metrics)
        };
    }

    /**
     * Generate gap heatmap data
     */
    _generateGapHeatmap(metrics) {
        return Object.entries(metrics.axes).map(([key, axis]) => ({
            axis: key,
            name: axis.bcgLabel,
            actual: axis.actualPercent,
            target: axis.targetPercent,
            gap: axis.gapPercent,
            color: axis.status === 'green' ? '#10B981' : axis.status === 'yellow' ? '#F59E0B' : '#EF4444'
        }));
    }

    /**
     * Generate Strategic Recommendations using AI
     */
    async _generateStrategicRecommendations(metrics) {
        // For now, generate deterministic recommendations
        // AI enhancement can be added later
        const recommendations = [];

        // Critical gaps recommendations
        metrics.gaps.slice(0, 3).forEach((gap, index) => {
            recommendations.push({
                id: `rec-${index + 1}`,
                priority: gap.priority >= 70 ? 'CRITICAL' : gap.priority >= 50 ? 'HIGH' : 'MEDIUM',
                category: gap.bcgLabel,
                title: `Close ${gap.bcgLabel} Gap`,
                description: `Implement transformation program to move from Level ${gap.actual} to Level ${gap.target}`,
                expectedOutcome: `${gap.gapPercent}% improvement in ${gap.bcgLabel} maturity`,
                timeframe: gap.isQuickWin ? '90 days' : gap.isStrategic ? '12-18 months' : '6-12 months',
                effort: gap.gap <= 2 ? 'LOW' : gap.gap <= 4 ? 'MEDIUM' : 'HIGH',
                dependencies: []
            });
        });

        // Quick wins
        if (metrics.quickWins.length > 0) {
            recommendations.push({
                id: 'rec-quickwins',
                priority: 'HIGH',
                category: 'Quick Wins',
                title: 'Execute Quick Win Program',
                description: `Capitalize on ${metrics.quickWins.length} identified quick-win opportunities across ${metrics.quickWins.map(qw => DRD_AXES_CONFIG[qw]?.bcgLabel).join(', ')}`,
                expectedOutcome: 'Early value demonstration and momentum building',
                timeframe: '90 days',
                effort: 'LOW',
                dependencies: []
            });
        }

        // Governance recommendation
        recommendations.push({
            id: 'rec-governance',
            priority: 'HIGH',
            category: 'Governance',
            title: 'Establish Digital Transformation Governance',
            description: 'Create cross-functional steering committee with clear KPIs and accountability',
            expectedOutcome: 'Aligned transformation execution and risk management',
            timeframe: '30 days',
            effort: 'MEDIUM',
            dependencies: []
        });

        return {
            type: 'strategic_recommendations',
            count: recommendations.length,
            recommendations,
            priorityMatrix: {
                critical: recommendations.filter(r => r.priority === 'CRITICAL').length,
                high: recommendations.filter(r => r.priority === 'HIGH').length,
                medium: recommendations.filter(r => r.priority === 'MEDIUM').length,
                low: recommendations.filter(r => r.priority === 'LOW').length
            }
        };
    }

    /**
     * Generate Transformation Roadmap
     */
    _generateTransformationRoadmap(metrics) {
        const phases = [];

        // Phase 1: Foundation (0-90 days)
        phases.push({
            id: 'phase-1',
            name: 'Foundation',
            duration: '0-90 days',
            focus: 'Quick wins and governance setup',
            objectives: [
                'Establish transformation governance',
                'Execute quick-win initiatives',
                'Build baseline metrics'
            ],
            expectedOutcome: `${metrics.quickWins.length * 5}% maturity improvement`,
            keyMilestones: [
                { week: 2, milestone: 'Steering committee formed' },
                { week: 4, milestone: 'Quick wins identified and prioritized' },
                { week: 12, milestone: 'Phase 1 value realized' }
            ]
        });

        // Phase 2: Acceleration (90-180 days)
        phases.push({
            id: 'phase-2',
            name: 'Acceleration',
            duration: '90-180 days',
            focus: 'Address critical gaps',
            objectives: [
                'Launch strategic transformation programs',
                'Build digital capabilities',
                'Implement change management'
            ],
            expectedOutcome: `${Math.round(metrics.overallGap * 0.4)}% gap closure`,
            keyMilestones: [
                { week: 16, milestone: 'Strategic programs launched' },
                { week: 20, milestone: 'Capability building complete' },
                { week: 26, milestone: 'Phase 2 targets achieved' }
            ]
        });

        // Phase 3: Scale (180-365 days)
        phases.push({
            id: 'phase-3',
            name: 'Scale',
            duration: '180-365 days',
            focus: 'Enterprise-wide transformation',
            objectives: [
                'Scale successful pilots',
                'Achieve target maturity',
                'Embed continuous improvement'
            ],
            expectedOutcome: `Target maturity of ${metrics.overallTarget}% achieved`,
            keyMilestones: [
                { week: 30, milestone: 'Pilot success metrics validated' },
                { week: 40, milestone: 'Enterprise rollout complete' },
                { week: 52, milestone: 'Target state achieved' }
            ]
        });

        return {
            type: 'transformation_roadmap',
            totalDuration: '12 months',
            phases,
            criticalPath: metrics.strategicPriorities.slice(0, 3).map(p => DRD_AXES_CONFIG[p]?.bcgLabel),
            riskFactors: [
                'Resource availability',
                'Change resistance',
                'Technology dependencies'
            ]
        };
    }

    /**
     * Generate Appendix
     */
    _generateAppendix() {
        return {
            type: 'appendix',
            methodology: {
                framework: 'Digital Readiness Diagnosis (DRD)',
                version: '2.0',
                basedOn: 'Digital Pathfinder by Dr. Piotr Wisniewski',
                axes: Object.keys(DRD_AXES_CONFIG).length,
                totalAreas: Object.values(DRD_AXES_CONFIG).reduce((sum, cfg) => sum + cfg.areas.length, 0)
            },
            glossary: [
                { term: 'Maturity Level', definition: 'Standardized measure of digital capability on a scale of 1-7 (processes) or 1-5 (other axes)' },
                { term: 'Gap', definition: 'Difference between current (Actual) and desired (Target) maturity level' },
                { term: 'Quick Win', definition: 'Improvement opportunity with low effort (gap ≤2) and immediate impact' }
            ],
            dataTimestamp: new Date().toISOString(),
            assessmentId: this.assessmentData?.id
        };
    }

    /**
     * Generate Spider Chart data
     */
    _generateSpiderChartData(metrics) {
        return {
            labels: Object.values(metrics.axes).map(a => a.bcgLabel),
            datasets: [
                {
                    label: 'Current State',
                    data: Object.values(metrics.axes).map(a => a.actualPercent),
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderColor: '#6366F1',
                    borderWidth: 2
                },
                {
                    label: 'Target State',
                    data: Object.values(metrics.axes).map(a => a.targetPercent),
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: '#10B981',
                    borderWidth: 2,
                    borderDash: [5, 5]
                }
            ]
        };
    }

    /**
     * Generate Gap Chart data
     */
    _generateGapChartData(metrics) {
        return {
            labels: Object.values(metrics.axes).map(a => a.bcgLabel),
            datasets: [
                {
                    label: 'Current',
                    data: Object.values(metrics.axes).map(a => a.actual),
                    backgroundColor: '#6366F1'
                },
                {
                    label: 'Gap',
                    data: Object.values(metrics.axes).map(a => a.gap),
                    backgroundColor: '#EF4444'
                }
            ]
        };
    }

    /**
     * Generate Roadmap Timeline data
     */
    _generateRoadmapTimeline(metrics) {
        return {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            phases: [
                { name: 'Foundation', start: 0, end: 90, color: '#6366F1' },
                { name: 'Acceleration', start: 90, end: 180, color: '#8B5CF6' },
                { name: 'Scale', start: 180, end: 365, color: '#10B981' }
            ]
        };
    }

    /**
     * Save report to database
     */
    async _saveReport(report) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO assessment_reports (
                    id, project_id, organization_id, title, report_status,
                    assessment_snapshot, generated_at, created_by, report_data
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                report.id,
                report.projectId,
                report.organizationId,
                `BCG-Style Report - ${new Date().toLocaleDateString()}`,
                'DRAFT',
                JSON.stringify({
                    assessmentId: report.assessmentId,
                    summary: report.summary,
                    metadata: report.metadata
                }),
                report.generatedAt,
                report.generatedBy,
                JSON.stringify(report)
            ];

            db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ id: report.id });
            });
        });
    }
}

// Export singleton instance
module.exports = new BCGReportGenerator();
module.exports.REPORT_SECTIONS = REPORT_SECTIONS;
module.exports.DRD_AXES_CONFIG = DRD_AXES_CONFIG;
module.exports.MATURITY_LEVELS = MATURITY_LEVELS;






