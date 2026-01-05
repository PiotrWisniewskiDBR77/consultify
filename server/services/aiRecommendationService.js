/**
 * AI Recommendation Service for Digitization Analyses
 * 
 * Generates intelligent recommendations based on gap analysis.
 * Uses pattern matching and industry best practices to suggest initiatives.
 */

import { getDatabase } from '../src/database/Database.ts';
const defaultDb = getDatabase();
import { v4 as uuidv4 } from 'uuid';
import { DIGITIZATION_AXES } from '../data/digitizationEvaluationData.js';



// Initiative templates for each axis
const INITIATIVE_TEMPLATES = {
    digital_processes: [
        { title: 'Automatyzacja procesów produkcyjnych', type: 'technology', effort: 'high', impact: 'high' },
        { title: 'Wdrożenie systemu workflow', type: 'technology', effort: 'medium', impact: 'high' },
        { title: 'Digitalizacja dokumentacji procesowej', type: 'process_change', effort: 'low', impact: 'medium' },
        { title: 'Szkolenie z metodyk Lean Digital', type: 'training', effort: 'low', impact: 'medium' },
        { title: 'Integracja systemów produkcyjnych', type: 'technology', effort: 'high', impact: 'high' }
    ],
    digital_products: [
        { title: 'Platforma IoT dla produktów', type: 'technology', effort: 'high', impact: 'high' },
        { title: 'System śledzenia produktów (Track & Trace)', type: 'technology', effort: 'medium', impact: 'high' },
        { title: 'Cyfrowy bliźniak produktu', type: 'technology', effort: 'high', impact: 'high' },
        { title: 'Portal klienta z danymi produktu', type: 'technology', effort: 'medium', impact: 'medium' }
    ],
    digital_business_models: [
        { title: 'Analiza możliwości modeli subskrypcyjnych', type: 'strategic', effort: 'medium', impact: 'high' },
        { title: 'Platforma marketplace B2B', type: 'technology', effort: 'high', impact: 'high' },
        { title: 'Program partnerski cyfrowy', type: 'strategic', effort: 'medium', impact: 'medium' },
        { title: 'Usługi predykcyjne oparte na danych', type: 'strategic', effort: 'high', impact: 'high' }
    ],
    big_data: [
        { title: 'Wdrożenie Data Lake', type: 'technology', effort: 'high', impact: 'high' },
        { title: 'Dashboard analityczny dla zarządu', type: 'technology', effort: 'medium', impact: 'medium' },
        { title: 'Szkolenie z analizy danych', type: 'training', effort: 'low', impact: 'medium' },
        { title: 'Predykcyjne utrzymanie ruchu (PdM)', type: 'technology', effort: 'high', impact: 'high' },
        { title: 'System raportowania KPI w czasie rzeczywistym', type: 'technology', effort: 'medium', impact: 'high' }
    ],
    transformation_culture: [
        { title: 'Program ambasadorów cyfrowej transformacji', type: 'process_change', effort: 'medium', impact: 'high' },
        { title: 'Hackathon innowacji', type: 'quick_win', effort: 'low', impact: 'medium' },
        { title: 'Szkolenia z kompetencji cyfrowych', type: 'training', effort: 'medium', impact: 'medium' },
        { title: 'System zgłaszania pomysłów innowacyjnych', type: 'process_change', effort: 'low', impact: 'medium' }
    ],
    cybersecurity: [
        { title: 'Audyt bezpieczeństwa infrastruktury', type: 'process_change', effort: 'medium', impact: 'high' },
        { title: 'Wdrożenie SIEM/SOC', type: 'technology', effort: 'high', impact: 'high' },
        { title: 'Szkolenia z cyberbezpieczeństwa dla pracowników', type: 'training', effort: 'low', impact: 'high' },
        { title: 'Program Bug Bounty', type: 'process_change', effort: 'low', impact: 'medium' },
        { title: 'Backup i disaster recovery', type: 'technology', effort: 'medium', impact: 'high' }
    ]
};

class AIRecommendationService {
    constructor() {
        this.db = defaultDb;
        this.uuid = uuidv4;
    }

    /**
     * Inject dependencies for testing
     * @param {Object} deps 
     */
    setDependencies(deps) {
        if (deps.db) this.db = deps.db;
        if (deps.uuid) this.uuid = deps.uuid;
    }

    /**
     * Generate recommendations for an analysis
     * @param {Object} analysis - Analysis with axisScores
     * @returns {Array} - List of recommendations
     */
    async generateRecommendations(analysis) {
        const recommendations = [];

        // Calculate gaps for each axis
        const axisGaps = DIGITIZATION_AXES.map(axis => {
            const score = analysis.axisScores?.[axis.id];
            const current = score?.currentScore || 0;
            const target = score?.targetScore || 0;
            const gap = target - current;

            return {
                axisId: axis.id,
                axisName: axis.namePl,
                current,
                target,
                gap,
                priority: gap * (target / 7) // Weighted by target importance
            };
        }).filter(a => a.gap > 0);

        // Sort by priority (highest gap * target first)
        axisGaps.sort((a, b) => b.priority - a.priority);

        // Generate recommendations for top 3 axes with gaps
        const topAxes = axisGaps.slice(0, 3);

        for (const axis of topAxes) {
            const templates = INITIATIVE_TEMPLATES[axis.axisId] || [];

            // Select relevant templates based on gap size
            const relevantTemplates = templates.filter(t => {
                if (axis.gap > 2) return true; // Large gap - all suggestions
                if (axis.gap > 1) return t.effort !== 'high' || t.impact === 'high'; // Medium gap
                return t.effort === 'low'; // Small gap - quick wins only
            });

            // Take top 2 templates per axis
            const selectedTemplates = relevantTemplates.slice(0, 2);

            for (const template of selectedTemplates) {
                const priorityScore = this.calculatePriorityScore(axis.gap, template.effort, template.impact);

                recommendations.push({
                    id: this.uuid(),
                    analysisId: analysis.id,
                    axisId: axis.axisId,
                    axisName: axis.axisName,
                    recommendationType: template.type,
                    title: template.title,
                    description: this.generateDescription(template, axis),
                    rationale: this.generateRationale(axis, template),
                    estimatedEffort: template.effort,
                    estimatedImpact: template.impact,
                    priorityScore,
                    status: 'suggested',
                    aiConfidence: 0.75 + (Math.random() * 0.2), // 0.75-0.95
                    generatedAt: new Date().toISOString()
                });
            }
        }

        // Sort by priority score
        recommendations.sort((a, b) => b.priorityScore - a.priorityScore);

        return recommendations;
    }

    /**
     * Get stored recommendations for an analysis
     */
    async getRecommendations(analysisId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM digitization_ai_recommendations 
                 WHERE analysis_id = ? 
                 ORDER BY priority_score DESC`,
                [analysisId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Save recommendations to database
     */
    async saveRecommendations(recommendations) {
        for (const rec of recommendations) {
            await new Promise((resolve, reject) => {
                this.db.run(
                    `INSERT OR REPLACE INTO digitization_ai_recommendations (
                        id, analysis_id, axis_id, recommendation_type,
                        title, description, rationale,
                        estimated_effort, estimated_impact, priority_score,
                        status, ai_confidence, generated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        rec.id,
                        rec.analysisId,
                        rec.axisId,
                        rec.recommendationType,
                        rec.title,
                        rec.description,
                        rec.rationale,
                        rec.estimatedEffort,
                        rec.estimatedImpact,
                        rec.priorityScore,
                        rec.status,
                        rec.aiConfidence,
                        rec.generatedAt
                    ],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
    }

    /**
     * Update recommendation status
     */
    async updateRecommendationStatus(recommendationId, status, userId) {
        const now = new Date().toISOString();

        await new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE digitization_ai_recommendations 
                 SET status = ?, accepted_by = ?, accepted_at = ?
                 WHERE id = ?`,
                [status, status === 'accepted' ? userId : null, status === 'accepted' ? now : null, recommendationId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    /**
     * Link recommendation to initiative
     */
    async linkToInitiative(recommendationId, initiativeId) {
        await new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE digitization_ai_recommendations 
                 SET initiative_id = ?, status = 'implemented'
                 WHERE id = ?`,
                [initiativeId, recommendationId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    /**
     * Get quick win recommendations (low effort, medium+ impact)
     */
    async getQuickWins(analysisId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM digitization_ai_recommendations 
                 WHERE analysis_id = ? 
                 AND estimated_effort = 'low'
                 AND estimated_impact IN ('medium', 'high')
                 AND status = 'suggested'
                 ORDER BY priority_score DESC
                 LIMIT 5`,
                [analysisId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Calculate priority score based on gap, effort, and impact
     */
    calculatePriorityScore(gap, effort, impact) {
        const effortScores = { low: 1.5, medium: 1, high: 0.7 };
        const impactScores = { low: 0.5, medium: 1, high: 1.5 };

        const base = gap * 10;
        const modifier = (effortScores[effort] || 1) * (impactScores[impact] || 1);

        return Math.round(base * modifier * 10);
    }

    /**
     * Generate detailed description for recommendation
     */
    generateDescription(template, axis) {
        const descriptions = {
            technology: `Implementacja rozwiązania technologicznego "${template.title}" w celu podniesienia poziomu dojrzałości cyfrowej w obszarze ${axis.axisName}.`,
            process_change: `Zmiana procesowa "${template.title}" pozwoli na lepsze wykorzystanie potencjału cyfryzacji w obszarze ${axis.axisName}.`,
            training: `Program szkoleniowy "${template.title}" podniesie kompetencje zespołu w zakresie ${axis.axisName}.`,
            strategic: `Inicjatywa strategiczna "${template.title}" otworzy nowe możliwości biznesowe w obszarze ${axis.axisName}.`,
            quick_win: `Szybka inicjatywa "${template.title}" przyniesie widoczne efekty przy minimalnym nakładzie pracy.`
        };

        return descriptions[template.type] || `Rekomendacja: ${template.title} dla obszaru ${axis.axisName}.`;
    }

    /**
     * Generate rationale for recommendation
     */
    generateRationale(axis, template) {
        const gapLevel = axis.gap > 2 ? 'znacząca' : axis.gap > 1 ? 'umiarkowana' : 'niewielka';

        return `Analiza wykazała ${gapLevel} lukę (${axis.gap.toFixed(1)} poziomów) w obszarze "${axis.axisName}". ` +
            `Obecny poziom ${axis.current.toFixed(1)} jest poniżej poziomu docelowego ${axis.target.toFixed(1)}. ` +
            `Ta inicjatywa ma ${template.impact === 'high' ? 'wysoki' : template.impact === 'medium' ? 'średni' : 'niski'} wpływ ` +
            `przy ${template.effort === 'low' ? 'niskim' : template.effort === 'medium' ? 'średnim' : 'wysokim'} nakładzie pracy.`;
    }
}

// Export singleton instance
const aIRecommendationServiceInstance = new AIRecommendationService();
export default aIRecommendationServiceInstance;













