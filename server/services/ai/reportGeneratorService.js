/**
 * Smart Report Generator Service
 * Multi-Agent Flow: ANALYST → STRATEGIST
 * Uses RAG, Visual Context, and Project Data
 */

import { AIPipeline } from './aiPipeline.js';
import { AnalysisSchema, StrategySchema } from './reportGeneratorSchemas.js';
import { createReportGeneratorPhases } from './reportGeneratorPhases.js';

class ReportGeneratorService {
    constructor() {
        this.pipeline = new AIPipeline();
        this.phases = createReportGeneratorPhases({
            pipeline: this.pipeline,
            AnalysisSchema,
            StrategySchema
        });
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
            const analysis = await this.phases.runAnalystPhase({
                assessmentData,
                projectData,
                screenContext,
                userId,
                organizationId
            });

            // Phase 2: STRATEGIST - Generate executive content
            console.log('[ReportGenerator] Phase 2: STRATEGIST');
            const strategy = await this.phases.runStrategistPhase({
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
        return this.phases.runAnalystPhase(params);
    }

    /**
     * Phase 2: STRATEGIST - Generate executive-level recommendations
     */
    async runStrategistPhase(params) {
        return this.phases.runStrategistPhase(params);
    }

    /**
     * Generate a single section of a report
     */
    async generateSection(params) {
        return this.phases.generateSection(params);
    }
}

// Singleton
const reportGeneratorService = new ReportGeneratorService();

export {
ReportGeneratorService,
    reportGeneratorService,
    AnalysisSchema,
    StrategySchema
};

export default {
    ReportGeneratorService,
    reportGeneratorService,
    AnalysisSchema,
    StrategySchema
};
