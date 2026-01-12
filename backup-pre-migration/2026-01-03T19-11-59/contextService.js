/**
 * Context Service
 * 
 * Manages project/assessment context and validates readiness for report generation.
 * Implements BCG/McKinsey-level context requirements for professional outputs.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const db = require('../database');

// Context readiness levels for assessment finalization
const CONTEXT_LEVELS = {
    INSUFFICIENT: { 
        threshold: 0, 
        maxThreshold: 39,
        canFinalize: false, 
        canGenerateReport: false,
        label: 'Insufficient',
        description: 'Critical context missing - cannot generate quality report'
    },
    MINIMAL: { 
        threshold: 40, 
        maxThreshold: 69,
        canFinalize: false, 
        canGenerateReport: false,
        label: 'Minimal',
        description: 'Basic context present but insufficient for professional report'
    },
    STANDARD: { 
        threshold: 70, 
        maxThreshold: 89,
        canFinalize: true, 
        canGenerateReport: true,
        label: 'Standard',
        description: 'Sufficient context for quality report generation'
    },
    COMPLETE: { 
        threshold: 90, 
        maxThreshold: 100,
        canFinalize: true, 
        canGenerateReport: true,
        label: 'Complete',
        description: 'Full context - optimal for BCG/McKinsey-level outputs'
    }
};

// Required fields with weights (total = 100)
const REQUIRED_FIELDS = [
    // Organization Profile (40% total)
    { key: 'industry', weight: 15, label: 'Industry', category: 'organization', required: true },
    { key: 'companySize', weight: 10, label: 'Company Size', category: 'organization', required: true },
    { key: 'employeeCount', weight: 5, label: 'Employee Count', category: 'organization', required: false },
    { key: 'annualRevenue', weight: 5, label: 'Annual Revenue', category: 'organization', required: false },
    { key: 'operatingCountries', weight: 5, label: 'Operating Countries', category: 'organization', required: false },
    
    // Strategic Context (35% total)
    { key: 'strategicGoals', weight: 20, label: 'Strategic Goals', category: 'strategy', required: true },
    { key: 'challenges', weight: 15, label: 'Current Challenges', category: 'strategy', required: true },
    
    // Transformation Context (25% total)
    { key: 'constraints', weight: 10, label: 'Constraints', category: 'transformation', required: true },
    { key: 'businessModel', weight: 10, label: 'Business Model', category: 'transformation', required: false },
    { key: 'transformationHorizon', weight: 5, label: 'Transformation Horizon', category: 'transformation', required: true }
];

// Minimum score to allow assessment finalization
const FINALIZATION_THRESHOLD = CONTEXT_LEVELS.STANDARD.threshold;

const ContextService = {
    // Export constants for use in other modules
    CONTEXT_LEVELS,
    REQUIRED_FIELDS,
    FINALIZATION_THRESHOLD,

    /**
     * Get project context
     * @param {string} projectId
     * @returns {Promise<Object>}
     */
    getContext: (projectId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT context_data FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                try {
                    resolve(row.context_data ? JSON.parse(row.context_data) : {});
                } catch (e) {
                    resolve({});
                }
            });
        });
    },

    /**
     * Get combined context from project and organization profile
     * @param {string} projectId
     * @param {string} organizationId
     * @returns {Promise<Object>}
     */
    getFullContext: async (projectId, organizationId) => {
        const [projectContext, orgProfile] = await Promise.all([
            ContextService.getContext(projectId),
            ContextService.getOrganizationProfile(organizationId)
        ]);

        return {
            // Organization data
            industry: orgProfile?.industry || projectContext?.industry,
            companySize: orgProfile?.company_size || projectContext?.companySize,
            employeeCount: orgProfile?.employee_count || projectContext?.employeeCount,
            annualRevenue: orgProfile?.annual_revenue || projectContext?.annualRevenue,
            operatingCountries: orgProfile?.headquarters_country || projectContext?.operatingCountries,
            
            // Strategic data (from project context)
            strategicGoals: projectContext?.strategicGoals || orgProfile?.strategic_priorities,
            challenges: projectContext?.challenges || orgProfile?.current_challenges,
            
            // Transformation data
            constraints: projectContext?.constraints,
            businessModel: projectContext?.businessModel,
            transformationHorizon: projectContext?.transformationHorizon,
            
            // Raw data for AI context building
            _projectContext: projectContext,
            _orgProfile: orgProfile
        };
    },

    /**
     * Get organization profile from database
     * @param {string} organizationId
     * @returns {Promise<Object>}
     */
    getOrganizationProfile: (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM organization_profiles WHERE organization_id = ?`,
                [organizationId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    
                    // Parse JSON fields
                    try {
                        row.strategic_priorities = JSON.parse(row.strategic_priorities || '[]');
                        row.current_challenges = JSON.parse(row.current_challenges || '[]');
                        row.competitive_advantages = JSON.parse(row.competitive_advantages || '[]');
                        row.key_competitors = JSON.parse(row.key_competitors || '[]');
                    } catch (e) {
                        // Keep as strings if parsing fails
                    }
                    
                    resolve(row);
                }
            );
        });
    },

    /**
     * Save project context
     * @param {string} projectId
     * @param {Object} contextData
     */
    saveContext: (projectId, contextData) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE projects SET context_data = ? WHERE id = ?`;
            db.run(sql, [JSON.stringify(contextData), projectId], function (err) {
                if (err) return reject(err);
                resolve({ projectId, success: true });
            });
        });
    },

    /**
     * Calculate Context Readiness Score with weighted fields
     * @param {Object} context - Combined context data
     * @returns {Object} Detailed readiness analysis
     */
    calculateReadiness: (context) => {
        if (!context) {
            return {
                score: 0,
                level: CONTEXT_LEVELS.INSUFFICIENT,
                gaps: REQUIRED_FIELDS.filter(f => f.required).map(f => ({
                    key: f.key,
                    label: f.label,
                    weight: f.weight,
                    category: f.category
                })),
                filledFields: [],
                canFinalize: false,
                canGenerateReport: false,
                byCategory: {
                    organization: { score: 0, total: 40 },
                    strategy: { score: 0, total: 35 },
                    transformation: { score: 0, total: 25 }
                }
            };
        }

        const gaps = [];
        const filledFields = [];
        let totalScore = 0;
        const categoryScores = {
            organization: { score: 0, total: 0 },
            strategy: { score: 0, total: 0 },
            transformation: { score: 0, total: 0 }
        };

        REQUIRED_FIELDS.forEach(field => {
            const value = context[field.key];
            const isFilled = ContextService._isFieldFilled(value);
            
            categoryScores[field.category].total += field.weight;
            
            if (isFilled) {
                totalScore += field.weight;
                categoryScores[field.category].score += field.weight;
                filledFields.push({
                    key: field.key,
                    label: field.label,
                    weight: field.weight,
                    category: field.category
                });
            } else if (field.required) {
                gaps.push({
                    key: field.key,
                    label: field.label,
                    weight: field.weight,
                    category: field.category,
                    required: true
                });
            } else {
                gaps.push({
                    key: field.key,
                    label: field.label,
                    weight: field.weight,
                    category: field.category,
                    required: false
                });
            }
        });

        // Determine level based on score
        let level = CONTEXT_LEVELS.INSUFFICIENT;
        if (totalScore >= CONTEXT_LEVELS.COMPLETE.threshold) {
            level = CONTEXT_LEVELS.COMPLETE;
        } else if (totalScore >= CONTEXT_LEVELS.STANDARD.threshold) {
            level = CONTEXT_LEVELS.STANDARD;
        } else if (totalScore >= CONTEXT_LEVELS.MINIMAL.threshold) {
            level = CONTEXT_LEVELS.MINIMAL;
        }

        return {
            score: totalScore,
            level,
            gaps: gaps.filter(g => g.required), // Only return required gaps
            optionalGaps: gaps.filter(g => !g.required),
            filledFields,
            canFinalize: level.canFinalize,
            canGenerateReport: level.canGenerateReport,
            byCategory: categoryScores,
            recommendations: ContextService._generateRecommendations(gaps, totalScore)
        };
    },

    /**
     * Check if assessment can be finalized
     * @param {string} projectId
     * @param {string} organizationId
     * @returns {Promise<Object>}
     */
    checkFinalizationReadiness: async (projectId, organizationId) => {
        const fullContext = await ContextService.getFullContext(projectId, organizationId);
        const readiness = ContextService.calculateReadiness(fullContext);

        return {
            canFinalize: readiness.canFinalize,
            score: readiness.score,
            level: readiness.level,
            requiredScore: FINALIZATION_THRESHOLD,
            missingPoints: Math.max(0, FINALIZATION_THRESHOLD - readiness.score),
            gaps: readiness.gaps,
            message: readiness.canFinalize 
                ? 'Assessment ready for finalization'
                : `Context score (${readiness.score}%) is below required threshold (${FINALIZATION_THRESHOLD}%). Please complete missing fields.`,
            recommendations: readiness.recommendations
        };
    },

    /**
     * Check if a field value is considered "filled"
     * @private
     */
    _isFieldFilled: (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        if (typeof value === 'number') return true;
        return Boolean(value);
    },

    /**
     * Generate recommendations based on gaps
     * @private
     */
    _generateRecommendations: (gaps, currentScore) => {
        const recommendations = [];
        const requiredGaps = gaps.filter(g => g.required);

        // Prioritize by weight
        const sortedGaps = [...requiredGaps].sort((a, b) => b.weight - a.weight);

        if (currentScore < CONTEXT_LEVELS.STANDARD.threshold) {
            recommendations.push({
                priority: 'HIGH',
                message: `Complete required fields to reach ${CONTEXT_LEVELS.STANDARD.threshold}% for report generation`,
                fields: sortedGaps.slice(0, 3).map(g => g.label)
            });
        }

        if (currentScore >= CONTEXT_LEVELS.STANDARD.threshold && currentScore < CONTEXT_LEVELS.COMPLETE.threshold) {
            recommendations.push({
                priority: 'MEDIUM',
                message: 'Add optional context for richer, more personalized reports',
                fields: gaps.filter(g => !g.required).slice(0, 2).map(g => g.label)
            });
        }

        // Category-specific recommendations
        const categoryNames = {
            organization: 'Organization Profile',
            strategy: 'Strategic Context',
            transformation: 'Transformation Details'
        };

        const weakCategories = Object.entries(gaps.reduce((acc, gap) => {
            if (!acc[gap.category]) acc[gap.category] = 0;
            acc[gap.category] += gap.weight;
            return acc;
        }, {}))
            .filter(([_, weight]) => weight > 10)
            .map(([category]) => categoryNames[category]);

        if (weakCategories.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                message: `Strengthen context in: ${weakCategories.join(', ')}`,
                fields: weakCategories
            });
        }

        return recommendations;
    },

    /**
     * Get context summary for AI prompts
     * @param {string} projectId
     * @param {string} organizationId
     * @returns {Promise<string>}
     */
    getContextSummaryForAI: async (projectId, organizationId) => {
        const fullContext = await ContextService.getFullContext(projectId, organizationId);
        
        const parts = [];
        
        if (fullContext.industry) {
            parts.push(`Industry: ${fullContext.industry}`);
        }
        if (fullContext.companySize) {
            parts.push(`Company Size: ${fullContext.companySize}`);
        }
        if (fullContext.employeeCount) {
            parts.push(`Employees: ${fullContext.employeeCount}`);
        }
        if (fullContext.strategicGoals) {
            const goals = Array.isArray(fullContext.strategicGoals) 
                ? fullContext.strategicGoals.join(', ')
                : fullContext.strategicGoals;
            parts.push(`Strategic Goals: ${goals}`);
        }
        if (fullContext.challenges) {
            const challenges = Array.isArray(fullContext.challenges)
                ? fullContext.challenges.join(', ')
                : fullContext.challenges;
            parts.push(`Key Challenges: ${challenges}`);
        }
        if (fullContext.constraints) {
            const constraints = Array.isArray(fullContext.constraints)
                ? fullContext.constraints.join(', ')
                : fullContext.constraints;
            parts.push(`Constraints: ${constraints}`);
        }
        if (fullContext.transformationHorizon) {
            parts.push(`Transformation Horizon: ${fullContext.transformationHorizon}`);
        }

        return parts.join('\n');
    }
};

export default ContextService;
