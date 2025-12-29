/**
 * FinanceAgent - Expert in financial analysis and ROI
 * 
 * Specializations:
 * - ROI and NPV calculations
 * - Budget planning and allocation
 * - Cost-benefit analysis
 * - Financial risk assessment
 * - Investment prioritization
 * - Business case development
 */

const { BaseAgent } = require('./baseAgent');
const llmService = require('../llmService');

class FinanceAgent extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'FinanceAgent',
            domain: 'finance',
            expertise: [
                'ROI Analysis',
                'NPV/IRR Calculations',
                'Budget Planning',
                'Cost-Benefit Analysis',
                'Financial Modeling',
                'Investment Appraisal',
                'Cash Flow Management',
                'Business Case Development'
            ],
            systemPrompt: `You are a Chief Financial Officer (CFO) advisor with deep expertise in technology investments and digital transformation financials.

Your role is to provide financial guidance on:
- Return on Investment (ROI) analysis
- Net Present Value (NPV) and IRR calculations
- Budget allocation and optimization
- Cost-benefit analysis for initiatives
- Financial risk assessment
- Business case development

Communication style:
- Be quantitative and data-driven
- Use financial terminology appropriately
- Provide specific numbers and ranges
- Highlight financial risks and sensitivities
- Focus on value creation and protection`,
            confidenceThreshold: 0.8, // Higher threshold for financial advice
            debateWeight: 1.1,
            ...config
        });
    }

    getKeywords() {
        return [
            'roi', 'return', 'investment', 'cost', 'budget', 'expense',
            'npv', 'irr', 'payback', 'cash flow', 'revenue',
            'profit', 'margin', 'savings', 'financial', 'finance',
            'money', 'dollar', 'euro', 'price', 'pricing',
            'business case', 'justification', 'value', 'benefit',
            'risk', 'sensitivity', 'scenario', 'forecast', 'projection'
        ];
    }

    async process(query, context) {
        const prompt = this.buildFinancePrompt(query, context);
        
        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: this.maxTokens,
                temperature: 0.5, // Lower temperature for financial accuracy
                model: context.preferredModel || 'default'
            });

            const analysis = this.parseResponse(response);
            
            // Add financial calculations if relevant
            if (context.economics) {
                analysis.calculations = this.performCalculations(context.economics);
            }

            this.remember({
                query,
                insight: analysis.mainInsight,
                financialImpact: analysis.financialImpact
            });

            return {
                agentId: this.id,
                agentName: this.name,
                domain: this.domain,
                ...analysis,
                metadata: {
                    model: context.preferredModel || 'default',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error(`[FinanceAgent] Error processing query:`, error);
            return this.getFallbackResponse(query, context);
        }
    }

    buildFinancePrompt(query, context) {
        const basePrompt = this.buildPrompt(query, context);
        
        let financeContext = '';
        
        if (context.economics) {
            const eco = context.economics;
            financeContext += `\nFINANCIAL DATA:
- Total Investment: ${this.formatCurrency(eco.totalInvestment)}
- Expected Benefits: ${this.formatCurrency(eco.totalBenefits)}
- Overall ROI: ${eco.overallROI || 0}%
- Payback Period: ${eco.paybackMonths || 'Not calculated'} months
- NPV: ${this.formatCurrency(eco.npv)}`;
        }
        
        if (context.initiatives?.length) {
            const initiativesCosts = context.initiatives
                .filter(i => i.estimatedCost)
                .slice(0, 5);
            
            if (initiativesCosts.length) {
                financeContext += `\nINITIATIVE INVESTMENTS:
${initiativesCosts.map(i => `- ${i.name}: ${this.formatCurrency(i.estimatedCost)} (${i.expectedROI || 'TBD'}% ROI)`).join('\n')}`;
            }
        }
        
        if (context.budget) {
            financeContext += `\nBUDGET ALLOCATION:
- Total Budget: ${this.formatCurrency(context.budget.total)}
- Allocated: ${this.formatCurrency(context.budget.allocated)}
- Remaining: ${this.formatCurrency(context.budget.remaining)}`;
        }

        return `${basePrompt}

FINANCIAL CONTEXT:
${financeContext || 'No specific financial data available'}

ANALYSIS REQUIREMENTS:
1. Provide quantified financial assessment
2. Include sensitivity analysis where relevant
3. Highlight key financial risks
4. Recommend financial optimization opportunities

FORMAT YOUR RESPONSE AS:
## Financial Assessment
[Summary of financial position and implications]

## Key Metrics
- ROI: [X]%
- NPV: $[X]
- Payback: [X] months
- Risk Level: [Low/Medium/High]

## Financial Recommendations
1. [Recommendation with financial impact]
2. [Recommendation with financial impact]

## Risk Factors
- [Financial risk with potential impact]

## Confidence: [X]%`;
    }

    parseResponse(response) {
        const text = response.text || response;
        
        const confidenceMatch = text.match(/Confidence:\s*(\d+)/i);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7;

        // Extract financial metrics
        const metricsMatch = text.match(/## Key Metrics\s*([\s\S]*?)(?=##|$)/i);
        const metrics = this.extractMetrics(metricsMatch ? metricsMatch[1] : text);

        // Extract main insight
        const insightMatch = text.match(/## Financial Assessment\s*([\s\S]*?)(?=##|$)/i);
        const mainInsight = insightMatch 
            ? insightMatch[1].trim().split('\n')[0]
            : 'Financial analysis completed';

        // Extract recommendations
        const recsMatch = text.match(/## Financial Recommendations\s*([\s\S]*?)(?=##|$)/i);
        const recommendations = recsMatch
            ? recsMatch[1].trim().split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))
            : [];

        return {
            mainInsight,
            fullAnalysis: text,
            recommendations,
            financialMetrics: metrics,
            financialImpact: this.categorizeImpact(metrics),
            confidence
        };
    }

    extractMetrics(text) {
        const metrics = {};
        
        const roiMatch = text.match(/ROI:\s*([\d.]+)%/i);
        if (roiMatch) metrics.roi = parseFloat(roiMatch[1]);
        
        const npvMatch = text.match(/NPV:\s*\$?([\d,]+)/i);
        if (npvMatch) metrics.npv = parseFloat(npvMatch[1].replace(/,/g, ''));
        
        const paybackMatch = text.match(/Payback:\s*([\d.]+)\s*months/i);
        if (paybackMatch) metrics.paybackMonths = parseFloat(paybackMatch[1]);
        
        const riskMatch = text.match(/Risk Level:\s*(Low|Medium|High)/i);
        if (riskMatch) metrics.riskLevel = riskMatch[1].toLowerCase();

        return metrics;
    }

    categorizeImpact(metrics) {
        if (!metrics.roi) return 'unknown';
        
        if (metrics.roi >= 100) return 'transformational';
        if (metrics.roi >= 50) return 'high';
        if (metrics.roi >= 20) return 'medium';
        if (metrics.roi >= 0) return 'low';
        return 'negative';
    }

    performCalculations(economics) {
        const calculations = {};
        
        // ROI Calculation
        if (economics.totalInvestment && economics.totalBenefits) {
            calculations.roi = ((economics.totalBenefits - economics.totalInvestment) / economics.totalInvestment) * 100;
        }
        
        // Simple Payback
        if (economics.totalInvestment && economics.annualBenefits) {
            calculations.paybackYears = economics.totalInvestment / economics.annualBenefits;
            calculations.paybackMonths = calculations.paybackYears * 12;
        }
        
        // NPV (simplified - assuming 10% discount rate, 5 year horizon)
        if (economics.annualBenefits && economics.totalInvestment) {
            const discountRate = 0.10;
            const years = 5;
            let npv = -economics.totalInvestment;
            
            for (let year = 1; year <= years; year++) {
                npv += economics.annualBenefits / Math.pow(1 + discountRate, year);
            }
            
            calculations.npv = Math.round(npv);
        }

        return calculations;
    }

    formatCurrency(value) {
        if (value === undefined || value === null) return 'N/A';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    getFallbackResponse(query, context) {
        return {
            agentId: this.id,
            agentName: this.name,
            domain: this.domain,
            mainInsight: 'Unable to complete financial analysis due to technical issues.',
            fullAnalysis: 'Please retry or provide additional financial data.',
            recommendations: [
                'Review investment assumptions',
                'Validate cost estimates',
                'Consider sensitivity analysis'
            ],
            financialMetrics: {},
            financialImpact: 'unknown',
            confidence: 0.3,
            error: true
        };
    }

    /**
     * Generate detailed ROI analysis for an initiative
     */
    async analyzeROI(initiative, context) {
        const prompt = `${this.systemPrompt}

Perform detailed ROI analysis for the following initiative:

INITIATIVE: ${initiative.name}
DESCRIPTION: ${initiative.description || 'Not provided'}
ESTIMATED COST: ${this.formatCurrency(initiative.estimatedCost)}
EXPECTED BENEFITS: ${initiative.expectedBenefits || 'Not quantified'}
TIMELINE: ${initiative.timeline || 'Not specified'}

ORGANIZATIONAL CONTEXT:
- Company Size: ${context.organization?.size || 'Unknown'}
- Industry: ${context.organization?.industry || 'Unknown'}
- Annual Revenue: ${this.formatCurrency(context.organization?.revenue)}

Provide:
1. Detailed cost breakdown (implementation, training, maintenance, opportunity cost)
2. Benefits quantification (hard savings, soft benefits, revenue impact)
3. 3-year ROI projection
4. Sensitivity analysis (best case, base case, worst case)
5. Recommendation (Proceed/Defer/Reject) with confidence level`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 2500,
                temperature: 0.5
            });

            return {
                agentId: this.id,
                initiative: initiative.name,
                analysis: response.text || response,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[FinanceAgent] Error analyzing ROI:', error);
            return { error: true, message: error.message };
        }
    }
}

module.exports = { FinanceAgent };

