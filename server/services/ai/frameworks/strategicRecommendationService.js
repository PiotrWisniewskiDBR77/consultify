/**
 * Strategic Recommendation Service
 * 
 * Generates BCG/McKinsey-style strategic recommendations based on
 * assessment data, framework analyses, and industry intelligence.
 * 
 * Part of the Enterprise AI Consulting System.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../../database');
const FrameworkEngine = require('./frameworkEngine');
const { getFramework } = require('./consultingFrameworks');

// Recommendation categories aligned with strategic consulting
const RECOMMENDATION_CATEGORIES = {
    QUICK_WIN: {
        name: 'Quick Wins',
        description: 'High impact, low effort improvements achievable in 0-3 months',
        characteristics: { impactThreshold: 'MEDIUM', effortMax: 'LOW', timeframe: '0-3 months' }
    },
    STRATEGIC_INITIATIVE: {
        name: 'Strategic Initiatives',
        description: 'Major transformational programs requiring significant investment',
        characteristics: { impactThreshold: 'HIGH', effortMax: 'HIGH', timeframe: '6-18 months' }
    },
    FOUNDATION_BUILDING: {
        name: 'Foundation Building',
        description: 'Essential capabilities and infrastructure investments',
        characteristics: { impactThreshold: 'MEDIUM', effortMax: 'MEDIUM', timeframe: '3-12 months' }
    },
    MOONSHOT: {
        name: 'Moonshots',
        description: 'Bold, transformative bets with high risk and high reward',
        characteristics: { impactThreshold: 'TRANSFORMATIONAL', effortMax: 'HIGH', timeframe: '12-36 months' }
    }
};

// Investment thesis templates
const INVESTMENT_THESIS_TEMPLATES = {
    EFFICIENCY: {
        theme: 'Operational Excellence',
        valueDriver: 'Cost reduction and productivity improvement',
        roiRange: '15-30%',
        paybackPeriod: '12-18 months'
    },
    GROWTH: {
        theme: 'Revenue Growth',
        valueDriver: 'Market expansion and customer acquisition',
        roiRange: '20-50%',
        paybackPeriod: '18-36 months'
    },
    RISK_MITIGATION: {
        theme: 'Risk Management',
        valueDriver: 'Risk reduction and compliance assurance',
        roiRange: '10-20%',
        paybackPeriod: '6-12 months'
    },
    CAPABILITY_BUILDING: {
        theme: 'Capability Development',
        valueDriver: 'Strategic optionality and competitive moat',
        roiRange: '25-100%',
        paybackPeriod: '24-48 months'
    },
    CUSTOMER_EXPERIENCE: {
        theme: 'Customer Experience',
        valueDriver: 'NPS improvement and customer lifetime value',
        roiRange: '15-40%',
        paybackPeriod: '12-24 months'
    }
};

class StrategicRecommendationService {
    
    /**
     * Generate comprehensive strategic recommendations
     * @param {Object} assessment - Assessment data with scores and gaps
     * @param {Object} orgProfile - Organization profile
     * @param {Object} frameworkAnalyses - Results from FrameworkEngine
     * @param {Object} industryContext - Industry intelligence
     * @returns {Promise<StrategicRecommendations>}
     */
    static async generateRecommendations(assessment, orgProfile, frameworkAnalyses = null, industryContext = null) {
        // Get framework analyses if not provided
        if (!frameworkAnalyses) {
            frameworkAnalyses = await FrameworkEngine.applyFrameworks(assessment, orgProfile, industryContext);
        }
        
        // Generate recommendations from multiple sources
        const [
            gapBasedRecs,
            frameworkBasedRecs,
            industryBasedRecs,
            competitiveRecs
        ] = await Promise.all([
            this.generateGapBasedRecommendations(assessment, orgProfile),
            this.generateFrameworkBasedRecommendations(frameworkAnalyses, orgProfile),
            this.generateIndustryBasedRecommendations(industryContext, assessment),
            this.generateCompetitiveRecommendations(orgProfile, industryContext)
        ]);
        
        // Consolidate and prioritize
        const allRecommendations = [
            ...gapBasedRecs,
            ...frameworkBasedRecs,
            ...industryBasedRecs,
            ...competitiveRecs
        ];
        
        const prioritized = this.prioritizeRecommendations(allRecommendations, orgProfile);
        const categorized = this.categorizeRecommendations(prioritized);
        const withThesis = this.addInvestmentThesis(categorized);
        
        // Generate executive summary
        const executiveSummary = this.generateExecutiveSummary(withThesis, assessment, orgProfile);
        
        return {
            executiveSummary,
            recommendations: withThesis,
            categorized: {
                quickWins: categorized.filter(r => r.category === 'QUICK_WIN'),
                strategicInitiatives: categorized.filter(r => r.category === 'STRATEGIC_INITIATIVE'),
                foundationBuilding: categorized.filter(r => r.category === 'FOUNDATION_BUILDING'),
                moonshots: categorized.filter(r => r.category === 'MOONSHOT')
            },
            roadmap: this.generateRoadmap(withThesis),
            investmentSummary: this.calculateInvestmentSummary(withThesis),
            confidence: this.calculateOverallConfidence(frameworkAnalyses, industryContext),
            generatedAt: new Date().toISOString()
        };
    }
    
    /**
     * Generate recommendations based on assessment gaps
     */
    static async generateGapBasedRecommendations(assessment, orgProfile) {
        const recommendations = [];
        const gaps = assessment.gaps || [];
        const scores = assessment.scores || {};
        
        // Priority gap mapping to recommendations
        const gapRecommendations = {
            processes: [
                { title: 'Process Automation Program', theme: 'EFFICIENCY', impact: 'HIGH' },
                { title: 'BPM Platform Implementation', theme: 'EFFICIENCY', impact: 'MEDIUM' },
                { title: 'Process Mining Initiative', theme: 'EFFICIENCY', impact: 'MEDIUM' }
            ],
            digitalProducts: [
                { title: 'Digital Product Strategy Development', theme: 'GROWTH', impact: 'HIGH' },
                { title: 'Customer Digital Experience Platform', theme: 'CUSTOMER_EXPERIENCE', impact: 'HIGH' },
                { title: 'Mobile-First Product Redesign', theme: 'GROWTH', impact: 'MEDIUM' }
            ],
            businessModels: [
                { title: 'Digital Revenue Stream Development', theme: 'GROWTH', impact: 'HIGH' },
                { title: 'Platform Business Model Exploration', theme: 'GROWTH', impact: 'HIGH' },
                { title: 'Ecosystem Partnership Strategy', theme: 'CAPABILITY_BUILDING', impact: 'MEDIUM' }
            ],
            dataManagement: [
                { title: 'Enterprise Data Platform Modernization', theme: 'CAPABILITY_BUILDING', impact: 'HIGH' },
                { title: 'Data Governance Framework', theme: 'RISK_MITIGATION', impact: 'MEDIUM' },
                { title: 'Real-time Analytics Capability', theme: 'EFFICIENCY', impact: 'MEDIUM' }
            ],
            culture: [
                { title: 'Digital Upskilling Program', theme: 'CAPABILITY_BUILDING', impact: 'HIGH' },
                { title: 'Agile Transformation', theme: 'EFFICIENCY', impact: 'HIGH' },
                { title: 'Innovation Lab Establishment', theme: 'CAPABILITY_BUILDING', impact: 'MEDIUM' }
            ],
            cybersecurity: [
                { title: 'Zero Trust Security Implementation', theme: 'RISK_MITIGATION', impact: 'HIGH' },
                { title: 'Security Operations Center (SOC)', theme: 'RISK_MITIGATION', impact: 'HIGH' },
                { title: 'Security Awareness Program', theme: 'RISK_MITIGATION', impact: 'MEDIUM' }
            ],
            aiMaturity: [
                { title: 'AI Center of Excellence', theme: 'CAPABILITY_BUILDING', impact: 'HIGH' },
                { title: 'ML Ops Platform', theme: 'CAPABILITY_BUILDING', impact: 'HIGH' },
                { title: 'GenAI Use Case Pilots', theme: 'EFFICIENCY', impact: 'MEDIUM' }
            ]
        };
        
        // Generate recommendations for significant gaps
        gaps.forEach(gap => {
            if (gap.gap >= 1.5) {
                const axisRecs = gapRecommendations[gap.axisId] || [];
                const numRecs = gap.gap >= 3 ? 3 : gap.gap >= 2 ? 2 : 1;
                
                axisRecs.slice(0, numRecs).forEach((recTemplate, index) => {
                    const currentScore = gap.currentScore || scores[gap.axisId] || 3;
                    const targetScore = gap.targetScore || Math.min(7, currentScore + 2);
                    
                    recommendations.push({
                        id: uuidv4(),
                        title: recTemplate.title,
                        description: this.generateDescription(recTemplate.title, gap.axisName || gap.axisId, currentScore, targetScore),
                        sourceAxis: gap.axisId,
                        sourceGap: gap.gap,
                        theme: recTemplate.theme,
                        impact: recTemplate.impact,
                        effort: index === 0 ? 'HIGH' : index === 1 ? 'MEDIUM' : 'LOW',
                        priority: gap.priority === 'CRITICAL' ? 1 : gap.priority === 'HIGH' ? 2 : 3,
                        expectedOutcome: `Improve ${gap.axisName || gap.axisId} maturity from ${currentScore.toFixed(1)} to ${targetScore.toFixed(1)}`,
                        source: 'GAP_ANALYSIS'
                    });
                });
            }
        });
        
        return recommendations;
    }
    
    /**
     * Generate recommendations from framework analyses
     */
    static async generateFrameworkBasedRecommendations(frameworkAnalyses, orgProfile) {
        const recommendations = [];
        
        if (!frameworkAnalyses?.analyses) return recommendations;
        
        // Extract recommendations from each framework
        Object.entries(frameworkAnalyses.analyses).forEach(([frameworkId, analysis]) => {
            const result = analysis.result || {};
            
            // SWOT strategies
            if (frameworkId === 'SWOT' && result.strategies) {
                Object.entries(result.strategies).forEach(([stratType, strategies]) => {
                    (strategies || []).slice(0, 2).forEach(strategy => {
                        recommendations.push({
                            id: uuidv4(),
                            title: this.titleFromStrategy(strategy),
                            description: strategy,
                            sourceFramework: 'SWOT',
                            strategyType: stratType,
                            theme: stratType === 'SO' ? 'GROWTH' : stratType === 'ST' ? 'RISK_MITIGATION' : 'CAPABILITY_BUILDING',
                            impact: stratType === 'SO' || stratType === 'ST' ? 'HIGH' : 'MEDIUM',
                            effort: 'MEDIUM',
                            priority: stratType === 'SO' ? 1 : stratType === 'ST' ? 2 : 3,
                            source: 'FRAMEWORK_ANALYSIS'
                        });
                    });
                });
            }
            
            // McKinsey 7S recommendations
            if (frameworkId === 'MCKINSEY_7S' && result.recommendations) {
                result.recommendations.forEach((rec, index) => {
                    recommendations.push({
                        id: uuidv4(),
                        title: this.titleFromStrategy(rec),
                        description: rec,
                        sourceFramework: 'MCKINSEY_7S',
                        theme: 'CAPABILITY_BUILDING',
                        impact: index === 0 ? 'HIGH' : 'MEDIUM',
                        effort: 'HIGH',
                        priority: index + 1,
                        source: 'FRAMEWORK_ANALYSIS'
                    });
                });
            }
            
            // Porter's Five Forces digital defense strategies
            if (frameworkId === 'PORTER_5_FORCES' && result.digitalDefenseStrategies) {
                result.digitalDefenseStrategies.slice(0, 2).forEach((strategy, index) => {
                    recommendations.push({
                        id: uuidv4(),
                        title: this.titleFromStrategy(strategy),
                        description: strategy,
                        sourceFramework: 'PORTER_5_FORCES',
                        theme: 'RISK_MITIGATION',
                        impact: 'HIGH',
                        effort: 'HIGH',
                        priority: index + 1,
                        source: 'FRAMEWORK_ANALYSIS'
                    });
                });
            }
        });
        
        return recommendations;
    }
    
    /**
     * Generate recommendations based on industry intelligence
     */
    static async generateIndustryBasedRecommendations(industryContext, assessment) {
        const recommendations = [];
        
        if (!industryContext?.trends?.items) return recommendations;
        
        // Map industry trends to recommendations
        industryContext.trends.items.slice(0, 3).forEach((trend, index) => {
            if (trend.relevance === 'HIGH' || trend.relevance === 'CRITICAL') {
                recommendations.push({
                    id: uuidv4(),
                    title: `Capitalize on ${trend.trend}`,
                    description: `Develop capabilities to leverage the industry trend: ${trend.trend}`,
                    sourceTrend: trend.trend,
                    theme: 'GROWTH',
                    impact: trend.impact || 'HIGH',
                    effort: 'MEDIUM',
                    priority: index + 1,
                    source: 'INDUSTRY_INTELLIGENCE'
                });
            }
        });
        
        return recommendations;
    }
    
    /**
     * Generate competitive response recommendations
     */
    static async generateCompetitiveRecommendations(orgProfile, industryContext) {
        const recommendations = [];
        
        if (!orgProfile?.competitive_position) return recommendations;
        
        const positionStrategies = {
            LEADER: [
                { title: 'Defend Leadership through Innovation', theme: 'GROWTH', impact: 'HIGH' },
                { title: 'Build Platform Ecosystem', theme: 'CAPABILITY_BUILDING', impact: 'HIGH' }
            ],
            CHALLENGER: [
                { title: 'Differentiation through Digital Excellence', theme: 'GROWTH', impact: 'HIGH' },
                { title: 'Target Underserved Segments', theme: 'GROWTH', impact: 'MEDIUM' }
            ],
            FOLLOWER: [
                { title: 'Fast-Follower Digital Strategy', theme: 'EFFICIENCY', impact: 'MEDIUM' },
                { title: 'Niche Specialization', theme: 'GROWTH', impact: 'MEDIUM' }
            ],
            NICHE: [
                { title: 'Deep Domain Digital Excellence', theme: 'CAPABILITY_BUILDING', impact: 'HIGH' },
                { title: 'Customer Intimacy Platform', theme: 'CUSTOMER_EXPERIENCE', impact: 'HIGH' }
            ]
        };
        
        const strategies = positionStrategies[orgProfile.competitive_position] || positionStrategies.FOLLOWER;
        
        strategies.forEach((strategy, index) => {
            recommendations.push({
                id: uuidv4(),
                title: strategy.title,
                description: `Strategic response based on ${orgProfile.competitive_position} market position`,
                competitivePosition: orgProfile.competitive_position,
                theme: strategy.theme,
                impact: strategy.impact,
                effort: 'HIGH',
                priority: index + 1,
                source: 'COMPETITIVE_ANALYSIS'
            });
        });
        
        return recommendations;
    }
    
    /**
     * Prioritize recommendations using weighted scoring
     */
    static prioritizeRecommendations(recommendations, orgProfile) {
        return recommendations.map(rec => {
            let score = 0;
            
            // Impact weight (40%)
            const impactScores = { TRANSFORMATIONAL: 10, HIGH: 8, MEDIUM: 5, LOW: 2 };
            score += (impactScores[rec.impact] || 5) * 0.4;
            
            // Alignment with strategic priorities (30%)
            const priorities = orgProfile?.strategic_priorities || [];
            const alignmentBonus = priorities.some(p => 
                rec.title.toLowerCase().includes(p.toLowerCase()) ||
                rec.description?.toLowerCase().includes(p.toLowerCase())
            ) ? 3 : 0;
            score += alignmentBonus;
            
            // Effort inverse (20%)
            const effortScores = { LOW: 8, MEDIUM: 5, HIGH: 2 };
            score += (effortScores[rec.effort] || 5) * 0.2;
            
            // Source reliability (10%)
            const sourceScores = { GAP_ANALYSIS: 8, FRAMEWORK_ANALYSIS: 7, INDUSTRY_INTELLIGENCE: 6, COMPETITIVE_ANALYSIS: 5 };
            score += (sourceScores[rec.source] || 5) * 0.1;
            
            return { ...rec, priorityScore: Math.round(score * 10) / 10 };
        }).sort((a, b) => b.priorityScore - a.priorityScore);
    }
    
    /**
     * Categorize recommendations
     */
    static categorizeRecommendations(recommendations) {
        return recommendations.map(rec => {
            let category;
            
            if (rec.impact === 'HIGH' && rec.effort === 'LOW') {
                category = 'QUICK_WIN';
            } else if (rec.impact === 'TRANSFORMATIONAL' || (rec.impact === 'HIGH' && rec.effort === 'HIGH')) {
                category = rec.theme === 'GROWTH' || rec.theme === 'CAPABILITY_BUILDING' ? 'STRATEGIC_INITIATIVE' : 'FOUNDATION_BUILDING';
            } else if (rec.effort === 'HIGH' && rec.impact === 'HIGH') {
                category = 'MOONSHOT';
            } else {
                category = 'FOUNDATION_BUILDING';
            }
            
            return {
                ...rec,
                category,
                categoryDetails: RECOMMENDATION_CATEGORIES[category]
            };
        });
    }
    
    /**
     * Add investment thesis to recommendations
     */
    static addInvestmentThesis(recommendations) {
        return recommendations.map(rec => {
            const thesisTemplate = INVESTMENT_THESIS_TEMPLATES[rec.theme] || INVESTMENT_THESIS_TEMPLATES.CAPABILITY_BUILDING;
            
            // Estimate budget based on effort and category
            const budgetRanges = {
                QUICK_WIN: { min: 50000, max: 200000 },
                FOUNDATION_BUILDING: { min: 200000, max: 800000 },
                STRATEGIC_INITIATIVE: { min: 500000, max: 2000000 },
                MOONSHOT: { min: 1000000, max: 5000000 }
            };
            const range = budgetRanges[rec.category] || budgetRanges.FOUNDATION_BUILDING;
            const estimatedBudget = rec.effort === 'HIGH' ? range.max : rec.effort === 'LOW' ? range.min : (range.min + range.max) / 2;
            
            return {
                ...rec,
                investmentThesis: {
                    theme: thesisTemplate.theme,
                    valueDriver: thesisTemplate.valueDriver,
                    expectedROI: thesisTemplate.roiRange,
                    paybackPeriod: thesisTemplate.paybackPeriod,
                    estimatedBudget: Math.round(estimatedBudget),
                    riskLevel: rec.effort === 'HIGH' ? 'HIGH' : rec.effort === 'MEDIUM' ? 'MEDIUM' : 'LOW'
                }
            };
        });
    }
    
    /**
     * Generate executive summary
     */
    static generateExecutiveSummary(recommendations, assessment, orgProfile) {
        const topRecs = recommendations.slice(0, 5);
        const totalInvestment = recommendations.reduce((sum, r) => sum + (r.investmentThesis?.estimatedBudget || 0), 0);
        
        return {
            headline: `Digital Transformation Roadmap for ${orgProfile?.industry || 'Organization'}`,
            currentState: `Current digital maturity: ${assessment.overall_score?.toFixed(1) || 'N/A'}/7`,
            keyFindings: [
                `Identified ${recommendations.length} strategic recommendations`,
                `${recommendations.filter(r => r.category === 'QUICK_WIN').length} quick wins for immediate impact`,
                `${recommendations.filter(r => r.category === 'STRATEGIC_INITIATIVE').length} strategic initiatives for transformation`
            ],
            topPriorities: topRecs.map(r => ({
                title: r.title,
                impact: r.impact,
                timeframe: r.categoryDetails?.characteristics?.timeframe
            })),
            investmentOverview: {
                totalEstimated: totalInvestment,
                quickWins: recommendations.filter(r => r.category === 'QUICK_WIN').reduce((sum, r) => sum + (r.investmentThesis?.estimatedBudget || 0), 0),
                strategic: recommendations.filter(r => r.category === 'STRATEGIC_INITIATIVE').reduce((sum, r) => sum + (r.investmentThesis?.estimatedBudget || 0), 0)
            }
        };
    }
    
    /**
     * Generate implementation roadmap
     */
    static generateRoadmap(recommendations) {
        const phases = {
            phase1: { name: 'Foundation (0-3 months)', initiatives: [] },
            phase2: { name: 'Build (3-9 months)', initiatives: [] },
            phase3: { name: 'Scale (9-18 months)', initiatives: [] },
            phase4: { name: 'Transform (18+ months)', initiatives: [] }
        };
        
        recommendations.forEach(rec => {
            const phase = rec.category === 'QUICK_WIN' ? 'phase1' :
                         rec.category === 'FOUNDATION_BUILDING' ? 'phase2' :
                         rec.category === 'STRATEGIC_INITIATIVE' ? 'phase3' : 'phase4';
            
            phases[phase].initiatives.push({
                id: rec.id,
                title: rec.title,
                impact: rec.impact,
                budget: rec.investmentThesis?.estimatedBudget
            });
        });
        
        return phases;
    }
    
    /**
     * Calculate investment summary
     */
    static calculateInvestmentSummary(recommendations) {
        const byTheme = {};
        const byCategory = {};
        
        recommendations.forEach(rec => {
            const budget = rec.investmentThesis?.estimatedBudget || 0;
            
            byTheme[rec.theme] = (byTheme[rec.theme] || 0) + budget;
            byCategory[rec.category] = (byCategory[rec.category] || 0) + budget;
        });
        
        return {
            total: Object.values(byCategory).reduce((a, b) => a + b, 0),
            byTheme,
            byCategory,
            breakdown: Object.entries(byTheme).map(([theme, amount]) => ({
                theme,
                amount,
                percentage: Math.round((amount / Object.values(byTheme).reduce((a, b) => a + b, 1)) * 100)
            }))
        };
    }
    
    /**
     * Calculate overall confidence
     */
    static calculateOverallConfidence(frameworkAnalyses, industryContext) {
        let score = 0.5;
        
        if (frameworkAnalyses?.analyses && Object.keys(frameworkAnalyses.analyses).length > 2) score += 0.2;
        if (industryContext?.confidence === 'HIGH') score += 0.2;
        if (frameworkAnalyses?.synthesis?.overallConfidence === 'HIGH') score += 0.1;
        
        return score >= 0.8 ? 'HIGH' : score >= 0.5 ? 'MEDIUM' : 'LOW';
    }
    
    // Helper methods
    static generateDescription(title, axisName, currentScore, targetScore) {
        return `Initiative to address ${axisName} maturity gap. Current state: ${currentScore.toFixed(1)}/7, target: ${targetScore.toFixed(1)}/7. ${title} will establish foundational capabilities for sustainable improvement.`;
    }
    
    static titleFromStrategy(strategy) {
        // Extract a short title from a strategy description
        const words = strategy.split(' ').slice(0, 5);
        return words.join(' ').replace(/[.,;:]$/, '');
    }
}

module.exports = StrategicRecommendationService;






