/**
 * Learning System - Pattern Extraction
 * 
 * Learns from user interactions and feedback to improve AI responses.
 * Features:
 * - Pattern extraction from successful interactions
 * - Failure pattern detection
 * - Adaptive prompt refinement suggestions
 * - Organization-specific learning
 */

const db = require('../../database');
const { aiLogger } = require('./logger');

class LearningSystem {
    constructor() {
        this.patterns = {
            successful: [],
            failed: []
        };
        this.learningRate = 0.1; // How quickly to adapt
        this.minSamples = 10; // Minimum samples before learning
    }

    /**
     * Record interaction for learning
     */
    async recordInteraction(interaction) {
        const {
            userId,
            organizationId,
            requestType,
            prompt,
            response,
            feedback,
            metadata = {}
        } = interaction;

        try {
            await db.run(`
                INSERT INTO ai_learning_interactions 
                (id, user_id, organization_id, request_type, prompt_hash, 
                 response_quality, feedback_score, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                require('crypto').randomUUID(),
                userId,
                organizationId,
                requestType,
                this.hashPrompt(prompt),
                metadata.qualityScore || null,
                feedback?.score || null,
                JSON.stringify(metadata)
            ]);

            // Extract patterns if we have enough data
            await this.maybeExtractPatterns(organizationId, requestType);
        } catch (error) {
            aiLogger.debug('LearningSystem', `Record failed: ${error.message}`);
        }
    }

    /**
     * Hash prompt for pattern matching
     */
    hashPrompt(prompt) {
        // Create a normalized hash for grouping similar prompts
        const normalized = (prompt || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[0-9]+/g, 'N')
            .trim();
        
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    /**
     * Extract patterns from interactions
     */
    async maybeExtractPatterns(organizationId, requestType) {
        try {
            // Count interactions
            const count = await db.get(`
                SELECT COUNT(*) as count 
                FROM ai_learning_interactions
                WHERE organization_id = ? AND request_type = ?
            `, [organizationId, requestType]);

            if (count.count < this.minSamples) {
                return; // Not enough data
            }

            // Extract successful patterns
            const successful = await db.all(`
                SELECT prompt_hash, COUNT(*) as frequency, AVG(feedback_score) as avg_score
                FROM ai_learning_interactions
                WHERE organization_id = ? 
                  AND request_type = ?
                  AND (feedback_score >= 4 OR response_quality >= 0.8)
                GROUP BY prompt_hash
                HAVING COUNT(*) >= 3
                ORDER BY avg_score DESC
                LIMIT 10
            `, [organizationId, requestType]);

            // Extract failed patterns
            const failed = await db.all(`
                SELECT prompt_hash, COUNT(*) as frequency, AVG(feedback_score) as avg_score
                FROM ai_learning_interactions
                WHERE organization_id = ? 
                  AND request_type = ?
                  AND (feedback_score <= 2 OR response_quality <= 0.4)
                GROUP BY prompt_hash
                HAVING COUNT(*) >= 3
                ORDER BY avg_score ASC
                LIMIT 10
            `, [organizationId, requestType]);

            // Store patterns
            await this.storePatterns(organizationId, requestType, { successful, failed });

        } catch (error) {
            aiLogger.debug('LearningSystem', `Pattern extraction failed: ${error.message}`);
        }
    }

    /**
     * Store extracted patterns
     */
    async storePatterns(organizationId, requestType, patterns) {
        try {
            await db.run(`
                INSERT OR REPLACE INTO ai_learned_patterns 
                (id, organization_id, request_type, successful_patterns, 
                 failed_patterns, sample_count, updated_at)
                VALUES (?, ?, ?, ?, ?, 
                    (SELECT COUNT(*) FROM ai_learning_interactions 
                     WHERE organization_id = ? AND request_type = ?),
                    datetime('now'))
            `, [
                `${organizationId}:${requestType}`,
                organizationId,
                requestType,
                JSON.stringify(patterns.successful),
                JSON.stringify(patterns.failed),
                organizationId,
                requestType
            ]);

            aiLogger.info('LearningSystem', 
                `Updated patterns for ${organizationId}:${requestType}`);
        } catch (error) {
            aiLogger.debug('LearningSystem', `Pattern storage failed: ${error.message}`);
        }
    }

    /**
     * Get learned patterns for context
     */
    async getPatterns(organizationId, requestType) {
        try {
            const patterns = await db.get(`
                SELECT * FROM ai_learned_patterns
                WHERE organization_id = ? AND request_type = ?
            `, [organizationId, requestType]);

            if (!patterns) {
                return { successful: [], failed: [], confidence: 0 };
            }

            return {
                successful: JSON.parse(patterns.successful_patterns || '[]'),
                failed: JSON.parse(patterns.failed_patterns || '[]'),
                sampleCount: patterns.sample_count,
                confidence: Math.min(1, patterns.sample_count / 100),
                updatedAt: patterns.updated_at
            };
        } catch (error) {
            aiLogger.debug('LearningSystem', `Pattern retrieval failed: ${error.message}`);
            return { successful: [], failed: [], confidence: 0 };
        }
    }

    /**
     * Generate prompt refinement suggestions
     */
    async getPromptSuggestions(organizationId, requestType) {
        const patterns = await this.getPatterns(organizationId, requestType);
        const suggestions = [];

        if (patterns.confidence < 0.3) {
            return {
                suggestions: [],
                message: 'Niewystarczająca ilość danych do generowania sugestii'
            };
        }

        // Analyze failed patterns
        if (patterns.failed.length > 0) {
            suggestions.push({
                type: 'AVOID',
                priority: 'HIGH',
                description: `Wykryto ${patterns.failed.length} wzorców prowadzących do słabych odpowiedzi`,
                recommendation: 'Rozważ modyfikację promptów aby unikać tych wzorców'
            });
        }

        // Analyze successful patterns
        if (patterns.successful.length > 0) {
            suggestions.push({
                type: 'REINFORCE',
                priority: 'MEDIUM',
                description: `${patterns.successful.length} wzorców prowadzi do dobrych odpowiedzi`,
                recommendation: 'Wzmocnij te wzorce w systemowych promptach'
            });
        }

        // Calculate improvement potential
        const improvementPotential = patterns.failed.length > 0
            ? Math.round((patterns.failed.length / (patterns.failed.length + patterns.successful.length)) * 100)
            : 0;

        return {
            suggestions,
            patterns,
            improvementPotential,
            confidence: patterns.confidence
        };
    }

    /**
     * Get learning analytics
     */
    async getAnalytics(organizationId = null) {
        try {
            let whereClause = '';
            const params = [];

            if (organizationId) {
                whereClause = 'WHERE organization_id = ?';
                params.push(organizationId);
            }

            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total_interactions,
                    AVG(feedback_score) as avg_feedback,
                    AVG(response_quality) as avg_quality,
                    COUNT(DISTINCT organization_id) as organizations,
                    COUNT(DISTINCT request_type) as request_types
                FROM ai_learning_interactions
                ${whereClause}
            `, params);

            const topPatterns = await db.all(`
                SELECT request_type, sample_count, updated_at
                FROM ai_learned_patterns
                ${whereClause}
                ORDER BY sample_count DESC
                LIMIT 10
            `, params);

            return {
                totalInteractions: stats.total_interactions,
                averageFeedback: Math.round((stats.avg_feedback || 0) * 100) / 100,
                averageQuality: Math.round((stats.avg_quality || 0) * 100) / 100,
                organizationCount: stats.organizations,
                requestTypeCount: stats.request_types,
                topPatterns
            };
        } catch (error) {
            aiLogger.debug('LearningSystem', `Analytics failed: ${error.message}`);
            return {
                totalInteractions: 0,
                averageFeedback: 0,
                averageQuality: 0,
                error: error.message
            };
        }
    }

    /**
     * Apply learned improvements to prompt
     */
    async applyLearning(prompt, organizationId, requestType) {
        const patterns = await this.getPatterns(organizationId, requestType);

        if (patterns.confidence < 0.5) {
            return prompt; // Not confident enough to modify
        }

        // Add learning context to prompt
        let enhancedPrompt = prompt;

        if (patterns.successful.length > 0) {
            enhancedPrompt += `\n\n[LEARNING_CONTEXT: Na podstawie ${patterns.sampleCount} interakcji, ` +
                `preferowane są odpowiedzi zgodne z następującymi wzorcami sukcesu.]`;
        }

        return enhancedPrompt;
    }
}

// Singleton instance
const learningSystem = new LearningSystem();

module.exports = {
    LearningSystem,
    learningSystem
};

