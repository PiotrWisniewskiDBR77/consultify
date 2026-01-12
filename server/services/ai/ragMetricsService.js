/**
 * RAG Quality Metrics Service
 * 
 * Tracks and measures Retrieval Augmented Generation quality metrics:
 * - Retrieval precision and recall
 * - Context relevance scoring
 * - Answer groundedness
 * - Source attribution accuracy
 * 
 * Part of Enterprise AI Readiness - Phase 5: Quality Metrics
 * 
 * @version 1.0.0
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _uuidv4: null,
    _aiLogger: null,
    _OpenAI: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; },

    get aiLogger() { return this._aiLogger; },
    set aiLogger(val) { this._aiLogger = val; },

    get OpenAI() { return this._OpenAI; },
    set OpenAI(val) { this._OpenAI = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../../database.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
    if (!deps._aiLogger) {
        const { aiLogger } = await import('./logger.js');
        deps._aiLogger = aiLogger;
    }
    if (!deps._OpenAI) {
        const { OpenAI } = await import('openai');
        deps._OpenAI = OpenAI;
    }
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
    if (newDeps.aiLogger) deps.aiLogger = newDeps.aiLogger;
    if (newDeps.OpenAI) deps.OpenAI = newDeps.OpenAI;
}

// RAG quality thresholds
const THRESHOLDS = {
    EXCELLENT: 0.9,
    GOOD: 0.7,
    FAIR: 0.5,
    POOR: 0
};

const RAGMetricsService = {
    /**
     * Record a RAG query result for metrics
     */
    recordQuery: async (queryData) => {
        const {
            organizationId,
            projectId,
            userId,
            query,
            retrievedDocuments,
            selectedDocuments,
            response,
            userFeedback = null
        } = queryData;

        await initDeps();
        const id = deps.uuidv4();
        const now = new Date().toISOString();

        // Calculate automatic metrics
        const metrics = RAGMetricsService.calculateMetrics({
            retrievedDocuments,
            selectedDocuments,
            query,
            response
        });

        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO rag_quality_metrics (
                    id, organization_id, project_id, user_id,
                    query_hash, query_length,
                    docs_retrieved, docs_used, docs_relevant,
                    retrieval_precision, retrieval_recall,
                    context_relevance_score, answer_groundedness,
                    response_length, latency_ms,
                    user_rating, user_feedback,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                organizationId,
                projectId,
                userId,
                RAGMetricsService._hashQuery(query),
                query.length,
                retrievedDocuments?.length || 0,
                selectedDocuments?.length || 0,
                metrics.relevantDocs,
                metrics.precision,
                metrics.recall,
                metrics.contextRelevance,
                metrics.groundedness,
                response?.length || 0,
                metrics.latencyMs || 0,
                userFeedback?.rating || null,
                userFeedback?.comment || null,
                now
            ], function(err) {
                if (err) {
                    deps.aiLogger.error('RAGMetrics', `Failed to record query: ${err.message}`);
                    return reject(err);
                }
                
                deps.aiLogger.info('RAGMetrics', `Recorded query metrics: precision=${metrics.precision.toFixed(2)}, relevance=${metrics.contextRelevance.toFixed(2)}`);
                resolve({ id, ...metrics });
            });
        });
    },

    /**
     * Calculate RAG quality metrics
     */
    calculateMetrics: ({ retrievedDocuments, selectedDocuments, query, response }) => {
        const docsRetrieved = retrievedDocuments?.length || 0;
        const docsUsed = selectedDocuments?.length || 0;
        
        // Calculate relevance for each retrieved document
        const relevantDocs = retrievedDocuments?.filter(doc => {
            const score = RAGMetricsService.calculateRelevanceScore(query, doc.content);
            return score >= THRESHOLDS.FAIR;
        }).length || 0;

        // Precision: relevant docs / retrieved docs
        const precision = docsRetrieved > 0 ? relevantDocs / docsRetrieved : 0;
        
        // Recall: used docs that are relevant / total relevant in corpus (estimated)
        // Since we don't know total relevant docs, we use docs used as proxy
        const recall = relevantDocs > 0 && docsUsed > 0 
            ? Math.min(1, docsUsed / relevantDocs) 
            : 0;

        // Context relevance: average relevance score of used documents
        const contextRelevance = selectedDocuments?.length > 0
            ? selectedDocuments.reduce((sum, doc) => {
                return sum + RAGMetricsService.calculateRelevanceScore(query, doc.content);
            }, 0) / selectedDocuments.length
            : 0;

        // Groundedness: check if response is grounded in sources
        const groundedness = RAGMetricsService.calculateGroundedness(response, selectedDocuments);

        return {
            docsRetrieved,
            docsUsed,
            relevantDocs,
            precision,
            recall,
            contextRelevance,
            groundedness,
            latencyMs: 0 // To be filled by caller
        };
    },

    /**
     * Calculate relevance score between query and document
     */
    calculateRelevanceScore: (query, documentContent) => {
        if (!query || !documentContent) return 0;

        const queryTokens = RAGMetricsService._tokenize(query.toLowerCase());
        const docTokens = RAGMetricsService._tokenize(documentContent.toLowerCase());
        
        if (queryTokens.length === 0 || docTokens.length === 0) return 0;

        // TF-IDF-like scoring
        const docTokenSet = new Set(docTokens);
        const matchingTokens = queryTokens.filter(t => docTokenSet.has(t));
        
        // Jaccard similarity + keyword boost
        const union = new Set([...queryTokens, ...docTokens]);
        const intersection = matchingTokens.length;
        
        const jaccardScore = union.size > 0 ? intersection / union.size : 0;
        
        // Boost for exact phrase matches
        const phraseBoost = documentContent.toLowerCase().includes(query.toLowerCase()) ? 0.2 : 0;
        
        return Math.min(1, jaccardScore * 2 + phraseBoost);
    },

    /**
     * Calculate groundedness of response in source documents
     */
    calculateGroundedness: (response, sourceDocuments) => {
        if (!response || !sourceDocuments || sourceDocuments.length === 0) return 0;

        const responseSentences = RAGMetricsService._splitSentences(response);
        if (responseSentences.length === 0) return 0;

        const allSourceContent = sourceDocuments.map(d => d.content || '').join(' ').toLowerCase();
        
        let groundedSentences = 0;
        responseSentences.forEach(sentence => {
            const sentenceTokens = RAGMetricsService._tokenize(sentence.toLowerCase());
            const matchRatio = sentenceTokens.filter(t => 
                allSourceContent.includes(t)
            ).length / Math.max(sentenceTokens.length, 1);
            
            if (matchRatio >= 0.5) {
                groundedSentences++;
            }
        });

        return groundedSentences / responseSentences.length;
    },

    /**
     * Get aggregated metrics for dashboard
     */
    getAggregatedMetrics: async (organizationId, periodDays = 7) => {
        await initDeps();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - periodDays);

        return new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_queries,
                    AVG(retrieval_precision) as avg_precision,
                    AVG(retrieval_recall) as avg_recall,
                    AVG(context_relevance_score) as avg_relevance,
                    AVG(answer_groundedness) as avg_groundedness,
                    AVG(CASE WHEN user_rating IS NOT NULL THEN user_rating ELSE NULL END) as avg_user_rating,
                    SUM(CASE WHEN retrieval_precision >= 0.7 THEN 1 ELSE 0 END) as high_quality_queries
                FROM rag_quality_metrics
                WHERE organization_id = ? AND created_at >= ?
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `, [organizationId, cutoffDate.toISOString()], (err, rows) => {
                if (err) {
                    aiLogger.error('RAGMetrics', `Failed to get aggregated metrics: ${err.message}`);
                    return resolve({ daily: [], summary: {} });
                }

                // Calculate summary
                const summary = {
                    totalQueries: 0,
                    avgPrecision: 0,
                    avgRecall: 0,
                    avgRelevance: 0,
                    avgGroundedness: 0,
                    avgUserRating: 0,
                    highQualityRate: 0
                };

                if (rows && rows.length > 0) {
                    summary.totalQueries = rows.reduce((s, r) => s + r.total_queries, 0);
                    summary.avgPrecision = rows.reduce((s, r) => s + (r.avg_precision || 0), 0) / rows.length;
                    summary.avgRecall = rows.reduce((s, r) => s + (r.avg_recall || 0), 0) / rows.length;
                    summary.avgRelevance = rows.reduce((s, r) => s + (r.avg_relevance || 0), 0) / rows.length;
                    summary.avgGroundedness = rows.reduce((s, r) => s + (r.avg_groundedness || 0), 0) / rows.length;
                    
                    const ratedRows = rows.filter(r => r.avg_user_rating !== null);
                    if (ratedRows.length > 0) {
                        summary.avgUserRating = ratedRows.reduce((s, r) => s + r.avg_user_rating, 0) / ratedRows.length;
                    }
                    
                    const totalHighQuality = rows.reduce((s, r) => s + r.high_quality_queries, 0);
                    summary.highQualityRate = summary.totalQueries > 0 ? totalHighQuality / summary.totalQueries : 0;
                }

                // Determine overall quality level
                summary.qualityLevel = RAGMetricsService.getQualityLevel(summary.avgPrecision);

                resolve({
                    daily: rows || [],
                    summary,
                    period: {
                        days: periodDays,
                        start: cutoffDate.toISOString(),
                        end: new Date().toISOString()
                    }
                });
            });
        });
    },

    /**
     * Update user feedback for a query
     */
    updateUserFeedback: async (queryId, feedback) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.run(`
                UPDATE rag_quality_metrics 
                SET user_rating = ?, user_feedback = ?, updated_at = ?
                WHERE id = ?
            `, [
                feedback.rating,
                feedback.comment || null,
                new Date().toISOString(),
                queryId
            ], function(err) {
                if (err) {
                    return reject(err);
                }
                resolve({ updated: this.changes > 0 });
            });
        });
    },

    /**
     * Get quality level label
     */
    getQualityLevel: (score) => {
        if (score >= THRESHOLDS.EXCELLENT) return 'EXCELLENT';
        if (score >= THRESHOLDS.GOOD) return 'GOOD';
        if (score >= THRESHOLDS.FAIR) return 'FAIR';
        return 'POOR';
    },

    /**
     * Get problematic queries for review
     */
    getProblematicQueries: async (organizationId, limit = 20) => {
        await initDeps();
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT id, query_hash, query_length, 
                       retrieval_precision, context_relevance_score, 
                       answer_groundedness, user_rating,
                       created_at
                FROM rag_quality_metrics
                WHERE organization_id = ?
                  AND (retrieval_precision < 0.5 OR context_relevance_score < 0.5 OR user_rating < 3)
                ORDER BY created_at DESC
                LIMIT ?
            `, [organizationId, limit], (err, rows) => {
                if (err) {
                    return resolve([]);
                }
                resolve(rows || []);
            });
        });
    },

    // Private helper methods
    _tokenize: (text) => {
        if (!text) return [];
        return text
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2); // Filter out short words
    },

    _splitSentences: (text) => {
        if (!text) return [];
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10);
    },

    _hashQuery: (query) => {
        // Simple hash for query deduplication
        let hash = 0;
        for (let i = 0; i < query.length; i++) {
            const char = query.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    },

    // ========================================================================
    // HALLUCINATION DETECTION (Phase 1.3)
    // ========================================================================

    /**
     * Detect hallucinations in AI response by verifying grounding in sources
     * Uses NLI-based (Natural Language Inference) verification
     * 
     * @param {string} response - AI-generated response
     * @param {Array} sources - Array of source documents { content, filename }
     * @param {Object} options - { useLLM, threshold, verbose }
     * @returns {Promise<Object>} Hallucination detection results
     */
    detectHallucination: async (response, sources, options = {}) => {
        const {
            useLLM = true,
            threshold = 0.6,
            verbose = false
        } = options;

        if (!response || response.trim().length === 0) {
            return { 
                isHallucinated: false, 
                confidence: 1.0, 
                sentences: [],
                summary: 'Empty response'
            };
        }

        if (!sources || sources.length === 0) {
            return {
                isHallucinated: true,
                confidence: 0.0,
                sentences: [],
                summary: 'No sources provided - cannot verify grounding'
            };
        }

        aiLogger.info('RAGMetrics', `Detecting hallucinations in ${response.length} char response against ${sources.length} sources`);

        // Split response into claims/sentences
        const sentences = RAGMetricsService._extractClaims(response);
        
        if (sentences.length === 0) {
            return {
                isHallucinated: false,
                confidence: 1.0,
                sentences: [],
                summary: 'No verifiable claims found'
            };
        }

        // Combine source content
        const sourceContent = sources.map(s => s.content || '').join('\n\n');

        // Verify each sentence
        const verifiedSentences = [];
        let totalGroundedScore = 0;

        for (const sentence of sentences) {
            let verification;
            
            if (useLLM) {
                verification = await RAGMetricsService._verifyWithLLM(sentence, sourceContent);
            } else {
                verification = RAGMetricsService._verifyWithKeywords(sentence, sourceContent);
            }

            verifiedSentences.push({
                text: sentence,
                ...verification
            });

            totalGroundedScore += verification.groundedScore;
        }

        // Calculate overall hallucination metrics
        const avgGroundedScore = totalGroundedScore / sentences.length;
        const hallucinatedCount = verifiedSentences.filter(s => s.groundedScore < threshold).length;
        const hallucinationRate = hallucinatedCount / sentences.length;

        const result = {
            isHallucinated: avgGroundedScore < threshold,
            confidence: avgGroundedScore,
            hallucinationRate,
            totalClaims: sentences.length,
            groundedClaims: sentences.length - hallucinatedCount,
            hallucinatedClaims: hallucinatedCount,
            sentences: verifiedSentences,
            summary: RAGMetricsService._generateHallucinationSummary(avgGroundedScore, hallucinatedCount, sentences.length),
            qualityLevel: RAGMetricsService.getQualityLevel(avgGroundedScore)
        };

        // Log hallucination detection
        if (result.isHallucinated) {
            aiLogger.warn('RAGMetrics', `Hallucination detected: ${hallucinatedCount}/${sentences.length} claims ungrounded`);
        }

        return result;
    },

    /**
     * Verify a single claim using LLM-based NLI
     */
    _verifyWithLLM: async (claim, sourceContent) => {
        try {
            // Get OpenAI config
            await initDeps();
            const openaiConfig = await new Promise((resolve) => {
                deps.db.get("SELECT * FROM llm_providers WHERE provider = 'openai' AND is_active = 1 LIMIT 1",
                    (err, row) => resolve(row || null));
            });

            if (!openaiConfig) {
                return RAGMetricsService._verifyWithKeywords(claim, sourceContent);
            }

            await initDeps();
            const OpenAI = deps.OpenAI;
            const openai = new OpenAI({ apiKey: openaiConfig.api_key });

            // Truncate source content for context window
            const truncatedSource = sourceContent.substring(0, 6000);

            const prompt = `You are a fact-checker. Determine if the following CLAIM can be supported by the SOURCE documents.

SOURCE DOCUMENTS:
${truncatedSource}

CLAIM TO VERIFY:
"${claim}"

Analyze the claim and respond with ONLY a JSON object:
{
  "verdict": "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "CONTRADICTED",
  "confidence": <number 0.0 to 1.0>,
  "evidence": "<brief quote from sources if found>",
  "explanation": "<one sentence explanation>"
}`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 300
            });

            const resultText = response.choices[0]?.message?.content?.trim() || '';
            
            // Parse JSON response
            let parsed;
            try {
                const cleanedText = resultText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(cleanedText);
            } catch (e) {
                // Fallback parsing
                parsed = {
                    verdict: resultText.includes('SUPPORTED') ? 'SUPPORTED' : 'NOT_SUPPORTED',
                    confidence: resultText.includes('SUPPORTED') ? 0.7 : 0.3,
                    evidence: '',
                    explanation: 'Could not parse LLM response'
                };
            }

            // Convert verdict to grounded score
            const verdictScores = {
                'SUPPORTED': 1.0,
                'PARTIALLY_SUPPORTED': 0.7,
                'NOT_SUPPORTED': 0.2,
                'CONTRADICTED': 0.0
            };

            return {
                groundedScore: verdictScores[parsed.verdict] || 0.5,
                verdict: parsed.verdict || 'UNKNOWN',
                confidence: parsed.confidence || 0.5,
                evidence: parsed.evidence || '',
                explanation: parsed.explanation || '',
                method: 'llm_nli'
            };

        } catch (error) {
            aiLogger.error('RAGMetrics', `LLM verification failed: ${error.message}`);
            return RAGMetricsService._verifyWithKeywords(claim, sourceContent);
        }
    },

    /**
     * Verify a claim using keyword-based matching (fallback)
     */
    _verifyWithKeywords: (claim, sourceContent) => {
        const claimTokens = RAGMetricsService._tokenize(claim.toLowerCase());
        const sourceTokens = new Set(RAGMetricsService._tokenize(sourceContent.toLowerCase()));

        if (claimTokens.length === 0) {
            return {
                groundedScore: 0.5,
                verdict: 'UNKNOWN',
                confidence: 0.5,
                evidence: '',
                explanation: 'Could not tokenize claim',
                method: 'keyword'
            };
        }

        // Calculate token overlap
        const matchedTokens = claimTokens.filter(t => sourceTokens.has(t));
        const overlapRatio = matchedTokens.length / claimTokens.length;

        // Check for exact phrase matches
        const claimLower = claim.toLowerCase();
        const sourceLower = sourceContent.toLowerCase();
        const phraseMatch = sourceLower.includes(claimLower);

        // Calculate final score
        let groundedScore = overlapRatio * 0.7;
        if (phraseMatch) groundedScore += 0.3;
        groundedScore = Math.min(1, groundedScore);

        // Determine verdict
        let verdict;
        if (groundedScore >= 0.8) verdict = 'SUPPORTED';
        else if (groundedScore >= 0.5) verdict = 'PARTIALLY_SUPPORTED';
        else verdict = 'NOT_SUPPORTED';

        return {
            groundedScore,
            verdict,
            confidence: groundedScore,
            evidence: matchedTokens.slice(0, 5).join(', '),
            explanation: `${matchedTokens.length}/${claimTokens.length} key terms found in sources`,
            method: 'keyword'
        };
    },

    /**
     * Extract verifiable claims from response
     */
    _extractClaims: (text) => {
        if (!text) return [];

        // Split into sentences
        const sentences = text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 15);

        // Filter out non-claims (questions, greetings, etc.)
        return sentences.filter(s => {
            const lower = s.toLowerCase();
            // Skip questions
            if (s.includes('?')) return false;
            // Skip meta-statements
            if (lower.startsWith('i think') || lower.startsWith('i believe')) return false;
            if (lower.startsWith('here is') || lower.startsWith('here are')) return false;
            if (lower.includes('let me') || lower.includes('i can help')) return false;
            // Keep factual statements
            return true;
        });
    },

    /**
     * Generate human-readable hallucination summary
     */
    _generateHallucinationSummary: (avgScore, hallucinatedCount, totalCount) => {
        if (avgScore >= 0.9) {
            return 'Excellent: All claims are well-grounded in sources';
        } else if (avgScore >= 0.7) {
            return `Good: Most claims are grounded (${hallucinatedCount} of ${totalCount} may need verification)`;
        } else if (avgScore >= 0.5) {
            return `Fair: Some claims are not fully supported (${hallucinatedCount} of ${totalCount} ungrounded)`;
        } else {
            return `Warning: Significant hallucination detected (${hallucinatedCount} of ${totalCount} claims ungrounded)`;
        }
    },

    /**
     * Get hallucination detection statistics for organization
     */
    getHallucinationStats: async (organizationId, periodDays = 7) => {
        await initDeps();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - periodDays);

        return new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    DATE(created_at) as date,
                    AVG(answer_groundedness) as avg_groundedness,
                    COUNT(*) as total_responses,
                    SUM(CASE WHEN answer_groundedness < 0.6 THEN 1 ELSE 0 END) as hallucinated_count
                FROM rag_quality_metrics
                WHERE organization_id = ? AND created_at >= ?
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `, [organizationId, cutoffDate.toISOString()], (err, rows) => {
                if (err) {
                    aiLogger.error('RAGMetrics', `Failed to get hallucination stats: ${err.message}`);
                    return resolve({ daily: [], summary: {} });
                }

                const totalResponses = rows.reduce((s, r) => s + r.total_responses, 0);
                const totalHallucinated = rows.reduce((s, r) => s + r.hallucinated_count, 0);

                resolve({
                    daily: rows || [],
                    summary: {
                        totalResponses,
                        hallucinatedResponses: totalHallucinated,
                        hallucinationRate: totalResponses > 0 ? totalHallucinated / totalResponses : 0,
                        avgGroundedness: rows.length > 0 
                            ? rows.reduce((s, r) => s + r.avg_groundedness, 0) / rows.length 
                            : 0
                    }
                });
            });
        });
    },

    // ========================================================================
    // RESPONSE QUALITY SCORING (Phase 4.4)
    // ========================================================================

    /**
     * Calculate comprehensive quality score for AI response
     * @param {string} response - AI response
     * @param {string} query - Original user query
     * @param {Array} sources - Retrieved sources
     * @returns {Object} Quality score breakdown
     */
    calculateResponseQuality: async (response, query, sources) => {
        const scores = {
            relevance: 0,
            completeness: 0,
            groundedness: 0,
            coherence: 0,
            overall: 0
        };

        // 1. Relevance: Does response address the query?
        scores.relevance = RAGMetricsService.calculateRelevanceScore(query, response);

        // 2. Completeness: Does response fully answer the query?
        const queryTokens = RAGMetricsService._tokenize(query.toLowerCase());
        const responseTokens = RAGMetricsService._tokenize(response.toLowerCase());
        const coverageRatio = queryTokens.filter(t => responseTokens.includes(t)).length / Math.max(queryTokens.length, 1);
        scores.completeness = Math.min(1, coverageRatio * 1.5);

        // 3. Groundedness: Is response grounded in sources?
        const hallucinationResult = await RAGMetricsService.detectHallucination(response, sources, { useLLM: false });
        scores.groundedness = hallucinationResult.confidence;

        // 4. Coherence: Is response well-structured?
        scores.coherence = RAGMetricsService._calculateCoherence(response);

        // 5. Overall weighted score
        scores.overall = (
            scores.relevance * 0.3 +
            scores.completeness * 0.2 +
            scores.groundedness * 0.35 +
            scores.coherence * 0.15
        );

        return {
            ...scores,
            qualityLevel: RAGMetricsService.getQualityLevel(scores.overall),
            recommendation: RAGMetricsService._getQualityRecommendation(scores)
        };
    },

    /**
     * Calculate coherence score for response
     */
    _calculateCoherence: (response) => {
        if (!response) return 0;

        let score = 0.5; // Base score

        // Check for structure indicators
        const hasLists = /[-•*]\s/.test(response) || /\d+\.\s/.test(response);
        const hasParagraphs = response.split('\n\n').length > 1;
        const hasHeaders = /#{1,3}\s/.test(response);
        const avgSentenceLength = response.length / Math.max(RAGMetricsService._splitSentences(response).length, 1);

        if (hasLists) score += 0.15;
        if (hasParagraphs) score += 0.1;
        if (hasHeaders) score += 0.1;
        
        // Penalize very long or very short sentences
        if (avgSentenceLength > 20 && avgSentenceLength < 150) score += 0.15;

        return Math.min(1, score);
    },

    /**
     * Get quality improvement recommendation
     */
    _getQualityRecommendation: (scores) => {
        const issues = [];
        
        if (scores.relevance < 0.6) issues.push('Response may not fully address the question');
        if (scores.completeness < 0.6) issues.push('Response may be incomplete');
        if (scores.groundedness < 0.6) issues.push('Some claims may not be fully supported by sources');
        if (scores.coherence < 0.6) issues.push('Response could be better structured');

        if (issues.length === 0) {
            return 'Response meets quality standards';
        }

        return issues.join('; ');
    },

    /**
     * Set dependencies (for testing)
     */
    setDependencies
};

export default RAGMetricsService;

