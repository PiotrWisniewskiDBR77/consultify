/**
 * Response Quality Scoring Service
 * 
 * Real-time evaluation and scoring of AI responses:
 * - Relevance to query
 * - Groundedness (hallucination prevention)
 * - Completeness
 * - Coherence
 * 
 * Part of UX Excellence - Phase 4.4
 * 
 * @module responseQualityService
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _aiLogger: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get aiLogger() { return this._aiLogger; },
    set aiLogger(val) { this._aiLogger = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../../database.js');
        deps._db = db;
    }
    if (!deps._aiLogger) {
        const { aiLogger } = await import('./logger.js');
        deps._aiLogger = aiLogger;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.aiLogger) deps.aiLogger = newDeps.aiLogger;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
}

// Quality levels
const QUALITY_LEVELS = {
    EXCELLENT: 'EXCELLENT',  // >= 0.9
    GOOD: 'GOOD',            // >= 0.7
    FAIR: 'FAIR',            // >= 0.5
    POOR: 'POOR'             // < 0.5
};

// Weights for overall score calculation
const WEIGHTS = {
    relevance: 0.35,
    groundedness: 0.30,
    completeness: 0.20,
    coherence: 0.15
};

const ResponseQualityService = {
    QUALITY_LEVELS,

    /**
     * Calculate comprehensive quality metrics for an AI response
     * @param {object} params - { query, response, context, sources }
     * @returns {Promise<object>} Quality metrics
     */
    calculateQuality: async ({ query, response, context = {}, sources = [] }) => {
        await initDeps();
        const startTime = Date.now();

        try {
            // Calculate individual metrics
            const relevance = await ResponseQualityService._calculateRelevance(query, response, context);
            const groundedness = await ResponseQualityService._calculateGroundedness(response, sources);
            const completeness = await ResponseQualityService._calculateCompleteness(query, response);
            const coherence = ResponseQualityService._calculateCoherence(response);

            // Calculate weighted overall score
            const overall = (
                relevance * WEIGHTS.relevance +
                groundedness * WEIGHTS.groundedness +
                completeness * WEIGHTS.completeness +
                coherence * WEIGHTS.coherence
            );

            // Determine quality level
            const qualityLevel = ResponseQualityService._getQualityLevel(overall);

            // Generate recommendation if quality is not excellent
            const recommendation = ResponseQualityService._generateRecommendation({
                relevance,
                groundedness,
                completeness,
                coherence,
                qualityLevel
            });

            const metrics = {
                relevance,
                groundedness,
                completeness,
                coherence,
                overall,
                qualityLevel,
                recommendation,
                calculationTimeMs: Date.now() - startTime
            };

            // Log metrics for analysis
            await ResponseQualityService._logQualityMetrics(metrics, query, context);

            return metrics;

        } catch (error) {
            deps.aiLogger.error('ResponseQuality', `Error calculating quality: ${error.message}`);
            return {
                relevance: 0.5,
                groundedness: 0.5,
                completeness: 0.5,
                coherence: 0.5,
                overall: 0.5,
                qualityLevel: QUALITY_LEVELS.FAIR,
                recommendation: 'Unable to fully evaluate response quality',
                calculationTimeMs: Date.now() - startTime,
                error: error.message
            };
        }
    },

    /**
     * Calculate relevance score (how well response addresses the query)
     */
    _calculateRelevance: async (query, response, context) => {
        if (!query || !response) return 0.5;

        const queryLower = query.toLowerCase();
        const responseLower = response.toLowerCase();

        // Extract key terms from query
        const queryTerms = ResponseQualityService._extractKeyTerms(queryLower);

        // Check term coverage in response
        let coveredTerms = 0;
        queryTerms.forEach(term => {
            if (responseLower.includes(term)) {
                coveredTerms++;
            }
        });

        const termCoverage = queryTerms.length > 0 
            ? coveredTerms / queryTerms.length 
            : 0.5;

        // Check for question answering patterns
        const questionPatterns = [
            { pattern: /^(what|who|where|when|why|how)/i, weight: 0.2 },
            { pattern: /\?$/, weight: 0.1 }
        ];

        let questionBonus = 0;
        questionPatterns.forEach(({ pattern, weight }) => {
            if (pattern.test(query) && response.length > 50) {
                questionBonus += weight;
            }
        });

        // Context relevance bonus
        let contextBonus = 0;
        if (context.screenContext?.screenId) {
            const screenTerms = context.screenContext.screenId.split('_');
            screenTerms.forEach(term => {
                if (responseLower.includes(term.toLowerCase())) {
                    contextBonus += 0.05;
                }
            });
        }

        // Combine scores
        const score = Math.min(1, termCoverage * 0.6 + questionBonus + contextBonus + 0.2);
        return Math.round(score * 100) / 100;
    },

    /**
     * Calculate groundedness score (how well response is supported by sources)
     */
    _calculateGroundedness: async (response, sources) => {
        if (!response) return 0.5;
        if (!sources || sources.length === 0) {
            // No sources to verify against - assume moderate groundedness
            return 0.6;
        }

        const responseSentences = ResponseQualityService._splitSentences(response);
        if (responseSentences.length === 0) return 0.5;

        const allSourceContent = sources.map(s => s.content || s).join(' ').toLowerCase();
        const sourceTerms = ResponseQualityService._extractKeyTerms(allSourceContent);

        let groundedSentences = 0;
        responseSentences.forEach(sentence => {
            const sentenceLower = sentence.toLowerCase();
            const sentenceTerms = ResponseQualityService._extractKeyTerms(sentenceLower);

            // Check how many sentence terms appear in sources
            const matchingTerms = sentenceTerms.filter(term => 
                sourceTerms.includes(term) || allSourceContent.includes(term)
            );

            // Consider grounded if >50% of significant terms are found
            if (sentenceTerms.length > 0 && matchingTerms.length / sentenceTerms.length >= 0.5) {
                groundedSentences++;
            } else if (sentenceTerms.length <= 2) {
                // Very short sentences (like connectors) are considered grounded
                groundedSentences++;
            }
        });

        const score = groundedSentences / responseSentences.length;
        return Math.round(score * 100) / 100;
    },

    /**
     * Calculate completeness score (how comprehensively the query is addressed)
     */
    _calculateCompleteness: async (query, response) => {
        if (!query || !response) return 0.5;

        const responseLength = response.length;
        const queryLength = query.length;

        // Length heuristics
        let lengthScore = 0.5;
        if (responseLength > queryLength * 2) lengthScore = 0.7;
        if (responseLength > queryLength * 5) lengthScore = 0.85;
        if (responseLength > queryLength * 10) lengthScore = 0.95;

        // Check for structured response indicators
        const structureIndicators = [
            /\d+\.\s/g,          // Numbered lists
            /[-•]\s/g,           // Bullet points
            /\n\n/g,             // Paragraphs
            /^#+\s/gm,           // Headers
            /```/g,              // Code blocks
            /\*\*/g              // Bold text
        ];

        let structureScore = 0;
        structureIndicators.forEach(pattern => {
            if (pattern.test(response)) {
                structureScore += 0.1;
            }
        });
        structureScore = Math.min(0.3, structureScore);

        // Check for completeness markers
        const completenessMarkers = [
            'in summary',
            'in conclusion',
            'to summarize',
            'overall',
            'therefore',
            'as a result',
            'hope this helps',
            'let me know if'
        ];

        let conclusionBonus = 0;
        completenessMarkers.forEach(marker => {
            if (response.toLowerCase().includes(marker)) {
                conclusionBonus = 0.1;
            }
        });

        const score = Math.min(1, lengthScore + structureScore + conclusionBonus);
        return Math.round(score * 100) / 100;
    },

    /**
     * Calculate coherence score (logical flow and readability)
     */
    _calculateCoherence: (response) => {
        if (!response) return 0.5;

        const sentences = ResponseQualityService._splitSentences(response);
        if (sentences.length === 0) return 0.5;

        let score = 0.6; // Base score

        // Check for transition words (indicates logical flow)
        const transitionWords = [
            'however', 'therefore', 'moreover', 'furthermore', 'additionally',
            'first', 'second', 'third', 'finally', 'next', 'then',
            'because', 'since', 'as a result', 'consequently',
            'for example', 'for instance', 'specifically',
            'in addition', 'on the other hand', 'nevertheless'
        ];

        const responseLower = response.toLowerCase();
        let transitionCount = 0;
        transitionWords.forEach(word => {
            if (responseLower.includes(word)) {
                transitionCount++;
            }
        });

        // More transitions = better coherence (up to a point)
        const transitionBonus = Math.min(0.2, transitionCount * 0.04);
        score += transitionBonus;

        // Check sentence length consistency (very long or very short sentences hurt coherence)
        const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
        if (avgSentenceLength > 50 && avgSentenceLength < 200) {
            score += 0.1; // Good sentence length
        }

        // Penalize very repetitive responses
        const words = responseLower.split(/\s+/);
        const uniqueWords = new Set(words);
        const uniqueRatio = uniqueWords.size / words.length;
        if (uniqueRatio > 0.5) {
            score += 0.1; // Good vocabulary variety
        }

        return Math.min(1, Math.round(score * 100) / 100);
    },

    /**
     * Determine quality level from overall score
     */
    _getQualityLevel: (score) => {
        if (score >= 0.9) return QUALITY_LEVELS.EXCELLENT;
        if (score >= 0.7) return QUALITY_LEVELS.GOOD;
        if (score >= 0.5) return QUALITY_LEVELS.FAIR;
        return QUALITY_LEVELS.POOR;
    },

    /**
     * Generate improvement recommendation based on metrics
     */
    _generateRecommendation: ({ relevance, groundedness, completeness, coherence, qualityLevel }) => {
        if (qualityLevel === QUALITY_LEVELS.EXCELLENT) {
            return null;
        }

        const issues = [];

        if (relevance < 0.7) {
            issues.push('Response could be more directly related to your question');
        }
        if (groundedness < 0.6) {
            issues.push('Some statements may need verification');
        }
        if (completeness < 0.6) {
            issues.push('Ask follow-up questions for more detail');
        }
        if (coherence < 0.6) {
            issues.push('Response structure could be clearer');
        }

        if (issues.length === 0) {
            return 'Overall good response with minor areas for improvement';
        }

        return issues[0]; // Return the most significant issue
    },

    /**
     * Extract key terms from text (simple tokenization + stopword removal)
     */
    _extractKeyTerms: (text) => {
        if (!text) return [];

        const stopwords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
            'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
            'above', 'below', 'between', 'under', 'again', 'further', 'then',
            'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
            'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
            'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but',
            'or', 'if', 'because', 'as', 'until', 'while', 'this', 'that',
            'these', 'those', 'it', 'its', 'my', 'your', 'his', 'her', 'we',
            'they', 'i', 'me', 'you', 'he', 'she', 'what', 'which', 'who'
        ]);

        return text
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopwords.has(word))
            .slice(0, 50); // Limit to prevent performance issues
    },

    /**
     * Split text into sentences
     */
    _splitSentences: (text) => {
        if (!text) return [];
        return text
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 10);
    },

    /**
     * Log quality metrics for analysis
     */
    _logQualityMetrics: async (metrics, query, context) => {
        await initDeps();
        return new Promise((resolve) => {
            deps.db.run(`
                INSERT INTO ai_quality_metrics (
                    id, organization_id, project_id,
                    relevance, groundedness, completeness, coherence, overall,
                    quality_level, query_length, response_time_ms,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                deps.uuidv4(),
                context.organizationId || null,
                context.projectId || null,
                metrics.relevance,
                metrics.groundedness,
                metrics.completeness,
                metrics.coherence,
                metrics.overall,
                metrics.qualityLevel,
                query?.length || 0,
                metrics.calculationTimeMs,
                new Date().toISOString()
            ], (err) => {
                if (err) {
                    deps.aiLogger.error('ResponseQuality', `Failed to log quality metrics: ${err.message}`);
                }
                resolve();
            });
        });
    },

    /**
     * Get aggregate quality metrics for reporting
     */
    getAggregateMetrics: async (organizationId, days = 30) => {
        await initDeps();
        return new Promise((resolve) => {
            deps.db.get(`
                SELECT 
                    AVG(relevance) as avgRelevance,
                    AVG(groundedness) as avgGroundedness,
                    AVG(completeness) as avgCompleteness,
                    AVG(coherence) as avgCoherence,
                    AVG(overall) as avgOverall,
                    COUNT(*) as totalResponses,
                    SUM(CASE WHEN quality_level = 'EXCELLENT' THEN 1 ELSE 0 END) as excellentCount,
                    SUM(CASE WHEN quality_level = 'GOOD' THEN 1 ELSE 0 END) as goodCount,
                    SUM(CASE WHEN quality_level = 'FAIR' THEN 1 ELSE 0 END) as fairCount,
                    SUM(CASE WHEN quality_level = 'POOR' THEN 1 ELSE 0 END) as poorCount
                FROM ai_quality_metrics
                WHERE (organization_id = ? OR organization_id IS NULL)
                  AND created_at >= datetime('now', '-' || ? || ' days')
            `, [organizationId, days], (err, row) => {
                if (err) {
                    deps.aiLogger.error('ResponseQuality', `Failed to get aggregate metrics: ${err.message}`);
                    return resolve(null);
                }
                resolve(row);
            });
        });
    },

    /**
     * Get quality trends over time
     */
    getQualityTrends: async (organizationId, days = 30) => {
        await initDeps();
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    DATE(created_at) as date,
                    AVG(overall) as avgQuality,
                    COUNT(*) as responseCount
                FROM ai_quality_metrics
                WHERE (organization_id = ? OR organization_id IS NULL)
                  AND created_at >= datetime('now', '-' || ? || ' days')
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `, [organizationId, days], (err, rows) => {
                if (err) {
                    deps.aiLogger.error('ResponseQuality', `Failed to get quality trends: ${err.message}`);
                    return resolve([]);
                }
                resolve(rows || []);
            });
        });
    },

    /**
     * Set dependencies (for testing)
     */
    setDependencies
};

export default ResponseQualityService;


