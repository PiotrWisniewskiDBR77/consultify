/**
 * Learning System - Enhanced Self-Learning AI
 * 
 * Advanced learning from user interactions and feedback to improve AI responses.
 * Features:
 * - Auto-feedback based on quality scores
 * - Pattern extraction with AI-powered insights
 * - Learning context injection into prompts
 * - Organization-specific and global learning
 * - Scheduled consolidation jobs
 * - Comprehensive analytics
 */

import db from '../../database.js';
import { aiLogger } from './logger.js';
import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // Thresholds for pattern classification
    successThreshold: 0.75,      // Quality score >= 0.75 = success
    failureThreshold: 0.45,      // Quality score <= 0.45 = failure

    // Learning parameters
    minSamplesForPatterns: 5,    // Minimum samples before extracting patterns
    minConfidenceForInjection: 0.4, // Minimum confidence to inject learned context

    // Auto-extraction triggers
    extractionInterval: 50,      // Extract patterns every N interactions
    insightInterval: 50,         // Generate AI insights every N interactions

    // Retention
    interactionRetentionDays: 90,
    patternRetentionDays: 365,

    // Quality weights for auto-feedback
    qualityWeights: {
        qualityScore: 0.6,
        latencyPenalty: 0.1,      // Penalize slow responses
        lengthBonus: 0.1,         // Reward appropriate length
        structureBonus: 0.2       // Reward well-structured responses
    },

    // Consolidation parameters
    minConfidenceForConsolidation: 0.5
};

const deps = {
    db,
    aiLogger,
    crypto
};

class LearningSystem {
    constructor() {
        this.config = CONFIG;
        this.extractionCounters = new Map(); // Track per-org/capability extraction counts
    }

    // For testing: allow overriding dependencies
    static setDependencies(newDeps = {}) {
        Object.assign(deps, newDeps);
    }

    setDependencies(newDeps = {}) {
        Object.assign(deps, newDeps);
    }

    // ========================================================================
    // CORE RECORDING METHODS
    // ========================================================================

    /**
     * Record interaction with automatic feedback calculation
     * This is the primary method called by aiPipeline
     */
    async recordWithAutoFeedback(interaction) {
        const {
            userId,
            organizationId,
            requestType,
            prompt,
            response,
            qualityResult,
            model,
            latency,
            tokenCount,
            userFeedback = null,
            metadata = {}
        } = interaction;

        try {
            const id = deps.crypto.randomUUID();
            const promptHash = this.hashPrompt(prompt);
            const promptSignature = this.extractPromptSignature(prompt);
            const responseSignature = this.extractResponseSignature(response);

            // Calculate auto-feedback score based on quality metrics
            const autoFeedback = this.calculateAutoFeedback(qualityResult, {
                latency,
                responseLength: response?.length,
                tokenCount
            });

            await this._runQuery(`
                INSERT INTO ai_learning_interactions 
                (id, user_id, organization_id, request_type, prompt_hash, 
                 response_quality, feedback_score, auto_feedback_score, auto_feedback_reason,
                 model, latency_ms, token_count, prompt_signature, response_signature,
                 metadata, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                id,
                userId,
                organizationId,
                requestType || 'chat',
                promptHash,
                qualityResult?.overallScore || null,
                userFeedback?.score || null,
                autoFeedback.score,
                autoFeedback.reason,
                model,
                latency,
                tokenCount,
                promptSignature,
                responseSignature,
                JSON.stringify({ ...metadata, qualityWarnings: qualityResult?.warnings })
            ]);

            // Check if we should trigger pattern extraction
            await this._maybeExtractPatternsEnhanced(organizationId, requestType);

            deps.aiLogger.debug('LearningSystem', `Recorded interaction: ${id}`, {
                autoFeedbackScore: autoFeedback.score,
                qualityScore: qualityResult?.overallScore
            });

            return { id, autoFeedback };
        } catch (error) {
            deps.aiLogger.debug('LearningSystem', `Record failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Legacy method for backward compatibility
     */
    async recordInteraction(interaction) {
        return this.recordWithAutoFeedback({
            ...interaction,
            qualityResult: interaction.metadata?.qualityScore
                ? { overallScore: interaction.metadata.qualityScore }
                : null
        });
    }

    // ========================================================================
    // AUTO-FEEDBACK CALCULATION
    // ========================================================================

    /**
     * Calculate automatic feedback score based on quality metrics
     */
    calculateAutoFeedback(qualityResult, metrics) {
        const weights = this.config.qualityWeights;
        let score = 0;
        const reasons = [];

        // 1. Base quality score (60% weight)
        if (qualityResult?.overallScore != null) {
            score += qualityResult.overallScore * weights.qualityScore;
            if (qualityResult.overallScore >= this.config.successThreshold) {
                reasons.push('HIGH_QUALITY');
            } else if (qualityResult.overallScore <= this.config.failureThreshold) {
                reasons.push('LOW_QUALITY');
            }
        } else {
            // Default to neutral if no quality score
            score += 0.5 * weights.qualityScore;
            reasons.push('NO_QUALITY_DATA');
        }

        // 2. Latency penalty (10% weight)
        if (metrics.latency) {
            // Penalize responses > 10 seconds
            const latencyFactor = Math.max(0, 1 - (metrics.latency - 10000) / 30000);
            score += latencyFactor * weights.latencyPenalty;
            if (metrics.latency > 15000) {
                reasons.push('SLOW_RESPONSE');
            }
        } else {
            score += 0.5 * weights.latencyPenalty;
        }

        // 3. Response length bonus (10% weight)
        if (metrics.responseLength) {
            // Optimal length: 500-3000 chars
            let lengthFactor = 0.5;
            if (metrics.responseLength >= 500 && metrics.responseLength <= 3000) {
                lengthFactor = 1.0;
                reasons.push('OPTIMAL_LENGTH');
            } else if (metrics.responseLength < 100) {
                lengthFactor = 0.2;
                reasons.push('TOO_SHORT');
            } else if (metrics.responseLength > 5000) {
                lengthFactor = 0.6;
                reasons.push('TOO_LONG');
            }
            score += lengthFactor * weights.lengthBonus;
        } else {
            score += 0.5 * weights.lengthBonus;
        }

        // 4. Structure bonus (20% weight) - based on quality warnings
        if (qualityResult?.warnings?.length === 0) {
            score += weights.structureBonus;
            reasons.push('GOOD_STRUCTURE');
        } else if (qualityResult?.warnings?.length <= 2) {
            score += 0.7 * weights.structureBonus;
        } else {
            score += 0.3 * weights.structureBonus;
            reasons.push('STRUCTURE_ISSUES');
        }

        return {
            score: Math.round(score * 100) / 100, // Round to 2 decimals
            reason: reasons.join(','),
            breakdown: {
                qualityScore: qualityResult?.overallScore,
                latency: metrics.latency,
                responseLength: metrics.responseLength
            }
        };
    }

    // ========================================================================
    // PATTERN EXTRACTION
    // ========================================================================

    /**
     * Enhanced pattern extraction with AI insights
     */
    async _maybeExtractPatternsEnhanced(organizationId, requestType) {
        if (!organizationId) return;

        const key = `${organizationId}:${requestType}`;
        const count = (this.extractionCounters.get(key) || 0) + 1;
        this.extractionCounters.set(key, count);

        // Extract patterns every N interactions
        if (count % this.config.extractionInterval === 0) {
            await this.extractPatternsForCapability(organizationId, requestType);
        }

        // Generate AI insights every M interactions
        if (count % this.config.insightInterval === 0) {
            await this._extractInsightsWithAI(organizationId, requestType);
        }
    }

    /**
     * Extract patterns for a specific organization and capability
     */
    async extractPatternsForCapability(organizationId, requestType) {
        try {
            // Count interactions
            const countResult = await this._getOne(`
                SELECT COUNT(*) as count 
                FROM ai_learning_interactions
                WHERE organization_id = ? AND request_type = ?
            `, [organizationId, requestType]);

            if (!countResult || countResult.count < this.config.minSamplesForPatterns) {
                return null; // Not enough data
            }

            // Extract successful patterns
            const successful = await this._getAll(`
                SELECT 
                    prompt_signature,
                    response_signature,
                    COUNT(*) as frequency,
                    AVG(COALESCE(auto_feedback_score, response_quality, 0.5)) as avg_score,
                    AVG(latency_ms) as avg_latency,
                    GROUP_CONCAT(DISTINCT model) as models_used
                FROM ai_learning_interactions
                WHERE organization_id = ? 
                  AND request_type = ?
                  AND (auto_feedback_score >= ? OR response_quality >= ?)
                GROUP BY prompt_signature, response_signature
                HAVING COUNT(*) >= 2
                ORDER BY avg_score DESC, frequency DESC
                LIMIT 15
            `, [organizationId, requestType, this.config.successThreshold, this.config.successThreshold]);

            // Extract failed patterns
            const failed = await this._getAll(`
                SELECT 
                    prompt_signature,
                    response_signature,
                    COUNT(*) as frequency,
                    AVG(COALESCE(auto_feedback_score, response_quality, 0.5)) as avg_score,
                    AVG(latency_ms) as avg_latency,
                    GROUP_CONCAT(DISTINCT model) as models_used
                FROM ai_learning_interactions
                WHERE organization_id = ? 
                  AND request_type = ?
                  AND (auto_feedback_score <= ? OR response_quality <= ?)
                GROUP BY prompt_signature, response_signature
                HAVING COUNT(*) >= 2
                ORDER BY avg_score ASC, frequency DESC
                LIMIT 10
            `, [organizationId, requestType, this.config.failureThreshold, this.config.failureThreshold]);

            // Calculate confidence score
            const confidence = Math.min(1, countResult.count / 100);

            // Store patterns
            await this.storePatterns(organizationId, requestType, {
                successful: successful || [],
                failed: failed || [],
                sampleCount: countResult.count,
                confidence
            });

            aiLogger.info('LearningSystem',
                `Extracted patterns for ${organizationId}:${requestType}`, {
                successPatterns: successful?.length || 0,
                failurePatterns: failed?.length || 0,
                confidence
            });

            return { successful, failed, confidence };
        } catch (error) {
            aiLogger.debug('LearningSystem', `Pattern extraction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract all patterns for all organizations (for scheduler)
     */
    async extractAllPatterns() {
        const jobId = crypto.randomUUID();
        const startTime = Date.now();
        let recordsProcessed = 0;
        let patternsExtracted = 0;

        try {
            // Log job start
            await this._runQuery(`
                INSERT INTO ai_learning_jobs (id, job_type, status, started_at, created_at)
                VALUES (?, 'PATTERN_EXTRACTION', 'RUNNING', datetime('now'), datetime('now'))
            `, [jobId]);

            // Get all unique org/capability combinations
            const combinations = await this._getAll(`
                SELECT DISTINCT organization_id, request_type, COUNT(*) as count
                FROM ai_learning_interactions
                WHERE organization_id IS NOT NULL
                GROUP BY organization_id, request_type
                HAVING COUNT(*) >= ?
            `, [this.config.minSamplesForPatterns]);

            if (combinations && combinations.length > 0) {
                for (const combo of combinations) {
                    const result = await this.extractPatternsForCapability(
                        combo.organization_id,
                        combo.request_type
                    );
                    recordsProcessed += combo.count;
                    if (result) {
                        patternsExtracted += (result.successful?.length || 0) + (result.failed?.length || 0);
                    }
                }
            }

            // Log job completion
            const duration = Date.now() - startTime;
            await this._runQuery(`
                UPDATE ai_learning_jobs 
                SET status = 'COMPLETED', 
                    completed_at = datetime('now'),
                    duration_ms = ?,
                    records_processed = ?,
                    patterns_extracted = ?
                WHERE id = ?
            `, [duration, recordsProcessed, patternsExtracted, jobId]);

            aiLogger.info('LearningSystem', 'Pattern extraction job completed', {
                jobId,
                duration,
                recordsProcessed,
                patternsExtracted
            });

            return { jobId, recordsProcessed, patternsExtracted, duration };
        } catch (error) {
            await this._runQuery(`
                UPDATE ai_learning_jobs 
                SET status = 'FAILED', 
                    completed_at = datetime('now'),
                    error_message = ?
                WHERE id = ?
            `, [error.message, jobId]);
            throw error;
        }
    }

    /**
     * Generate AI-powered insights from patterns
     */
    async _extractInsightsWithAI(organizationId, requestType) {
        try {
            // Get recent patterns
            const patterns = await this.getPatterns(organizationId, requestType);
            if (!patterns || patterns.confidence < 0.3) return null;

            // Get recent interactions for context
            const recentInteractions = await this._getAll(`
                SELECT prompt_signature, response_signature, auto_feedback_score, auto_feedback_reason
                FROM ai_learning_interactions
                WHERE organization_id = ? AND request_type = ?
                ORDER BY created_at DESC
                LIMIT 20
            `, [organizationId, requestType]);

            // Generate insights using AI (simplified - in production would use LLM)
            const insights = this._generateInsightsLocally(patterns, recentInteractions);

            // Store insights
            await this._runQuery(`
                UPDATE ai_learned_patterns 
                SET ai_insights = ?,
                    improvement_suggestions = ?,
                    last_extraction_at = datetime('now'),
                    extraction_count = extraction_count + 1
                WHERE id = ?
            `, [
                JSON.stringify(insights.insights),
                JSON.stringify(insights.suggestions),
                `${organizationId}:${requestType}`
            ]);

            return insights;
        } catch (error) {
            aiLogger.debug('LearningSystem', `AI insight extraction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Generate insights locally without LLM call (fast, deterministic)
     */
    _generateInsightsLocally(patterns, recentInteractions) {
        const insights = [];
        const suggestions = [];

        // Analyze success patterns
        if (patterns.successful.length > 0) {
            const avgScore = patterns.successful.reduce((sum, p) => sum + (p.avg_score || 0), 0) / patterns.successful.length;
            insights.push({
                type: 'SUCCESS_TREND',
                message: `${patterns.successful.length} successful patterns identified with avg score ${avgScore.toFixed(2)}`,
                confidence: patterns.confidence
            });
        }

        // Analyze failure patterns
        if (patterns.failed.length > 0) {
            insights.push({
                type: 'FAILURE_TREND',
                message: `${patterns.failed.length} failure patterns detected - consider prompt adjustments`,
                confidence: patterns.confidence
            });
            suggestions.push({
                type: 'AVOID_PATTERN',
                description: 'Review and avoid patterns that consistently lead to low scores'
            });
        }

        // Analyze recent feedback reasons
        const reasonCounts = {};
        recentInteractions?.forEach(i => {
            if (i.auto_feedback_reason) {
                i.auto_feedback_reason.split(',').forEach(r => {
                    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
                });
            }
        });

        // Generate suggestions based on common issues
        if (reasonCounts['TOO_SHORT'] > 3) {
            suggestions.push({
                type: 'INCREASE_DETAIL',
                description: 'Responses are often too short - consider adding more detail'
            });
        }
        if (reasonCounts['TOO_LONG'] > 3) {
            suggestions.push({
                type: 'REDUCE_LENGTH',
                description: 'Responses are often too long - consider being more concise'
            });
        }
        if (reasonCounts['SLOW_RESPONSE'] > 3) {
            suggestions.push({
                type: 'OPTIMIZE_SPEED',
                description: 'Response times are slow - consider simpler prompts or faster models'
            });
        }

        return { insights, suggestions };
    }

    // ========================================================================
    // PATTERN STORAGE & RETRIEVAL
    // ========================================================================

    /**
     * Store extracted patterns
     */
    async storePatterns(organizationId, requestType, data) {
        const { successful, failed, sampleCount, confidence } = data;
        const id = `${organizationId}:${requestType}`;

        try {
            await this._runQuery(`
                INSERT INTO ai_learned_patterns 
                (id, organization_id, request_type, successful_patterns, 
                 failed_patterns, sample_count, confidence_score, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    successful_patterns = excluded.successful_patterns,
                    failed_patterns = excluded.failed_patterns,
                    sample_count = excluded.sample_count,
                    confidence_score = excluded.confidence_score,
                    updated_at = datetime('now')
            `, [
                id,
                organizationId,
                requestType,
                JSON.stringify(successful),
                JSON.stringify(failed),
                sampleCount,
                confidence
            ]);
        } catch (error) {
            aiLogger.debug('LearningSystem', `Pattern storage failed: ${error.message}`);
        }
    }

    /**
     * Get learned patterns for a capability
     */
    async getPatterns(organizationId, requestType) {
        try {
            const patterns = await this._getOne(`
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
                confidence: patterns.confidence_score || 0,
                insights: patterns.ai_insights ? JSON.parse(patterns.ai_insights) : [],
                suggestions: patterns.improvement_suggestions ? JSON.parse(patterns.improvement_suggestions) : [],
                updatedAt: patterns.updated_at
            };
        } catch (error) {
            aiLogger.debug('LearningSystem', `Pattern retrieval failed: ${error.message}`);
            return { successful: [], failed: [], confidence: 0 };
        }
    }

    // ========================================================================
    // LEARNING CONTEXT FOR PROMPTS
    // ========================================================================

    /**
     * Generate learning context to inject into prompts
     * This is called by promptAssembler
     */
    async getLearningContextForPrompt(organizationId, capability) {
        try {
            const patterns = await this.getPatterns(organizationId, capability);

            // Don't inject if confidence is too low
            if (patterns.confidence < this.config.minConfidenceForInjection) {
                return null;
            }

            const contextParts = [];

            // Add success patterns guidance
            if (patterns.successful.length > 0) {
                const successGuidance = patterns.successful
                    .slice(0, 5)
                    .map(p => `- ${p.response_signature || 'Well-structured response'}`)
                    .join('\n');
                contextParts.push(`EFFECTIVE RESPONSE PATTERNS:\n${successGuidance}`);
            }

            // Add failure patterns to avoid
            if (patterns.failed.length > 0) {
                const avoidGuidance = patterns.failed
                    .slice(0, 3)
                    .map(p => `- Avoid: ${p.response_signature || 'Unclear or incomplete responses'}`)
                    .join('\n');
                contextParts.push(`PATTERNS TO AVOID:\n${avoidGuidance}`);
            }

            // Add improvement suggestions
            if (patterns.suggestions && patterns.suggestions.length > 0) {
                const suggestionText = patterns.suggestions
                    .slice(0, 3)
                    .map(s => `- ${s.description}`)
                    .join('\n');
                contextParts.push(`IMPROVEMENT SUGGESTIONS:\n${suggestionText}`);
            }

            if (contextParts.length === 0) {
                return null;
            }

            return {
                content: contextParts.join('\n\n'),
                confidence: patterns.confidence,
                patternCount: patterns.successful.length + patterns.failed.length,
                sampleCount: patterns.sampleCount
            };
        } catch (error) {
            aiLogger.debug('LearningSystem', `Learning context generation failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Legacy method for backward compatibility
     */
    async applyLearning(prompt, organizationId, requestType) {
        const context = await this.getLearningContextForPrompt(organizationId, requestType);

        if (!context) {
            return prompt;
        }

        return prompt + `\n\n[LEARNING_CONTEXT: Based on ${context.sampleCount} interactions, ` +
            `apply these learned patterns (confidence: ${Math.round(context.confidence * 100)}%)]\n${context.content}`;
    }

    // ========================================================================
    // GLOBAL LEARNING CONSOLIDATION
    // ========================================================================

    /**
     * Consolidate learnings across organizations into global strategies
     * Called by scheduler
     */
    async consolidateLearnings() {
        const jobId = crypto.randomUUID();
        const startTime = Date.now();
        let strategiesCreated = 0;

        try {
            // Log job start
            await this._runQuery(`
                INSERT INTO ai_learning_jobs (id, job_type, status, started_at, created_at)
                VALUES (?, 'CONSOLIDATION', 'RUNNING', datetime('now'), datetime('now'))
            `, [jobId]);

            // Get all patterns with high confidence
            const allPatterns = await this._getAll(`
                SELECT 
                    request_type,
                    successful_patterns,
                    failed_patterns,
                    confidence_score,
                    organization_id,
                    sample_count
                FROM ai_learned_patterns
                WHERE confidence_score >= ?
            `, [this.config.minConfidenceForConsolidation]);

            if (!allPatterns || allPatterns.length === 0) {
                aiLogger.info('LearningSystem', 'No high-confidence patterns to consolidate');
                await this._runQuery(`
                    UPDATE ai_learning_jobs 
                    SET status = 'COMPLETED', completed_at = datetime('now'), duration_ms = ?
                    WHERE id = ?
                `, [Date.now() - startTime, jobId]);
                return { jobId, strategiesCreated: 0 };
            }

            // Group patterns by capability
            const byCapability = {};
            for (const p of allPatterns) {
                const cap = p.request_type || 'general';
                if (!byCapability[cap]) {
                    byCapability[cap] = { successful: [], failed: [], orgs: new Set(), totalSamples: 0 };
                }

                const successPatterns = JSON.parse(p.successful_patterns || '[]');
                const failPatterns = JSON.parse(p.failed_patterns || '[]');

                byCapability[cap].successful.push(...successPatterns);
                byCapability[cap].failed.push(...failPatterns);
                byCapability[cap].orgs.add(p.organization_id);
                byCapability[cap].totalSamples += p.sample_count || 0;
            }

            // Create global strategies
            for (const [capability, data] of Object.entries(byCapability)) {
                if (data.successful.length >= 3 || data.failed.length >= 3) {
                    // Success strategy
                    if (data.successful.length >= 3) {
                        await this._createGlobalStrategy({
                            type: 'SUCCESS_PATTERN',
                            capability,
                            content: data.successful.slice(0, 10),
                            organizations: Array.from(data.orgs),
                            sampleSize: data.totalSamples,
                            confidence: Math.min(1, data.totalSamples / 500)
                        });
                        strategiesCreated++;
                    }

                    // Failure avoidance strategy
                    if (data.failed.length >= 3) {
                        await this._createGlobalStrategy({
                            type: 'FAILURE_PATTERN',
                            capability,
                            content: data.failed.slice(0, 10),
                            organizations: Array.from(data.orgs),
                            sampleSize: data.totalSamples,
                            confidence: Math.min(1, data.totalSamples / 500)
                        });
                        strategiesCreated++;
                    }
                }
            }

            // Log job completion
            const duration = Date.now() - startTime;
            await this._runQuery(`
                UPDATE ai_learning_jobs 
                SET status = 'COMPLETED', 
                    completed_at = datetime('now'),
                    duration_ms = ?,
                    strategies_created = ?
                WHERE id = ?
            `, [duration, strategiesCreated, jobId]);

            aiLogger.info('LearningSystem', 'Consolidation job completed', {
                jobId,
                duration,
                strategiesCreated
            });

            return { jobId, strategiesCreated, duration };
        } catch (error) {
            await this._runQuery(`
                UPDATE ai_learning_jobs 
                SET status = 'FAILED', 
                    completed_at = datetime('now'),
                    error_message = ?
                WHERE id = ?
            `, [error.message, jobId]);
            throw error;
        }
    }

    /**
     * Create or update a global strategy
     */
    async _createGlobalStrategy(data) {
        const id = `${data.type}:${data.capability}`;

        await this._runQuery(`
            INSERT INTO ai_global_strategies 
            (id, strategy_type, capability, strategy_content, source_organizations,
             sample_size, confidence_score, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, true, datetime('now'), datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                strategy_content = excluded.strategy_content,
                source_organizations = excluded.source_organizations,
                sample_size = excluded.sample_size,
                confidence_score = excluded.confidence_score,
                updated_at = datetime('now')
        `, [
            id,
            data.type,
            data.capability,
            JSON.stringify(data.content),
            JSON.stringify(data.organizations),
            data.sampleSize,
            data.confidence
        ]);
    }

    /**
     * Cleanup old learning data
     * Called by scheduler
     */
    async cleanupOldData() {
        const jobId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            await this._runQuery(`
                INSERT INTO ai_learning_jobs (id, job_type, status, started_at, created_at)
                VALUES (?, 'CLEANUP', 'RUNNING', datetime('now'), datetime('now'))
            `, [jobId]);

            // Delete old interactions
            const interactionResult = await this._runQuery(`
                DELETE FROM ai_learning_interactions
                WHERE created_at < datetime('now', '-${this.config.interactionRetentionDays} days')
            `);

            // Delete old job logs
            await this._runQuery(`
                DELETE FROM ai_learning_jobs
                WHERE created_at < datetime('now', '-30 days')
                  AND status IN ('COMPLETED', 'FAILED')
                  AND id != ?
            `, [jobId]);

            const duration = Date.now() - startTime;
            await this._runQuery(`
                UPDATE ai_learning_jobs 
                SET status = 'COMPLETED', 
                    completed_at = datetime('now'),
                    duration_ms = ?,
                    records_processed = ?
                WHERE id = ?
            `, [duration, interactionResult?.changes || 0, jobId]);

            aiLogger.info('LearningSystem', 'Cleanup job completed', { jobId, duration });
            return { jobId, deleted: interactionResult?.changes || 0, duration };
        } catch (error) {
            await this._runQuery(`
                UPDATE ai_learning_jobs 
                SET status = 'FAILED', error_message = ?
                WHERE id = ?
            `, [error.message, jobId]);
            throw error;
        }
    }

    // ========================================================================
    // ANALYTICS
    // ========================================================================

    /**
     * Get comprehensive learning analytics
     */
    async getAnalytics(organizationId = null) {
        try {
            let whereClause = '';
            const params = [];

            if (organizationId) {
                whereClause = 'WHERE organization_id = ?';
                params.push(organizationId);
            }

            // Overall stats
            const stats = await this._getOne(`
                SELECT 
                    COUNT(*) as total_interactions,
                    AVG(feedback_score) as avg_feedback,
                    AVG(response_quality) as avg_quality,
                    AVG(auto_feedback_score) as avg_auto_feedback,
                    COUNT(DISTINCT organization_id) as organizations,
                    COUNT(DISTINCT request_type) as capabilities,
                    AVG(latency_ms) as avg_latency,
                    SUM(token_count) as total_tokens
                FROM ai_learning_interactions
                ${whereClause}
            `, params);

            // Pattern stats
            const patternStats = await this._getOne(`
                SELECT 
                    COUNT(*) as total_patterns,
                    AVG(confidence_score) as avg_confidence,
                    AVG(sample_count) as avg_samples
                FROM ai_learned_patterns
                ${organizationId ? 'WHERE organization_id = ?' : ''}
            `, organizationId ? [organizationId] : []);

            // Top performing capabilities
            const topCapabilities = await this._getAll(`
                SELECT 
                    request_type,
                    COUNT(*) as count,
                    AVG(auto_feedback_score) as avg_score
                FROM ai_learning_interactions
                ${whereClause}
                GROUP BY request_type
                ORDER BY avg_score DESC
                LIMIT 10
            `, params);

            // Recent jobs
            const recentJobs = await this._getAll(`
                SELECT job_type, status, duration_ms, records_processed, patterns_extracted, created_at
                FROM ai_learning_jobs
                ORDER BY created_at DESC
                LIMIT 10
            `);

            // Learning trend (last 7 days)
            const trend = await this._getAll(`
                SELECT 
                    date(created_at) as date,
                    COUNT(*) as interactions,
                    AVG(auto_feedback_score) as avg_score
                FROM ai_learning_interactions
                ${whereClause ? whereClause + ' AND' : 'WHERE'} 
                    created_at >= datetime('now', '-7 days')
                GROUP BY date(created_at)
                ORDER BY date DESC
            `, params);

            return {
                totalInteractions: stats?.total_interactions || 0,
                averageFeedback: Math.round((stats?.avg_feedback || 0) * 100) / 100,
                averageQuality: Math.round((stats?.avg_quality || 0) * 100) / 100,
                averageAutoFeedback: Math.round((stats?.avg_auto_feedback || 0) * 100) / 100,
                organizationCount: stats?.organizations || 0,
                capabilityCount: stats?.capabilities || 0,
                averageLatency: Math.round(stats?.avg_latency || 0),
                totalTokens: stats?.total_tokens || 0,
                patterns: {
                    total: patternStats?.total_patterns || 0,
                    avgConfidence: Math.round((patternStats?.avg_confidence || 0) * 100) / 100,
                    avgSamples: Math.round(patternStats?.avg_samples || 0)
                },
                topCapabilities: topCapabilities || [],
                recentJobs: recentJobs || [],
                trend: trend || []
            };
        } catch (error) {
            aiLogger.debug('LearningSystem', `Analytics failed: ${error.message}`);
            return {
                totalInteractions: 0,
                averageQuality: 0,
                error: error.message
            };
        }
    }

    /**
     * Get job history
     */
    async getJobHistory(limit = 50) {
        return this._getAll(`
            SELECT * FROM ai_learning_jobs
            ORDER BY created_at DESC
            LIMIT ?
        `, [limit]);
    }

    // ========================================================================
    // PROMPT SUGGESTIONS
    // ========================================================================

    /**
     * Generate prompt refinement suggestions
     */
    async getPromptSuggestions(organizationId, requestType) {
        const patterns = await this.getPatterns(organizationId, requestType);
        const suggestions = [];

        if (patterns.confidence < 0.3) {
            return {
                suggestions: [],
                message: 'Insufficient data for suggestions (need more interactions)'
            };
        }

        // Analyze failed patterns
        if (patterns.failed.length > 0) {
            suggestions.push({
                type: 'AVOID',
                priority: 'HIGH',
                description: `${patterns.failed.length} patterns lead to poor responses`,
                recommendation: 'Review and modify prompts to avoid these patterns',
                patterns: patterns.failed.slice(0, 3)
            });
        }

        // Analyze successful patterns
        if (patterns.successful.length > 0) {
            suggestions.push({
                type: 'REINFORCE',
                priority: 'MEDIUM',
                description: `${patterns.successful.length} patterns lead to good responses`,
                recommendation: 'Reinforce these patterns in system prompts',
                patterns: patterns.successful.slice(0, 3)
            });
        }

        // Add AI-generated suggestions
        if (patterns.suggestions && patterns.suggestions.length > 0) {
            for (const s of patterns.suggestions) {
                suggestions.push({
                    type: s.type,
                    priority: 'MEDIUM',
                    description: s.description,
                    recommendation: s.description
                });
            }
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

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Hash prompt for pattern matching
     */
    hashPrompt(prompt) {
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
     * Extract a signature from prompt (first 100 chars, normalized)
     */
    extractPromptSignature(prompt) {
        if (!prompt) return 'empty';
        return prompt
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100);
    }

    /**
     * Extract a signature from response (structure indicators)
     */
    extractResponseSignature(response) {
        if (!response) return 'empty';

        const indicators = [];

        // Check for structure elements
        if (response.includes('##') || response.includes('**')) indicators.push('formatted');
        if (response.includes('1.') || response.includes('- ')) indicators.push('list');
        if (response.includes('```')) indicators.push('code');
        if (response.length > 2000) indicators.push('detailed');
        else if (response.length < 300) indicators.push('concise');
        else indicators.push('balanced');

        return indicators.join(',');
    }

    // ========================================================================
    // DATABASE HELPERS
    // ========================================================================

    async _runQuery(sql, params = []) {
        if (!deps.db || !deps.db.run) return null;
        return new Promise((resolve, reject) => {
            deps.db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes, lastID: this.lastID });
            });
        });
    }

    async _getOne(sql, params = []) {
        if (!deps.db || !deps.db.get) return null;
        return new Promise((resolve, reject) => {
            deps.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async _getAll(sql, params = []) {
        if (!deps.db || !deps.db.all) return [];
        return new Promise((resolve, reject) => {
            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
}

// Singleton instance
const learningSystem = new LearningSystem();

export default {
    LearningSystem,
    learningSystem,
    CONFIG
};
