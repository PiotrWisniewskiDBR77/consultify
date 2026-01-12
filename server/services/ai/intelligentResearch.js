/**
 * Intelligent Research Module
 * 
 * Extends web research with intelligent query generation based on:
 * - Conversation context
 * - User intent
 * - Knowledge gaps
 * - Consulting methodology
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

import { webResearchService } from './webResearchService.js';
import { aiLogger } from './logger.js';

// Query generation templates by research purpose
const QUERY_TEMPLATES = {
    benchmark: {
        templates: [
            '{industry} {metric} benchmark {year}',
            '{industry} digital transformation {axis} statistics',
            '{metric} average {industry} sector {region}',
            'what is the average {metric} for {industry} companies',
            '{axis} maturity benchmark enterprise {year}'
        ],
        enhancers: ['statistics', 'data', 'report', 'survey', 'Gartner', 'McKinsey', 'Deloitte', 'Forrester']
    },
    caseStudy: {
        templates: [
            '{company_type} {transformation} case study success',
            '{industry} digital transformation {initiative} implementation',
            'how did {leader} implement {technology}',
            '{industry} {initiative} ROI case study'
        ],
        enhancers: ['implementation', 'lessons learned', 'success factors', 'results', 'ROI']
    },
    bestPractice: {
        templates: [
            '{topic} best practices enterprise',
            'how to implement {initiative} successfully',
            '{framework} implementation guide {industry}',
            '{topic} success factors large organization'
        ],
        enhancers: ['guide', 'framework', 'methodology', 'playbook', 'checklist']
    },
    trend: {
        templates: [
            '{topic} trends {year}',
            '{industry} {technology} adoption trends',
            'future of {topic} enterprise',
            '{topic} predictions {year}'
        ],
        enhancers: ['emerging', 'future', 'forecast', 'outlook', 'evolution']
    },
    competitive: {
        templates: [
            '{leader} {axis} strategy',
            'how does {leader} approach {topic}',
            '{industry} leaders {initiative} approach',
            '{company_type} competitive advantage {technology}'
        ],
        enhancers: ['strategy', 'approach', 'competitive advantage', 'differentiation']
    },
    risk: {
        templates: [
            '{initiative} implementation risks',
            '{technology} adoption challenges {industry}',
            'why do {initiative} projects fail',
            '{topic} pitfalls to avoid'
        ],
        enhancers: ['risks', 'challenges', 'failures', 'lessons', 'mistakes']
    },
    roi: {
        templates: [
            '{initiative} ROI statistics',
            '{technology} business case {industry}',
            '{topic} cost benefit analysis',
            '{initiative} payback period enterprise'
        ],
        enhancers: ['ROI', 'business case', 'investment', 'payback', 'savings']
    }
};

// Context-to-research mapping
const CONTEXT_RESEARCH_MAP = {
    // Conversation phases
    discovery: ['benchmark', 'competitive', 'trend'],
    assessment: ['benchmark', 'caseStudy', 'competitive'],
    initiatives: ['bestPractice', 'caseStudy', 'roi', 'risk'],
    roadmap: ['roi', 'risk', 'bestPractice'],
    execution: ['bestPractice', 'caseStudy', 'trend'],

    // User intents
    compare: ['benchmark', 'competitive'],
    understand: ['bestPractice', 'trend', 'caseStudy'],
    decide: ['roi', 'risk', 'caseStudy'],
    implement: ['bestPractice', 'caseStudy', 'risk'],
    validate: ['benchmark', 'caseStudy', 'roi']
};

class IntelligentResearch {
    constructor() {
        this.webResearch = webResearchService;
        this.queryCache = new Map();
        this.maxCacheSize = 500;
    }

    /**
     * Generate intelligent research queries based on context
     * @param {Object} context - Full conversation context
     * @returns {Array} Array of optimized search queries
     */
    generateQueries(context) {
        const {
            userMessage,
            intent,
            phase,
            topic,
            industry,
            axisId,
            knowledgeGaps = [],
            organizationContext = {}
        } = context;

        const queries = [];
        const year = new Date().getFullYear();

        // Determine research types needed
        const researchTypes = this.determineResearchTypes(intent, phase);

        // Generate queries for each research type
        for (const researchType of researchTypes) {
            const typeConfig = QUERY_TEMPLATES[researchType];
            if (!typeConfig) continue;

            // Select best template
            const template = this.selectTemplate(typeConfig.templates, context);

            // Fill template variables
            const baseQuery = this.fillTemplate(template, {
                industry: industry || 'enterprise',
                topic: topic || 'digital transformation',
                axis: axisId || '',
                metric: this.getRelevantMetric(axisId, context),
                year,
                initiative: this.extractInitiative(userMessage),
                technology: this.extractTechnology(userMessage),
                company_type: this.getCompanyType(organizationContext),
                leader: this.getIndustryLeader(industry),
                framework: this.getRelevantFramework(axisId),
                transformation: 'digital transformation',
                region: 'Europe'
            });

            // Add enhancers for better results
            const enhancedQuery = this.enhanceQuery(baseQuery, typeConfig.enhancers, context);

            queries.push({
                query: enhancedQuery,
                type: researchType,
                priority: this.calculatePriority(researchType, context),
                language: context.language || 'en'
            });
        }

        // Add knowledge gap specific queries
        for (const gap of knowledgeGaps.slice(0, 2)) {
            queries.push({
                query: this.gapToQuery(gap, context),
                type: 'gap_filling',
                priority: 'high',
                language: context.language || 'en'
            });
        }

        // Sort by priority and return top queries
        return queries
            .sort((a, b) => this.priorityOrder(a.priority) - this.priorityOrder(b.priority))
            .slice(0, 5);
    }

    /**
     * Perform intelligent research based on context
     * @param {Object} context - Conversation context
     * @returns {Object} Research results with synthesis
     */
    async research(context) {
        const queries = this.generateQueries(context);

        if (queries.length === 0) {
            return {
                success: false,
                message: 'No research queries generated',
                context
            };
        }

        aiLogger.info('IntelligentResearch', `Executing ${queries.length} research queries`);

        // Execute queries in parallel (with limit)
        const maxParallel = 3;
        const results = [];

        for (let i = 0; i < queries.length; i += maxParallel) {
            const batch = queries.slice(i, i + maxParallel);
            const batchResults = await Promise.allSettled(
                batch.map(q => this.executeQuery(q))
            );

            results.push(...batchResults
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value)
            );
        }

        // Synthesize findings
        const synthesis = await this.synthesizeForConsulting(results, context);

        return {
            success: true,
            queryCount: queries.length,
            resultCount: results.length,
            queries: queries.map(q => ({ query: q.query, type: q.type })),
            results,
            synthesis,
            citations: this.collectCitations(results),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Deep research for complex questions
     * @param {string} question - Complex question requiring deep research
     * @param {Object} context - Context information
     */
    async deepResearch(question, context = {}) {
        const { industry, phase, maxDepth = 3 } = context;

        aiLogger.info('IntelligentResearch', `Starting deep research: ${question.substring(0, 50)}...`);

        // Decompose question into sub-questions
        const subQuestions = this.decomposeQuestion(question);

        // Research each sub-question
        const subResults = [];
        for (const subQ of subQuestions.slice(0, maxDepth)) {
            const result = await this.research({
                userMessage: subQ.text,
                intent: subQ.intent,
                industry,
                phase,
                language: context.language
            });
            subResults.push({
                question: subQ.text,
                ...result
            });
        }

        // Perform cross-reference research if needed
        const crossRefs = await this.crossReference(subResults, context);

        // Create comprehensive synthesis
        const comprehensiveSynthesis = await this.createDeepSynthesis(
            question,
            subResults,
            crossRefs,
            context
        );

        return {
            originalQuestion: question,
            subQuestions: subQuestions.map(q => q.text),
            subResults,
            crossReferences: crossRefs,
            synthesis: comprehensiveSynthesis,
            depth: maxDepth,
            totalSources: this.countUniqueSources(subResults),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Real-time research support for conversation
     * @param {Object} message - Current message being processed
     * @param {Object} conversationState - Full conversation state
     */
    async supportConversation(message, conversationState) {
        // Detect if research would be helpful
        const needsResearch = this.detectResearchNeed(message, conversationState);

        if (!needsResearch) {
            return { needed: false };
        }

        // Quick research with tight timeout
        const timeout = 5000; // 5 seconds max for real-time support

        try {
            const researchPromise = this.research({
                userMessage: message.content,
                intent: conversationState.currentIntent,
                phase: conversationState.currentPhase,
                knowledgeGaps: conversationState.knowledgeGaps,
                industry: conversationState.organization?.industry,
                axisId: conversationState.currentAxis,
                language: conversationState.language
            });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Research timeout')), timeout)
            );

            const result = await Promise.race([researchPromise, timeoutPromise]);

            return {
                needed: true,
                available: true,
                ...result
            };
        } catch (error) {
            aiLogger.warn('IntelligentResearch', `Real-time research failed: ${error.message}`);
            return {
                needed: true,
                available: false,
                reason: error.message
            };
        }
    }

    // =========================================================================
    // Query Generation Helpers
    // =========================================================================

    determineResearchTypes(intent, phase) {
        const types = new Set();

        // Add phase-based types
        const phaseTypes = CONTEXT_RESEARCH_MAP[phase] || [];
        phaseTypes.forEach(t => types.add(t));

        // Add intent-based types
        const intentTypes = CONTEXT_RESEARCH_MAP[intent] || [];
        intentTypes.forEach(t => types.add(t));

        // Default fallback
        if (types.size === 0) {
            types.add('benchmark');
            types.add('bestPractice');
        }

        return Array.from(types);
    }

    selectTemplate(templates, context) {
        // For now, select randomly. Could be ML-based in future.
        return templates[Math.floor(Math.random() * templates.length)];
    }

    fillTemplate(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
        }
        return result.replace(/\s+/g, ' ').trim();
    }

    enhanceQuery(query, enhancers, context) {
        // Add one or two enhancers
        const selectedEnhancers = enhancers
            .sort(() => Math.random() - 0.5)
            .slice(0, 2);

        // Add year for freshness
        const year = new Date().getFullYear();

        return `${query} ${selectedEnhancers.join(' ')} ${year}`.trim();
    }

    getRelevantMetric(axisId, context) {
        const metrics = {
            processes: 'process automation rate',
            digitalProducts: 'digital revenue share',
            businessModels: 'digital business model adoption',
            dataManagement: 'data maturity score',
            culture: 'digital skills index',
            cybersecurity: 'security maturity level',
            aiMaturity: 'AI adoption rate'
        };
        return metrics[axisId] || 'digital maturity';
    }

    extractInitiative(message) {
        // Simple extraction - could use NLP
        const initiativePatterns = [
            /implement(?:ing)?\s+(\w+(?:\s+\w+)?)/i,
            /(\w+(?:\s+\w+)?)\s+initiative/i,
            /start(?:ing)?\s+(\w+(?:\s+\w+)?)/i
        ];

        for (const pattern of initiativePatterns) {
            const match = message?.match(pattern);
            if (match) return match[1];
        }
        return 'digital transformation';
    }

    extractTechnology(message) {
        const techKeywords = [
            'AI', 'RPA', 'IoT', 'cloud', 'blockchain', 'analytics',
            'automation', 'machine learning', 'data platform', 'ERP', 'CRM'
        ];

        const lower = message?.toLowerCase() || '';
        return techKeywords.find(t => lower.includes(t.toLowerCase())) || 'technology';
    }

    getCompanyType(orgContext) {
        if (orgContext.employeeCount > 10000) return 'large enterprise';
        if (orgContext.employeeCount > 1000) return 'mid-size company';
        if (orgContext.employeeCount > 100) return 'SME';
        return 'company';
    }

    getIndustryLeader(industry) {
        const leaders = {
            manufacturing: 'Siemens',
            retail: 'Amazon',
            financial: 'JPMorgan',
            healthcare: 'Mayo Clinic',
            technology: 'Google',
            logistics: 'DHL',
            energy: 'Shell'
        };
        return leaders[industry] || 'industry leader';
    }

    getRelevantFramework(axisId) {
        const frameworks = {
            processes: 'lean digital',
            dataManagement: 'DAMA DMBOK',
            cybersecurity: 'NIST',
            aiMaturity: 'AI Maturity Model',
            culture: 'ADKAR'
        };
        return frameworks[axisId] || 'digital transformation framework';
    }

    calculatePriority(researchType, context) {
        const urgencyMap = {
            benchmark: context.intent === 'compare' ? 'high' : 'medium',
            caseStudy: context.intent === 'validate' ? 'high' : 'medium',
            bestPractice: context.phase === 'initiatives' ? 'high' : 'medium',
            roi: context.intent === 'decide' ? 'high' : 'medium',
            risk: context.phase === 'roadmap' ? 'high' : 'low',
            trend: 'low',
            competitive: context.intent === 'compare' ? 'high' : 'medium'
        };
        return urgencyMap[researchType] || 'medium';
    }

    priorityOrder(priority) {
        const order = { high: 0, medium: 1, low: 2 };
        return order[priority] ?? 1;
    }

    gapToQuery(gap, context) {
        // Convert knowledge gap to search query
        return `${gap.topic || gap} ${context.industry || ''} ${new Date().getFullYear()}`.trim();
    }

    // =========================================================================
    // Research Execution
    // =========================================================================

    async executeQuery(queryObj) {
        const { query, type, language } = queryObj;

        // Check cache
        const cacheKey = `${type}:${query}`;
        if (this.queryCache.has(cacheKey)) {
            return this.queryCache.get(cacheKey);
        }

        try {
            // Execute search through web research service
            const result = await this.webResearch._executeSearch(query, {
                searchType: type,
                language,
                numResults: 5
            });

            const processed = {
                query,
                type,
                ...result,
                processedAt: new Date().toISOString()
            };

            // Cache result
            this.queryCache.set(cacheKey, processed);
            this.cleanCache();

            return processed;
        } catch (error) {
            aiLogger.error('IntelligentResearch', `Query failed: ${error.message}`);
            return {
                query,
                type,
                error: error.message,
                content: '',
                citations: []
            };
        }
    }

    cleanCache() {
        if (this.queryCache.size > this.maxCacheSize) {
            // Remove oldest entries
            const keysToDelete = Array.from(this.queryCache.keys())
                .slice(0, this.maxCacheSize / 4);
            keysToDelete.forEach(k => this.queryCache.delete(k));
        }
    }

    // =========================================================================
    // Synthesis
    // =========================================================================

    async synthesizeForConsulting(results, context) {
        const validResults = results.filter(r => r.content && !r.error);

        if (validResults.length === 0) {
            return {
                summary: 'No relevant research findings available.',
                keyInsights: [],
                recommendations: []
            };
        }

        // Use web research service's synthesis capability
        const synthesis = await this.webResearch.synthesizeFindings(validResults, {
            industry: context.industry,
            focusArea: context.topic,
            language: context.language || 'en'
        });

        // Extract key insights
        const keyInsights = this.extractKeyInsights(validResults);

        // Generate consulting-style recommendations
        const recommendations = this.generateRecommendations(validResults, context);

        return {
            summary: synthesis.synthesis,
            keyInsights,
            recommendations,
            sourceQuality: this.assessSourceQuality(validResults),
            citations: synthesis.citations
        };
    }

    extractKeyInsights(results) {
        const insights = [];

        for (const result of results) {
            // Extract statistics
            const stats = (result.content || '').match(/\d+(?:\.\d+)?%/g) || [];
            if (stats.length > 0) {
                insights.push({
                    type: 'statistic',
                    value: stats[0],
                    source: result.source
                });
            }

            // Extract company mentions
            const companies = (result.content || '').match(/([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g) || [];
            if (companies.length > 0) {
                insights.push({
                    type: 'company_example',
                    value: companies.slice(0, 3).join(', '),
                    source: result.source
                });
            }
        }

        return insights.slice(0, 5);
    }

    generateRecommendations(results, context) {
        // Basic recommendation generation
        const recommendations = [];

        if (context.phase === 'assessment') {
            recommendations.push('Consider benchmarking against industry leaders identified in research');
        }

        if (context.phase === 'initiatives') {
            recommendations.push('Review case studies for implementation lessons');
            recommendations.push('Validate business case with industry ROI data');
        }

        return recommendations;
    }

    assessSourceQuality(results) {
        const sources = results.map(r => r.source);
        const hasCredible = sources.some(s => ['perplexity', 'tavily', 'google'].includes(s));

        return {
            totalSources: results.length,
            hasCredibleSources: hasCredible,
            quality: hasCredible ? 'high' : 'medium'
        };
    }

    collectCitations(results) {
        const allCitations = [];

        for (const result of results) {
            if (result.citations) {
                allCitations.push(...result.citations);
            }
        }

        // Deduplicate by URL
        const seen = new Set();
        return allCitations.filter(c => {
            const url = c.url || c;
            if (seen.has(url)) return false;
            seen.add(url);
            return true;
        });
    }

    // =========================================================================
    // Deep Research Helpers
    // =========================================================================

    decomposeQuestion(question) {
        // Simple decomposition - in production would use NLP
        const subQuestions = [];

        // Extract "what", "how", "why" components
        if (question.toLowerCase().includes('how')) {
            subQuestions.push({
                text: question,
                intent: 'understand'
            });
            subQuestions.push({
                text: question.replace(/how/i, 'best practices for'),
                intent: 'implement'
            });
        }

        if (question.toLowerCase().includes('why')) {
            subQuestions.push({
                text: question,
                intent: 'understand'
            });
            subQuestions.push({
                text: question.replace(/why/i, 'benefits of'),
                intent: 'validate'
            });
        }

        // Add benchmark angle
        subQuestions.push({
            text: `${question} benchmark statistics`,
            intent: 'compare'
        });

        // Add case study angle
        subQuestions.push({
            text: `${question} case study example`,
            intent: 'validate'
        });

        return subQuestions.slice(0, 4);
    }

    async crossReference(subResults, context) {
        // Find common themes across results
        const themes = new Map();

        for (const result of subResults) {
            if (result.synthesis?.keyInsights) {
                for (const insight of result.synthesis.keyInsights) {
                    const key = insight.type;
                    if (!themes.has(key)) themes.set(key, []);
                    themes.get(key).push(insight);
                }
            }
        }

        return {
            commonThemes: Array.from(themes.keys()),
            convergingInsights: Array.from(themes.entries())
                .filter(([_, insights]) => insights.length > 1)
                .map(([theme, insights]) => ({ theme, count: insights.length }))
        };
    }

    async createDeepSynthesis(question, subResults, crossRefs, context) {
        const allSyntheses = subResults
            .map(r => r.synthesis?.summary)
            .filter(Boolean);

        if (allSyntheses.length === 0) {
            return 'Insufficient research data for comprehensive synthesis.';
        }

        // Create consulting-style executive summary
        return {
            executiveSummary: `Research findings for: ${question}`,
            keyFindings: allSyntheses.slice(0, 3),
            convergingThemes: crossRefs.convergingInsights,
            recommendedActions: this.generateStrategicRecommendations(subResults, context),
            confidenceLevel: subResults.filter(r => r.success).length / subResults.length
        };
    }

    generateStrategicRecommendations(results, context) {
        const recommendations = [];

        // Based on findings
        const hasGoodData = results.some(r => r.success && r.resultCount > 0);

        if (hasGoodData) {
            recommendations.push('Leverage identified benchmarks for goal-setting');
            recommendations.push('Study highlighted case studies for implementation approach');
        }

        if (context.phase === 'initiatives') {
            recommendations.push('Prioritize initiatives with proven ROI in research');
        }

        return recommendations;
    }

    countUniqueSources(results) {
        const sources = new Set();
        for (const result of results) {
            if (result.citations) {
                result.citations.forEach(c => sources.add(c.url || c));
            }
        }
        return sources.size;
    }

    detectResearchNeed(message, state) {
        const text = message.content?.toLowerCase() || '';

        // Keywords that trigger research
        const researchTriggers = [
            'benchmark', 'compare', 'industry average', 'best practice',
            'case study', 'example', 'how do others', 'what is typical',
            'roi', 'return on investment', 'statistics', 'data',
            'średnia', 'benchmark', 'przykład', 'jak inni'
        ];

        return researchTriggers.some(trigger => text.includes(trigger));
    }
}

// Singleton instance
const intelligentResearch = new IntelligentResearch();

export {
IntelligentResearch,
    intelligentResearch,
    QUERY_TEMPLATES,
    CONTEXT_RESEARCH_MAP
};

export default {
    IntelligentResearch,
    intelligentResearch,
    QUERY_TEMPLATES,
    CONTEXT_RESEARCH_MAP
};

