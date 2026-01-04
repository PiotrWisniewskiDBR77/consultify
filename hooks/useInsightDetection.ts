import { useCallback, useState } from 'react';

export interface DetectedInsight {
    id: string;
    category:
        | 'objective'
        | 'stakeholder'
        | 'risk'
        | 'assumption'
        | 'constraint'
        | 'decision'
        | 'dependency'
        | 'success_criteria';
    title: string;
    content: Record<string, unknown>;
    confidence: 'high' | 'medium' | 'low';
    sourceText: string;
}

interface UseInsightDetectionResult {
    detectedInsights: DetectedInsight[];
    isDetecting: boolean;
    detectInsights: (text: string) => Promise<DetectedInsight[]>;
    clearInsights: () => void;
    confirmInsight: (insightId: string) => void;
    dismissInsight: (insightId: string) => void;
}

// Category detection patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
    objective: [
        /goal|objective|aim|target|achieve|accomplish|deliver/i,
        /we want to|we need to|our mission|purpose is/i,
        /increase|decrease|improve|reduce|optimize/i,
    ],
    stakeholder: [
        /stakeholder|sponsor|team|manager|director|ceo|cto|client|customer|user/i,
        /responsible for|owner|lead|head of|department/i,
        /interested party|key person|decision maker/i,
    ],
    risk: [
        /risk|threat|danger|concern|worry|issue|problem/i,
        /might fail|could go wrong|potential issue|vulnerability/i,
        /if.*then.*negative|uncertain|exposure/i,
    ],
    assumption: [
        /assume|assumption|expect|expectation|believe|presume/i,
        /we think|we believe|it is assumed|taking for granted/i,
        /should be|will be available|will have/i,
    ],
    constraint: [
        /constraint|limitation|restriction|boundary|must not|cannot/i,
        /budget|deadline|regulation|compliance|legal|policy/i,
        /fixed|non-negotiable|mandatory|required/i,
    ],
    decision: [
        /decided|decision|chose|selected|approved|agreed/i,
        /we will use|we have chosen|resolution|determination/i,
        /after consideration|based on analysis/i,
    ],
    dependency: [
        /depend|dependency|relies on|requires|prerequisite|blocked by/i,
        /before we can|needs to be completed|waiting for/i,
        /external|internal dependency|integration with/i,
    ],
    success_criteria: [
        /success|kpi|metric|measure|criterion|criteria|indicator/i,
        /definition of done|acceptance criteria|target.*%/i,
        /will be successful when|measured by|evaluated/i,
    ],
};

// Generate a simple UUID
const generateId = (): string => {
    return 'insight-' + Math.random().toString(36).substring(2, 11);
};

// Detect category from text
const detectCategory = (text: string): string | null => {
    let bestMatch: { category: string; score: number } | null = null;

    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
        let score = 0;
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                score++;
            }
        }
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { category, score };
        }
    }

    return bestMatch?.category || null;
};

// Extract title from text
const extractTitle = (text: string, category: string): string => {
    // Take first sentence or first 50 characters
    const firstSentence = text.split(/[.!?]/)[0].trim();
    if (firstSentence.length <= 60) {
        return firstSentence;
    }
    return firstSentence.substring(0, 57) + '...';
};

// Generate content structure based on category
const generateContent = (text: string, category: string): Record<string, unknown> => {
    const baseContent = { description: text };

    switch (category) {
        case 'objective':
            return {
                ...baseContent,
                measurable_outcomes: [],
                timeframe: '',
                priority: 'medium',
            };
        case 'stakeholder':
            return {
                ...baseContent,
                role: '',
                influence: 'medium',
                interest: 'medium',
                engagement_strategy: '',
            };
        case 'risk':
            return {
                ...baseContent,
                probability: 'medium',
                impact: 'medium',
                mitigation_strategy: '',
                owner: '',
            };
        case 'assumption':
            return {
                statement: text,
                validation_method: '',
                impact_if_false: '',
                owner: '',
            };
        case 'constraint':
            return {
                ...baseContent,
                type: 'other',
                flexibility: 'low',
                impact_on_scope: '',
            };
        case 'decision':
            return {
                decision: text,
                rationale: '',
                alternatives_considered: [],
                decision_maker: '',
                date: new Date().toISOString().split('T')[0],
            };
        case 'dependency':
            return {
                ...baseContent,
                type: 'internal',
                dependent_project: '',
                expected_completion: '',
                criticality: 'medium',
            };
        case 'success_criteria':
            return {
                criterion: text,
                measurement_method: '',
                target_value: '',
                current_baseline: '',
            };
        default:
            return baseContent;
    }
};

export function useInsightDetection(): UseInsightDetectionResult {
    const [detectedInsights, setDetectedInsights] = useState<DetectedInsight[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);

    const detectInsights = useCallback(async (text: string): Promise<DetectedInsight[]> => {
        setIsDetecting(true);

        try {
            // Split text into sentences for analysis
            const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
            const insights: DetectedInsight[] = [];

            for (const sentence of sentences) {
                const category = detectCategory(sentence);
                if (category) {
                    const insight: DetectedInsight = {
                        id: generateId(),
                        category: category as DetectedInsight['category'],
                        title: extractTitle(sentence, category),
                        content: generateContent(sentence.trim(), category),
                        confidence: 'medium',
                        sourceText: sentence.trim(),
                    };
                    insights.push(insight);
                }
            }

            // Also check the full text
            if (insights.length === 0) {
                const category = detectCategory(text);
                if (category) {
                    insights.push({
                        id: generateId(),
                        category: category as DetectedInsight['category'],
                        title: extractTitle(text, category),
                        content: generateContent(text, category),
                        confidence: 'low',
                        sourceText: text,
                    });
                }
            }

            setDetectedInsights((prev) => [...prev, ...insights]);
            return insights;
        } finally {
            setIsDetecting(false);
        }
    }, []);

    const clearInsights = useCallback(() => {
        setDetectedInsights([]);
    }, []);

    const confirmInsight = useCallback((insightId: string) => {
        setDetectedInsights((prev) => prev.filter((i) => i.id !== insightId));
    }, []);

    const dismissInsight = useCallback((insightId: string) => {
        setDetectedInsights((prev) => prev.filter((i) => i.id !== insightId));
    }, []);

    return {
        detectedInsights,
        isDetecting,
        detectInsights,
        clearInsights,
        confirmInsight,
        dismissInsight,
    };
}
