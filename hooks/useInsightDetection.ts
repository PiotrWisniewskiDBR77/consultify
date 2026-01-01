/**
 * useInsightDetection Hook
 * 
 * Analyzes AI responses and detects potential insights
 * that can be captured into the Knowledge Base
 */

import { useState, useCallback } from 'react';
import { 
    InsightCategory, 
    DetectedInsight, 
    InsightConfidence,
    PMODomainId 
} from '../types';
import { Api } from '../services/api';

// Category detection patterns
const CATEGORY_PATTERNS: Record<InsightCategory, {
    keywords: string[];
    patterns: RegExp[];
    pmoDomain: PMODomainId;
}> = {
    objective: {
        keywords: ['goal', 'objective', 'target', 'aim', 'purpose', 'outcome', 'achieve', 'deliver'],
        patterns: [
            /(?:our|the|main|key|primary)\s+(?:goal|objective|target)(?:\s+is)?[:\s]+(.+)/i,
            /we\s+(?:want|need|aim)\s+to\s+(.+)/i,
            /the\s+(?:project|initiative)\s+(?:aims|intends|seeks)\s+to\s+(.+)/i
        ],
        pmoDomain: PMODomainId.BENEFITS_REALIZATION
    },
    stakeholder: {
        keywords: ['stakeholder', 'sponsor', 'owner', 'responsible', 'team', 'manager', 'director', 'lead'],
        patterns: [
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:is|will be|as)\s+(?:the\s+)?(?:sponsor|owner|lead|manager|responsible)/i,
            /(?:the\s+)?(?:sponsor|owner|lead|manager)\s+(?:is|will be)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
            /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+from\s+(?:the\s+)?(\w+)\s+(?:department|team|division)/i
        ],
        pmoDomain: PMODomainId.RESOURCE_RESPONSIBILITY
    },
    risk: {
        keywords: ['risk', 'threat', 'danger', 'concern', 'issue', 'problem', 'challenge', 'worry'],
        patterns: [
            /(?:a|the|main|key|potential)\s+risk(?:\s+is)?[:\s]+(.+)/i,
            /we\s+(?:might|could|may)\s+(?:face|encounter|experience)\s+(.+)/i,
            /(?:there is|there's)\s+(?:a\s+)?risk\s+(?:of|that)\s+(.+)/i
        ],
        pmoDomain: PMODomainId.RISK_ISSUE_MANAGEMENT
    },
    assumption: {
        keywords: ['assume', 'assumption', 'assuming', 'suppose', 'expect', 'expected', 'believe'],
        patterns: [
            /(?:we|i)\s+assume(?:\s+that)?[:\s]+(.+)/i,
            /(?:the|our)\s+assumption(?:\s+is)?[:\s]+(.+)/i,
            /assuming\s+(?:that\s+)?(.+)/i
        ],
        pmoDomain: PMODomainId.SCOPE_CHANGE_CONTROL
    },
    constraint: {
        keywords: ['constraint', 'limitation', 'limit', 'restriction', 'boundary', 'budget', 'deadline', 'cannot'],
        patterns: [
            /(?:a|the|main|key)\s+constraint(?:\s+is)?[:\s]+(.+)/i,
            /(?:we|the project)\s+(?:cannot|can't|must not)\s+(.+)/i,
            /(?:budget|time|resource)\s+(?:constraint|limitation)(?:\s+is)?[:\s]+(.+)/i
        ],
        pmoDomain: PMODomainId.SCOPE_CHANGE_CONTROL
    },
    decision: {
        keywords: ['decided', 'decision', 'chose', 'selected', 'approved', 'agreed', 'determined'],
        patterns: [
            /(?:we|it was)\s+decided(?:\s+that)?[:\s]+(.+)/i,
            /(?:the\s+)?decision(?:\s+is|\s+was)?[:\s]+(.+)/i,
            /(?:we|they)\s+(?:chose|selected|agreed)\s+(?:to\s+)?(.+)/i
        ],
        pmoDomain: PMODomainId.GOVERNANCE_DECISION_MAKING
    },
    dependency: {
        keywords: ['depend', 'dependency', 'relies', 'requires', 'needs', 'waiting', 'blocked by'],
        patterns: [
            /(?:we|the project)\s+depend(?:s)?\s+on\s+(.+)/i,
            /(?:a|the)\s+dependency(?:\s+is)?[:\s]+(.+)/i,
            /(?:waiting|blocked)\s+(?:on|by)\s+(.+)/i
        ],
        pmoDomain: PMODomainId.SCHEDULE_MILESTONES
    },
    success_criteria: {
        keywords: ['success', 'criteria', 'kpi', 'metric', 'measure', 'benchmark', 'target'],
        patterns: [
            /(?:success|the project)\s+(?:will be|is)\s+measured\s+by\s+(.+)/i,
            /(?:the\s+)?(?:success\s+)?(?:criteria|kpi)(?:\s+is|\s+are)?[:\s]+(.+)/i,
            /(?:we'll|we will)\s+know\s+(?:it's|we're)\s+successful\s+(?:when|if)\s+(.+)/i
        ],
        pmoDomain: PMODomainId.PERFORMANCE_MONITORING
    }
};

// Confidence scoring based on matches
const calculateConfidence = (keywordMatches: number, patternMatches: number): InsightConfidence => {
    const score = keywordMatches * 0.3 + patternMatches * 0.7;
    if (score >= 1.5) return 'high';
    if (score >= 0.7) return 'medium';
    return 'low';
};

interface UseInsightDetectionResult {
    detectedInsights: DetectedInsight[];
    isAnalyzing: boolean;
    analyzeText: (text: string) => Promise<DetectedInsight[]>;
    clearDetected: () => void;
}

export const useInsightDetection = (): UseInsightDetectionResult => {
    const [detectedInsights, setDetectedInsights] = useState<DetectedInsight[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    /**
     * Analyze text for potential insights
     */
    const analyzeText = useCallback(async (text: string): Promise<DetectedInsight[]> => {
        setIsAnalyzing(true);
        const detected: DetectedInsight[] = [];

        try {
            // First, try server-side AI detection (if available)
            try {
                const response = await Api.post('/intelligence/detect-insights', { text });
                if (response.detectedInsights?.length > 0) {
                    setDetectedInsights(response.detectedInsights);
                    setIsAnalyzing(false);
                    return response.detectedInsights;
                }
            } catch (err) {
                // Server detection not available, fall back to client-side
                console.log('[InsightDetection] Server detection unavailable, using client-side');
            }

            // Client-side pattern matching
            const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 10);

            for (const [category, config] of Object.entries(CATEGORY_PATTERNS)) {
                const lowerText = text.toLowerCase();
                
                // Count keyword matches
                const keywordMatches = config.keywords.filter(kw => 
                    lowerText.includes(kw.toLowerCase())
                ).length;

                // Check pattern matches
                for (const pattern of config.patterns) {
                    const match = text.match(pattern);
                    if (match && match[1]) {
                        const extractedContent = match[1].trim();
                        
                        // Skip if too short or too long
                        if (extractedContent.length < 10 || extractedContent.length > 500) continue;

                        const confidence = calculateConfidence(keywordMatches, 1);

                        // Create detected insight
                        const insight: DetectedInsight = {
                            category: category as InsightCategory,
                            title: extractedContent.slice(0, 100) + (extractedContent.length > 100 ? '...' : ''),
                            content: { description: extractedContent },
                            confidence,
                            sourceQuote: match[0].slice(0, 200)
                        };

                        // Avoid duplicates
                        const isDuplicate = detected.some(d => 
                            d.category === insight.category && 
                            d.title.toLowerCase() === insight.title.toLowerCase()
                        );

                        if (!isDuplicate) {
                            detected.push(insight);
                        }
                    }
                }

                // If high keyword density but no pattern match, suggest general insight
                if (keywordMatches >= 3 && !detected.some(d => d.category === category)) {
                    // Find sentence with most keywords
                    let bestSentence = '';
                    let maxKeywords = 0;
                    
                    for (const sentence of sentences) {
                        const sentLower = sentence.toLowerCase();
                        const sentKeywords = config.keywords.filter(kw => sentLower.includes(kw)).length;
                        if (sentKeywords > maxKeywords) {
                            maxKeywords = sentKeywords;
                            bestSentence = sentence;
                        }
                    }

                    if (bestSentence && maxKeywords >= 2) {
                        detected.push({
                            category: category as InsightCategory,
                            title: bestSentence.slice(0, 100) + (bestSentence.length > 100 ? '...' : ''),
                            content: { description: bestSentence },
                            confidence: 'low',
                            sourceQuote: bestSentence
                        });
                    }
                }
            }

            // Sort by confidence
            detected.sort((a, b) => {
                const order = { high: 3, medium: 2, low: 1 };
                return order[b.confidence] - order[a.confidence];
            });

            // Limit to top 5 insights
            const topInsights = detected.slice(0, 5);
            
            setDetectedInsights(topInsights);
            return topInsights;

        } catch (err) {
            console.error('[InsightDetection] Error:', err);
            return [];
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    /**
     * Clear detected insights
     */
    const clearDetected = useCallback(() => {
        setDetectedInsights([]);
    }, []);

    return {
        detectedInsights,
        isAnalyzing,
        analyzeText,
        clearDetected
    };
};

export default useInsightDetection;


