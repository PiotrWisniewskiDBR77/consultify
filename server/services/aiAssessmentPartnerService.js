/**
 * AI Assessment Partner Service
 * Implements THINKING_PARTNER mode from Enterprise Spec
 * Provides intelligent guidance for assessment process
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// AI THINKING_PARTNER Mode Configuration
const AI_PARTNER_CONFIG = {
    mode: 'THINKING_PARTNER',
    
    allowed: [
        'ASK_CLARIFYING_QUESTION',    // Deepen understanding
        'EXPLAIN_WHY_ASKING',         // "I ask because..."
        'REFLECT_BACK',               // "So you're saying..."
        'SURFACE_TENSION',            // "I notice a tension between..."
        'PROPOSE_AXIS',               // "This suggests an axis around..."
        'VALIDATE_SCORE',             // Check score consistency
        'SUGGEST_EVIDENCE',           // Ask for supporting evidence
        'BENCHMARK_CONTEXT',          // Provide industry benchmarks
        'GAP_ANALYSIS',               // Analyze gaps between actual and target
        'PATHWAY_SUGGESTION'          // Suggest improvement pathways
    ],
    
    blocked: [
        'JUMP_TO_CONCLUSION',         // Never skip steps
        'SUMMARIZE_PREMATURELY',      // Wait until user is ready
        'SUGGEST_SOLUTION',           // Insight, not answers
        'EVALUATE_ANSWERS'            // Never judge input
    ],
    
    tone: {
        style: 'partner',             // Collaborative, not instructive
        formality: 'professional',
        length: 'concise',            // Max 3-4 sentences per response
        language: 'en'
    }
};

// DRD Axis Definitions for Context
const DRD_AXES = {
    processes: {
        name: 'Digital Processes',
        description: 'Level of digital automation, integration and optimization of operational processes',
        levels: {
            1: 'Manual, paper-based processes with no digital tools',
            2: 'Basic digitization of some processes (spreadsheets, email)',
            3: 'Process-specific software tools (ERP, CRM modules)',
            4: 'Integrated cross-functional workflows with automation',
            5: 'End-to-end digital processes with advanced analytics',
            6: 'AI-augmented process optimization and prediction',
            7: 'Autonomous, self-optimizing intelligent processes'
        }
    },
    digitalProducts: {
        name: 'Digital Products & Services',
        description: 'Extent to which products/services incorporate digital capabilities',
        levels: {
            1: 'Traditional physical products with no digital components',
            2: 'Basic digital documentation and support',
            3: 'Connected products with data collection',
            4: 'Smart products with analytics and user personalization',
            5: 'Platform-based products with ecosystem integration',
            6: 'AI-driven products with predictive capabilities',
            7: 'Autonomous, adaptive product ecosystems'
        }
    },
    businessModels: {
        name: 'Digital Business Models',
        description: 'Adoption of digital-enabled revenue streams and business models',
        levels: {
            1: 'Traditional product/service sales only',
            2: 'Basic e-commerce or digital sales channels',
            3: 'Digital services as add-on revenue',
            4: 'Subscription or outcome-based models',
            5: 'Platform/marketplace business models',
            6: 'Data monetization and ecosystem orchestration',
            7: 'Autonomous value creation networks'
        }
    },
    dataManagement: {
        name: 'Data & Analytics',
        description: 'Maturity of data infrastructure, governance and analytics capabilities',
        levels: {
            1: 'Scattered data in silos, no analytics',
            2: 'Basic reporting from operational systems',
            3: 'Centralized data with standard reporting',
            4: 'Data warehouse with business intelligence',
            5: 'Data lake with advanced analytics and ML',
            6: 'Real-time analytics with prescriptive AI',
            7: 'Autonomous data-driven decision systems'
        }
    },
    culture: {
        name: 'Organizational Culture',
        description: 'Digital-first mindset, agility and innovation culture',
        levels: {
            1: 'Resistance to change, hierarchical',
            2: 'Awareness of digital need, limited action',
            3: 'Digital initiatives in some departments',
            4: 'Organization-wide digital transformation commitment',
            5: 'Agile, experimentation-driven culture',
            6: 'Innovation as core competency',
            7: 'Adaptive, self-organizing digital-native culture'
        }
    },
    cybersecurity: {
        name: 'Cybersecurity & Risk',
        description: 'Security posture, risk management and compliance maturity',
        levels: {
            1: 'No formal security measures',
            2: 'Basic firewall and antivirus',
            3: 'Security policies and access controls',
            4: 'ISMS, incident response, regular audits',
            5: 'Advanced threat detection and response',
            6: 'Zero-trust architecture with AI security',
            7: 'Autonomous security operations'
        }
    },
    aiMaturity: {
        name: 'AI & Machine Learning',
        description: 'Adoption and sophistication of AI/ML capabilities',
        levels: {
            1: 'No AI awareness or usage',
            2: 'Exploration of AI use cases',
            3: 'Pilot AI projects in specific areas',
            4: 'Production AI solutions with governance',
            5: 'AI-first strategy with MLOps',
            6: 'Pervasive AI across organization',
            7: 'AI-native organization with autonomous systems'
        }
    }
};

class AIAssessmentPartnerService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.initializeAI();
    }

    initializeAI() {
        const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        }
    }

    /**
     * Generate contextual guidance for assessment
     */
    async getAssessmentGuidance(axisId, currentScore, targetScore, context = {}) {
        const axis = DRD_AXES[axisId];
        if (!axis) {
            return { error: 'Invalid axis ID' };
        }

        const prompt = this._buildGuidancePrompt(axis, axisId, currentScore, targetScore, context);
        
        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();
            
            return {
                axisId,
                guidance: response,
                mode: AI_PARTNER_CONFIG.mode,
                context: {
                    currentLevel: axis.levels[currentScore],
                    targetLevel: axis.levels[targetScore],
                    gap: targetScore - currentScore
                }
            };
        } catch (error) {
            console.error('[AIPartner] Error generating guidance:', error);
            return {
                axisId,
                guidance: this._getFallbackGuidance(axisId, currentScore, targetScore),
                mode: 'FALLBACK',
                error: error.message
            };
        }
    }

    /**
     * Validate score consistency across axes
     */
    async validateScoreConsistency(assessment, organizationContext = {}) {
        const inconsistencies = [];
        
        // Check for common inconsistencies
        const scores = Object.entries(assessment).filter(([key, val]) => val?.actual);
        
        // Rule 1: AI Maturity shouldn't exceed Data Management by more than 2 levels
        if (assessment.aiMaturity?.actual && assessment.dataManagement?.actual) {
            const aiScore = assessment.aiMaturity.actual;
            const dataScore = assessment.dataManagement.actual;
            if (aiScore > dataScore + 2) {
                inconsistencies.push({
                    type: 'DEPENDENCY_MISMATCH',
                    axes: ['aiMaturity', 'dataManagement'],
                    message: `AI maturity (${aiScore}) seems high relative to Data Management (${dataScore}). Advanced AI typically requires strong data foundations.`,
                    suggestion: 'Consider if data infrastructure supports the claimed AI capabilities.'
                });
            }
        }

        // Rule 2: Cybersecurity shouldn't lag significantly behind digitalization
        if (assessment.processes?.actual && assessment.cybersecurity?.actual) {
            const processScore = assessment.processes.actual;
            const cyberScore = assessment.cybersecurity.actual;
            if (processScore > cyberScore + 2) {
                inconsistencies.push({
                    type: 'RISK_GAP',
                    axes: ['processes', 'cybersecurity'],
                    message: `Process digitalization (${processScore}) outpaces cybersecurity (${cyberScore}). This may indicate security risk.`,
                    suggestion: 'Digital processes require proportional security measures.'
                });
            }
        }

        // Rule 3: Digital products require supporting processes
        if (assessment.digitalProducts?.actual && assessment.processes?.actual) {
            const productScore = assessment.digitalProducts.actual;
            const processScore = assessment.processes.actual;
            if (productScore > processScore + 1) {
                inconsistencies.push({
                    type: 'CAPABILITY_GAP',
                    axes: ['digitalProducts', 'processes'],
                    message: `Digital product maturity (${productScore}) may be constrained by process maturity (${processScore}).`,
                    suggestion: 'Digital products often require digital processes to deliver effectively.'
                });
            }
        }

        // Rule 4: Business model innovation needs culture support
        if (assessment.businessModels?.actual && assessment.culture?.actual) {
            const bizScore = assessment.businessModels.actual;
            const cultureScore = assessment.culture.actual;
            if (bizScore > cultureScore + 2) {
                inconsistencies.push({
                    type: 'CULTURE_GAP',
                    axes: ['businessModels', 'culture'],
                    message: `Advanced business model (${bizScore}) may face adoption challenges with current culture (${cultureScore}).`,
                    suggestion: 'Digital business models require organizational buy-in to succeed.'
                });
            }
        }

        return {
            hasInconsistencies: inconsistencies.length > 0,
            inconsistencies,
            overallAssessment: inconsistencies.length === 0 
                ? 'Assessment appears internally consistent' 
                : `Found ${inconsistencies.length} potential inconsistencies to review`
        };
    }

    /**
     * Generate gap analysis between current and target
     */
    async generateGapAnalysis(axisId, currentScore, targetScore, justification = '') {
        const axis = DRD_AXES[axisId];
        if (!axis) {
            return { error: 'Invalid axis ID' };
        }

        const gap = targetScore - currentScore;
        
        // Build pathway from current to target
        const pathway = [];
        for (let level = currentScore + 1; level <= targetScore; level++) {
            pathway.push({
                level,
                description: axis.levels[level],
                estimatedMonths: this._estimateLevelTransition(axisId, level - 1, level),
                keyActivities: this._getKeyActivities(axisId, level)
            });
        }

        // Generate AI-powered recommendations
        let aiRecommendations = [];
        if (this.model && gap > 0) {
            try {
                const prompt = `
                    As a digital transformation expert, provide 3 specific recommendations for improving ${axis.name} 
                    from level ${currentScore} to ${targetScore}.
                    
                    Current state: ${axis.levels[currentScore]}
                    Target state: ${axis.levels[targetScore]}
                    ${justification ? `Context: ${justification}` : ''}
                    
                    Provide practical, actionable recommendations in JSON format:
                    [{"title": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW", "timeframe": "..."}]
                `;
                
                const result = await this.model.generateContent(prompt);
                const responseText = result.response.text();
                
                // Try to parse JSON from response
                const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    aiRecommendations = JSON.parse(jsonMatch[0]);
                }
            } catch (error) {
                console.error('[AIPartner] Error generating recommendations:', error);
            }
        }

        return {
            axisId,
            axisName: axis.name,
            currentScore,
            targetScore,
            gap,
            gapSeverity: gap <= 1 ? 'LOW' : gap <= 3 ? 'MEDIUM' : 'HIGH',
            currentDescription: axis.levels[currentScore],
            targetDescription: axis.levels[targetScore],
            pathway,
            estimatedTotalMonths: pathway.reduce((sum, p) => sum + p.estimatedMonths, 0),
            aiRecommendations
        };
    }

    /**
     * Generate proactive insights based on assessment data
     */
    async generateProactiveInsights(assessment, organizationContext = {}) {
        const insights = [];

        // Analyze overall maturity
        const scores = Object.entries(assessment)
            .filter(([key, val]) => val?.actual)
            .map(([key, val]) => ({ axis: key, actual: val.actual, target: val.target }));

        if (scores.length === 0) {
            return { insights: [], message: 'No assessment data to analyze' };
        }

        const avgActual = scores.reduce((sum, s) => sum + s.actual, 0) / scores.length;
        const avgTarget = scores.reduce((sum, s) => sum + s.target, 0) / scores.length;
        const overallGap = avgTarget - avgActual;

        // Insight 1: Identify strongest axis
        const strongest = scores.reduce((max, s) => s.actual > max.actual ? s : max);
        insights.push({
            type: 'STRENGTH',
            priority: 'INFO',
            title: `Strong foundation in ${DRD_AXES[strongest.axis]?.name || strongest.axis}`,
            description: `Your highest maturity score (${strongest.actual}) is in ${DRD_AXES[strongest.axis]?.name}. This could be leveraged to support improvements in other areas.`,
            axis: strongest.axis
        });

        // Insight 2: Identify weakest axis
        const weakest = scores.reduce((min, s) => s.actual < min.actual ? s : min);
        insights.push({
            type: 'PRIORITY_GAP',
            priority: 'HIGH',
            title: `Priority improvement area: ${DRD_AXES[weakest.axis]?.name || weakest.axis}`,
            description: `${DRD_AXES[weakest.axis]?.name} has the lowest maturity (${weakest.actual}). Improving this area may unlock capabilities in other dimensions.`,
            axis: weakest.axis,
            gap: (weakest.target || avgTarget) - weakest.actual
        });

        // Insight 3: Ambitious targets warning
        const ambitiousTargets = scores.filter(s => (s.target - s.actual) > 3);
        if (ambitiousTargets.length > 0) {
            insights.push({
                type: 'RISK',
                priority: 'MEDIUM',
                title: 'Ambitious transformation targets detected',
                description: `${ambitiousTargets.length} axis(es) have gaps of 4+ levels. Consider a phased approach to achieve sustainable progress.`,
                axes: ambitiousTargets.map(s => s.axis)
            });
        }

        // Insight 4: Quick wins identification
        const quickWins = scores.filter(s => (s.target - s.actual) === 1);
        if (quickWins.length > 0) {
            insights.push({
                type: 'OPPORTUNITY',
                priority: 'LOW',
                title: `${quickWins.length} quick win opportunity(ies) available`,
                description: `These areas have small gaps and could show progress quickly: ${quickWins.map(s => DRD_AXES[s.axis]?.name).join(', ')}.`,
                axes: quickWins.map(s => s.axis)
            });
        }

        // Insight 5: Overall transformation scope
        insights.push({
            type: 'SUMMARY',
            priority: 'INFO',
            title: 'Transformation scope assessment',
            description: `Average current maturity: ${avgActual.toFixed(1)}/7. Target: ${avgTarget.toFixed(1)}/7. Overall gap: ${overallGap.toFixed(1)} levels. ${overallGap < 2 ? 'Moderate transformation scope.' : overallGap < 4 ? 'Significant transformation journey ahead.' : 'Major transformation initiative required.'}`,
            data: { avgActual, avgTarget, overallGap }
        });

        return {
            insights,
            summary: {
                axesAssessed: scores.length,
                averageMaturity: avgActual.toFixed(1),
                averageTarget: avgTarget.toFixed(1),
                overallGap: overallGap.toFixed(1)
            }
        };
    }

    /**
     * Ask clarifying question about a score
     */
    async askClarifyingQuestion(axisId, score, context = {}) {
        const axis = DRD_AXES[axisId];
        if (!axis) {
            return { question: 'Please provide more context about this assessment.' };
        }

        const currentLevel = axis.levels[score];
        const nextLevel = axis.levels[score + 1];
        const prevLevel = axis.levels[score - 1];

        // Generate contextual question based on score
        const questions = {
            low: [
                `You've rated ${axis.name} at level ${score}. What specific capabilities or systems are currently in place that support this assessment?`,
                `For ${axis.name}, what would need to change to move from "${currentLevel}" toward "${nextLevel}"?`,
                `What are the main barriers preventing higher maturity in ${axis.name}?`
            ],
            mid: [
                `You've assessed ${axis.name} at level ${score}. Can you describe a specific example that demonstrates this maturity level?`,
                `What distinguishes your current ${axis.name} capabilities from the next level: "${nextLevel}"?`,
                `How consistent is this level of ${axis.name} maturity across different departments or processes?`
            ],
            high: [
                `Level ${score} for ${axis.name} indicates advanced capabilities. What specific achievements or KPIs support this assessment?`,
                `At level ${score}, what unique competitive advantages does your ${axis.name} maturity provide?`,
                `How do you maintain and continuously improve your ${axis.name} capabilities at this level?`
            ]
        };

        const tier = score <= 2 ? 'low' : score <= 5 ? 'mid' : 'high';
        const randomIndex = Math.floor(Math.random() * questions[tier].length);

        return {
            axisId,
            axisName: axis.name,
            score,
            question: questions[tier][randomIndex],
            levelContext: {
                current: currentLevel,
                next: nextLevel,
                previous: prevLevel
            },
            mode: 'ASK_CLARIFYING_QUESTION'
        };
    }

    // Private helper methods

    _buildGuidancePrompt(axis, axisId, currentScore, targetScore, context) {
        return `
            You are an AI assessment partner helping evaluate ${axis.name} maturity.
            
            Current Level: ${currentScore} - ${axis.levels[currentScore]}
            Target Level: ${targetScore} - ${axis.levels[targetScore]}
            Gap: ${targetScore - currentScore} levels
            
            ${context.industry ? `Industry: ${context.industry}` : ''}
            ${context.companySize ? `Company Size: ${context.companySize}` : ''}
            ${context.justification ? `User's Justification: ${context.justification}` : ''}
            
            As a THINKING_PARTNER, provide:
            1. Brief validation or gentle challenge of the current assessment
            2. One clarifying question to deepen understanding
            3. Key consideration for the improvement pathway
            
            Keep response to 3-4 sentences. Be collaborative, not instructive.
            Do not provide solutions - help the user discover insights.
        `;
    }

    _getFallbackGuidance(axisId, currentScore, targetScore) {
        const axis = DRD_AXES[axisId];
        const gap = targetScore - currentScore;
        
        if (gap <= 0) {
            return `Your current ${axis?.name} maturity meets or exceeds your target. Consider if the target reflects your true ambition.`;
        } else if (gap <= 2) {
            return `A ${gap}-level improvement in ${axis?.name} is achievable with focused effort. What specific capabilities would you prioritize developing?`;
        } else {
            return `A ${gap}-level leap in ${axis?.name} represents significant transformation. Consider a phased approach with interim milestones.`;
        }
    }

    _estimateLevelTransition(axisId, fromLevel, toLevel) {
        // Base estimates in months, adjusted by axis complexity
        const baseMonths = {
            1: 3,  // 1 → 2: basic digitization
            2: 4,  // 2 → 3: tool adoption
            3: 6,  // 3 → 4: integration
            4: 9,  // 4 → 5: advanced capabilities
            5: 12, // 5 → 6: AI/advanced
            6: 18  // 6 → 7: autonomous
        };
        
        const axisComplexity = {
            processes: 1.0,
            digitalProducts: 1.2,
            businessModels: 1.3,
            dataManagement: 1.1,
            culture: 1.5, // Culture change takes longer
            cybersecurity: 1.0,
            aiMaturity: 1.4
        };
        
        const base = baseMonths[fromLevel] || 6;
        const multiplier = axisComplexity[axisId] || 1.0;
        
        return Math.round(base * multiplier);
    }

    _getKeyActivities(axisId, level) {
        const activities = {
            processes: {
                2: ['Digitize paper-based processes', 'Implement basic workflow tools'],
                3: ['Deploy process-specific software', 'Establish process ownership'],
                4: ['Integrate cross-functional workflows', 'Implement automation'],
                5: ['Deploy end-to-end digital processes', 'Add analytics layer'],
                6: ['Introduce AI-based optimization', 'Predictive process control'],
                7: ['Implement autonomous process management', 'Self-healing systems']
            },
            digitalProducts: {
                2: ['Add digital documentation', 'Create customer portal'],
                3: ['Implement IoT sensors', 'Build data collection layer'],
                4: ['Add analytics dashboard', 'Personalization features'],
                5: ['Build platform APIs', 'Ecosystem integrations'],
                6: ['Implement predictive AI', 'Autonomous features'],
                7: ['Full product autonomy', 'Self-evolving capabilities']
            },
            dataManagement: {
                2: ['Consolidate data sources', 'Basic reporting tools'],
                3: ['Central data repository', 'Standard dashboards'],
                4: ['Data warehouse setup', 'BI implementation'],
                5: ['Data lake architecture', 'ML pipelines'],
                6: ['Real-time analytics', 'Prescriptive AI'],
                7: ['Autonomous decisions', 'Self-optimizing data']
            },
            culture: {
                2: ['Digital awareness training', 'Change champions'],
                3: ['Department-level initiatives', 'Digital KPIs'],
                4: ['Organization-wide commitment', 'Leadership buy-in'],
                5: ['Agile methodologies', 'Experimentation culture'],
                6: ['Innovation programs', 'Intrapreneurship'],
                7: ['Self-organizing teams', 'Continuous evolution']
            },
            cybersecurity: {
                2: ['Firewall & antivirus', 'Basic policies'],
                3: ['Access controls', 'Security training'],
                4: ['ISMS implementation', 'Incident response'],
                5: ['SIEM & threat detection', 'Penetration testing'],
                6: ['Zero-trust architecture', 'AI-based security'],
                7: ['Autonomous SOC', 'Self-healing security']
            },
            businessModels: {
                2: ['E-commerce setup', 'Digital sales channels'],
                3: ['Digital service add-ons', 'Online subscriptions'],
                4: ['Outcome-based models', 'Usage-based pricing'],
                5: ['Platform business model', 'Marketplace setup'],
                6: ['Data monetization', 'Ecosystem orchestration'],
                7: ['Autonomous value networks', 'AI-driven models']
            },
            aiMaturity: {
                2: ['AI use case discovery', 'Proof of concepts'],
                3: ['Pilot AI projects', 'Data scientist hiring'],
                4: ['Production AI', 'AI governance'],
                5: ['AI-first strategy', 'MLOps platform'],
                6: ['Pervasive AI', 'AI center of excellence'],
                7: ['AI-native organization', 'Autonomous AI systems']
            }
        };
        
        return activities[axisId]?.[level] || ['Assess current capabilities', 'Define improvement roadmap'];
    }

    // =========================================================================
    // FORM ASSISTANCE METHODS
    // =========================================================================

    /**
     * Suggest justification text based on axis and score
     */
    async suggestJustification(axisId, score, context = {}) {
        const axis = DRD_AXES[axisId];
        if (!axis) {
            return { error: 'Invalid axis ID' };
        }

        const prompt = `
            You are helping a consultant write a justification for a digital maturity assessment.
            
            Axis: ${axis.name}
            Score: ${score}/7
            Level Description: ${axis.levels[score]}
            ${context.industry ? `Industry: ${context.industry}` : ''}
            ${context.companySize ? `Company Size: ${context.companySize}` : ''}
            ${context.existingJustification ? `Current draft: ${context.existingJustification}` : ''}
            
            Generate a professional justification (2-3 sentences) that:
            1. Explains why this score is appropriate
            2. Mentions specific evidence or indicators
            3. Is written in ${context.language || 'Polish'}
            
            Return ONLY the justification text, no explanations.
        `;

        try {
            if (!this.model) {
                return { 
                    suggestion: this._getFallbackJustification(axisId, score),
                    mode: 'FALLBACK'
                };
            }

            const result = await this.model.generateContent(prompt);
            const suggestion = result.response.text().trim();
            
            return {
                axisId,
                score,
                suggestion,
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error suggesting justification:', error);
            return {
                axisId,
                score,
                suggestion: this._getFallbackJustification(axisId, score),
                mode: 'FALLBACK',
                error: error.message
            };
        }
    }

    /**
     * Suggest evidence/proof for a given score
     */
    async suggestEvidence(axisId, score, context = {}) {
        const axis = DRD_AXES[axisId];
        if (!axis) {
            return { error: 'Invalid axis ID' };
        }

        const prompt = `
            You are helping identify evidence for a digital maturity assessment.
            
            Axis: ${axis.name}
            Score: ${score}/7
            Level: ${axis.levels[score]}
            ${context.industry ? `Industry: ${context.industry}` : ''}
            
            Suggest 3-5 specific types of evidence that would support this maturity level.
            Examples: documents, metrics, systems, certifications, processes.
            
            Return as JSON array: ["evidence1", "evidence2", ...]
            Language: ${context.language || 'Polish'}
        `;

        try {
            if (!this.model) {
                return { 
                    evidence: this._getFallbackEvidence(axisId, score),
                    mode: 'FALLBACK'
                };
            }

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();
            
            // Parse JSON array from response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            const evidence = jsonMatch ? JSON.parse(jsonMatch[0]) : this._getFallbackEvidence(axisId, score);
            
            return {
                axisId,
                score,
                evidence,
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error suggesting evidence:', error);
            return {
                axisId,
                score,
                evidence: this._getFallbackEvidence(axisId, score),
                mode: 'FALLBACK',
                error: error.message
            };
        }
    }

    /**
     * Suggest target score based on current score and ambition level
     */
    async suggestTargetScore(axisId, currentScore, ambitionLevel = 'balanced', context = {}) {
        const axis = DRD_AXES[axisId];
        if (!axis) {
            return { error: 'Invalid axis ID' };
        }

        // Calculate suggestion based on ambition level
        const ambitionMultipliers = {
            conservative: 1,
            balanced: 2,
            aggressive: 3
        };

        const multiplier = ambitionMultipliers[ambitionLevel] || 2;
        let suggestedTarget = Math.min(7, currentScore + multiplier);

        // Adjust based on industry context
        if (context.industryAverage && suggestedTarget < context.industryAverage) {
            suggestedTarget = Math.min(7, context.industryAverage + 1);
        }

        const reasoning = this._getTargetReasoning(axisId, currentScore, suggestedTarget, ambitionLevel);

        return {
            axisId,
            currentScore,
            suggestedTarget,
            ambitionLevel,
            reasoning,
            timeEstimate: this._estimateTotalTime(axisId, currentScore, suggestedTarget)
        };
    }

    /**
     * Correct and improve justification text
     */
    async correctJustificationLanguage(text, targetLanguage = 'pl') {
        if (!text || text.trim().length === 0) {
            return { error: 'No text provided' };
        }

        const languageNames = {
            pl: 'Polish',
            en: 'English',
            de: 'German'
        };

        const prompt = `
            Improve and correct the following justification text for a digital maturity assessment.
            
            Original text: "${text}"
            Target language: ${languageNames[targetLanguage] || 'Polish'}
            
            Requirements:
            1. Fix any grammar or spelling errors
            2. Make it more professional and concise
            3. Ensure it's in the target language
            4. Keep the original meaning
            
            Return ONLY the corrected text, no explanations.
        `;

        try {
            if (!this.model) {
                return { 
                    correctedText: text,
                    mode: 'UNCHANGED'
                };
            }

            const result = await this.model.generateContent(prompt);
            const correctedText = result.response.text().trim();
            
            return {
                originalText: text,
                correctedText,
                language: targetLanguage,
                mode: 'AI_CORRECTED'
            };
        } catch (error) {
            console.error('[AIPartner] Error correcting text:', error);
            return {
                originalText: text,
                correctedText: text,
                mode: 'UNCHANGED',
                error: error.message
            };
        }
    }

    /**
     * Autocomplete partial justification text
     */
    async autocompleteJustification(partialText, axisId, score, context = {}) {
        const axis = DRD_AXES[axisId];
        if (!axis) {
            return { error: 'Invalid axis ID' };
        }

        const prompt = `
            Complete this partial justification for a digital maturity assessment.
            
            Axis: ${axis.name}
            Score: ${score}/7
            Partial text: "${partialText}"
            
            Complete the sentence/paragraph naturally. Keep it professional.
            Language: ${context.language || 'Polish'}
            
            Return ONLY the completion (not the original partial text).
        `;

        try {
            if (!this.model) {
                return { 
                    completion: '',
                    mode: 'FALLBACK'
                };
            }

            const result = await this.model.generateContent(prompt);
            const completion = result.response.text().trim();
            
            return {
                partialText,
                completion,
                fullText: partialText + ' ' + completion,
                mode: 'AI_COMPLETED'
            };
        } catch (error) {
            console.error('[AIPartner] Error autocompleting:', error);
            return {
                partialText,
                completion: '',
                mode: 'FALLBACK',
                error: error.message
            };
        }
    }

    // =========================================================================
    // REPORT GENERATION METHODS
    // =========================================================================

    /**
     * Generate executive summary from assessment
     */
    async generateExecutiveSummary(assessment, options = {}) {
        const scores = Object.entries(assessment)
            .filter(([key, val]) => val?.actual && DRD_AXES[key])
            .map(([key, val]) => ({
                axis: key,
                name: DRD_AXES[key].name,
                actual: val.actual,
                target: val.target,
                gap: (val.target || val.actual) - val.actual
            }));

        if (scores.length === 0) {
            return { error: 'No assessment data provided' };
        }

        const avgActual = scores.reduce((sum, s) => sum + s.actual, 0) / scores.length;
        const avgTarget = scores.reduce((sum, s) => sum + (s.target || s.actual), 0) / scores.length;
        const topStrengths = [...scores].sort((a, b) => b.actual - a.actual).slice(0, 3);
        const topGaps = [...scores].sort((a, b) => b.gap - a.gap).slice(0, 3);

        const prompt = `
            Generate an executive summary for a digital maturity assessment.
            
            Assessment Data:
            - Average Maturity: ${avgActual.toFixed(1)}/7
            - Average Target: ${avgTarget.toFixed(1)}/7
            - Overall Gap: ${(avgTarget - avgActual).toFixed(1)} levels
            
            Top Strengths: ${topStrengths.map(s => `${s.name} (${s.actual})`).join(', ')}
            Priority Gaps: ${topGaps.map(s => `${s.name} (gap: ${s.gap})`).join(', ')}
            
            ${options.organizationName ? `Organization: ${options.organizationName}` : ''}
            ${options.industry ? `Industry: ${options.industry}` : ''}
            
            Write a professional executive summary (3-4 paragraphs) covering:
            1. Overall maturity assessment and positioning
            2. Key strengths and competitive advantages
            3. Priority improvement areas
            4. Strategic recommendation
            
            Language: ${options.language || 'Polish'}
            Tone: Executive-ready, actionable, positive but realistic
        `;

        try {
            if (!this.model) {
                return this._getFallbackExecutiveSummary(scores, avgActual, avgTarget);
            }

            const result = await this.model.generateContent(prompt);
            const summary = result.response.text().trim();
            
            return {
                summary,
                metrics: {
                    averageMaturity: avgActual.toFixed(1),
                    averageTarget: avgTarget.toFixed(1),
                    overallGap: (avgTarget - avgActual).toFixed(1),
                    axesAssessed: scores.length
                },
                topStrengths: topStrengths.map(s => s.name),
                priorityGaps: topGaps.map(s => s.name),
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error generating executive summary:', error);
            return this._getFallbackExecutiveSummary(scores, avgActual, avgTarget);
        }
    }

    /**
     * Generate stakeholder-specific view
     */
    async generateStakeholderView(assessment, stakeholderRole, options = {}) {
        const validRoles = ['CTO', 'CFO', 'COO', 'CEO', 'BOARD'];
        if (!validRoles.includes(stakeholderRole)) {
            return { error: 'Invalid stakeholder role. Valid: CTO, CFO, COO, CEO, BOARD' };
        }

        const scores = Object.entries(assessment)
            .filter(([key, val]) => val?.actual && DRD_AXES[key])
            .map(([key, val]) => ({
                axis: key,
                name: DRD_AXES[key].name,
                actual: val.actual,
                target: val.target
            }));

        const roleContext = {
            CTO: 'Focus on technology architecture, AI/ML capabilities, data infrastructure, and digital products.',
            CFO: 'Focus on ROI, investment requirements, cost optimization, and business model impacts.',
            COO: 'Focus on process efficiency, operational excellence, and organizational readiness.',
            CEO: 'Focus on strategic positioning, competitive advantage, and transformation roadmap.',
            BOARD: 'Focus on governance, risk management, and long-term value creation.'
        };

        const prompt = `
            Generate a stakeholder-specific summary of a digital maturity assessment.
            
            Stakeholder Role: ${stakeholderRole}
            Focus Areas: ${roleContext[stakeholderRole]}
            
            Assessment Scores:
            ${scores.map(s => `- ${s.name}: ${s.actual}/7 (target: ${s.target || 'not set'})`).join('\n')}
            
            ${options.organizationName ? `Organization: ${options.organizationName}` : ''}
            
            Generate a 2-3 paragraph summary tailored to ${stakeholderRole}'s perspective and concerns.
            Include specific metrics and recommendations relevant to their role.
            
            Language: ${options.language || 'Polish'}
        `;

        try {
            if (!this.model) {
                return { 
                    view: `Podsumowanie dla ${stakeholderRole} wymaga połączenia z AI.`,
                    mode: 'FALLBACK'
                };
            }

            const result = await this.model.generateContent(prompt);
            const view = result.response.text().trim();
            
            return {
                stakeholderRole,
                view,
                focusAreas: roleContext[stakeholderRole],
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error generating stakeholder view:', error);
            return {
                stakeholderRole,
                view: `Podsumowanie dla ${stakeholderRole} wymaga połączenia z AI.`,
                mode: 'FALLBACK',
                error: error.message
            };
        }
    }

    /**
     * Generate benchmark commentary
     */
    async generateBenchmarkCommentary(assessment, benchmarks, options = {}) {
        const scores = Object.entries(assessment)
            .filter(([key, val]) => val?.actual && DRD_AXES[key])
            .map(([key, val]) => ({
                axis: key,
                name: DRD_AXES[key].name,
                actual: val.actual,
                benchmark: benchmarks[key]?.median || benchmarks[key]?.average || null,
                vsIndustry: benchmarks[key] ? val.actual - (benchmarks[key].median || benchmarks[key].average) : null
            }));

        const prompt = `
            Generate a benchmark comparison commentary for a digital maturity assessment.
            
            Comparison Data:
            ${scores.map(s => `- ${s.name}: Score ${s.actual}/7 ${s.benchmark ? `vs Industry ${s.benchmark} (${s.vsIndustry > 0 ? '+' : ''}${s.vsIndustry?.toFixed(1)})` : '(no benchmark)'}`).join('\n')}
            
            ${options.industry ? `Industry: ${options.industry}` : ''}
            
            Write a professional commentary (2-3 paragraphs) that:
            1. Summarizes overall position vs industry
            2. Highlights areas where organization leads
            3. Identifies areas where organization lags
            4. Provides context for the comparison
            
            Language: ${options.language || 'Polish'}
        `;

        try {
            if (!this.model) {
                return { 
                    commentary: 'Komentarz benchmarkowy wymaga połączenia z AI.',
                    mode: 'FALLBACK'
                };
            }

            const result = await this.model.generateContent(prompt);
            const commentary = result.response.text().trim();
            
            // Calculate summary stats
            const withBenchmark = scores.filter(s => s.benchmark !== null);
            const aboveAvg = withBenchmark.filter(s => s.vsIndustry > 0).length;
            const belowAvg = withBenchmark.filter(s => s.vsIndustry < 0).length;
            
            return {
                commentary,
                summary: {
                    axesAboveIndustry: aboveAvg,
                    axesBelowIndustry: belowAvg,
                    axesAtIndustry: withBenchmark.length - aboveAvg - belowAvg
                },
                detailedComparison: scores,
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error generating benchmark commentary:', error);
            return {
                commentary: 'Komentarz benchmarkowy wymaga połączenia z AI.',
                mode: 'FALLBACK',
                error: error.message
            };
        }
    }

    // =========================================================================
    // INITIATIVE SUPPORT METHODS
    // =========================================================================

    /**
     * Generate initiatives from gap analysis
     */
    async generateInitiativesFromGaps(gapAnalysis, constraints = {}) {
        if (!gapAnalysis || !gapAnalysis.length) {
            return { error: 'No gap analysis data provided' };
        }

        // Sort gaps by severity
        const sortedGaps = [...gapAnalysis].sort((a, b) => b.gap - a.gap);

        const prompt = `
            Generate digital transformation initiatives based on gap analysis.
            
            Gap Analysis:
            ${sortedGaps.slice(0, 5).map(g => `- ${g.axisName || g.axis}: Gap ${g.gap} levels (current: ${g.currentScore}, target: ${g.targetScore})`).join('\n')}
            
            Constraints:
            - Budget: ${constraints.budget || 'Not specified'}
            - Timeline: ${constraints.timeline || '12 months'}
            - Resources: ${constraints.resources || 'Standard team'}
            
            Generate 5-7 initiatives in JSON format:
            [
                {
                    "name": "Initiative name",
                    "description": "What this initiative achieves",
                    "targetAxes": ["axis1", "axis2"],
                    "priority": "HIGH|MEDIUM|LOW",
                    "estimatedDuration": "X months",
                    "estimatedBudget": "€XXk-XXXk",
                    "expectedImpact": "Description of expected improvements",
                    "dependencies": ["other initiative names if any"]
                }
            ]
            
            Language: ${constraints.language || 'Polish'}
        `;

        try {
            if (!this.model) {
                return this._getFallbackInitiatives(sortedGaps);
            }

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();
            
            // Parse JSON from response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            const initiatives = jsonMatch ? JSON.parse(jsonMatch[0]) : this._getFallbackInitiatives(sortedGaps).initiatives;
            
            return {
                initiatives,
                basedOnGaps: sortedGaps.slice(0, 5).map(g => g.axisName || g.axis),
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error generating initiatives:', error);
            return this._getFallbackInitiatives(sortedGaps);
        }
    }

    /**
     * Prioritize initiatives based on criteria
     */
    async prioritizeInitiatives(initiatives, criteria = {}) {
        if (!initiatives || !initiatives.length) {
            return { error: 'No initiatives provided' };
        }

        const prompt = `
            Prioritize these digital transformation initiatives.
            
            Initiatives:
            ${initiatives.map((i, idx) => `${idx + 1}. ${i.name}: ${i.description}`).join('\n')}
            
            Prioritization Criteria:
            - Strategic Impact Weight: ${criteria.impactWeight || 40}%
            - Feasibility Weight: ${criteria.feasibilityWeight || 30}%
            - Quick Win Potential: ${criteria.quickWinWeight || 30}%
            ${criteria.focusAreas ? `Focus Areas: ${criteria.focusAreas.join(', ')}` : ''}
            
            Return prioritized list in JSON format:
            [
                {
                    "rank": 1,
                    "name": "Initiative name",
                    "priorityScore": 85,
                    "reasoning": "Why this is ranked here",
                    "recommendedQuarter": "Q1 2025"
                }
            ]
        `;

        try {
            if (!this.model) {
                return {
                    prioritizedList: initiatives.map((i, idx) => ({
                        rank: idx + 1,
                        name: i.name,
                        priorityScore: 100 - idx * 10,
                        reasoning: 'Prioritized by gap severity',
                        recommendedQuarter: `Q${Math.floor(idx / 2) + 1} 2025`
                    })),
                    mode: 'FALLBACK'
                };
            }

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();
            
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            const prioritizedList = jsonMatch ? JSON.parse(jsonMatch[0]) : initiatives.map((i, idx) => ({
                rank: idx + 1,
                name: i.name,
                priorityScore: 100 - idx * 10
            }));
            
            return {
                prioritizedList,
                criteria,
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error prioritizing initiatives:', error);
            return {
                prioritizedList: initiatives.map((i, idx) => ({
                    rank: idx + 1,
                    name: i.name,
                    priorityScore: 100 - idx * 10
                })),
                mode: 'FALLBACK',
                error: error.message
            };
        }
    }

    /**
     * Estimate ROI for an initiative
     */
    async estimateInitiativeROI(initiative, context = {}) {
        if (!initiative || !initiative.name) {
            return { error: 'Invalid initiative data' };
        }

        const prompt = `
            Estimate ROI for a digital transformation initiative.
            
            Initiative: ${initiative.name}
            Description: ${initiative.description || 'Not provided'}
            Target Areas: ${initiative.targetAxes?.join(', ') || 'General'}
            Estimated Budget: ${initiative.estimatedBudget || 'Not specified'}
            Duration: ${initiative.estimatedDuration || '12 months'}
            
            ${context.companySize ? `Company Size: ${context.companySize}` : ''}
            ${context.industry ? `Industry: ${context.industry}` : ''}
            ${context.revenue ? `Annual Revenue: ${context.revenue}` : ''}
            
            Provide ROI estimate in JSON format:
            {
                "estimatedCost": "€XXXk",
                "estimatedBenefitYear1": "€XXXk",
                "estimatedBenefitYear3": "€XXXk",
                "paybackPeriod": "X months",
                "roiPercentage3Years": "XXX%",
                "confidenceLevel": "HIGH|MEDIUM|LOW",
                "assumptions": ["assumption1", "assumption2"],
                "risks": ["risk1", "risk2"]
            }
        `;

        try {
            if (!this.model) {
                return this._getFallbackROI(initiative);
            }

            const result = await this.model.generateContent(prompt);
            const responseText = result.response.text();
            
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const roiEstimate = jsonMatch ? JSON.parse(jsonMatch[0]) : this._getFallbackROI(initiative).estimate;
            
            return {
                initiative: initiative.name,
                estimate: roiEstimate,
                mode: 'AI_GENERATED'
            };
        } catch (error) {
            console.error('[AIPartner] Error estimating ROI:', error);
            return this._getFallbackROI(initiative);
        }
    }

    // =========================================================================
    // PRIVATE HELPER METHODS FOR NEW FEATURES
    // =========================================================================

    _getFallbackJustification(axisId, score) {
        const axis = DRD_AXES[axisId];
        return `Organizacja osiągnęła poziom ${score} w obszarze ${axis?.name || axisId}, charakteryzujący się: ${axis?.levels[score] || 'podstawowymi możliwościami'}.`;
    }

    _getFallbackEvidence(axisId, score) {
        const genericEvidence = {
            low: ['Dokumentacja procesów', 'Wywiady z pracownikami', 'Analiza istniejących systemów'],
            mid: ['Raporty KPI', 'Dokumentacja systemowa', 'Certyfikaty', 'Wyniki audytów'],
            high: ['Metryki wydajności', 'Benchmarki branżowe', 'Case studies', 'Nagrody i certyfikacje']
        };
        const tier = score <= 2 ? 'low' : score <= 5 ? 'mid' : 'high';
        return genericEvidence[tier];
    }

    _getTargetReasoning(axisId, current, target, ambitionLevel) {
        const gap = target - current;
        const axis = DRD_AXES[axisId];
        
        if (gap === 0) return 'Obecny poziom spełnia oczekiwania.';
        if (gap === 1) return `Konserwatywny cel: osiągnięcie poziomu ${target} w ${axis?.name || axisId} jest realistyczne w ciągu 6-9 miesięcy.`;
        if (gap === 2) return `Zbalansowany cel: przejście na poziom ${target} wymaga średnioterminowego programu transformacji (12-18 miesięcy).`;
        return `Ambitny cel: osiągnięcie poziomu ${target} to znacząca transformacja wymagająca wieloletniej strategii.`;
    }

    _estimateTotalTime(axisId, current, target) {
        let totalMonths = 0;
        for (let level = current; level < target; level++) {
            totalMonths += this._estimateLevelTransition(axisId, level, level + 1);
        }
        return `${totalMonths} miesięcy`;
    }

    _getFallbackExecutiveSummary(scores, avgActual, avgTarget) {
        const topStrengths = [...scores].sort((a, b) => b.actual - a.actual).slice(0, 3);
        const topGaps = [...scores].sort((a, b) => b.gap - a.gap).slice(0, 3);
        
        return {
            summary: `Organizacja osiągnęła średni poziom dojrzałości cyfrowej ${avgActual.toFixed(1)}/7. ` +
                `Mocne strony to: ${topStrengths.map(s => s.name).join(', ')}. ` +
                `Priorytetowe obszary rozwoju: ${topGaps.map(s => s.name).join(', ')}. ` +
                `Cel transformacji: osiągnięcie poziomu ${avgTarget.toFixed(1)}/7.`,
            metrics: {
                averageMaturity: avgActual.toFixed(1),
                averageTarget: avgTarget.toFixed(1),
                overallGap: (avgTarget - avgActual).toFixed(1)
            },
            mode: 'FALLBACK'
        };
    }

    _getFallbackInitiatives(gaps) {
        return {
            initiatives: gaps.slice(0, 5).map((g, idx) => ({
                name: `Poprawa ${g.axisName || g.axis}`,
                description: `Inicjatywa mająca na celu podniesienie dojrzałości w obszarze ${g.axisName || g.axis}`,
                targetAxes: [g.axis],
                priority: idx < 2 ? 'HIGH' : idx < 4 ? 'MEDIUM' : 'LOW',
                estimatedDuration: `${3 + idx * 2} miesięcy`,
                estimatedBudget: '€50k-150k',
                expectedImpact: `Poprawa o ${g.gap} poziomów`
            })),
            mode: 'FALLBACK'
        };
    }

    _getFallbackROI(initiative) {
        return {
            initiative: initiative.name,
            estimate: {
                estimatedCost: '€100k-300k',
                estimatedBenefitYear1: '€50k-100k',
                estimatedBenefitYear3: '€300k-500k',
                paybackPeriod: '18-24 miesięcy',
                roiPercentage3Years: '100-200%',
                confidenceLevel: 'LOW',
                assumptions: ['Standardowe założenia branżowe'],
                risks: ['Ryzyko wdrożeniowe', 'Ryzyko adopcji']
            },
            mode: 'FALLBACK'
        };
    }
}

// Singleton instance
const aiAssessmentPartner = new AIAssessmentPartnerService();

module.exports = {
    AIAssessmentPartnerService,
    aiAssessmentPartner,
    DRD_AXES,
    AI_PARTNER_CONFIG
};

