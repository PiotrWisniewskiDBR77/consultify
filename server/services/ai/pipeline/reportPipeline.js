/**
 * Report Pipeline
 * 
 * Orchestrates multi-agent pipeline for enterprise report generation.
 * Coordinates analyst, strategist, validator, and reporter agents.
 * 
 * Part of the Enterprise AI Consulting System.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../../database');
const { getAgentsInOrder, getAgentPrompt, validateAgentOutput, getAgent } = require('./reportAgents');
const IndustryIntelligenceService = require('../intelligence/industryIntelligenceService');
const BenchmarkDataService = require('../intelligence/benchmarkDataService');
const FrameworkEngine = require('../frameworks/frameworkEngine');
const StrategicRecommendationService = require('../frameworks/strategicRecommendationService');

// Lazy-load AI service
let AIService = null;
function getAIService() {
    if (!AIService) {
        try {
            AIService = require('../../aiService');
        } catch (e) {
            console.warn('[ReportPipeline] AIService not available:', e.message);
        }
    }
    return AIService;
}

// Pipeline statuses
const PIPELINE_STATUS = {
    PENDING: 'PENDING',
    GATHERING_CONTEXT: 'GATHERING_CONTEXT',
    ANALYST_WORKING: 'ANALYST_WORKING',
    STRATEGIST_WORKING: 'STRATEGIST_WORKING',
    VALIDATOR_WORKING: 'VALIDATOR_WORKING',
    REPORTER_WORKING: 'REPORTER_WORKING',
    ASSEMBLING: 'ASSEMBLING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
};

class ReportPipeline {
    
    /**
     * Generate enterprise report with multi-agent pipeline
     * @param {Object} assessment - Assessment data
     * @param {Object} orgProfile - Organization profile
     * @param {Object} options - Generation options
     * @yields {Object} Progress updates
     * @returns {Promise<EnterpriseReport>}
     */
    static async *generateReport(assessment, orgProfile, options = {}) {
        const generationId = uuidv4();
        const startTime = Date.now();
        
        // Initialize generation record
        await this.initializeGeneration(generationId, assessment.report_id || assessment.id, orgProfile?.organization_id);
        
        try {
            // Phase 1: Gather Context
            yield { phase: 'GATHERING_CONTEXT', progress: 5, message: 'Gathering industry intelligence...' };
            await this.updateGenerationStatus(generationId, PIPELINE_STATUS.GATHERING_CONTEXT, 5);
            
            const context = await this.gatherContext(assessment, orgProfile, options);
            yield { phase: 'GATHERING_CONTEXT', progress: 15, message: 'Context gathered successfully' };
            
            // Phase 2: Run Analyst Agent
            yield { phase: 'ANALYST_WORKING', progress: 20, message: 'Analyst analyzing data...' };
            await this.updateGenerationStatus(generationId, PIPELINE_STATUS.ANALYST_WORKING, 20, 'ANALYST');
            
            const analystOutput = await this.runAgent('ANALYST', context, assessment, orgProfile);
            await this.storeAgentOutput(generationId, 'analyst_output', analystOutput);
            yield { phase: 'ANALYST_WORKING', progress: 35, message: 'Analysis complete' };
            
            // Phase 3: Run Strategist Agent
            yield { phase: 'STRATEGIST_WORKING', progress: 40, message: 'Strategist developing recommendations...' };
            await this.updateGenerationStatus(generationId, PIPELINE_STATUS.STRATEGIST_WORKING, 40, 'STRATEGIST');
            
            const strategistOutput = await this.runAgent('STRATEGIST', { ...context, analystOutput }, assessment, orgProfile);
            await this.storeAgentOutput(generationId, 'strategist_output', strategistOutput);
            yield { phase: 'STRATEGIST_WORKING', progress: 55, message: 'Strategy developed' };
            
            // Phase 4: Run Validator Agent
            yield { phase: 'VALIDATOR_WORKING', progress: 60, message: 'Validator reviewing quality...' };
            await this.updateGenerationStatus(generationId, PIPELINE_STATUS.VALIDATOR_WORKING, 60, 'VALIDATOR');
            
            const validatorOutput = await this.runAgent('VALIDATOR', { ...context, analystOutput, strategistOutput }, assessment, orgProfile);
            await this.storeAgentOutput(generationId, 'validator_output', validatorOutput);
            yield { phase: 'VALIDATOR_WORKING', progress: 75, message: 'Validation complete' };
            
            // Phase 5: Run Reporter Agent
            yield { phase: 'REPORTER_WORKING', progress: 80, message: 'Reporter assembling report...' };
            await this.updateGenerationStatus(generationId, PIPELINE_STATUS.REPORTER_WORKING, 80, 'REPORTER');
            
            const reporterOutput = await this.runAgent('REPORTER', { ...context, analystOutput, strategistOutput, validatorOutput }, assessment, orgProfile);
            await this.storeAgentOutput(generationId, 'reporter_output', reporterOutput);
            yield { phase: 'REPORTER_WORKING', progress: 90, message: 'Report drafted' };
            
            // Phase 6: Assemble Final Report
            yield { phase: 'ASSEMBLING', progress: 95, message: 'Assembling final report...' };
            await this.updateGenerationStatus(generationId, PIPELINE_STATUS.ASSEMBLING, 95);
            
            const finalReport = await this.assembleReport({
                analystOutput,
                strategistOutput,
                validatorOutput,
                reporterOutput,
                context
            }, assessment, orgProfile);
            
            // Complete
            const duration = Date.now() - startTime;
            await this.completeGeneration(generationId, finalReport, duration);
            
            yield { phase: 'COMPLETED', progress: 100, message: 'Report generation complete' };
            
            return {
                generationId,
                report: finalReport,
                pipelineMetadata: {
                    duration,
                    agentsUsed: ['ANALYST', 'STRATEGIST', 'VALIDATOR', 'REPORTER'],
                    validationScore: validatorOutput.validationScore || 80,
                    confidence: finalReport.confidence
                }
            };
            
        } catch (error) {
            console.error('[ReportPipeline] Generation failed:', error);
            await this.failGeneration(generationId, error.message);
            yield { phase: 'FAILED', progress: 0, message: error.message, error: true };
            throw error;
        }
    }
    
    /**
     * Gather all context needed for report generation
     */
    static async gatherContext(assessment, orgProfile, options) {
        const industry = orgProfile?.industry || 'Technology';
        const companySize = orgProfile?.company_size || 'MID_MARKET';
        
        // Fetch intelligence in parallel
        const [industryContext, benchmarks, frameworkAnalyses] = await Promise.all([
            IndustryIntelligenceService.getIndustryContext(industry, orgProfile?.industry_subsector),
            BenchmarkDataService.compareWithBenchmarks(assessment.scores || {}, industry, companySize),
            FrameworkEngine.applyFrameworks(assessment, orgProfile)
        ]);
        
        // Generate strategic recommendations
        const strategicRecommendations = await StrategicRecommendationService.generateRecommendations(
            assessment, orgProfile, frameworkAnalyses, industryContext
        );
        
        return {
            industry,
            companySize,
            industryContext,
            benchmarks,
            frameworkAnalyses,
            strategicRecommendations,
            assessmentScores: assessment.scores || {},
            assessmentGaps: assessment.gaps || [],
            organizationProfile: orgProfile,
            options
        };
    }
    
    /**
     * Run a single agent in the pipeline
     */
    static async runAgent(agentName, context, assessment, orgProfile) {
        const agent = getAgent(agentName);
        if (!agent) {
            throw new Error(`Unknown agent: ${agentName}`);
        }
        
        const aiService = getAIService();
        
        // Build agent prompt with context
        const systemPrompt = getAgentPrompt(agentName, {
            industry: orgProfile?.industry,
            companySize: orgProfile?.company_size,
            previousAgentOutput: context.analystOutput || context.strategistOutput || null
        });
        
        // Build user prompt based on agent role
        const userPrompt = this.buildAgentUserPrompt(agentName, context, assessment, orgProfile);
        
        try {
            if (aiService) {
                // Use AI service
                const result = await aiService.generateStructuredContent(
                    userPrompt,
                    `report_${agentName.toLowerCase()}`,
                    { systemPrompt }
                );
                
                // Validate output
                const validation = validateAgentOutput(agentName, result);
                if (!validation.valid) {
                    console.warn(`[ReportPipeline] ${agentName} output validation issues:`, validation.issues);
                }
                
                return result;
            } else {
                // Fallback to static generation
                return this.generateStaticAgentOutput(agentName, context, assessment, orgProfile);
            }
        } catch (error) {
            console.error(`[ReportPipeline] ${agentName} failed:`, error.message);
            return this.generateStaticAgentOutput(agentName, context, assessment, orgProfile);
        }
    }
    
    /**
     * Build user prompt for specific agent
     */
    static buildAgentUserPrompt(agentName, context, assessment, orgProfile) {
        const baseContext = `
Organization: ${orgProfile?.industry || 'Unknown'} industry, ${orgProfile?.company_size || 'Mid-market'} company
Competitive Position: ${orgProfile?.competitive_position || 'Unknown'}
Current Digital Maturity: ${assessment.overall_score?.toFixed(1) || 'N/A'}/7
Assessment Dimensions: ${Object.keys(assessment.scores || {}).length}
Identified Gaps: ${(assessment.gaps || []).length}
`;
        
        switch (agentName) {
            case 'ANALYST':
                return `${baseContext}

Assessment Scores:
${Object.entries(assessment.scores || {}).map(([k, v]) => `- ${k}: ${v}/7`).join('\n')}

Industry Benchmarks:
${JSON.stringify(context.benchmarks?.summary || {}, null, 2)}

Gap Analysis:
${(assessment.gaps || []).slice(0, 5).map(g => `- ${g.axisName || g.axisId}: Gap of ${g.gap} (Current: ${g.currentScore}, Target: ${g.targetScore})`).join('\n')}

Industry Trends:
${(context.industryContext?.trends?.items || []).slice(0, 3).map(t => `- ${t.trend}`).join('\n')}

Analyze this data and provide your findings following the output schema.`;

            case 'STRATEGIST':
                return `${baseContext}

Analyst Findings:
${JSON.stringify(context.analystOutput?.keyFindings?.slice(0, 3) || [], null, 2)}

Framework Analyses Applied:
${context.frameworkAnalyses?.appliedFrameworks?.join(', ') || 'None'}

Framework Insights:
${JSON.stringify(context.frameworkAnalyses?.synthesis?.keyInsights?.slice(0, 3) || [], null, 2)}

Strategic Recommendations Generated:
${context.strategicRecommendations?.recommendations?.slice(0, 5).map(r => `- ${r.title} (${r.impact} impact)`).join('\n') || 'None'}

Organization Strategic Priorities:
${(orgProfile?.strategic_priorities || []).join(', ') || 'Not defined'}

Develop strategic recommendations and roadmap following the output schema.`;

            case 'VALIDATOR':
                return `${baseContext}

Analyst Output Summary:
- Key Findings: ${context.analystOutput?.keyFindings?.length || 0}
- Critical Gaps: ${context.analystOutput?.gapAnalysis?.criticalGaps?.length || 0}
- Benchmark Position: ${context.analystOutput?.benchmarkComparison?.overallPosition || 'Unknown'}

Strategist Output Summary:
- Recommendations: ${context.strategistOutput?.recommendations?.length || 0}
- Roadmap Phases: ${Object.keys(context.strategistOutput?.roadmap || {}).length || 0}
- Success Metrics: ${context.strategistOutput?.successMetrics?.length || 0}

Validate the analysis and recommendations following the output schema.`;

            case 'REPORTER':
                return `${baseContext}

Analyst Key Findings:
${(context.analystOutput?.keyFindings || []).slice(0, 3).map(f => `- ${f.finding}`).join('\n')}

Strategist Top Recommendations:
${(context.strategistOutput?.recommendations || []).slice(0, 3).map(r => `- ${r.title}: ${r.description?.slice(0, 100)}`).join('\n')}

Validator Assessment:
- Validation Score: ${context.validatorOutput?.validationScore || 'N/A'}
- Status: ${context.validatorOutput?.validationLevel || 'N/A'}

Transform this into a compelling executive report following the output schema.`;

            default:
                return baseContext;
        }
    }
    
    /**
     * Generate static agent output when AI unavailable
     */
    static generateStaticAgentOutput(agentName, context, assessment, orgProfile) {
        const scores = assessment.scores || {};
        const gaps = assessment.gaps || [];
        
        switch (agentName) {
            case 'ANALYST':
                return {
                    keyFindings: gaps.slice(0, 5).map(g => ({
                        finding: `${g.axisName || g.axisId} shows a gap of ${g.gap} points`,
                        evidence: `Current: ${g.currentScore}, Target: ${g.targetScore}`,
                        significance: g.gap >= 3 ? 'HIGH' : g.gap >= 2 ? 'MEDIUM' : 'LOW',
                        confidence: 0.8
                    })),
                    gapAnalysis: {
                        criticalGaps: gaps.filter(g => g.gap >= 3).map(g => g.axisName || g.axisId),
                        gapDrivers: ['Digital capability deficit', 'Legacy system constraints'],
                        correlations: ['Process and data maturity correlation detected']
                    },
                    benchmarkComparison: context.benchmarks?.summary || {
                        overallPosition: 'BELOW_MEDIAN',
                        percentile: 45,
                        strengthAreas: [],
                        weaknessAreas: gaps.slice(0, 2).map(g => g.axisName || g.axisId)
                    },
                    dataQualityNotes: ['Analysis based on self-assessment data']
                };
                
            case 'STRATEGIST':
                return {
                    strategicAssessment: {
                        currentPositioning: `Current digital maturity at ${assessment.overall_score?.toFixed(1) || '4.0'}/7`,
                        targetState: 'Industry-leading digital capabilities (6.0/7)',
                        transformationGap: 'Moderate transformation required over 18-24 months'
                    },
                    recommendations: (context.strategicRecommendations?.recommendations || []).slice(0, 5).map(r => ({
                        title: r.title,
                        description: r.description,
                        rationale: 'Addresses identified maturity gap',
                        impact: r.impact || 'MEDIUM',
                        effort: r.effort || 'MEDIUM',
                        investmentThesis: r.investmentThesis?.valueDriver || 'Value creation through digital excellence',
                        estimatedBudget: r.investmentThesis?.estimatedBudget || 500000,
                        expectedROI: '20-40%',
                        timeframe: '6-12 months',
                        keyRisks: ['Execution risk', 'Change management']
                    })),
                    roadmap: context.strategicRecommendations?.roadmap || {
                        phase1: { name: 'Foundation', duration: '0-6 months', initiatives: [] },
                        phase2: { name: 'Build', duration: '6-12 months', initiatives: [] },
                        phase3: { name: 'Scale', duration: '12-24 months', initiatives: [] }
                    },
                    successMetrics: [
                        { metric: 'Digital Maturity Score', baseline: `${assessment.overall_score?.toFixed(1) || '4.0'}`, target: '5.5', timeframe: '18 months' }
                    ]
                };
                
            case 'VALIDATOR':
                return {
                    validationScore: 75,
                    validationLevel: 'APPROVED_WITH_CAVEATS',
                    logicValidation: {
                        score: 80,
                        issues: ['Some recommendations may require further feasibility analysis'],
                        strengths: ['Clear alignment between gaps and recommendations']
                    },
                    feasibilityAssessment: {
                        budgetRealism: 'REALISTIC',
                        timelineRealism: 'REALISTIC',
                        capabilityFit: 'MEDIUM',
                        concerns: ['Change management capacity needs assessment']
                    },
                    riskAssessment: {
                        overallRiskLevel: 'MEDIUM',
                        keyRisks: [
                            { risk: 'Execution complexity', likelihood: 'MEDIUM', impact: 'HIGH', mitigation: 'Phased approach with gates' },
                            { risk: 'Resource constraints', likelihood: 'MEDIUM', impact: 'MEDIUM', mitigation: 'Prioritized portfolio management' }
                        ]
                    },
                    recommendations: ['Consider pilot programs for highest-risk initiatives']
                };
                
            case 'REPORTER':
                const topRecs = context.strategistOutput?.recommendations?.slice(0, 3) || [];
                return {
                    executiveSummary: {
                        headline: `Digital Transformation Roadmap for ${orgProfile?.industry || 'Your Organization'}`,
                        keyMessage: `Strategic investment in digital capabilities will close critical maturity gaps and position the organization for competitive advantage.`,
                        topFindings: (context.analystOutput?.keyFindings || []).slice(0, 3).map(f => f.finding),
                        topRecommendations: topRecs.map(r => r.title),
                        callToAction: 'Approve Phase 1 initiatives and establish transformation governance'
                    },
                    reportSections: [
                        {
                            sectionId: 'executive-summary',
                            title: 'Executive Summary',
                            narrative: 'This report presents a comprehensive digital transformation roadmap based on detailed maturity assessment and industry benchmarking.',
                            keyTakeaways: ['Current state assessed', 'Target state defined', 'Roadmap developed'],
                            visualizationType: 'INFOGRAPHIC',
                            visualizationSpec: { type: 'maturity-spider' }
                        },
                        {
                            sectionId: 'current-state',
                            title: 'Current State Assessment',
                            narrative: 'Assessment of digital maturity across key dimensions reveals opportunities for improvement.',
                            keyTakeaways: context.analystOutput?.keyFindings?.slice(0, 2).map(f => f.finding) || [],
                            visualizationType: 'CHART',
                            visualizationSpec: { type: 'bar-chart' }
                        },
                        {
                            sectionId: 'recommendations',
                            title: 'Strategic Recommendations',
                            narrative: 'Prioritized initiatives to close maturity gaps and drive competitive advantage.',
                            keyTakeaways: topRecs.map(r => r.title),
                            visualizationType: 'TABLE',
                            visualizationSpec: { type: 'initiative-table' }
                        }
                    ],
                    appendices: [
                        { title: 'Methodology', content: 'Based on DRD Digital Readiness Diagnostic framework' }
                    ],
                    keyMessageCallouts: [
                        'Digital transformation is a strategic imperative',
                        'Phased approach reduces execution risk',
                        'Investment thesis supports 20-40% ROI potential'
                    ],
                    readingTime: 15
                };
                
            default:
                return { note: 'Static output', agentName };
        }
    }
    
    /**
     * Assemble final report from agent outputs
     */
    static async assembleReport(pipelineOutputs, assessment, orgProfile) {
        const { analystOutput, strategistOutput, validatorOutput, reporterOutput, context } = pipelineOutputs;
        
        return {
            id: uuidv4(),
            assessmentId: assessment.id,
            organizationId: orgProfile?.organization_id,
            
            // Executive Summary
            executiveSummary: reporterOutput.executiveSummary,
            
            // Analysis Section
            analysis: {
                keyFindings: analystOutput.keyFindings,
                gapAnalysis: analystOutput.gapAnalysis,
                benchmarkComparison: analystOutput.benchmarkComparison,
                frameworkAnalyses: context.frameworkAnalyses?.analyses
            },
            
            // Strategy Section
            strategy: {
                assessment: strategistOutput.strategicAssessment,
                recommendations: strategistOutput.recommendations,
                roadmap: strategistOutput.roadmap,
                successMetrics: strategistOutput.successMetrics
            },
            
            // Validation
            validation: {
                score: validatorOutput.validationScore,
                level: validatorOutput.validationLevel,
                riskAssessment: validatorOutput.riskAssessment,
                feasibility: validatorOutput.feasibilityAssessment
            },
            
            // Report Content
            sections: reporterOutput.reportSections,
            appendices: reporterOutput.appendices,
            keyMessages: reporterOutput.keyMessageCallouts,
            
            // Metadata
            metadata: {
                generatedAt: new Date().toISOString(),
                industry: context.industry,
                companySize: context.companySize,
                assessmentScore: assessment.overall_score,
                readingTime: reporterOutput.readingTime,
                confidence: this.calculateReportConfidence(analystOutput, validatorOutput, context)
            }
        };
    }
    
    /**
     * Calculate report confidence
     */
    static calculateReportConfidence(analystOutput, validatorOutput, context) {
        let score = 0.5;
        
        if (validatorOutput?.validationScore >= 80) score += 0.2;
        else if (validatorOutput?.validationScore >= 60) score += 0.1;
        
        if (context.industryContext?.confidence === 'HIGH') score += 0.15;
        if (analystOutput?.keyFindings?.length >= 3) score += 0.1;
        
        return score >= 0.8 ? 'HIGH' : score >= 0.5 ? 'MEDIUM' : 'LOW';
    }
    
    // ============================================================================
    // DATABASE OPERATIONS
    // ============================================================================
    
    static async initializeGeneration(generationId, reportId, organizationId) {
        return new Promise((resolve) => {
            db.run(`
                INSERT INTO enterprise_report_generations 
                (id, report_id, organization_id, pipeline_status, progress_percent, started_at)
                VALUES (?, ?, ?, ?, 0, datetime('now'))
            `, [generationId, reportId, organizationId, PIPELINE_STATUS.PENDING], (err) => {
                if (err) console.warn('[ReportPipeline] Init generation error:', err.message);
                resolve();
            });
        });
    }
    
    static async updateGenerationStatus(generationId, status, progress, currentAgent = null) {
        return new Promise((resolve) => {
            db.run(`
                UPDATE enterprise_report_generations 
                SET pipeline_status = ?, progress_percent = ?, current_agent = ?
                WHERE id = ?
            `, [status, progress, currentAgent, generationId], (err) => {
                if (err) console.warn('[ReportPipeline] Update status error:', err.message);
                resolve();
            });
        });
    }
    
    static async storeAgentOutput(generationId, field, output) {
        return new Promise((resolve) => {
            db.run(`
                UPDATE enterprise_report_generations 
                SET ${field} = ?
                WHERE id = ?
            `, [JSON.stringify(output), generationId], (err) => {
                if (err) console.warn('[ReportPipeline] Store output error:', err.message);
                resolve();
            });
        });
    }
    
    static async completeGeneration(generationId, report, duration) {
        return new Promise((resolve) => {
            db.run(`
                UPDATE enterprise_report_generations 
                SET pipeline_status = ?, progress_percent = 100, 
                    completed_at = datetime('now'), duration_ms = ?,
                    overall_confidence = ?
                WHERE id = ?
            `, [PIPELINE_STATUS.COMPLETED, duration, report.metadata?.confidence === 'HIGH' ? 0.9 : 0.7, generationId], (err) => {
                if (err) console.warn('[ReportPipeline] Complete generation error:', err.message);
                resolve();
            });
        });
    }
    
    static async failGeneration(generationId, errorMessage) {
        return new Promise((resolve) => {
            db.run(`
                UPDATE enterprise_report_generations 
                SET pipeline_status = ?, error_message = ?, retry_count = retry_count + 1
                WHERE id = ?
            `, [PIPELINE_STATUS.FAILED, errorMessage, generationId], (err) => {
                if (err) console.warn('[ReportPipeline] Fail generation error:', err.message);
                resolve();
            });
        });
    }
    
    /**
     * Get generation status
     */
    static async getGenerationStatus(generationId) {
        return new Promise((resolve) => {
            db.get(
                'SELECT * FROM enterprise_report_generations WHERE id = ?',
                [generationId],
                (err, row) => resolve(row || null)
            );
        });
    }
}

module.exports = ReportPipeline;

