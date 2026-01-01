/**
 * Framework Engine
 * 
 * Applies consulting frameworks to assessment data and organizational context.
 * Generates structured analyses using AI with framework-specific prompts.
 * 
 * Part of the Enterprise AI Consulting System.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../../database');
const { 
    CONSULTING_FRAMEWORKS, 
    getFramework, 
    recommendFrameworks 
} = require('./consultingFrameworks');

// Lazy-load AI service to avoid circular dependencies
let AIService = null;
function getAIService() {
    if (!AIService) {
        try {
            AIService = require('../../aiService');
        } catch (e) {
            console.warn('[FrameworkEngine] AIService not available:', e.message);
        }
    }
    return AIService;
}

class FrameworkEngine {
    
    /**
     * Apply multiple frameworks automatically based on context
     * @param {Object} assessment - Assessment data
     * @param {Object} orgProfile - Organization profile
     * @param {Object} industryContext - Industry intelligence
     * @returns {Promise<FrameworkAnalyses>}
     */
    static async applyFrameworks(assessment, orgProfile, industryContext = null) {
        // Determine which frameworks to apply
        const analysisContext = {
            assessmentType: assessment.type || 'MATURITY',
            hasCompetitorData: orgProfile?.key_competitors?.length > 0,
            hasIndustryData: !!industryContext,
            focusArea: this.determineFocusArea(assessment)
        };
        
        const recommended = recommendFrameworks(analysisContext);
        
        // Apply recommended frameworks in parallel
        const results = await Promise.all(
            recommended.slice(0, 4).map(async rec => {
                try {
                    const analysis = await this.applyFramework(
                        rec.frameworkId, 
                        assessment, 
                        orgProfile, 
                        industryContext
                    );
                    return { 
                        frameworkId: rec.frameworkId, 
                        analysis, 
                        reason: rec.reason,
                        success: true 
                    };
                } catch (error) {
                    console.error(`[FrameworkEngine] ${rec.frameworkId} failed:`, error.message);
                    return { 
                        frameworkId: rec.frameworkId, 
                        error: error.message,
                        success: false 
                    };
                }
            })
        );
        
        // Store analyses
        const successfulAnalyses = results.filter(r => r.success);
        for (const result of successfulAnalyses) {
            await this.storeAnalysis(
                orgProfile?.organization_id || assessment.organization_id,
                assessment.id,
                result.frameworkId,
                result.analysis
            );
        }
        
        return {
            appliedFrameworks: results.map(r => r.frameworkId),
            analyses: Object.fromEntries(
                successfulAnalyses.map(r => [r.frameworkId, r.analysis])
            ),
            failed: results.filter(r => !r.success).map(r => ({
                framework: r.frameworkId,
                error: r.error
            })),
            synthesis: this.synthesizeAnalyses(successfulAnalyses),
            generatedAt: new Date().toISOString()
        };
    }
    
    /**
     * Apply a specific framework
     */
    static async applyFramework(frameworkId, assessment, orgProfile, industryContext = null) {
        const framework = getFramework(frameworkId);
        if (!framework) {
            throw new Error(`Unknown framework: ${frameworkId}`);
        }
        
        // Build context for prompt
        const promptContext = this.buildPromptContext(framework, assessment, orgProfile, industryContext);
        
        // Generate analysis using AI
        const prompt = this.buildPrompt(framework, promptContext);
        
        const aiService = getAIService();
        if (!aiService) {
            // Return static analysis if AI not available
            return this.generateStaticAnalysis(frameworkId, assessment, orgProfile);
        }
        
        try {
            const result = await aiService.generateStructuredContent(prompt, `framework_${frameworkId.toLowerCase()}`);
            
            return {
                frameworkId,
                frameworkName: framework.name,
                result,
                confidence: this.assessAnalysisConfidence(result, promptContext),
                metadata: {
                    assessmentId: assessment.id,
                    organizationId: orgProfile?.organization_id,
                    generatedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            console.warn(`[FrameworkEngine] AI generation failed for ${frameworkId}:`, error.message);
            return this.generateStaticAnalysis(frameworkId, assessment, orgProfile);
        }
    }
    
    /**
     * Generate BCG Matrix for initiatives
     */
    static async generateBCGMatrix(initiatives, orgProfile) {
        if (!initiatives || initiatives.length === 0) {
            return { quadrants: {}, initiatives: [] };
        }
        
        const classified = {
            STAR: [],
            QUESTION_MARK: [],
            CASH_COW: [],
            DOG: []
        };
        
        const classifiedInitiatives = initiatives.map(init => {
            // Calculate strategic value (Y-axis)
            const strategicValue = this.calculateStrategicValue(init);
            
            // Calculate competitive position (X-axis)  
            const competitivePosition = this.calculateCompetitivePosition(init, orgProfile);
            
            // Determine quadrant
            const quadrant = this.determineBCGQuadrant(strategicValue, competitivePosition);
            
            classified[quadrant].push(init.id);
            
            return {
                id: init.id,
                name: init.name,
                strategicValue,
                competitivePosition,
                quadrant,
                investmentSize: init.estimated_budget || init.capex || 100000,
                recommendation: this.getBCGRecommendation(quadrant)
            };
        });
        
        return {
            quadrants: classified,
            initiatives: classifiedInitiatives,
            summary: {
                stars: classified.STAR.length,
                questionMarks: classified.QUESTION_MARK.length,
                cashCows: classified.CASH_COW.length,
                dogs: classified.DOG.length
            },
            portfolioBalance: this.assessPortfolioBalance(classified),
            recommendations: this.generateBCGRecommendations(classified, classifiedInitiatives)
        };
    }
    
    /**
     * Apply Porter's Five Forces analysis
     */
    static async applyPortersFiveForces(orgProfile, industryContext) {
        const framework = getFramework('PORTER_5_FORCES');
        
        // Use industry context to inform analysis
        const forces = {
            competitiveRivalry: this.assessCompetitiveRivalry(orgProfile, industryContext),
            threatNewEntrants: this.assessNewEntrantsThreat(orgProfile, industryContext),
            supplierPower: this.assessSupplierPower(orgProfile, industryContext),
            buyerPower: this.assessBuyerPower(orgProfile, industryContext),
            threatSubstitutes: this.assessSubstitutesThreat(orgProfile, industryContext)
        };
        
        const avgScore = Object.values(forces).reduce((sum, f) => sum + f.score, 0) / 5;
        
        return {
            frameworkId: 'PORTER_5_FORCES',
            frameworkName: framework.name,
            forces,
            overallScore: Math.round(avgScore * 10) / 10,
            industryAttractiveness: avgScore > 6 ? 'LOW' : avgScore > 4 ? 'MODERATE' : 'HIGH',
            strategicImplications: this.generatePorterImplications(forces),
            digitalDefenseStrategies: this.generateDigitalDefenseStrategies(forces)
        };
    }
    
    /**
     * Apply McKinsey 7S analysis
     */
    static async apply7SAnalysis(assessment, orgProfile) {
        const framework = getFramework('MCKINSEY_7S');
        
        // Map assessment data to 7S elements
        const scores = {
            strategy: this.assess7SStrategy(assessment, orgProfile),
            structure: this.assess7SStructure(assessment, orgProfile),
            systems: this.assess7SSystems(assessment, orgProfile),
            sharedValues: this.assess7SSharedValues(assessment, orgProfile),
            style: this.assess7SStyle(assessment, orgProfile),
            staff: this.assess7SStaff(assessment, orgProfile),
            skills: this.assess7SSkills(assessment, orgProfile)
        };
        
        const avgScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0) / 7;
        const alignmentScore = Math.round(avgScore * 10);
        
        let alignmentLevel;
        if (alignmentScore >= 76) alignmentLevel = 'HIGHLY_ALIGNED';
        else if (alignmentScore >= 51) alignmentLevel = 'ALIGNED';
        else if (alignmentScore >= 26) alignmentLevel = 'PARTIALLY_ALIGNED';
        else alignmentLevel = 'MISALIGNED';
        
        return {
            frameworkId: 'MCKINSEY_7S',
            frameworkName: framework.name,
            scores,
            alignmentScore,
            alignmentLevel,
            hardElements: { strategy: scores.strategy, structure: scores.structure, systems: scores.systems },
            softElements: { sharedValues: scores.sharedValues, style: scores.style, staff: scores.staff, skills: scores.skills },
            keyGaps: this.identify7SGaps(scores),
            transformationReadiness: alignmentScore >= 60 ? 'HIGH' : alignmentScore >= 40 ? 'MEDIUM' : 'LOW',
            recommendations: this.generate7SRecommendations(scores)
        };
    }
    
    // ============================================================================
    // HELPER METHODS
    // ============================================================================
    
    static determineFocusArea(assessment) {
        // Analyze assessment to determine focus
        const scores = assessment.scores || {};
        const gaps = assessment.gaps || [];
        
        // Check for specific patterns
        if (gaps.some(g => g.axisId === 'processes' && g.gap > 2)) {
            return 'OPERATIONS';
        }
        if (gaps.some(g => g.axisId === 'digitalProducts' && g.gap > 2)) {
            return 'PRODUCTS';
        }
        if (assessment.type === 'PORTFOLIO' || assessment.initiatives?.length > 0) {
            return 'PORTFOLIO';
        }
        
        return 'TRANSFORMATION';
    }
    
    static buildPromptContext(framework, assessment, orgProfile, industryContext) {
        return {
            industry: orgProfile?.industry || 'General',
            subSector: orgProfile?.industry_subsector || null,
            size: orgProfile?.company_size || 'MID_MARKET',
            growthStage: orgProfile?.growth_stage || 'MATURE',
            competitivePosition: orgProfile?.competitive_position || 'CHALLENGER',
            competitors: orgProfile?.key_competitors || [],
            markets: orgProfile?.primary_markets || [],
            regulations: orgProfile?.regulatory_environment || [],
            maturity: assessment.overall_score || 4,
            priorities: orgProfile?.strategic_priorities || [],
            assessmentSummary: this.summarizeAssessment(assessment),
            industryContext: industryContext ? JSON.stringify(industryContext) : 'Not available',
            findings: this.extractKeyFindings(assessment)
        };
    }
    
    static buildPrompt(framework, context) {
        let prompt = framework.promptTemplate;
        
        // Replace placeholders
        Object.entries(context).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            const valueStr = Array.isArray(value) ? value.join(', ') : String(value || '');
            prompt = prompt.replace(new RegExp(placeholder, 'g'), valueStr);
        });
        
        return prompt;
    }
    
    static summarizeAssessment(assessment) {
        const scores = assessment.scores || {};
        const summary = Object.entries(scores)
            .map(([axis, score]) => `${axis}: ${score}/7`)
            .join(', ');
        return summary || 'No scores available';
    }
    
    static extractKeyFindings(assessment) {
        const findings = [];
        const gaps = assessment.gaps || [];
        
        gaps.slice(0, 5).forEach(gap => {
            findings.push(`${gap.axisName || gap.axisId}: Gap of ${gap.gap} points`);
        });
        
        return findings.join('; ') || 'No specific gaps identified';
    }
    
    static assessAnalysisConfidence(result, context) {
        let confidence = 0.5;
        
        if (context.industryContext && context.industryContext !== 'Not available') confidence += 0.2;
        if (context.competitors.length > 0) confidence += 0.1;
        if (context.assessmentSummary !== 'No scores available') confidence += 0.2;
        
        return confidence >= 0.8 ? 'HIGH' : confidence >= 0.5 ? 'MEDIUM' : 'LOW';
    }
    
    static synthesizeAnalyses(analyses) {
        if (analyses.length === 0) return null;
        
        const insights = [];
        const recommendations = [];
        
        analyses.forEach(a => {
            if (a.analysis?.result?.strategicImplications) {
                insights.push(...a.analysis.result.strategicImplications.slice(0, 2));
            }
            if (a.analysis?.result?.recommendations) {
                recommendations.push(...a.analysis.result.recommendations.slice(0, 2));
            }
            if (a.analysis?.result?.priorityActions) {
                recommendations.push(...a.analysis.result.priorityActions.slice(0, 2));
            }
        });
        
        return {
            keyInsights: [...new Set(insights)].slice(0, 5),
            topRecommendations: [...new Set(recommendations)].slice(0, 5),
            frameworksApplied: analyses.map(a => a.frameworkId),
            overallConfidence: analyses.every(a => a.analysis?.confidence === 'HIGH') ? 'HIGH' : 
                              analyses.some(a => a.analysis?.confidence === 'HIGH') ? 'MEDIUM' : 'LOW'
        };
    }
    
    // BCG Matrix helpers
    static calculateStrategicValue(initiative) {
        let value = 5;
        
        if (initiative.priority === 1) value += 2;
        else if (initiative.priority === 2) value += 1;
        
        if (initiative.strategic_alignment === 'HIGH') value += 1.5;
        else if (initiative.strategic_alignment === 'CRITICAL') value += 2;
        
        if (initiative.estimated_roi > 2) value += 1;
        
        return Math.min(10, Math.max(1, value));
    }
    
    static calculateCompetitivePosition(initiative, orgProfile) {
        let position = 5;
        
        if (orgProfile?.competitive_position === 'LEADER') position += 2;
        else if (orgProfile?.competitive_position === 'CHALLENGER') position += 1;
        else if (orgProfile?.competitive_position === 'FOLLOWER') position -= 1;
        
        if (initiative.risk_level === 'LOW') position += 1;
        else if (initiative.risk_level === 'HIGH') position -= 1;
        
        return Math.min(10, Math.max(1, position));
    }
    
    static determineBCGQuadrant(strategicValue, competitivePosition) {
        const highValue = strategicValue >= 6;
        const highPosition = competitivePosition >= 6;
        
        if (highValue && highPosition) return 'STAR';
        if (highValue && !highPosition) return 'QUESTION_MARK';
        if (!highValue && highPosition) return 'CASH_COW';
        return 'DOG';
    }
    
    static getBCGRecommendation(quadrant) {
        const recommendations = {
            STAR: 'Invest heavily to maintain leadership and capture growth',
            QUESTION_MARK: 'Evaluate carefully - invest selectively or divest',
            CASH_COW: 'Harvest profits, maintain with minimal investment',
            DOG: 'Consider divestment or turnaround strategy'
        };
        return recommendations[quadrant];
    }
    
    static assessPortfolioBalance(classified) {
        const total = Object.values(classified).reduce((sum, arr) => sum + arr.length, 0);
        if (total === 0) return 'EMPTY';
        
        const starRatio = classified.STAR.length / total;
        const dogRatio = classified.DOG.length / total;
        
        if (starRatio >= 0.3 && dogRatio <= 0.2) return 'HEALTHY';
        if (dogRatio >= 0.4) return 'WEAK';
        if (classified.QUESTION_MARK.length / total >= 0.4) return 'UNCERTAIN';
        return 'BALANCED';
    }
    
    static generateBCGRecommendations(classified, initiatives) {
        const recommendations = [];
        
        if (classified.STAR.length === 0) {
            recommendations.push('Develop or acquire star initiatives to drive future growth');
        }
        if (classified.DOG.length > 2) {
            recommendations.push('Review and potentially divest underperforming initiatives');
        }
        if (classified.QUESTION_MARK.length > 3) {
            recommendations.push('Make decisive investments in promising question marks');
        }
        
        return recommendations;
    }
    
    // Porter's Five Forces helpers
    static assessCompetitiveRivalry(orgProfile, industryContext) {
        let score = 5;
        
        if (orgProfile?.key_competitors?.length > 5) score += 2;
        if (orgProfile?.competitive_position === 'FOLLOWER') score += 1;
        if (industryContext?.trends?.items?.some(t => t.trend?.toLowerCase().includes('competition'))) score += 1;
        
        return {
            score: Math.min(10, score),
            level: score >= 7 ? 'HIGH' : score >= 4 ? 'MODERATE' : 'LOW',
            rationale: `${orgProfile?.key_competitors?.length || 'Multiple'} competitors in market`,
            digitalImpact: 'Digital transformation intensifying competition'
        };
    }
    
    static assessNewEntrantsThreat(orgProfile, industryContext) {
        let score = 5;
        
        if (orgProfile?.industry === 'Technology') score += 1;
        if (orgProfile?.digital_maturity_overall < 4) score += 1;
        
        return {
            score: Math.min(10, score),
            level: score >= 7 ? 'HIGH' : score >= 4 ? 'MODERATE' : 'LOW',
            rationale: 'Digital-native competitors can enter with lower barriers',
            digitalImpact: 'Technology reduces traditional entry barriers'
        };
    }
    
    static assessSupplierPower(orgProfile, industryContext) {
        let score = 4;
        
        if (orgProfile?.technology_stack?.length < 3) score += 2;
        
        return {
            score: Math.min(10, score),
            level: score >= 7 ? 'HIGH' : score >= 4 ? 'MODERATE' : 'LOW',
            rationale: 'Technology vendor concentration',
            digitalImpact: 'Cloud provider dependency creates supplier power'
        };
    }
    
    static assessBuyerPower(orgProfile, industryContext) {
        let score = 5;
        
        if (orgProfile?.customer_segments?.includes('B2B')) score += 1;
        
        return {
            score: Math.min(10, score),
            level: score >= 7 ? 'HIGH' : score >= 4 ? 'MODERATE' : 'LOW',
            rationale: 'Digital transparency increases buyer power',
            digitalImpact: 'Easy comparison and switching via digital channels'
        };
    }
    
    static assessSubstitutesThreat(orgProfile, industryContext) {
        let score = 5;
        
        if (orgProfile?.digital_maturity_overall < 4) score += 2;
        
        return {
            score: Math.min(10, score),
            level: score >= 7 ? 'HIGH' : score >= 4 ? 'MODERATE' : 'LOW',
            rationale: 'Digital alternatives emerging',
            digitalImpact: 'Platform business models as substitutes'
        };
    }
    
    static generatePorterImplications(forces) {
        const implications = [];
        
        if (forces.competitiveRivalry.score >= 7) {
            implications.push('Intense competition requires differentiation through digital excellence');
        }
        if (forces.threatNewEntrants.score >= 6) {
            implications.push('Build digital barriers through data advantages and platform effects');
        }
        if (forces.buyerPower.score >= 6) {
            implications.push('Invest in customer experience to increase switching costs');
        }
        
        return implications;
    }
    
    static generateDigitalDefenseStrategies(forces) {
        const strategies = [];
        
        strategies.push('Build data moats through proprietary analytics');
        strategies.push('Create platform network effects');
        strategies.push('Develop AI-powered customer experience');
        
        return strategies;
    }
    
    // McKinsey 7S helpers
    static assess7SStrategy(assessment, orgProfile) {
        const score = orgProfile?.strategic_priorities?.length > 0 ? 6 : 4;
        return { score, rationale: 'Digital strategy clarity assessment' };
    }
    
    static assess7SStructure(assessment, orgProfile) {
        const score = orgProfile?.company_size === 'ENTERPRISE' ? 5 : 6;
        return { score, rationale: 'Organizational structure assessment' };
    }
    
    static assess7SSystems(assessment, orgProfile) {
        const score = assessment.scores?.processes || 4;
        return { score, rationale: 'Based on process maturity assessment' };
    }
    
    static assess7SSharedValues(assessment, orgProfile) {
        const score = assessment.scores?.culture || 4;
        return { score, rationale: 'Based on culture assessment' };
    }
    
    static assess7SStyle(assessment, orgProfile) {
        const score = orgProfile?.risk_appetite === 'AGGRESSIVE' ? 7 : orgProfile?.risk_appetite === 'CONSERVATIVE' ? 4 : 5;
        return { score, rationale: 'Leadership style assessment' };
    }
    
    static assess7SStaff(assessment, orgProfile) {
        const score = assessment.scores?.culture || 4;
        return { score, rationale: 'Digital talent assessment' };
    }
    
    static assess7SSkills(assessment, orgProfile) {
        const score = assessment.scores?.aiMaturity || 4;
        return { score, rationale: 'Based on AI/digital skills assessment' };
    }
    
    static identify7SGaps(scores) {
        return Object.entries(scores)
            .filter(([, data]) => data.score < 5)
            .map(([element, data]) => `${element}: ${data.score}/10 - ${data.rationale}`);
    }
    
    static generate7SRecommendations(scores) {
        const recommendations = [];
        
        Object.entries(scores).forEach(([element, data]) => {
            if (data.score < 5) {
                recommendations.push(`Strengthen ${element} through targeted interventions`);
            }
        });
        
        return recommendations.slice(0, 3);
    }
    
    // Static fallback analysis
    static generateStaticAnalysis(frameworkId, assessment, orgProfile) {
        const framework = getFramework(frameworkId);
        
        return {
            frameworkId,
            frameworkName: framework?.name || frameworkId,
            result: {
                note: 'Static analysis - AI not available',
                summary: `Analysis based on ${assessment.scores ? Object.keys(assessment.scores).length : 0} assessment dimensions`,
                recommendations: ['Complete assessment for detailed analysis']
            },
            confidence: 'LOW',
            isStatic: true
        };
    }
    
    // Storage
    static async storeAnalysis(organizationId, assessmentId, frameworkType, analysis) {
        const id = uuidv4();
        const now = new Date().toISOString();
        
        return new Promise((resolve) => {
            db.run(`
                INSERT INTO framework_analyses 
                (id, organization_id, assessment_id, framework_type, framework_version,
                 analysis_data, summary, key_findings, recommendations, overall_score,
                 generated_by, confidence_level, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AI', ?, ?, ?)
            `, [
                id, organizationId, assessmentId, frameworkType, '1.0',
                JSON.stringify(analysis.result),
                analysis.result?.summary || null,
                JSON.stringify(analysis.result?.keyInsights || analysis.result?.keyGaps || []),
                JSON.stringify(analysis.result?.recommendations || analysis.result?.priorityActions || []),
                analysis.result?.overallScore || analysis.result?.alignmentScore || null,
                analysis.confidence || 'MEDIUM',
                now, now
            ], (err) => {
                if (err) console.warn('[FrameworkEngine] Storage error:', err.message);
                resolve(id);
            });
        });
    }
}

module.exports = FrameworkEngine;


