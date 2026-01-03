/**
 * ADKAR Scoring Service
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Change Readiness Assessment scoring and analysis.
 * Fully migrated from server/services/adkarService.js
 * 
 * Features:
 * - ADKAR score calculation (Awareness, Desire, Knowledge, Ability, Reinforcement)
 * - Gap identification
 * - Change readiness recommendations
 * - Score persistence
 */

import { v4 as uuidv4 } from 'uuid';
import type { IDatabase } from '../database/IDatabase.js';
import { getDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface ADKARResponses {
    [questionId: string]: number; // 1-5 scale
}

interface ADKARScores {
    awareness_score?: number;
    desire_score?: number;
    knowledge_score?: number;
    ability_score?: number;
    reinforcement_score?: number;
    overall_score: number;
}

interface ADKARGap {
    dimension: string;
    score: number;
    gap: number;
}

interface ADKARRecommendation {
    dimension: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
}

interface ADKARAssessment {
    id: string;
    organization_id: string;
    project_id?: string;
    scores: ADKARScores;
    gaps: ADKARGap[];
    recommendations: ADKARRecommendation[];
    created_at: string;
    updated_at: string;
}

interface ADKARServiceDependencies {
    db?: IDatabase;
}

// ==========================================
// ADKAR SERVICE CLASS
// ==========================================

class ADKARServiceClass {
    private db: IDatabase;

    constructor(deps?: ADKARServiceDependencies) {
        this.db = deps?.db || getDatabase();
    }

    /**
     * Database helper: Get single row
     */
    private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
        return new Promise((resolve, reject) => {
            this.db.get<T>(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }

    /**
     * Database helper: Run query
     */
    private async dbRun(sql: string, params: unknown[] = []): Promise<{ lastID?: number; changes: number }> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (this: { lastID?: number; changes: number }, err: Error | null) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes || 0 });
            });
        });
    }
    /**
     * Calculate ADKAR scores from responses
     */
    calculateScores(responses: ADKARResponses): ADKARScores {
        const dimensionScores: Record<string, number[]> = {
            awareness: [],
            desire: [],
            knowledge: [],
            ability: [],
            reinforcement: []
        };

        // Group responses by dimension
        Object.keys(responses).forEach(questionId => {
            const dimension = questionId.split('_')[0]; // e.g., "awareness_1" -> "awareness"
            if (dimensionScores[dimension as keyof typeof dimensionScores]) {
                dimensionScores[dimension as keyof typeof dimensionScores].push(responses[questionId]);
            }
        });

        // Calculate averages
        const scores: ADKARScores = {
            overall_score: 0
        };
        let totalSum = 0;
        let dimensionCount = 0;

        Object.keys(dimensionScores).forEach(dimension => {
            const dimScores = dimensionScores[dimension];
            if (dimScores.length > 0) {
                const avg = dimScores.reduce((sum, score) => sum + score, 0) / dimScores.length;
                scores[`${dimension}_score` as keyof ADKARScores] = avg;
                totalSum += avg;
                dimensionCount++;
            }
        });

        scores.overall_score = dimensionCount > 0 ? totalSum / dimensionCount : 0;

        return scores;
    }

    /**
     * Identify weakest dimensions (change readiness gaps)
     */
    identifyGaps(scores: ADKARScores, threshold = 3.0): ADKARGap[] {
        const gaps: ADKARGap[] = [];

        const dimensions = ['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'] as const;
        dimensions.forEach(dim => {
            const scoreKey = `${dim}_score` as keyof ADKARScores;
            const score = scores[scoreKey] as number | undefined;
            if (score !== undefined && score < threshold) {
                gaps.push({
                    dimension: dim,
                    score,
                    gap: threshold - score
                });
            }
        });

        return gaps.sort((a, b) => b.gap - a.gap);
    }

    /**
     * Generate change readiness recommendations
     */
    generateRecommendations(scores: ADKARScores): ADKARRecommendation[] {
        const gaps = this.identifyGaps(scores);
        const recommendations: ADKARRecommendation[] = [];

        gaps.forEach(gap => {
            let recommendation = '';
            let priority: 'high' | 'medium' | 'low' = 'medium';

            switch (gap.dimension) {
                case 'awareness':
                    recommendation = 'Increase communication about WHY change is needed. Share business case and urgency.';
                    priority = gap.gap > 1.5 ? 'high' : 'medium';
                    break;
                case 'desire':
                    recommendation = 'Build personal motivation through leadership buy-in and WIIFM (What\'s In It For Me) messaging.';
                    priority = gap.gap > 1.5 ? 'high' : 'medium';
                    break;
                case 'knowledge':
                    recommendation = 'Provide comprehensive training programs and accessible documentation.';
                    priority = gap.gap > 1.5 ? 'high' : 'medium';
                    break;
                case 'ability':
                    recommendation = 'Offer hands-on practice, coaching, and support resources to build skills.';
                    priority = gap.gap > 1.5 ? 'high' : 'medium';
                    break;
                case 'reinforcement':
                    recommendation = 'Establish recognition systems, celebrate wins, and ensure change sustainability.';
                    priority = gap.gap > 1.5 ? 'high' : 'medium';
                    break;
            }

            recommendations.push({
                dimension: gap.dimension,
                recommendation,
                priority
            });
        });

        return recommendations;
    }

    /**
     * Get overall change readiness level
     */
    static getReadinessLevel(scores: ADKARScores): 'high' | 'medium' | 'low' {
        const overall = scores.overall_score || 0;
        if (overall >= 4.0) return 'high';
        if (overall >= 3.0) return 'medium';
        return 'low';
    }

    /**
     * Generate summary report
     */
    static generateReport(scores: ADKARScores): {
        readinessLevel: 'high' | 'medium' | 'low';
        overallScore: number;
        gaps: ADKARGap[];
        recommendations: ADKARRecommendation[];
        strengths: string[];
        weaknesses: string[];
    } {
        const readinessLevel = this.getReadinessLevel(scores);
        const gaps = this.identifyGaps(scores);
        const recommendations = this.generateRecommendations(scores);

        const strengths: string[] = [];
        const weaknesses: string[] = [];

        const dimensions = ['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'] as const;
        dimensions.forEach(dim => {
            const scoreKey = `${dim}_score` as keyof ADKARScores;
            const score = scores[scoreKey] as number | undefined;
            if (score !== undefined) {
                if (score >= 4.0) {
                    strengths.push(dim.charAt(0).toUpperCase() + dim.slice(1));
                } else if (score < 3.0) {
                    weaknesses.push(dim.charAt(0).toUpperCase() + dim.slice(1));
                }
            }
        });

        return {
            readinessLevel,
            overallScore: scores.overall_score || 0,
            gaps,
            recommendations,
            strengths,
            weaknesses
        };
    }
}

// ==========================================
// EXPORTS
// ==========================================

// Export class (static methods)
export { ADKARServiceClass };

// Export default instance (for backward compatibility)
const adkarService = ADKARServiceClass;
export default adkarService;

// Export individual methods for backward compatibility
export const calculateScores = (responses: ADKARResponses) => ADKARServiceClass.calculateScores(responses);
export const identifyGaps = (scores: ADKARScores, threshold?: number) => ADKARServiceClass.identifyGaps(scores, threshold);
export const generateRecommendations = (scores: ADKARScores) => ADKARServiceClass.generateRecommendations(scores);
export const getReadinessLevel = (scores: ADKARScores) => ADKARServiceClass.getReadinessLevel(scores);
export const generateReport = (scores: ADKARScores) => ADKARServiceClass.generateReport(scores);
