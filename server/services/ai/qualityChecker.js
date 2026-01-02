/**
 * Quality Checker Service
 * 
 * Validates AI outputs for quality, accuracy, and compliance.
 * Features:
 * - Hallucination detection
 * - Citation validation
 * - Accuracy scoring
 * - Auto-retry on low quality
 */

const { aiLogger } = require('./logger');

// Quality thresholds
const QUALITY_THRESHOLDS = {
    MIN_ACCURACY: 0.7,
    MIN_RELEVANCE: 0.6,
    MAX_HALLUCINATION_RISK: 0.3,
    MIN_LENGTH_RATIO: 0.2, // Response should be at least 20% of context length
    MAX_LENGTH_RATIO: 3.0  // Response should not exceed 3x context length
};

// Patterns that indicate potential hallucination
const HALLUCINATION_PATTERNS = [
    /in (?:19|20)\d{2}.*(?:announced|released|launched)/i, // Unsupported date claims
    /according to (?:recent|latest) (?:studies|research)/i, // Vague research claims
    /\d+(?:\.\d+)?%\s*(?:of|increase|decrease|growth)/i, // Unverified statistics
    /(?:the|a) famous|well-known|popular/i, // Subjective authority claims
    /scientists|researchers|experts (?:agree|say|found)/i // Vague expert claims
];

// Patterns that should have citations
const CITATION_REQUIRED_PATTERNS = [
    /(?:study|research|report) (?:found|shows|indicates)/i,
    /\d+(?:\.\d+)?%\s*(?:of\s+)?(?:companies|organizations|enterprises)/i,
    /according to/i,
    /statistics show/i
];

class QualityChecker {
    constructor() {
        this.checksPerformed = 0;
        this.failedChecks = 0;
    }

    /**
     * Run full quality check on AI response
     * @param {Object} response - AI response to check
     * @param {Object} context - Original context/request
     * @param {Object} options - Check options
     */
    async check(response, context, options = {}) {
        const startTime = Date.now();
        const { strictMode = false, capability } = options;

        this.checksPerformed++;

        const checks = {
            hallucinationRisk: this.checkHallucination(response.content),
            citationCompliance: this.checkCitations(response.content, context),
            relevance: this.checkRelevance(response.content, context),
            lengthAppropriate: this.checkLength(response.content, context),
            structureValid: this.checkStructure(response.content, capability),
            languageQuality: this.checkLanguageQuality(response.content)
        };

        // Calculate overall score
        const scores = {};
        Object.entries(checks).forEach(([key, val]) => {
            // Map camelCase check names to simple score names if needed
            const scoreKey = key.replace('Risk', '').replace('Compliance', '').replace('Appropriate', '').replace('Valid', '').toLowerCase();
            scores[scoreKey] = val.score;
        });

        const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;

        // Determine if quality is acceptable
        const minScore = (strictMode || (response.content || '').length === 0) ? 0.8 : 0.6;
        const passed = overallScore >= minScore &&
            checks.hallucinationRisk.score >= (1 - QUALITY_THRESHOLDS.MAX_HALLUCINATION_RISK);

        if (!passed) {
            this.failedChecks++;
        }

        const result = {
            passed,
            overallScore: Math.round(overallScore * 100) / 100,
            checks,
            scores, // Added for test compatibility
            warnings: this.collectWarnings(checks),
            suggestions: this.generateSuggestions(checks),
            metadata: {
                checkDuration: Date.now() - startTime,
                strictMode,
                capability
            }
        };

        aiLogger.debug('QualityChecker', `Check ${passed ? 'PASSED' : 'FAILED'}: score=${result.overallScore}`);

        return result;
    }

    /**
     * Check for potential hallucinations
     */
    checkHallucination(content) {
        const issues = [];
        let riskScore = 0;

        for (const pattern of HALLUCINATION_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
                issues.push({
                    pattern: pattern.source.substring(0, 50),
                    match: matches[0],
                    riskLevel: 'MEDIUM'
                });
                riskScore += 0.15;
            }
        }

        // Check for very specific numeric claims
        const specificNumbers = content.match(/\b\d{4,}\b/g) || [];
        if (specificNumbers.length > 5) {
            issues.push({
                pattern: 'Many specific numbers',
                count: specificNumbers.length,
                riskLevel: 'LOW'
            });
            riskScore += 0.1;
        }

        return {
            score: Math.max(0, 1 - riskScore),
            passed: riskScore < QUALITY_THRESHOLDS.MAX_HALLUCINATION_RISK,
            issues,
            riskLevel: riskScore > 0.3 ? 'HIGH' : riskScore > 0.15 ? 'MEDIUM' : 'LOW'
        };
    }

    /**
     * Check citation compliance
     */
    checkCitations(content, context) {
        const issues = [];
        const citationPatterns = CITATION_REQUIRED_PATTERNS;
        const hasCitations = /\[[\d,\s]+\]|\(\d{4}\)|\(Source:/.test(content);

        let needsCitation = false;
        for (const pattern of citationPatterns) {
            if (pattern.test(content)) {
                needsCitation = true;
                if (!hasCitations) {
                    issues.push({
                        type: 'MISSING_CITATION',
                        pattern: pattern.source.substring(0, 50)
                    });
                }
            }
        }

        const score = needsCitation ? (hasCitations ? 1 : 0.5) : 1;

        return {
            score,
            passed: score >= 0.7,
            hasCitations,
            needsCitation,
            issues
        };
    }

    /**
     * Check response relevance to context
     */
    checkRelevance(content, context) {
        if (!context || !context.query) {
            return { score: 0.8, passed: true, note: 'No query context to compare' };
        }

        const queryWords = this.extractKeywords(context.query || '');
        const responseWords = this.extractKeywords(content);

        // Calculate keyword overlap
        const overlap = queryWords.filter(w => responseWords.includes(w));
        const relevanceScore = queryWords.length > 0
            ? overlap.length / queryWords.length
            : 0.5;

        return {
            score: Math.min(1, relevanceScore + 0.3), // Base boost for any response
            passed: relevanceScore >= QUALITY_THRESHOLDS.MIN_RELEVANCE,
            overlapCount: overlap.length,
            queryKeywords: queryWords.length,
            matchedKeywords: overlap
        };
    }

    /**
     * Check response length appropriateness
     */
    checkLength(content, context) {
        const responseLength = (content || '').length;
        const contextLength = (context?.query || '').length + (context?.description || '').length;

        if (contextLength === 0) {
            return {
                score: responseLength > 50 ? 1 : 0.5,
                passed: true,
                note: 'No context for comparison'
            };
        }

        const ratio = responseLength / contextLength;

        let score = 1;
        let issues = [];

        if (ratio < QUALITY_THRESHOLDS.MIN_LENGTH_RATIO) {
            score = 0.5;
            issues.push('Response too short for context');
        } else if (ratio > QUALITY_THRESHOLDS.MAX_LENGTH_RATIO) {
            score = 0.7;
            issues.push('Response may be unnecessarily verbose');
        }

        return {
            score,
            passed: score >= 0.6,
            ratio: Math.round(ratio * 100) / 100,
            responseLength,
            contextLength,
            issues
        };
    }

    /**
     * Check response structure validity
     */
    checkStructure(content, capability) {
        const issues = [];
        let score = 1;

        // Check for proper formatting based on capability
        if (capability === 'report_section' || capability === 'full_report') {
            if (!/^#|^##|^\*\*/.test(content)) {
                issues.push('Report should have formatted headers');
                score -= 0.1;
            }
            if (!/\n\n/.test(content)) {
                issues.push('Report should have paragraph breaks');
                score -= 0.1;
            }
        }

        // Check for incomplete thoughts
        if (/\.{3}$|\s+$|^[\s\n]*$/.test(content)) {
            issues.push('Response appears incomplete');
            score -= 0.2;
        }

        // Check for JSON validity if expected
        if (content.includes('{') && content.includes('}')) {
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                issues.push('Contains invalid JSON structure');
                score -= 0.15;
            }
        }

        return {
            score: Math.max(0, score),
            passed: score >= 0.7,
            issues
        };
    }

    /**
     * Check language quality
     */
    checkLanguageQuality(content) {
        const issues = [];
        let score = 1;

        // Check for repeated phrases (potential loop)
        const sentences = content.split(/[.!?]+/);
        const uniqueSentences = [...new Set(sentences)];
        if (sentences.length > 5 && uniqueSentences.length < sentences.length * 0.7) {
            issues.push('Contains repetitive content');
            score -= 0.2;
        }

        // Check for placeholder text
        const placeholders = content.match(/\[.*?\]|\{.*?\}|TODO|FIXME|XXX/g) || [];
        if (placeholders.length > 2) {
            issues.push('Contains placeholder text');
            score -= 0.15;
        }

        // Check for mixed language issues (basic)
        const hasPolish = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(content);
        const hasEnglish = /\b(the|and|or|is|are|was|were)\b/i.test(content);
        if (hasPolish && hasEnglish) {
            // Mixed language might be intentional, just note it
            issues.push('Contains mixed Polish/English');
            // Don't penalize as it might be intentional
        }

        return {
            score: Math.max(0, score),
            passed: score >= 0.7,
            issues
        };
    }

    /**
     * Collect warnings from all checks
     */
    collectWarnings(checks) {
        const warnings = [];

        if (checks.hallucinationRisk.riskLevel === 'HIGH') {
            warnings.push({
                level: 'HIGH',
                message: 'High hallucination risk detected',
                action: 'Review AI response for accuracy'
            });
        }

        if (!checks.citationCompliance.passed && checks.citationCompliance.needsCitation) {
            warnings.push({
                level: 'MEDIUM',
                message: 'Claims without citations detected',
                action: 'Add sources or rephrase as opinions'
            });
        }

        if (!checks.relevance.passed) {
            warnings.push({
                level: 'MEDIUM',
                message: 'Response may not be relevant to query',
                action: 'Consider regenerating'
            });
        }

        return warnings;
    }

    /**
     * Generate improvement suggestions
     */
    generateSuggestions(checks) {
        const suggestions = [];

        if (checks.hallucinationRisk.issues.length > 0) {
            suggestions.push('Consider fact-checking specific claims and statistics');
        }

        if (!checks.citationCompliance.passed) {
            suggestions.push('Add citations for factual claims and statistics');
        }

        if (!checks.lengthAppropriate.passed) {
            if (checks.lengthAppropriate.ratio < 1) {
                suggestions.push('Provide more detailed response');
            } else {
                suggestions.push('Consider being more concise');
            }
        }

        return suggestions;
    }

    /**
     * Extract keywords from text
     */
    extractKeywords(text) {
        const stopwords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
            'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
            'i', 'w', 'z', 'na', 'do', 'od', 'dla', 'po', 'jest', 'są', 'to'
        ]);

        return (text || '')
            .toLowerCase()
            .replace(/[^\w\sąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopwords.has(w));
    }

    /**
     * Calculate overall score from individual check scores
     * @param {Object} scores - Individual check scores
     * @returns {number} - Overall score
     */
    calculateOverallScore(scores) {
        if (!scores || Object.keys(scores).length === 0) return 0;
        const values = Object.values(scores).filter(v => typeof v === 'number');
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    /**
     * Get warnings based on scores
     * @param {Object} scores - Individual check scores
     * @returns {Array<string>} - List of warnings
     */
    getWarnings(scores) {
        const warnings = [];
        if (scores.relevance < 0.6) warnings.push('Information may not be fully relevant to the query.');
        if (scores.hallucination < 0.7) warnings.push('High risk of hallucination or unverified claims.');
        if (scores.completeness < 0.6) warnings.push('Response may be incomplete or too brief.');
        if (scores.coherence < 0.7) warnings.push('Response structure or coherence is low.');
        return warnings;
    }

    /**
     * Get quality check statistics
     */
    getStats() {
        return {
            totalChecks: this.checksPerformed,
            failedChecks: this.failedChecks,
            passRate: this.checksPerformed > 0
                ? ((this.checksPerformed - this.failedChecks) / this.checksPerformed * 100).toFixed(1)
                : 100
        };
    }
}

// Singleton instance
const qualityChecker = new QualityChecker();

module.exports = {
    QualityChecker,
    QualityCheckerService: QualityChecker,
    qualityChecker,
    QUALITY_THRESHOLDS
};



