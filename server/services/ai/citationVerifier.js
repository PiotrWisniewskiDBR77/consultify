/**
 * Citation Verifier Service
 * 
 * Verifies that citations in AI responses accurately reference source content.
 * Part of RAG Excellence - Phase 1.4
 * 
 * Features:
 * - Extract citations from response
 * - Verify citation accuracy against sources
 * - Calculate citation quality metrics
 * - Flag unsupported or incorrect citations
 * 
 * @module citationVerifier
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

// Citation patterns to detect
const CITATION_PATTERNS = {
    BRACKET_NUMBER: /\[(\d+)\]/g,                          // [1], [2], etc.
    BRACKET_SOURCE: /\[Source:\s*([^\]]+)\]/gi,            // [Source: filename.pdf]
    PARENTHETICAL: /\(([^)]+,\s*\d{4})\)/g,               // (Author, 2024)
    INLINE_REFERENCE: /according to\s+"?([^",.]+)"?/gi,    // according to Document X
    FOOTNOTE: /\[\^(\d+)\]/g,                              // [^1], [^2] (markdown footnotes)
    NAMED_SOURCE: /from\s+"([^"]+)"/gi                     // from "Document Name"
};

const CitationVerifier = {
    /**
     * Verify all citations in a response
     * 
     * @param {string} response - AI-generated response with citations
     * @param {Array} sources - Array of { content, filename, id } source documents
     * @param {Object} options - { strictMode, minConfidence }
     * @returns {Promise<Object>} Citation verification results
     */
    verifyCitations: async (response, sources, options = {}) => {
        const {
            strictMode = false,
            minConfidence = 0.5
        } = options;

        if (!response || response.trim().length === 0) {
            return {
                valid: true,
                totalCitations: 0,
                verifiedCitations: 0,
                unverifiedCitations: 0,
                citations: [],
                accuracy: 1.0,
                summary: 'No citations to verify'
            };
        }

        await initDeps();
        deps.aiLogger.info('CitationVerifier', `Verifying citations in ${response.length} char response`);

        // Extract all citations from response
        const extractedCitations = CitationVerifier._extractCitations(response);

        if (extractedCitations.length === 0) {
            return {
                valid: true,
                totalCitations: 0,
                verifiedCitations: 0,
                unverifiedCitations: 0,
                citations: [],
                accuracy: 1.0,
                summary: 'No citations found in response'
            };
        }

        // Create source lookup map
        const sourceMap = new Map();
        sources.forEach((source, idx) => {
            sourceMap.set(String(idx + 1), source);
            sourceMap.set(source.filename?.toLowerCase() || '', source);
            sourceMap.set(source.id || '', source);
        });

        // Verify each citation
        const verificationResults = [];
        
        for (const citation of extractedCitations) {
            const result = await CitationVerifier._verifySingleCitation(
                citation,
                response,
                sourceMap,
                sources,
                { strictMode, minConfidence }
            );
            verificationResults.push(result);
        }

        // Calculate overall metrics
        const verifiedCount = verificationResults.filter(r => r.verified).length;
        const accuracy = extractedCitations.length > 0 
            ? verifiedCount / extractedCitations.length 
            : 1.0;

        const result = {
            valid: accuracy >= minConfidence,
            totalCitations: extractedCitations.length,
            verifiedCitations: verifiedCount,
            unverifiedCitations: extractedCitations.length - verifiedCount,
            citations: verificationResults,
            accuracy,
            qualityLevel: CitationVerifier._getQualityLevel(accuracy),
            summary: CitationVerifier._generateSummary(verificationResults, accuracy),
            recommendations: CitationVerifier._generateRecommendations(verificationResults)
        };

        // Log results
        if (!result.valid) {
            deps.aiLogger.warn('CitationVerifier', `Citation verification failed: ${verifiedCount}/${extractedCitations.length} verified`);
        }

        return result;
    },

    /**
     * Extract all citations from response text
     */
    _extractCitations: (response) => {
        const citations = [];
        const seen = new Set();

        // Pattern 1: [1], [2], etc.
        let match;
        while ((match = CITATION_PATTERNS.BRACKET_NUMBER.exec(response)) !== null) {
            const key = `bracket_${match[1]}`;
            if (!seen.has(key)) {
                citations.push({
                    type: 'bracket_number',
                    reference: match[1],
                    fullMatch: match[0],
                    position: match.index,
                    context: CitationVerifier._getContext(response, match.index)
                });
                seen.add(key);
            }
        }

        // Pattern 2: [Source: filename.pdf]
        CITATION_PATTERNS.BRACKET_SOURCE.lastIndex = 0;
        while ((match = CITATION_PATTERNS.BRACKET_SOURCE.exec(response)) !== null) {
            const key = `source_${match[1].toLowerCase()}`;
            if (!seen.has(key)) {
                citations.push({
                    type: 'bracket_source',
                    reference: match[1].trim(),
                    fullMatch: match[0],
                    position: match.index,
                    context: CitationVerifier._getContext(response, match.index)
                });
                seen.add(key);
            }
        }

        // Pattern 3: (Author, 2024)
        CITATION_PATTERNS.PARENTHETICAL.lastIndex = 0;
        while ((match = CITATION_PATTERNS.PARENTHETICAL.exec(response)) !== null) {
            const key = `paren_${match[1].toLowerCase()}`;
            if (!seen.has(key)) {
                citations.push({
                    type: 'parenthetical',
                    reference: match[1].trim(),
                    fullMatch: match[0],
                    position: match.index,
                    context: CitationVerifier._getContext(response, match.index)
                });
                seen.add(key);
            }
        }

        // Pattern 4: "according to X"
        CITATION_PATTERNS.INLINE_REFERENCE.lastIndex = 0;
        while ((match = CITATION_PATTERNS.INLINE_REFERENCE.exec(response)) !== null) {
            const key = `inline_${match[1].toLowerCase()}`;
            if (!seen.has(key)) {
                citations.push({
                    type: 'inline_reference',
                    reference: match[1].trim(),
                    fullMatch: match[0],
                    position: match.index,
                    context: CitationVerifier._getContext(response, match.index)
                });
                seen.add(key);
            }
        }

        // Pattern 5: from "Document Name"
        CITATION_PATTERNS.NAMED_SOURCE.lastIndex = 0;
        while ((match = CITATION_PATTERNS.NAMED_SOURCE.exec(response)) !== null) {
            const key = `named_${match[1].toLowerCase()}`;
            if (!seen.has(key)) {
                citations.push({
                    type: 'named_source',
                    reference: match[1].trim(),
                    fullMatch: match[0],
                    position: match.index,
                    context: CitationVerifier._getContext(response, match.index)
                });
                seen.add(key);
            }
        }

        return citations;
    },

    /**
     * Verify a single citation
     */
    _verifySingleCitation: async (citation, response, sourceMap, allSources, options) => {
        const { strictMode, minConfidence } = options;

        // Try to find the referenced source
        let matchedSource = null;
        let matchConfidence = 0;

        // Try direct lookup first
        if (citation.type === 'bracket_number') {
            matchedSource = sourceMap.get(citation.reference);
            if (matchedSource) matchConfidence = 1.0;
        } else {
            // Try filename match
            const refLower = citation.reference.toLowerCase();
            for (const source of allSources) {
                const filename = (source.filename || '').toLowerCase();
                if (filename.includes(refLower) || refLower.includes(filename.replace(/\.[^.]+$/, ''))) {
                    matchedSource = source;
                    matchConfidence = 0.9;
                    break;
                }
            }
        }

        // If no direct match, try fuzzy matching
        if (!matchedSource && allSources.length > 0) {
            const fuzzyMatch = CitationVerifier._fuzzyFindSource(citation.reference, allSources);
            if (fuzzyMatch.score > 0.5) {
                matchedSource = fuzzyMatch.source;
                matchConfidence = fuzzyMatch.score * 0.8; // Reduce confidence for fuzzy match
            }
        }

        // Verify the claim is supported by the source
        let contentVerified = false;
        let supportEvidence = '';

        if (matchedSource && citation.context) {
            const verification = CitationVerifier._verifyClaimInSource(
                citation.context,
                matchedSource.content || ''
            );
            contentVerified = verification.supported;
            supportEvidence = verification.evidence;
            
            // Adjust confidence based on content verification
            if (contentVerified) {
                matchConfidence = Math.min(1, matchConfidence + 0.1);
            } else if (strictMode) {
                matchConfidence *= 0.5;
            }
        }

        const verified = matchConfidence >= minConfidence && (!strictMode || contentVerified);

        return {
            citation: citation.fullMatch,
            type: citation.type,
            reference: citation.reference,
            verified,
            sourceFound: !!matchedSource,
            contentVerified,
            confidence: matchConfidence,
            matchedSource: matchedSource ? {
                filename: matchedSource.filename,
                id: matchedSource.id
            } : null,
            evidence: supportEvidence,
            context: citation.context,
            issue: !verified ? CitationVerifier._diagnoseIssue(citation, matchedSource, contentVerified) : null
        };
    },

    /**
     * Verify that a claim is supported by source content
     */
    _verifyClaimInSource: (claim, sourceContent) => {
        if (!claim || !sourceContent) {
            return { supported: false, evidence: '' };
        }

        const claimLower = claim.toLowerCase();
        const sourceLower = sourceContent.toLowerCase();

        // Extract key terms from claim
        const claimTerms = claimLower
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 3);

        if (claimTerms.length === 0) {
            return { supported: true, evidence: 'No specific terms to verify' };
        }

        // Check for term presence
        const foundTerms = claimTerms.filter(term => sourceLower.includes(term));
        const termCoverage = foundTerms.length / claimTerms.length;

        // Check for phrase matches
        const phrases = claimLower.match(/\b\w+\s+\w+\b/g) || [];
        const matchedPhrases = phrases.filter(p => sourceLower.includes(p));

        // Calculate support score
        const supportScore = (termCoverage * 0.6) + (matchedPhrases.length / Math.max(phrases.length, 1) * 0.4);

        return {
            supported: supportScore >= 0.5,
            evidence: foundTerms.length > 0 
                ? `Found terms: ${foundTerms.slice(0, 5).join(', ')}`
                : 'Key terms not found in source',
            score: supportScore
        };
    },

    /**
     * Fuzzy find source by reference string
     */
    _fuzzyFindSource: (reference, sources) => {
        let bestMatch = { source: null, score: 0 };
        const refTerms = reference.toLowerCase().split(/\s+/).filter(t => t.length > 2);

        for (const source of sources) {
            const filename = (source.filename || '').toLowerCase();
            const content = (source.content || '').toLowerCase().substring(0, 500);

            // Calculate similarity
            let score = 0;
            
            // Filename match
            for (const term of refTerms) {
                if (filename.includes(term)) score += 0.3;
                if (content.includes(term)) score += 0.1;
            }

            if (score > bestMatch.score) {
                bestMatch = { source, score: Math.min(1, score) };
            }
        }

        return bestMatch;
    },

    /**
     * Get surrounding context for a citation
     */
    _getContext: (text, position, contextSize = 100) => {
        const start = Math.max(0, position - contextSize);
        const end = Math.min(text.length, position + contextSize);
        return text.substring(start, end).trim();
    },

    /**
     * Diagnose issue with unverified citation
     */
    _diagnoseIssue: (citation, matchedSource, contentVerified) => {
        if (!matchedSource) {
            return `Source "${citation.reference}" not found in provided documents`;
        }
        if (!contentVerified) {
            return `Claim not supported by cited source "${matchedSource.filename}"`;
        }
        return 'Citation confidence below threshold';
    },

    /**
     * Get quality level for citation accuracy
     */
    _getQualityLevel: (accuracy) => {
        if (accuracy >= 0.95) return 'EXCELLENT';
        if (accuracy >= 0.8) return 'GOOD';
        if (accuracy >= 0.6) return 'FAIR';
        return 'POOR';
    },

    /**
     * Generate verification summary
     */
    _generateSummary: (results, accuracy) => {
        const verified = results.filter(r => r.verified).length;
        const total = results.length;

        if (total === 0) return 'No citations to verify';
        if (accuracy >= 0.95) return `Excellent: All ${total} citations verified`;
        if (accuracy >= 0.8) return `Good: ${verified} of ${total} citations verified`;
        if (accuracy >= 0.6) return `Fair: ${verified} of ${total} citations verified - some issues found`;
        return `Needs attention: Only ${verified} of ${total} citations verified`;
    },

    /**
     * Generate recommendations for improving citations
     */
    _generateRecommendations: (results) => {
        const recommendations = [];
        
        const noSourceFound = results.filter(r => !r.sourceFound);
        const notContentVerified = results.filter(r => r.sourceFound && !r.contentVerified);

        if (noSourceFound.length > 0) {
            recommendations.push({
                type: 'missing_source',
                count: noSourceFound.length,
                suggestion: 'Ensure cited sources are included in the knowledge base',
                citations: noSourceFound.map(r => r.reference)
            });
        }

        if (notContentVerified.length > 0) {
            recommendations.push({
                type: 'unsupported_claim',
                count: notContentVerified.length,
                suggestion: 'Verify claims are accurately represented from sources',
                citations: notContentVerified.map(r => r.reference)
            });
        }

        return recommendations;
    },

    /**
     * Record citation verification results
     */
    recordVerification: async (organizationId, verificationResult) => {
        await initDeps();
        const id = deps.uuidv4();

        return new Promise((resolve) => {
            deps.db.run(`
                INSERT INTO citation_verification_logs (
                    id, organization_id, total_citations, verified_citations,
                    accuracy, quality_level, issues, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id,
                organizationId,
                verificationResult.totalCitations,
                verificationResult.verifiedCitations,
                verificationResult.accuracy,
                verificationResult.qualityLevel,
                JSON.stringify(verificationResult.recommendations),
                new Date().toISOString()
            ], (err) => {
                if (err) {
                    deps.aiLogger.error('CitationVerifier', `Failed to record verification: ${err.message}`);
                }
                resolve({ id, success: !err });
            });
        });
    },

    /**
     * Get citation quality stats for organization
     */
    getCitationStats: async (organizationId, periodDays = 7) => {
        await initDeps();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - periodDays);

        return new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total_verifications,
                    AVG(accuracy) as avg_accuracy,
                    SUM(total_citations) as total_citations,
                    SUM(verified_citations) as verified_citations
                FROM citation_verification_logs
                WHERE organization_id = ? AND created_at >= ?
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `, [organizationId, cutoffDate.toISOString()], (err, rows) => {
                if (err) {
                    return resolve({ daily: [], summary: {} });
                }

                const summary = {
                    totalVerifications: rows.reduce((s, r) => s + r.total_verifications, 0),
                    totalCitations: rows.reduce((s, r) => s + r.total_citations, 0),
                    verifiedCitations: rows.reduce((s, r) => s + r.verified_citations, 0),
                    avgAccuracy: rows.length > 0 
                        ? rows.reduce((s, r) => s + r.avg_accuracy, 0) / rows.length 
                        : 0
                };

                resolve({ daily: rows || [], summary });
            });
        });
    },

    /**
     * Set dependencies (for testing)
     */
    setDependencies
};

export default CitationVerifier;


