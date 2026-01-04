/**
 * Report Templates Manager
 * 
 * Manages templates for comprehensive DRD report sections.
 * Provides structured definitions for each report section with:
 * - Content structure
 * - Required data fields
 * - Customization options
 * - Prompt templates
 */

import { getDatabase } from '../../src/database/index.js';
const db = getDatabase();
import { aiLogger } from './logger.js';

// Section structure definitions
const SECTION_STRUCTURES = {
    executiveSummary: {
        id: 'executiveSummary',
        order: 1,
        name: 'Executive Summary',
        namePL: 'Podsumowanie Wykonawcze',
        type: 'ai_generated',
        maxLength: 1500,
        structure: {
            openingHook: { required: true, maxLength: 200 },
            keyFindings: { required: true, maxItems: 5 },
            strategicPriorities: { required: true, maxItems: 3 },
            recommendedActions: { required: true, sections: ['immediate', 'quickWins', 'strategic'] },
            investmentOutlook: { required: false }
        },
        dataRequirements: [
            'assessmentScores',
            'gapAnalysis',
            'industryBenchmark',
            'companyProfile'
        ]
    },

    maturityOverview: {
        id: 'maturityOverview',
        order: 2,
        name: 'Maturity Overview',
        namePL: 'Przegląd Dojrzałości',
        type: 'ai_generated',
        maxLength: 1200,
        structure: {
            overallScore: { required: true, visualization: 'gauge' },
            axisScores: { required: true, visualization: 'radar' },
            industryComparison: { required: true, visualization: 'bar' },
            maturityDistribution: { required: false, visualization: 'heatmap' }
        },
        dataRequirements: [
            'assessmentScores',
            'industryBenchmark'
        ]
    },

    axisAnalysis: {
        id: 'axisAnalysis',
        order: 3,
        name: 'Axis Deep-Dive',
        namePL: 'Analiza Szczegółowa Osi',
        type: 'ai_generated_per_axis',
        maxLength: 2000, // Per axis
        axes: [
            'aiMaturity',
            'dataManagement',
            'digitalCulture',
            'technologyInfrastructure',
            'processDigitization',
            'customerExperience',
            'innovationCapability'
        ],
        structure: {
            currentStateAssessment: { required: true },
            industryPositioning: { required: true },
            leaderPractices: { required: true },
            transformationPathway: { required: true },
            recommendations: { required: true, maxItems: 5 }
        },
        dataRequirements: [
            'axisScore',
            'axisJustification',
            'axisTarget',
            'industryBenchmarkForAxis',
            'webResearchForAxis'
        ]
    },

    gapAnalysis: {
        id: 'gapAnalysis',
        order: 4,
        name: 'Gap Analysis',
        namePL: 'Analiza Luk',
        type: 'ai_generated',
        maxLength: 1500,
        structure: {
            gapSummary: { required: true },
            criticalGaps: { required: true },
            patternAnalysis: { required: true },
            prioritizationMatrix: { required: true, visualization: 'matrix' }
        },
        dataRequirements: [
            'gapAnalysis',
            'strategicPriorities'
        ]
    },

    strategicInitiatives: {
        id: 'strategicInitiatives',
        order: 5,
        name: 'Strategic Initiatives',
        namePL: 'Inicjatywy Strategiczne',
        type: 'ai_generated',
        maxLength: 3000,
        structure: {
            initiativePortfolio: { required: true },
            quickWins: { required: true, timeframe: '0-3 months' },
            coreTransformations: { required: true, timeframe: '3-12 months' },
            strategicInvestments: { required: true, timeframe: '12-24 months' },
            dependencies: { required: false, visualization: 'dependency_map' }
        },
        dataRequirements: [
            'gapAnalysis',
            'strategicPriorities',
            'constraints',
            'companyProfile'
        ]
    },

    implementationRoadmap: {
        id: 'implementationRoadmap',
        order: 6,
        name: 'Implementation Roadmap',
        namePL: 'Mapa Wdrożenia',
        type: 'ai_generated',
        maxLength: 2000,
        structure: {
            phases: { required: true, minPhases: 3, maxPhases: 5 },
            milestones: { required: true, visualization: 'timeline' },
            resourceRequirements: { required: true },
            governanceModel: { required: false }
        },
        dataRequirements: [
            'strategicInitiatives',
            'constraints',
            'organizationCapacity'
        ]
    },

    riskAssessment: {
        id: 'riskAssessment',
        order: 7,
        name: 'Risk Assessment',
        namePL: 'Ocena Ryzyka',
        type: 'ai_generated',
        maxLength: 1200,
        structure: {
            riskRegister: { required: true, visualization: 'risk_matrix' },
            mitigationStrategies: { required: true },
            successFactors: { required: true },
            warningSignals: { required: false }
        },
        dataRequirements: [
            'gapAnalysis',
            'strategicInitiatives',
            'industryRisks'
        ]
    },

    investmentAnalysis: {
        id: 'investmentAnalysis',
        order: 8,
        name: 'Investment Analysis',
        namePL: 'Analiza Inwestycyjna',
        type: 'ai_generated',
        maxLength: 1500,
        structure: {
            budgetSummary: { required: true },
            roiProjections: { required: true },
            fundingOptions: { required: false },
            costBenefitAnalysis: { required: true }
        },
        dataRequirements: [
            'strategicInitiatives',
            'constraints',
            'industryBenchmarkCosts'
        ]
    },

    nextSteps: {
        id: 'nextSteps',
        order: 9,
        name: 'Next Steps',
        namePL: 'Następne Kroki',
        type: 'ai_generated',
        maxLength: 800,
        structure: {
            immediate: { required: true, timeframe: '0-30 days' },
            shortTerm: { required: true, timeframe: '30-90 days' },
            engagementOptions: { required: false }
        },
        dataRequirements: [
            'strategicPriorities',
            'organizationReadiness'
        ]
    },

    appendices: {
        id: 'appendices',
        order: 10,
        name: 'Appendices',
        namePL: 'Załączniki',
        type: 'static',
        maxLength: null, // Unlimited
        structure: {
            methodology: { required: true },
            glossary: { required: true },
            dataSourcesList: { required: true },
            detailedScoreBreakdown: { required: false }
        },
        dataRequirements: [
            'assessmentMetadata',
            'researchSources'
        ]
    }
};

// Prompt templates for AI generation
const PROMPT_TEMPLATES = {
    executiveSummary: {
        systemInstruction: `You are a senior management consultant writing an Executive Summary for a Digital Readiness Assessment.
Write in professional Polish. Be concise but impactful.
Use the Pyramid Principle: start with the answer, then support with evidence.`,
        
        userPromptTemplate: `Create the Executive Summary for this assessment:

## Company Profile
{companyProfile}

## Assessment Results
{assessmentResults}

## Industry Benchmark
{industryBenchmark}

## Key Gaps
{keyGaps}

Generate a compelling executive summary with:
1. Opening statement positioning the organization
2. 3-5 key findings with specific data
3. Top 3 strategic priorities
4. Recommended next steps
5. Investment perspective

Maximum 800 words. Use Polish language.`
    },

    axisAnalysis: {
        systemInstruction: `You are a digital transformation expert providing deep analysis of a specific maturity axis.
Be thorough but actionable. Include specific examples and data.
Write in professional Polish.`,
        
        userPromptTemplate: `Analyze the {axisName} axis:

## Current Assessment
Score: {currentScore}/5
Target: {targetScore}/5
Gap: {gap} levels
Justification: {justification}

## Industry Context
{industryContext}

## Research Data
{researchData}

Provide comprehensive analysis including:
1. What the current score means practically
2. Industry positioning (Leader/Average/Laggard)
3. What industry leaders do differently
4. Step-by-step pathway to target state
5. 3-5 prioritized recommendations

Maximum 1500 words. Use Polish language.`
    }
};

class ReportTemplateManager {
    constructor() {
        this.templates = { ...SECTION_STRUCTURES };
        this.prompts = { ...PROMPT_TEMPLATES };
    }

    /**
     * Get all section definitions
     */
    getAllSections() {
        return Object.values(this.templates)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get section by ID
     * @param {string} sectionId - Section identifier
     */
    getSection(sectionId) {
        return this.templates[sectionId] || null;
    }

    /**
     * Get prompt template for a section
     * @param {string} sectionId - Section identifier
     */
    getPromptTemplate(sectionId) {
        return this.prompts[sectionId] || null;
    }

    /**
     * Build prompt from template with data
     * @param {string} sectionId - Section identifier
     * @param {Object} data - Data to interpolate
     */
    buildPrompt(sectionId, data) {
        const template = this.prompts[sectionId];
        if (!template) return null;

        let prompt = template.userPromptTemplate;
        
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            const valueStr = typeof value === 'object' 
                ? JSON.stringify(value, null, 2) 
                : String(value);
            prompt = prompt.replace(new RegExp(placeholder, 'g'), valueStr);
        }

        return {
            systemInstruction: template.systemInstruction,
            userPrompt: prompt
        };
    }

    /**
     * Validate section data completeness
     * @param {string} sectionId - Section identifier
     * @param {Object} data - Data to validate
     */
    validateSectionData(sectionId, data) {
        const section = this.templates[sectionId];
        if (!section) return { valid: false, missing: ['Section not found'] };

        const missing = [];
        for (const requirement of section.dataRequirements || []) {
            if (!data[requirement]) {
                missing.push(requirement);
            }
        }

        return {
            valid: missing.length === 0,
            missing
        };
    }

    /**
     * Get customization options for organization
     * @param {string} organizationId - Organization ID
     */
    async getOrgCustomizations(organizationId) {
        return new Promise((resolve) => {
            db.get(
                `SELECT customizations FROM report_templates 
                 WHERE organization_id = ? AND is_active = 1`,
                [organizationId],
                (err, row) => {
                    if (err || !row) {
                        resolve(null);
                        return;
                    }
                    try {
                        resolve(JSON.parse(row.customizations));
                    } catch {
                        resolve(null);
                    }
                }
            );
        });
    }

    /**
     * Save customization for organization
     * @param {string} organizationId - Organization ID
     * @param {Object} customizations - Customization settings
     */
    async saveOrgCustomizations(organizationId, customizations) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO report_templates 
                 (organization_id, customizations, is_active, updated_at)
                 VALUES (?, ?, 1, datetime('now'))`,
                [organizationId, JSON.stringify(customizations)],
                (err) => {
                    if (err) reject(err);
                    else resolve({ success: true });
                }
            );
        });
    }

    /**
     * Get default section order
     */
    getDefaultOrder() {
        return this.getAllSections().map(s => s.id);
    }

    /**
     * Check if section is AI-generated
     * @param {string} sectionId - Section identifier
     */
    isAIGenerated(sectionId) {
        const section = this.templates[sectionId];
        return section?.type?.startsWith('ai_generated') || false;
    }
}

// Singleton instance
const reportTemplateManager = new ReportTemplateManager();

export {
ReportTemplateManager,
    reportTemplateManager,
    SECTION_STRUCTURES,
    PROMPT_TEMPLATES
};

export default {
    ReportTemplateManager,
    reportTemplateManager,
    SECTION_STRUCTURES,
    PROMPT_TEMPLATES
};











