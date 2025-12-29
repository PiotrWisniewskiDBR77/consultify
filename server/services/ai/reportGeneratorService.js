/**
 * Smart Report Generator Service
 * Multi-Agent Flow: ANALYST → STRATEGIST
 * Uses RAG, Visual Context, and Project Data
 */

const { AIPipeline } = require('./aiPipeline');
const { z } = require('zod');

// Analysis Phase Schema (ANALYST role)
const AnalysisSchema = z.object({
    executiveSummary: z.object({
        currentState: z.string(),
        targetState: z.string(),
        gapAnalysis: z.string()
    }),
    dimensions: z.array(z.object({
        name: z.string(),
        currentLevel: z.number(),
        targetLevel: z.number(),
        gap: z.number(),
        keyFindings: z.array(z.string())
    })),
    dataQuality: z.object({
        completeness: z.number(),
        concerns: z.array(z.string())
    })
});

// Strategy Phase Schema (STRATEGIST role)
const StrategySchema = z.object({
    executiveSummary: z.string().describe('One-paragraph executive summary for C-level'),
    strategicRecommendations: z.array(z.object({
        priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
        title: z.string(),
        description: z.string(),
        expectedImpact: z.string(),
        timeframe: z.string()
    })),
    roadmap: z.object({
        phase1: z.object({ title: z.string(), initiatives: z.array(z.string()) }),
        phase2: z.object({ title: z.string(), initiatives: z.array(z.string()) }),
        phase3: z.object({ title: z.string(), initiatives: z.array(z.string()) })
    }),
    riskFactors: z.array(z.object({
        risk: z.string(),
        mitigation: z.string()
    }))
});

class ReportGeneratorService {
    constructor() {
        this.pipeline = new AIPipeline();
    }

    /**
     * Generate a complete transformation report
     * @param {Object} params
     * @param {Object} params.assessmentData - User's assessment scores
     * @param {Object} params.projectData - Project context
     * @param {Object} params.screenContext - Current screen state
     * @param {string} params.userId
     * @param {string} params.organizationId
     */
    async generate(params) {
        const {
            assessmentData,
            projectData,
            screenContext,
            userId,
            organizationId
        } = params;

        const startTime = Date.now();

        try {
            // Phase 1: ANALYST - Structure the data
            console.log('[ReportGenerator] Phase 1: ANALYST');
            const analysis = await this.runAnalystPhase({
                assessmentData,
                projectData,
                screenContext,
                userId,
                organizationId
            });

            // Phase 2: STRATEGIST - Generate executive content
            console.log('[ReportGenerator] Phase 2: STRATEGIST');
            const strategy = await this.runStrategistPhase({
                analysis,
                assessmentData,
                projectData,
                userId,
                organizationId
            });

            return {
                success: true,
                report: {
                    generatedAt: new Date().toISOString(),
                    analysis,
                    strategy
                },
                metadata: {
                    phases: 2,
                    totalTime: Date.now() - startTime
                }
            };

        } catch (error) {
            console.error('[ReportGenerator] Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Phase 1: ANALYST - Structure and analyze the assessment data
     */
    async runAnalystPhase(params) {
        const { assessmentData, projectData, screenContext, userId, organizationId } = params;

        const prompt = `Analyze the following digital transformation assessment data.
Your task is to structure the findings and identify gaps.

## Assessment Data
${JSON.stringify(assessmentData, null, 2)}

## Project Context
${projectData ? JSON.stringify(projectData, null, 2) : 'No project context available'}

## Instructions
1. Summarize the current state vs target state
2. Analyze each dimension's gap
3. Identify key findings per dimension
4. Rate data quality and note any concerns

Be precise and data-driven. Use numbers and percentages.`;

        const response = await this.pipeline.process({
            type: 'structured',
            capability: 'analysis',
            role: 'ANALYST',
            schema: AnalysisSchema,
            prompt,
            screenContext,
            userId,
            organizationId,
            enableTools: false
        });

        return response.object || response.content;
    }

    /**
     * Phase 2: STRATEGIST - Generate executive-level recommendations
     */
    async runStrategistPhase(params) {
        const { analysis, assessmentData, projectData, userId, organizationId } = params;

        const prompt = `Based on the following analysis, create an executive-level strategic report.

## Analysis Results
${JSON.stringify(analysis, null, 2)}

## Original Assessment
${JSON.stringify(assessmentData, null, 2)}

## Instructions (McKinsey Pyramid Principle)
1. Start with the answer: One-paragraph executive summary
2. Prioritize recommendations (CRITICAL → HIGH → MEDIUM → LOW)
3. Create a 3-phase roadmap
4. Identify risks and mitigations

Write for a CEO audience. Be decisive and action-oriented.`;

        const response = await this.pipeline.process({
            type: 'structured',
            capability: 'strategic',
            role: 'STRATEGIST',
            schema: StrategySchema,
            prompt,
            userId,
            organizationId,
            enableTools: false
        });

        return response.object || response.content;
    }

    /**
     * Generate a single section of a report
     */
    async generateSection(params) {
        const { sectionType, data, userId, organizationId } = params;

        const sectionPrompts = {
            executive_summary: 'Write a concise executive summary for this transformation assessment.',
            gap_analysis: 'Perform a detailed gap analysis for each dimension.',
            recommendations: 'Generate prioritized recommendations based on the assessment.',
            roadmap: 'Create a phased implementation roadmap.',
            risk_analysis: 'Identify risks and mitigation strategies.'
        };

        const prompt = `${sectionPrompts[sectionType] || 'Generate content for this section.'}

## Data
${JSON.stringify(data, null, 2)}`;

        const response = await this.pipeline.process({
            capability: 'report_section',
            role: 'STRATEGIST',
            prompt,
            userId,
            organizationId
        });

        return {
            section: sectionType,
            content: response.content
        };
    }
}

// Singleton
const reportGeneratorService = new ReportGeneratorService();

module.exports = {
    ReportGeneratorService,
    reportGeneratorService,
    AnalysisSchema,
    StrategySchema
};
