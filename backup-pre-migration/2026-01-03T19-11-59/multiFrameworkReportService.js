/**
 * Multi-Framework Report Service
 * 
 * Generates reports for multi-framework assessments.
 * Supports SIRI, ADMA, CMMI, and LEAN 4.0 report templates.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { calculateFrameworkScore } = require('./frameworkScoreCalculators');
const { FrameworkBenchmarkService } = require('./frameworkBenchmarkService');
const multiFrameworkAuditService = require('./multiFrameworkAuditService');

// ============================================
// REPORT TEMPLATES
// ============================================

const REPORT_SECTIONS = {
    SIRI: [
        { id: 'executive_summary', title: 'Executive Summary', type: 'text', required: true },
        { id: 'methodology', title: 'Assessment Methodology', type: 'text', required: true },
        { id: 'overall_results', title: 'Overall Results', type: 'scores', required: true },
        { id: 'building_blocks', title: 'Building Block Analysis', type: 'radar', required: true },
        { id: 'process', title: 'Process Building Block', type: 'detail', required: true },
        { id: 'technology', title: 'Technology Building Block', type: 'detail', required: true },
        { id: 'organization', title: 'Organization Building Block', type: 'detail', required: true },
        { id: 'prioritization_matrix', title: 'Prioritization Matrix', type: 'matrix', required: true },
        { id: 'benchmark_comparison', title: 'Industry Benchmark Comparison', type: 'benchmark', required: false },
        { id: 'roadmap', title: 'Transformation Roadmap', type: 'roadmap', required: false },
        { id: 'recommendations', title: 'Recommendations', type: 'list', required: true },
        { id: 'appendix', title: 'Appendix', type: 'appendix', required: false },
    ],
    ADMA: [
        { id: 'executive_summary', title: 'Executive Summary', type: 'text', required: true },
        { id: 'methodology', title: 'ADMA 2.0 Methodology', type: 'text', required: true },
        { id: 'overall_results', title: 'Overall Digital Maturity', type: 'scores', required: true },
        { id: 'pillar_overview', title: '5 Pillars Overview', type: 'pentagon', required: true },
        { id: 'strategy', title: 'Strategy & Organization', type: 'pillar_detail', required: true },
        { id: 'smart_products', title: 'Smart Products', type: 'pillar_detail', required: true },
        { id: 'smart_operations', title: 'Smart Operations', type: 'pillar_detail', required: true },
        { id: 'smart_supply', title: 'Smart Supply Chain', type: 'pillar_detail', required: true },
        { id: 'data_driven', title: 'Data-Driven Services', type: 'pillar_detail', required: true },
        { id: 'benchmark', title: 'EU Industry Benchmark', type: 'benchmark', required: false },
        { id: 'action_plan', title: 'Action Plan', type: 'list', required: true },
        { id: 'appendix', title: 'Appendix', type: 'appendix', required: false },
    ],
    CMMI: [
        { id: 'executive_summary', title: 'Executive Summary', type: 'text', required: true },
        { id: 'appraisal_overview', title: 'Appraisal Overview', type: 'text', required: true },
        { id: 'maturity_level', title: 'Overall Maturity Level', type: 'level', required: true },
        { id: 'category_overview', title: 'Category Overview', type: 'categories', required: true },
        { id: 'doing', title: 'Doing Category', type: 'category_detail', required: true },
        { id: 'managing', title: 'Managing Category', type: 'category_detail', required: true },
        { id: 'enabling', title: 'Enabling Category', type: 'category_detail', required: true },
        { id: 'practice_areas', title: 'Practice Area Details', type: 'practice_matrix', required: true },
        { id: 'gaps_analysis', title: 'Gaps to Next Level', type: 'gaps', required: true },
        { id: 'improvement_plan', title: 'Improvement Plan', type: 'list', required: true },
        { id: 'evidence_summary', title: 'Evidence Summary', type: 'evidence', required: false },
        { id: 'appendix', title: 'Appendix', type: 'appendix', required: false },
    ],
    LEAN: [
        { id: 'executive_summary', title: 'Podsumowanie Zarządcze', type: 'text', required: true },
        { id: 'methodology', title: 'Metodologia DBR77 Lean 4.0', type: 'text', required: true },
        { id: 'overall_results', title: 'Wyniki Ogólne', type: 'scores', required: true },
        { id: 'phase_overview', title: 'Przegląd Faz', type: 'phases', required: true },
        { id: 'measure_phase', title: 'Faza POMIERZ', type: 'phase_detail', required: true },
        { id: 'optimize_phase', title: 'Faza ZOPTYMALIZUJ', type: 'phase_detail', required: true },
        { id: 'automate_phase', title: 'Faza AUTOMATYZUJ', type: 'phase_detail', required: true },
        { id: 'process_analysis', title: 'Analiza Procesów', type: 'process_list', required: true },
        { id: 'workstation_analysis', title: 'Analiza Stanowisk', type: 'workstation_pages', required: true },
        { id: 'waste_summary', title: 'Podsumowanie Marnotrawstw', type: 'wastes', required: true },
        { id: 'automation_potential', title: 'Potencjał Automatyzacji', type: 'automation', required: true },
        { id: 'action_plan', title: 'Plan Działań', type: 'list', required: true },
        { id: 'appendix', title: 'Załączniki', type: 'appendix', required: false },
    ],
};

// ============================================
// SERVICE CLASS
// ============================================

class MultiFrameworkReportService {
    /**
     * Generate report from assessment
     */
    static async generateReport(assessmentId, options = {}) {
        const { userId, industry, region, includeAI = true } = options;

        // Get assessment
        const assessmentResult = await db.query(
            'SELECT * FROM multi_framework_assessments WHERE id = $1',
            [assessmentId]
        );

        if (assessmentResult.rows.length === 0) {
            throw new Error('Assessment not found');
        }

        const assessment = assessmentResult.rows[0];
        const framework = assessment.framework;

        // Calculate scores
        const scoreResult = calculateFrameworkScore(framework, assessment.data);

        // Get benchmark comparison if industry provided
        let benchmarkComparison = null;
        if (industry) {
            benchmarkComparison = FrameworkBenchmarkService.compareToIndustry(
                framework,
                scoreResult,
                industry,
                { region }
            );
        }

        // Generate report content based on framework
        let content;
        switch (framework) {
            case 'SIRI':
                content = this.generateSIRIContent(assessment, scoreResult, benchmarkComparison);
                break;
            case 'ADMA':
                content = this.generateADMAContent(assessment, scoreResult, benchmarkComparison);
                break;
            case 'CMMI':
                content = this.generateCMMIContent(assessment, scoreResult, benchmarkComparison);
                break;
            case 'LEAN':
                content = this.generateLeanContent(assessment, scoreResult);
                break;
            default:
                throw new Error(`Unsupported framework: ${framework}`);
        }

        // Create report record
        const reportId = uuidv4();
        await db.query(`
            INSERT INTO multi_framework_reports (
                id, assessment_id, project_id, organization_id, framework,
                name, status, content, sections, executive_summary,
                key_findings, recommendations, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        `, [
            reportId,
            assessmentId,
            assessment.project_id,
            assessment.organization_id,
            framework,
            `${framework} Report - ${assessment.name}`,
            'DRAFT',
            JSON.stringify(content),
            JSON.stringify(REPORT_SECTIONS[framework]),
            content.executiveSummary,
            JSON.stringify(content.keyFindings || []),
            JSON.stringify(content.recommendations || []),
            userId,
        ]);

        // Audit log
        await multiFrameworkAuditService.logReportGeneration(
            assessmentId,
            framework,
            userId,
            reportId,
            'FULL_REPORT'
        );

        return {
            id: reportId,
            framework,
            assessmentId,
            content,
            sections: REPORT_SECTIONS[framework],
        };
    }

    /**
     * Generate SIRI report content
     */
    static generateSIRIContent(assessment, scoreResult, benchmark) {
        const data = assessment.data || {};
        const dimensions = data.dimensions || {};

        const buildingBlocks = {
            PROCESS: {
                name: 'Process',
                score: scoreResult.categories?.PROCESS || 0,
                dimensions: [
                    { id: 'operations', name: 'Operations', score: dimensions.operations || 0 },
                    { id: 'supply_chain', name: 'Supply Chain', score: dimensions.supply_chain || 0 },
                    { id: 'product_lifecycle', name: 'Product Lifecycle', score: dimensions.product_lifecycle || 0 },
                ],
            },
            TECHNOLOGY: {
                name: 'Technology',
                score: scoreResult.categories?.TECHNOLOGY || 0,
                dimensions: [
                    { id: 'automation', name: 'Automation', score: dimensions.automation || 0 },
                    { id: 'connectivity', name: 'Connectivity', score: dimensions.connectivity || 0 },
                    { id: 'intelligence', name: 'Intelligence', score: dimensions.intelligence || 0 },
                ],
            },
            ORGANIZATION: {
                name: 'Organization',
                score: scoreResult.categories?.ORGANIZATION || 0,
                dimensions: [
                    { id: 'talent_readiness', name: 'Talent Readiness', score: dimensions.talent_readiness || 0 },
                    { id: 'structure_management', name: 'Structure & Management', score: dimensions.structure_management || 0 },
                ],
            },
        };

        // Generate executive summary
        const executiveSummary = this.generateExecutiveSummary(
            'SIRI',
            scoreResult.overall,
            buildingBlocks,
            benchmark
        );

        // Identify key findings
        const keyFindings = this.identifyKeyFindings(
            'SIRI',
            scoreResult,
            buildingBlocks,
            benchmark
        );

        // Generate recommendations
        const recommendations = this.generateRecommendations(
            'SIRI',
            scoreResult,
            buildingBlocks
        );

        return {
            framework: 'SIRI',
            assessmentDate: assessment.created_at,
            overallScore: scoreResult.overall,
            scaleMax: 5,
            buildingBlocks,
            prioritizationMatrix: scoreResult.prioritizationMatrix,
            benchmark,
            executiveSummary,
            keyFindings,
            recommendations,
            legalNotice: data.legalDisclaimerAccepted 
                ? 'Assessment conducted for educational purposes. Official SIRI certification requires an accredited auditor.'
                : null,
        };
    }

    /**
     * Generate ADMA report content
     */
    static generateADMAContent(assessment, scoreResult, benchmark) {
        const data = assessment.data || {};
        const dimensions = data.dimensions || {};

        const pillars = {
            strategy: {
                name: 'Strategy & Organization',
                score: scoreResult.categories?.strategy || 0,
                dimensions: [
                    { id: 'leadership_strategy', name: 'Leadership & Strategy', score: dimensions.leadership_strategy || 0 },
                    { id: 'investment_innovation', name: 'Investment & Innovation', score: dimensions.investment_innovation || 0 },
                    { id: 'digital_culture', name: 'Digital Culture', score: dimensions.digital_culture || 0 },
                    { id: 'skills_talent', name: 'Skills & Talent', score: dimensions.skills_talent || 0 },
                ],
            },
            smart_products: {
                name: 'Smart Products',
                score: scoreResult.categories?.smart_products || 0,
                dimensions: [
                    { id: 'connected_products', name: 'Connected Products', score: dimensions.connected_products || 0 },
                    { id: 'digital_services', name: 'Digital Services', score: dimensions.digital_services || 0 },
                    { id: 'product_lifecycle', name: 'Product Lifecycle Management', score: dimensions.product_lifecycle || 0 },
                ],
            },
            smart_operations: {
                name: 'Smart Operations',
                score: scoreResult.categories?.smart_operations || 0,
                dimensions: [
                    { id: 'digital_manufacturing', name: 'Digital Manufacturing', score: dimensions.digital_manufacturing || 0 },
                    { id: 'quality_4_0', name: 'Quality 4.0', score: dimensions.quality_4_0 || 0 },
                    { id: 'flexible_production', name: 'Flexible Production', score: dimensions.flexible_production || 0 },
                    { id: 'predictive_maintenance', name: 'Predictive Maintenance', score: dimensions.predictive_maintenance || 0 },
                ],
            },
            smart_supply: {
                name: 'Smart Supply Chain',
                score: scoreResult.categories?.smart_supply || 0,
                dimensions: [
                    { id: 'e2e_visibility', name: 'End-to-End Visibility', score: dimensions.e2e_visibility || 0 },
                    { id: 'demand_planning', name: 'Demand Planning', score: dimensions.demand_planning || 0 },
                    { id: 'smart_logistics', name: 'Smart Logistics', score: dimensions.smart_logistics || 0 },
                ],
            },
            data_driven: {
                name: 'Data-Driven Services',
                score: scoreResult.categories?.data_driven || 0,
                dimensions: [
                    { id: 'data_governance', name: 'Data Governance', score: dimensions.data_governance || 0 },
                    { id: 'analytics_ai', name: 'Analytics & AI', score: dimensions.analytics_ai || 0 },
                    { id: 'data_monetization', name: 'Data Monetization', score: dimensions.data_monetization || 0 },
                ],
            },
        };

        const executiveSummary = this.generateExecutiveSummary('ADMA', scoreResult.overall, pillars, benchmark);
        const keyFindings = this.identifyKeyFindings('ADMA', scoreResult, pillars, benchmark);
        const recommendations = this.generateRecommendations('ADMA', scoreResult, pillars);

        return {
            framework: 'ADMA',
            assessmentDate: assessment.created_at,
            overallScore: scoreResult.overall,
            maturityLevel: scoreResult.maturityLevel,
            scaleMax: 5,
            pillars,
            benchmark,
            executiveSummary,
            keyFindings,
            recommendations,
            legalNotice: data.legalDisclaimerAccepted 
                ? 'Assessment conducted for educational purposes under ADMA 2.0 framework.'
                : null,
        };
    }

    /**
     * Generate CMMI report content
     */
    static generateCMMIContent(assessment, scoreResult, benchmark) {
        const data = assessment.data || {};
        const practiceAreas = data.practiceAreas || {};

        const categories = {
            DOING: {
                name: 'Doing',
                description: 'Delivering value through development practices',
                level: scoreResult.categories?.DOING || 1,
                practiceAreas: [
                    { id: 'EST', name: 'Estimating', level: practiceAreas.EST || 1 },
                    { id: 'RDM', name: 'Requirements Development & Management', level: practiceAreas.RDM || 1 },
                    { id: 'TS', name: 'Technical Solution', level: practiceAreas.TS || 1 },
                    { id: 'PI', name: 'Product Integration', level: practiceAreas.PI || 1 },
                    { id: 'PR', name: 'Peer Reviews', level: practiceAreas.PR || 1 },
                    { id: 'VV', name: 'Verification & Validation', level: practiceAreas.VV || 1 },
                ],
            },
            MANAGING: {
                name: 'Managing',
                description: 'Managing work and resources effectively',
                level: scoreResult.categories?.MANAGING || 1,
                practiceAreas: [
                    { id: 'PLAN', name: 'Planning', level: practiceAreas.PLAN || 1 },
                    { id: 'MC', name: 'Monitor & Control', level: practiceAreas.MC || 1 },
                    { id: 'MPM', name: 'Managing Performance & Measurement', level: practiceAreas.MPM || 1 },
                    { id: 'RSK', name: 'Risk & Opportunity Management', level: practiceAreas.RSK || 1 },
                    { id: 'SAM', name: 'Supplier Agreement Management', level: practiceAreas.SAM || 1 },
                ],
            },
            ENABLING: {
                name: 'Enabling',
                description: 'Enabling capability and infrastructure',
                level: scoreResult.categories?.ENABLING || 1,
                practiceAreas: [
                    { id: 'CAR', name: 'Causal Analysis & Resolution', level: practiceAreas.CAR || 1 },
                    { id: 'CM', name: 'Configuration Management', level: practiceAreas.CM || 1 },
                    { id: 'DAR', name: 'Decision Analysis & Resolution', level: practiceAreas.DAR || 1 },
                    { id: 'GOV', name: 'Governance', level: practiceAreas.GOV || 1 },
                    { id: 'II', name: 'Implementation Infrastructure', level: practiceAreas.II || 1 },
                    { id: 'OT', name: 'Organizational Training', level: practiceAreas.OT || 1 },
                    { id: 'PAD', name: 'Process Asset Development', level: practiceAreas.PAD || 1 },
                    { id: 'PCM', name: 'Process Management', level: practiceAreas.PCM || 1 },
                    { id: 'PPQA', name: 'Process Quality Assurance', level: practiceAreas.PPQA || 1 },
                ],
            },
        };

        const executiveSummary = this.generateExecutiveSummary('CMMI', scoreResult.overall, categories, benchmark);
        const keyFindings = this.identifyKeyFindings('CMMI', scoreResult, categories, benchmark);
        const recommendations = this.generateRecommendations('CMMI', scoreResult, categories);

        return {
            framework: 'CMMI',
            assessmentDate: assessment.created_at,
            overallLevel: scoreResult.overall,
            maturityLevel: scoreResult.maturityLevel,
            scaleMax: 5,
            categories,
            gaps: scoreResult.gaps,
            benchmark,
            executiveSummary,
            keyFindings,
            recommendations,
            legalNotice: data.legalDisclaimerAccepted 
                ? 'CMMI is a registered trademark of ISACA. This assessment is for educational purposes. Official CMMI certification requires a certified Lead Appraiser.'
                : null,
        };
    }

    /**
     * Generate Lean 4.0 (DBR77) report content
     */
    static generateLeanContent(assessment, scoreResult) {
        const data = assessment.data || {};
        const { processes = [], workstations = [], managementPractices = {} } = data;

        const phases = {
            MEASURE: {
                name: 'Pomierz',
                description: 'Analiza stanu obecnego - procesy i stanowiska',
                score: scoreResult.categories?.MEASURE || 0,
            },
            OPTIMIZE: {
                name: 'Zoptymalizuj',
                description: 'Klasyczne metody Lean - eliminacja marnotrawstwa',
                score: scoreResult.categories?.OPTIMIZE || 0,
            },
            AUTOMATE: {
                name: 'Automatyzuj',
                description: 'Audyt możliwości automatyzacji i AI',
                score: scoreResult.categories?.AUTOMATE || 0,
            },
        };

        // Process analysis
        const processAnalysis = processes.map(process => ({
            id: process.id,
            name: process.name,
            stepCount: process.steps?.length || 0,
            wastes: process.wastes || {},
            leadTime: process.leadTime,
            cycleTime: process.cycleTime,
            valueAddedTime: process.valueAddedTime,
            efficiency: process.valueAddedTime && process.leadTime 
                ? Math.round((process.valueAddedTime / process.leadTime) * 100) 
                : null,
        }));

        // Workstation pages (one page per workstation)
        const workstationPages = workstations.map(ws => ({
            id: ws.id,
            name: ws.name,
            tasks: ws.tasks || [],
            automationPotential: ws.automationPotential || 0,
            automationType: ws.automationType || 'STANDARD',
            aiReadiness: ws.aiReadiness || 0,
            ergonomics: ws.ergonomics,
            skills: ws.skills || [],
            recommendations: this.generateWorkstationRecommendations(ws),
        }));

        // Waste summary
        const wasteSummary = this.aggregateWastes(processes);

        // Automation summary
        const automationSummary = scoreResult.details?.AUTOMATE || {
            candidates: [],
            aiReadiness: 0,
        };

        const executiveSummary = this.generateExecutiveSummary('LEAN', scoreResult.overall, phases, null);
        const keyFindings = this.identifyKeyFindings('LEAN', scoreResult, { phases, wasteSummary }, null);
        const recommendations = this.generateRecommendations('LEAN', scoreResult, { phases, automationSummary });

        return {
            framework: 'LEAN',
            assessmentDate: assessment.created_at,
            overallScore: scoreResult.overall,
            leanMaturity: scoreResult.leanMaturity,
            automationPotential: scoreResult.automationPotential,
            scaleMax: 5,
            phases,
            processAnalysis,
            workstationPages,
            wasteSummary,
            automationSummary,
            managementPractices,
            executiveSummary,
            keyFindings,
            recommendations,
        };
    }

    /**
     * Generate executive summary
     */
    static generateExecutiveSummary(framework, overallScore, categories, benchmark) {
        const levelDescriptions = {
            1: 'początkowy',
            2: 'podstawowy',
            3: 'zdefiniowany',
            4: 'zarządzany',
            5: 'optymalizujący',
        };

        const level = Math.round(overallScore);
        const levelDesc = levelDescriptions[level] || 'nieokreślony';

        let summary = `Organizacja osiągnęła wynik ${overallScore.toFixed(1)} na skali 1-5 w ramach oceny ${framework}, `;
        summary += `co odpowiada poziomowi ${levelDesc} dojrzałości. `;

        if (benchmark) {
            const percentile = benchmark.overall?.percentile || 50;
            if (percentile >= 75) {
                summary += `Wynik plasuje organizację powyżej średniej branżowej (${benchmark.overall?.percentileLabel || 'above average'}). `;
            } else if (percentile >= 50) {
                summary += `Wynik jest zbliżony do średniej branżowej. `;
            } else {
                summary += `Istnieje znaczący potencjał poprawy w porównaniu do liderów branżowych. `;
            }
        }

        return summary;
    }

    /**
     * Identify key findings
     */
    static identifyKeyFindings(framework, scoreResult, categories, benchmark) {
        const findings = [];

        // Overall score finding
        findings.push({
            type: 'overall',
            title: 'Ogólny poziom dojrzałości',
            description: `Wynik ${scoreResult.overall.toFixed(1)}/5 wskazuje na ${
                scoreResult.overall >= 4 ? 'wysoki' :
                scoreResult.overall >= 3 ? 'średni' :
                scoreResult.overall >= 2 ? 'podstawowy' : 'początkowy'
            } poziom dojrzałości.`,
            severity: scoreResult.overall >= 3 ? 'positive' : 'attention',
        });

        // Category-specific findings
        if (scoreResult.categories) {
            Object.entries(scoreResult.categories).forEach(([catId, score]) => {
                if (score >= 4) {
                    findings.push({
                        type: 'strength',
                        category: catId,
                        title: `Mocna strona: ${catId}`,
                        description: `Obszar ${catId} wykazuje wysoki poziom dojrzałości (${score.toFixed(1)}/5).`,
                        severity: 'positive',
                    });
                } else if (score < 2.5) {
                    findings.push({
                        type: 'improvement',
                        category: catId,
                        title: `Obszar do poprawy: ${catId}`,
                        description: `Obszar ${catId} wymaga znaczącej poprawy (${score.toFixed(1)}/5).`,
                        severity: 'attention',
                    });
                }
            });
        }

        // Benchmark findings
        if (benchmark?.strengths?.length > 0) {
            findings.push({
                type: 'benchmark_strength',
                title: 'Przewaga konkurencyjna',
                description: `Organizacja przewyższa średnią branżową w: ${
                    benchmark.strengths.slice(0, 3).map(s => s.id).join(', ')
                }.`,
                severity: 'positive',
            });
        }

        if (benchmark?.weaknesses?.length > 0) {
            findings.push({
                type: 'benchmark_gap',
                title: 'Luki względem branży',
                description: `Największe luki względem średniej branżowej: ${
                    benchmark.weaknesses.slice(0, 3).map(w => w.id).join(', ')
                }.`,
                severity: 'attention',
            });
        }

        return findings;
    }

    /**
     * Generate recommendations
     */
    static generateRecommendations(framework, scoreResult, categories) {
        const recommendations = [];
        const { getTemplatesForGap } = require('../data/frameworkInitiativeTemplates');

        // Get gaps and generate recommendations
        if (scoreResult.categories) {
            Object.entries(scoreResult.categories).forEach(([catId, score]) => {
                if (score < 3) {
                    const gap = {
                        framework,
                        dimensionId: catId,
                        priority: score < 2 ? 'HIGH' : 'MEDIUM',
                    };
                    
                    const templates = getTemplatesForGap(gap);
                    if (templates.length > 0) {
                        recommendations.push({
                            category: catId,
                            priority: gap.priority,
                            title: templates[0].title,
                            description: templates[0].description,
                            estimatedEffort: templates[0].estimatedEffort,
                            impactScore: templates[0].impactScore,
                        });
                    }
                }
            });
        }

        // Sort by priority and impact
        recommendations.sort((a, b) => {
            const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
            if (priorityDiff !== 0) return priorityDiff;
            return (b.impactScore || 0) - (a.impactScore || 0);
        });

        return recommendations.slice(0, 10); // Top 10 recommendations
    }

    /**
     * Generate workstation recommendations (for Lean)
     */
    static generateWorkstationRecommendations(workstation) {
        const recommendations = [];

        if (workstation.automationPotential >= 4) {
            recommendations.push({
                type: 'automation',
                priority: 'HIGH',
                title: 'Wysoki potencjał automatyzacji',
                description: `Stanowisko kwalifikuje się do automatyzacji typu ${workstation.automationType || 'STANDARD'}.`,
            });
        }

        if (workstation.aiReadiness >= 3) {
            recommendations.push({
                type: 'ai',
                priority: 'MEDIUM',
                title: 'Gotowość na AI',
                description: 'Rozważ wdrożenie wspomagania AI dla tego stanowiska.',
            });
        }

        return recommendations;
    }

    /**
     * Aggregate wastes from all processes
     */
    static aggregateWastes(processes) {
        const wasteTypes = {
            OVERPRODUCTION: { name: 'Nadprodukcja', total: 0, count: 0 },
            WAITING: { name: 'Oczekiwanie', total: 0, count: 0 },
            TRANSPORT: { name: 'Transport', total: 0, count: 0 },
            OVERPROCESSING: { name: 'Nadmierne przetwarzanie', total: 0, count: 0 },
            INVENTORY: { name: 'Zapasy', total: 0, count: 0 },
            MOTION: { name: 'Zbędny ruch', total: 0, count: 0 },
            DEFECTS: { name: 'Defekty', total: 0, count: 0 },
            SKILLS: { name: 'Niewykorzystane talenty', total: 0, count: 0 },
        };

        processes.forEach(process => {
            if (process.wastes) {
                Object.entries(process.wastes).forEach(([wasteType, severity]) => {
                    if (wasteTypes[wasteType]) {
                        wasteTypes[wasteType].total += severity || 0;
                        wasteTypes[wasteType].count++;
                    }
                });
            }
        });

        // Calculate averages
        Object.values(wasteTypes).forEach(waste => {
            waste.average = waste.count > 0 ? waste.total / waste.count : 0;
        });

        return wasteTypes;
    }

    /**
     * Get report by ID
     */
    static async getReport(reportId) {
        const result = await db.query(
            'SELECT * FROM multi_framework_reports WHERE id = $1',
            [reportId]
        );
        
        if (result.rows.length === 0) return null;
        
        const report = result.rows[0];
        report.content = JSON.parse(report.content || '{}');
        report.sections = JSON.parse(report.sections || '[]');
        report.key_findings = JSON.parse(report.key_findings || '[]');
        report.recommendations = JSON.parse(report.recommendations || '[]');
        
        return report;
    }

    /**
     * List reports for assessment
     */
    static async listReports(assessmentId) {
        const result = await db.query(`
            SELECT id, name, status, framework, created_at, finalized_at
            FROM multi_framework_reports 
            WHERE assessment_id = $1
            ORDER BY created_at DESC
        `, [assessmentId]);
        
        return result.rows;
    }

    /**
     * Finalize report
     */
    static async finalizeReport(reportId, userId) {
        await db.query(`
            UPDATE multi_framework_reports
            SET status = 'FINAL', finalized_at = NOW(), finalized_by = $1
            WHERE id = $2
        `, [userId, reportId]);
        
        return this.getReport(reportId);
    }
}

export default MultiFrameworkReportService;







