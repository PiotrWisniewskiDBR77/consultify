/**
 * AI Charter Generator Service
 * 
 * Generates complete initiative charters from assessment gaps, templates, and organizational context.
 * Fills 80%+ of initiative card fields automatically using AI.
 * 
 * @todo MIGRATION: Uses legacy AIService - migrate to aiPipeline.generateStructuredContent()
 * @see server/services/ai/aiPipeline.js for new implementation
 * @see docs/AI_ENTERPRISE_AUDIT_REPORT.md for migration status
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
// TODO: Migrate to: const { generateStructuredContent } = require('./ai/aiPipeline');
const AIService = require('./aiService');
const InitiativeTemplateService = require('./initiativeTemplateService');

// Lazy-load enterprise services
let IndustryIntelligenceService = null;
let FrameworkEngine = null;
let StrategicRecommendationService = null;

function getEnterpriseServices() {
    if (!IndustryIntelligenceService) {
        try {
            IndustryIntelligenceService = require('./ai/intelligence/industryIntelligenceService');
            FrameworkEngine = require('./ai/frameworks/frameworkEngine');
            StrategicRecommendationService = require('./ai/frameworks/strategicRecommendationService');
        } catch (e) {
            console.warn('[AICharterGenerator] Enterprise services not available:', e.message);
        }
    }
    return { IndustryIntelligenceService, FrameworkEngine, StrategicRecommendationService };
}

// Task type mapping for generated tasks
const TASK_TYPES = ['ANALYSIS', 'DESIGN', 'BUILD', 'PILOT', 'VALIDATION', 'DECISION', 'CHANGE_MGMT'];

// RACI role types for governance
const RACI_ROLES = ['RESPONSIBLE', 'ACCOUNTABLE', 'CONSULTED', 'INFORMED'];

class AICharterGeneratorService {
    /**
     * Generate a full initiative charter from gaps and context
     * @param {Object} request - AICharterRequest
     * @param {string} userId - User generating the charter
     * @returns {Promise<Object>} AIGeneratedCharter
     */
    static async generateFullCharter(request, userId) {
        const startTime = Date.now();
        
        try {
            // 1. Get template if specified
            let template = null;
            if (request.templateId) {
                template = await InitiativeTemplateService.getTemplateById(request.templateId);
            }

            // 2. Prepare context for AI generation
            const context = this.prepareGenerationContext(request, template);

            // 3. Generate each section of the charter
            const [
                basicInfo,
                problemStructured,
                targetState,
                killCriteria,
                risks,
                tasks,
                team,
                financials
            ] = await Promise.all([
                this.generateBasicInfo(context),
                this.generateProblemStructured(context, template),
                this.generateTargetState(context, template),
                this.generateKillCriteria(context, template),
                this.generateRisks(context),
                this.generateTasks(context, request.constraints, template),
                this.generateTeamSuggestion(context, request.constraints),
                this.estimateFinancials(context, request.constraints)
            ]);

            // 4. Assemble the full charter
            const charter = {
                id: uuidv4(),
                assessmentId: request.reportId || null,
                sourceAxisId: context.primaryAxis || 'processes',
                
                // Basic info
                name: basicInfo.name,
                description: basicInfo.description,
                summary: basicInfo.summary,
                applicantOneLiner: basicInfo.oneLiner,
                
                // Strategic
                strategicIntent: basicInfo.strategicIntent,
                objectives: basicInfo.objectives || [],
                hypothesis: basicInfo.hypothesis,
                
                // Problem definition
                problemStructured: problemStructured,
                problemStatement: problemStructured.symptom,
                
                // Target state
                targetState: targetState,
                
                // Execution
                killCriteria: killCriteria,
                keyRisks: risks,
                deliverables: basicInfo.deliverables || [],
                milestones: this.generateMilestones(request.constraints, tasks),
                
                // Tasks
                suggestedTasks: tasks,
                
                // Team
                suggestedTeam: team,
                
                // Financials
                estimatedBudget: financials.totalBudget,
                estimatedROI: financials.roi,
                capex: financials.capex,
                firstYearOpex: financials.opex,
                annualBenefit: financials.annualBenefit,
                
                // Meta
                timeline: request.constraints.maxTimeline || '6 months',
                riskLevel: this.calculateOverallRisk(risks),
                priority: this.calculatePriority(context.gaps),
                status: 'DRAFT',
                aiGenerated: true,
                templateId: request.templateId || null,
                generationConfidence: this.calculateConfidence(context, template),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // 5. Log the generation for audit
            await this.logGeneration(charter, request, userId, Date.now() - startTime);

            return charter;

        } catch (error) {
            console.error('[AICharterGenerator] Error generating charter:', error);
            throw error;
        }
    }

    /**
     * Generate enterprise-grade charter with full strategic context
     * Includes industry intelligence, framework analyses, and governance structure
     * @param {Object} request - AICharterRequest
     * @param {string} userId - User generating the charter
     * @param {Object} orgProfile - Organization profile with strategic context
     * @returns {Promise<Object>} EnterpriseAIGeneratedCharter
     */
    static async generateEnterpriseCharter(request, userId, orgProfile = null) {
        const startTime = Date.now();
        
        try {
            // 1. Get base charter
            const baseCharter = await this.generateFullCharter(request, userId);
            
            // 2. Get enterprise services
            const { IndustryIntelligenceService, FrameworkEngine, StrategicRecommendationService } = getEnterpriseServices();
            
            if (!IndustryIntelligenceService || !orgProfile) {
                // Return base charter if enterprise services not available
                return {
                    ...baseCharter,
                    enterpriseEnhanced: false
                };
            }

            // 3. Gather enterprise context
            const industry = orgProfile.industry || 'Technology';
            const [industryContext, benchmarks] = await Promise.all([
                IndustryIntelligenceService.getIndustryContext(industry, orgProfile.industry_subsector),
                this.getBenchmarksForCharter(industry, orgProfile.company_size)
            ]);

            // 4. Generate strategic alignment section
            const strategicAlignment = await this.generateStrategicAlignment(
                baseCharter, orgProfile, industryContext
            );

            // 5. Generate financial model with enhanced metrics
            const financialModel = await this.generateFinancialModel(
                baseCharter, orgProfile, request.constraints
            );

            // 6. Generate governance structure with RACI
            const governanceStructure = await this.generateGovernanceStructure(
                baseCharter, request.constraints
            );

            // 7. Calculate AI confidence scores
            const aiMetadata = this.calculateAIMetadata(
                baseCharter, industryContext, orgProfile
            );

            // 8. Assemble enterprise charter
            const enterpriseCharter = {
                ...baseCharter,
                
                // Strategic Alignment Section
                strategicAlignment: {
                    alignmentScore: strategicAlignment.alignmentScore,
                    strategicPrioritiesMatch: strategicAlignment.prioritiesMatch,
                    competitivePositioning: strategicAlignment.competitivePositioning,
                    transformationFit: strategicAlignment.transformationFit,
                    industryBenchmark: benchmarks
                },
                
                // Enhanced Financial Model
                financialModel: {
                    investmentSummary: financialModel.investmentSummary,
                    npvAnalysis: financialModel.npv,
                    irrEstimate: financialModel.irr,
                    paybackPeriod: financialModel.paybackPeriod,
                    sensitivityAnalysis: financialModel.sensitivity,
                    riskAdjustedROI: financialModel.riskAdjustedROI
                },
                
                // Governance Structure with RACI
                governanceStructure: {
                    raciMatrix: governanceStructure.raciMatrix,
                    decisionRights: governanceStructure.decisionRights,
                    escalationPath: governanceStructure.escalationPath,
                    reviewCadence: governanceStructure.reviewCadence
                },
                
                // AI Metadata with Confidence Scores
                aiMetadata: {
                    overallConfidence: aiMetadata.overallConfidence,
                    dataQuality: aiMetadata.dataQuality,
                    sectionConfidence: aiMetadata.sectionConfidence,
                    modelVersion: '2.0-enterprise',
                    industryContextUsed: !!industryContext,
                    frameworksApplied: aiMetadata.frameworksApplied
                },
                
                // Enterprise flags
                enterpriseEnhanced: true,
                enterpriseGenerationTime: Date.now() - startTime
            };

            // 9. Log enterprise generation
            await this.logEnterpriseGeneration(enterpriseCharter, request, userId, orgProfile);

            return enterpriseCharter;

        } catch (error) {
            console.error('[AICharterGenerator] Enterprise generation error:', error);
            // Fallback to base charter
            return await this.generateFullCharter(request, userId);
        }
    }

    /**
     * Generate strategic alignment section
     */
    static async generateStrategicAlignment(charter, orgProfile, industryContext) {
        const priorities = orgProfile.strategic_priorities || [];
        const position = orgProfile.competitive_position || 'CHALLENGER';
        const stage = orgProfile.growth_stage || 'MATURE';

        // Calculate alignment with strategic priorities
        const charterText = `${charter.name} ${charter.description} ${charter.strategicIntent}`.toLowerCase();
        const prioritiesMatch = priorities.filter(p => 
            charterText.includes(p.toLowerCase())
        );

        // Competitive positioning assessment
        const positioningMap = {
            LEADER: { fit: 'DEFEND', focus: 'Innovation and efficiency' },
            CHALLENGER: { fit: 'ATTACK', focus: 'Differentiation and growth' },
            FOLLOWER: { fit: 'OPTIMIZE', focus: 'Efficiency and niche' },
            NICHE: { fit: 'SPECIALIZE', focus: 'Deep expertise' }
        };

        // Transformation fit based on stage
        const stageFitMap = {
            STARTUP: { readiness: 'HIGH', note: 'High agility, limited resources' },
            SCALE_UP: { readiness: 'HIGH', note: 'Growth focus, scaling capability' },
            MATURE: { readiness: 'MEDIUM', note: 'Established processes, change management needed' },
            TURNAROUND: { readiness: 'MEDIUM', note: 'Focused priorities, resource constraints' }
        };

        return {
            alignmentScore: Math.min(100, 50 + (prioritiesMatch.length * 15) + (priorities.length > 0 ? 20 : 0)),
            prioritiesMatch,
            competitivePositioning: positioningMap[position] || positioningMap.CHALLENGER,
            transformationFit: stageFitMap[stage] || stageFitMap.MATURE,
            industryTrends: industryContext?.trends?.items?.slice(0, 3) || []
        };
    }

    /**
     * Generate enhanced financial model
     */
    static async generateFinancialModel(charter, orgProfile, constraints) {
        const budget = charter.estimatedBudget || 500000;
        const roi = charter.estimatedROI || 1.5;
        const timelineMonths = parseInt(charter.timeline) || 12;
        const riskLevel = charter.riskLevel || 'MEDIUM';

        // Risk adjustment factors
        const riskFactors = { LOW: 0.95, MEDIUM: 0.85, HIGH: 0.70 };
        const riskFactor = riskFactors[riskLevel] || 0.85;

        // NPV calculation (simplified, 10% discount rate)
        const discountRate = 0.10;
        const annualBenefit = charter.annualBenefit || budget * roi;
        const npv = -budget + (annualBenefit / (1 + discountRate)) + (annualBenefit / Math.pow(1 + discountRate, 2));

        // IRR estimate based on ROI and timeline
        const irr = Math.round(((roi - 1) / (timelineMonths / 12)) * 100);

        // Payback period
        const monthlyBenefit = annualBenefit / 12;
        const paybackMonths = Math.ceil(budget / monthlyBenefit);

        return {
            investmentSummary: {
                totalInvestment: budget,
                capex: charter.capex || budget * 0.7,
                opex: charter.firstYearOpex || budget * 0.3,
                contingency: Math.round(budget * 0.15)
            },
            npv: {
                value: Math.round(npv),
                discountRate: '10%',
                horizon: '3 years'
            },
            irr: {
                estimate: `${irr}%`,
                confidence: riskLevel === 'LOW' ? 'HIGH' : 'MEDIUM'
            },
            paybackPeriod: {
                months: paybackMonths,
                confidence: riskLevel === 'LOW' ? 'HIGH' : 'MEDIUM'
            },
            sensitivity: {
                bestCase: { roi: roi * 1.2, npv: Math.round(npv * 1.3) },
                baseCase: { roi, npv: Math.round(npv) },
                worstCase: { roi: roi * 0.6, npv: Math.round(npv * 0.5) }
            },
            riskAdjustedROI: Math.round(roi * riskFactor * 100) / 100
        };
    }

    /**
     * Generate governance structure with RACI matrix
     */
    static async generateGovernanceStructure(charter, constraints) {
        const team = charter.suggestedTeam || [];
        const tasks = charter.suggestedTasks || [];

        // Generate RACI matrix
        const keyActivities = [
            'Initiative Approval',
            'Budget Allocation',
            'Design Decisions',
            'Implementation',
            'Quality Assurance',
            'Change Management',
            'Stakeholder Communication'
        ];

        const raciMatrix = keyActivities.map(activity => {
            const raci = {};
            team.forEach(member => {
                if (member.role === 'STAKEHOLDER') {
                    raci[member.title] = activity.includes('Approval') || activity.includes('Budget') ? 'A' : 'I';
                } else if (member.role === 'CONTRIBUTOR') {
                    raci[member.title] = activity.includes('Implementation') || activity.includes('Design') ? 'R' : 'C';
                } else if (member.role === 'SME') {
                    raci[member.title] = 'C';
                } else if (member.role === 'REVIEWER') {
                    raci[member.title] = activity.includes('Quality') ? 'R' : 'I';
                } else {
                    raci[member.title] = 'I';
                }
            });
            return { activity, ...raci };
        });

        return {
            raciMatrix,
            decisionRights: {
                strategic: 'Steering Committee',
                tactical: 'Project Manager',
                operational: 'Team Lead'
            },
            escalationPath: [
                { level: 1, owner: 'Project Manager', scope: 'Day-to-day issues' },
                { level: 2, owner: 'Project Sponsor', scope: 'Budget/scope changes' },
                { level: 3, owner: 'Steering Committee', scope: 'Strategic decisions' }
            ],
            reviewCadence: {
                daily: 'Stand-ups',
                weekly: 'Progress reviews',
                monthly: 'Steering committee',
                quarterly: 'Business review'
            }
        };
    }

    /**
     * Calculate AI metadata and confidence scores
     */
    static calculateAIMetadata(charter, industryContext, orgProfile) {
        const sectionConfidence = {};
        
        // Calculate confidence for each section
        sectionConfidence.basicInfo = charter.generationConfidence === 'HIGH' ? 0.9 : 0.7;
        sectionConfidence.problem = charter.problemStructured ? 0.85 : 0.5;
        sectionConfidence.targetState = charter.targetState ? 0.8 : 0.5;
        sectionConfidence.financials = orgProfile ? 0.75 : 0.5;
        sectionConfidence.team = charter.suggestedTeam?.length > 0 ? 0.8 : 0.5;
        sectionConfidence.tasks = charter.suggestedTasks?.length > 0 ? 0.85 : 0.5;

        const avgConfidence = Object.values(sectionConfidence).reduce((a, b) => a + b, 0) / 
                            Object.keys(sectionConfidence).length;

        // Data quality assessment
        let dataQuality = 'MEDIUM';
        if (orgProfile && industryContext && charter.suggestedTasks?.length > 5) {
            dataQuality = 'HIGH';
        } else if (!orgProfile && !industryContext) {
            dataQuality = 'LOW';
        }

        return {
            overallConfidence: avgConfidence >= 0.8 ? 'HIGH' : avgConfidence >= 0.6 ? 'MEDIUM' : 'LOW',
            confidenceScore: Math.round(avgConfidence * 100),
            dataQuality,
            sectionConfidence,
            frameworksApplied: industryContext ? ['Industry Benchmarks', 'Strategic Alignment'] : []
        };
    }

    /**
     * Get benchmarks for charter context
     */
    static async getBenchmarksForCharter(industry, companySize) {
        try {
            const BenchmarkService = require('./ai/intelligence/benchmarkDataService');
            const benchmarks = await BenchmarkService.getBenchmarkData(industry, companySize);
            return {
                industry,
                medianMaturity: benchmarks.overallBenchmark?.median || 4.0,
                topQuartile: benchmarks.overallBenchmark?.p75 || 5.5,
                source: 'DRD Industry Benchmarks'
            };
        } catch (e) {
            return {
                industry,
                medianMaturity: 4.0,
                topQuartile: 5.5,
                source: 'Default Benchmarks'
            };
        }
    }

    /**
     * Log enterprise generation for audit
     */
    static async logEnterpriseGeneration(charter, request, userId, orgProfile) {
        return new Promise((resolve) => {
            const sql = `
                INSERT INTO ai_charter_generations 
                (id, initiative_id, source_type, template_id, gaps_json, constraints_json, 
                 generated_charter_json, confidence_score, generation_time_ms, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const confidenceScore = charter.aiMetadata?.confidenceScore 
                ? charter.aiMetadata.confidenceScore / 100 
                : 0.7;

            db.run(sql, [
                uuidv4(),
                charter.id,
                'ENTERPRISE',
                request.templateId || null,
                JSON.stringify(request.gaps || []),
                JSON.stringify({ ...request.constraints, orgProfile: orgProfile?.id }),
                JSON.stringify(charter),
                confidenceScore,
                charter.enterpriseGenerationTime || 0,
                userId
            ], (err) => {
                if (err) {
                    console.warn('[AICharterGenerator] Failed to log enterprise generation:', err.message);
                }
                resolve();
            });
        });
    }

    /**
     * Prepare context for AI generation
     */
    static prepareGenerationContext(request, template) {
        const gaps = request.gaps || [];
        
        // Determine primary axis from gaps
        const axisCounts = {};
        gaps.forEach(g => {
            axisCounts[g.axisId] = (axisCounts[g.axisId] || 0) + 1;
        });
        const primaryAxis = Object.keys(axisCounts).sort((a, b) => axisCounts[b] - axisCounts[a])[0] || 'processes';

        // Calculate average gap severity
        const avgGap = gaps.length > 0 
            ? gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length 
            : 2;

        return {
            gaps,
            primaryAxis,
            avgGap,
            template,
            organizationContext: request.organizationContext || {},
            constraints: request.constraints || {},
            sourceType: request.sourceType
        };
    }

    /**
     * Generate basic initiative info (name, description, objectives)
     */
    static async generateBasicInfo(context) {
        const { gaps, primaryAxis, template, organizationContext } = context;

        // Build prompt for AI
        const gapSummary = gaps.map(g => 
            `- ${g.axisName}: Current ${g.currentScore}/7, Target ${g.targetScore}/7 (Gap: ${g.gap})`
        ).join('\n');

        const prompt = `Generate initiative details for a digital transformation project.

Context:
- Primary Focus: ${primaryAxis}
- Organization Industry: ${organizationContext.industry || 'General'}
- Organization Size: ${organizationContext.size || 'Medium'}
${template ? `- Based on template: ${template.name}` : ''}

Gaps to address:
${gapSummary || 'General improvement initiative'}

Generate JSON with:
{
  "name": "Short, action-oriented initiative name (max 60 chars)",
  "description": "2-3 sentence description of the initiative",
  "summary": "Executive summary (3-4 sentences) explaining what, why, and expected outcome",
  "oneLiner": "One sentence value proposition",
  "strategicIntent": "Grow" | "Fix" | "Stabilize" | "De-risk" | "Build Capability",
  "objectives": ["Objective 1", "Objective 2", "Objective 3"],
  "hypothesis": "If we [action], then [expected outcome] because [reasoning]",
  "deliverables": ["Deliverable 1", "Deliverable 2", "Deliverable 3", "Deliverable 4"]
}`;

        try {
            const result = await AIService.generateStructuredContent(prompt, 'initiative_basic_info');
            return result || this.getDefaultBasicInfo(context);
        } catch (error) {
            console.warn('[AICharterGenerator] AI basic info failed, using defaults:', error.message);
            return this.getDefaultBasicInfo(context);
        }
    }

    /**
     * Generate structured problem statement
     */
    static async generateProblemStructured(context, template) {
        const { gaps, organizationContext } = context;

        // Use template if available
        if (template?.problemStructured) {
            return {
                symptom: template.problemStructured.symptom || '',
                rootCause: template.problemStructured.rootCause || '',
                costOfInaction: template.problemStructured.costOfInaction || ''
            };
        }

        const gapSummary = gaps.map(g => `${g.axisName} (gap: ${g.gap})`).join(', ');

        const prompt = `Analyze these digital maturity gaps and create a structured problem statement.

Gaps: ${gapSummary || 'General digital maturity improvement needed'}
Industry: ${organizationContext.industry || 'General business'}

Generate JSON:
{
  "symptom": "Observable business problem or pain point (what is happening)",
  "rootCause": "Underlying cause of the problem (why it's happening)",
  "costOfInaction": "Quantified or described impact if not addressed (risk of doing nothing)"
}

Be specific and business-focused. Use metrics where possible.`;

        try {
            const result = await AIService.generateStructuredContent(prompt, 'problem_structured');
            return result || this.getDefaultProblem(context);
        } catch (error) {
            console.warn('[AICharterGenerator] AI problem generation failed:', error.message);
            return this.getDefaultProblem(context);
        }
    }

    /**
     * Generate target state
     */
    static async generateTargetState(context, template) {
        const { gaps, primaryAxis } = context;

        // Use template if available
        if (template?.targetState) {
            return template.targetState;
        }

        const prompt = `Define the target state for a digital transformation initiative.

Focus area: ${primaryAxis}
Gaps to close: ${gaps.map(g => `${g.axisName} from ${g.currentScore} to ${g.targetScore}`).join(', ')}

Generate JSON with specific, measurable outcomes:
{
  "process": ["Process improvement 1", "Process improvement 2"],
  "behavior": ["Behavior change 1", "Behavior change 2"],
  "capability": ["New capability 1", "New capability 2"]
}

Each item should be concrete and verifiable.`;

        try {
            const result = await AIService.generateStructuredContent(prompt, 'target_state');
            return result || this.getDefaultTargetState(primaryAxis);
        } catch (error) {
            console.warn('[AICharterGenerator] AI target state failed:', error.message);
            return this.getDefaultTargetState(primaryAxis);
        }
    }

    /**
     * Generate kill criteria
     */
    static async generateKillCriteria(context, template) {
        // Use template if available
        if (template?.killCriteria && template.killCriteria.length > 0) {
            return template.killCriteria;
        }

        const { avgGap, primaryAxis } = context;

        const prompt = `Generate kill criteria for stopping a digital transformation initiative if it's not working.

Initiative focus: ${primaryAxis}
Gap severity: ${avgGap > 3 ? 'High' : avgGap > 2 ? 'Medium' : 'Low'}

Generate JSON array of 3-5 kill criteria. Each should be a clear, measurable condition:
["Criterion 1: If X happens, stop", "Criterion 2: If metric Y falls below Z, stop", ...]`;

        try {
            const result = await AIService.generateStructuredContent(prompt, 'kill_criteria');
            return Array.isArray(result) ? result : this.getDefaultKillCriteria();
        } catch (error) {
            console.warn('[AICharterGenerator] AI kill criteria failed:', error.message);
            return this.getDefaultKillCriteria();
        }
    }

    /**
     * Generate risk assessment
     */
    static async generateRisks(context) {
        const { gaps, primaryAxis, avgGap } = context;

        const prompt = `Identify key risks for a digital transformation initiative.

Focus: ${primaryAxis}
Gap severity: ${avgGap.toFixed(1)}/5
Areas affected: ${gaps.map(g => g.axisName).join(', ')}

Generate JSON array of 3-5 risks:
[
  {"risk": "Risk description", "mitigation": "How to mitigate", "metric": "Low|Medium|High"},
  ...
]`;

        try {
            const result = await AIService.generateStructuredContent(prompt, 'risk_assessment');
            return Array.isArray(result) ? result : this.getDefaultRisks();
        } catch (error) {
            console.warn('[AICharterGenerator] AI risk assessment failed:', error.message);
            return this.getDefaultRisks();
        }
    }

    /**
     * Generate suggested tasks
     */
    static async generateTasks(context, constraints, template) {
        // Use template tasks if available
        if (template?.suggestedTasks && template.suggestedTasks.length > 0) {
            return template.suggestedTasks.map(t => ({
                ...t,
                id: uuidv4(),
                status: 'todo',
                priority: t.priority || 'medium'
            }));
        }

        const { primaryAxis, gaps } = context;
        const timeline = constraints.maxTimeline || '6 months';

        const prompt = `Generate a task breakdown for a digital transformation initiative.

Focus: ${primaryAxis}
Timeline: ${timeline}
Team size: ${constraints.teamSize || '5-10'}

Generate JSON array of 6-10 tasks covering the full lifecycle:
[
  {
    "title": "Task title",
    "description": "What needs to be done",
    "taskType": "ANALYSIS|DESIGN|BUILD|PILOT|VALIDATION|DECISION|CHANGE_MGMT",
    "priority": "high|medium|low",
    "estimatedHours": 40,
    "stepPhase": "design|pilot|rollout",
    "expectedOutcome": "What success looks like",
    "why": "Why this task matters for the initiative"
  },
  ...
]

Order tasks logically from discovery to rollout.`;

        try {
            const result = await AIService.generateStructuredContent(prompt, 'task_breakdown');
            if (Array.isArray(result)) {
                return result.map(t => ({
                    id: uuidv4(),
                    title: t.title,
                    description: t.description,
                    taskType: TASK_TYPES.includes(t.taskType) ? t.taskType : 'ANALYSIS',
                    status: 'todo',
                    priority: t.priority || 'medium',
                    estimatedHours: t.estimatedHours || 40,
                    stepPhase: t.stepPhase || 'design',
                    expectedOutcome: t.expectedOutcome,
                    why: t.why
                }));
            }
            return this.getDefaultTasks(primaryAxis);
        } catch (error) {
            console.warn('[AICharterGenerator] AI task generation failed:', error.message);
            return this.getDefaultTasks(primaryAxis);
        }
    }

    /**
     * Generate team suggestion
     */
    static async generateTeamSuggestion(context, constraints) {
        const { primaryAxis } = context;
        const teamSize = constraints.teamSize || '5-10';

        const prompt = `Suggest team composition for a ${primaryAxis} digital transformation initiative.

Team size guidance: ${teamSize}

Generate JSON array of team roles:
[
  {"role": "CONTRIBUTOR|REVIEWER|SME|STAKEHOLDER|OBSERVER", "title": "Role title", "allocation": 50, "reason": "Why needed"},
  ...
]

Include mix of business and technical roles. Allocation is percentage of time.`;

        try {
            const result = await AIService.generateStructuredContent(prompt, 'team_suggestion');
            if (Array.isArray(result)) {
                return result.map(r => ({
                    id: uuidv4(),
                    role: r.role || 'CONTRIBUTOR',
                    title: r.title,
                    allocation: r.allocation || 50,
                    reason: r.reason
                }));
            }
            return this.getDefaultTeam();
        } catch (error) {
            console.warn('[AICharterGenerator] AI team suggestion failed:', error.message);
            return this.getDefaultTeam();
        }
    }

    /**
     * Estimate financial metrics
     */
    static async estimateFinancials(context, constraints) {
        const { avgGap, gaps } = context;
        const maxBudget = constraints.maxBudget || 500000;

        // Calculate based on gap severity and number of gaps
        const gapCount = gaps.length || 1;
        const baseCost = avgGap * 50000; // Base cost per gap point
        const scaleFactor = Math.min(gapCount * 0.8, 3); // Scale with gaps

        const capex = Math.round(baseCost * scaleFactor * 0.7); // 70% CAPEX
        const opex = Math.round(baseCost * scaleFactor * 0.3); // 30% OPEX
        const totalBudget = Math.min(capex + opex, maxBudget);

        // ROI estimation based on gap closure
        const roiBase = avgGap * 0.4 + 1; // 1.4x to 3x depending on gap
        const roi = Math.round(roiBase * 10) / 10;

        // Annual benefit
        const annualBenefit = Math.round(totalBudget * roi);

        return {
            capex: Math.min(capex, maxBudget * 0.7),
            opex: Math.min(opex, maxBudget * 0.3),
            totalBudget: Math.min(totalBudget, maxBudget),
            roi,
            annualBenefit
        };
    }

    /**
     * Generate milestones from timeline and tasks
     */
    static generateMilestones(constraints, tasks) {
        const timeline = constraints.maxTimeline || '6 months';
        const months = parseInt(timeline) || 6;

        const milestones = [
            { name: 'Kickoff & Discovery Complete', targetDate: this.addMonths(new Date(), 1) },
            { name: 'Design Phase Complete', targetDate: this.addMonths(new Date(), Math.round(months * 0.3)) },
            { name: 'Pilot Launch', targetDate: this.addMonths(new Date(), Math.round(months * 0.5)) },
            { name: 'Pilot Evaluation', targetDate: this.addMonths(new Date(), Math.round(months * 0.7)) },
            { name: 'Full Rollout', targetDate: this.addMonths(new Date(), months) }
        ];

        return milestones.map(m => ({
            ...m,
            targetDate: m.targetDate.toISOString().split('T')[0]
        }));
    }

    /**
     * Calculate overall risk level
     */
    static calculateOverallRisk(risks) {
        if (!risks || risks.length === 0) return 'MEDIUM';
        
        const highCount = risks.filter(r => r.metric === 'High').length;
        const mediumCount = risks.filter(r => r.metric === 'Medium').length;

        if (highCount >= 2) return 'HIGH';
        if (highCount >= 1 || mediumCount >= 3) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Calculate priority from gaps
     */
    static calculatePriority(gaps) {
        if (!gaps || gaps.length === 0) return 2;
        
        const criticalCount = gaps.filter(g => g.priority === 'CRITICAL').length;
        const highCount = gaps.filter(g => g.priority === 'HIGH').length;

        if (criticalCount > 0) return 1;
        if (highCount >= 2) return 2;
        return 3;
    }

    /**
     * Calculate confidence in the generation
     */
    static calculateConfidence(context, template) {
        let confidence = 'MEDIUM';

        // Higher confidence with template
        if (template) confidence = 'HIGH';

        // Higher confidence with more gaps data
        if (context.gaps && context.gaps.length >= 3) {
            confidence = template ? 'HIGH' : 'MEDIUM';
        }

        // Lower confidence with minimal data
        if (!context.gaps || context.gaps.length === 0) {
            confidence = 'LOW';
        }

        return confidence;
    }

    /**
     * Log generation for audit
     */
    static async logGeneration(charter, request, userId, durationMs) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO ai_charter_generations 
                (id, initiative_id, source_type, template_id, gaps_json, constraints_json, 
                 generated_charter_json, confidence_score, generation_time_ms, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const confidenceScore = charter.generationConfidence === 'HIGH' ? 0.9 :
                                   charter.generationConfidence === 'MEDIUM' ? 0.7 : 0.5;

            db.run(sql, [
                uuidv4(),
                charter.id,
                request.sourceType,
                request.templateId || null,
                JSON.stringify(request.gaps || []),
                JSON.stringify(request.constraints || {}),
                JSON.stringify(charter),
                confidenceScore,
                durationMs,
                userId
            ], (err) => {
                if (err) {
                    console.warn('[AICharterGenerator] Failed to log generation:', err.message);
                }
                resolve(); // Don't fail the generation if logging fails
            });
        });
    }

    /**
     * Regenerate a specific section of the charter
     */
    static async regenerateSection(charter, section, context) {
        switch (section) {
            case 'problem':
                return await this.generateProblemStructured(context, null);
            case 'target':
                return await this.generateTargetState(context, null);
            case 'kill':
                return await this.generateKillCriteria(context, null);
            case 'risks':
                return await this.generateRisks(context);
            case 'tasks':
                return await this.generateTasks(context, context.constraints || {}, null);
            case 'team':
                return await this.generateTeamSuggestion(context, context.constraints || {});
            default:
                throw new Error(`Unknown section: ${section}`);
        }
    }

    // ============= HELPER METHODS =============

    static addMonths(date, months) {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    // ============= DEFAULT FALLBACKS =============

    static getDefaultBasicInfo(context) {
        const axisNames = {
            processes: 'Process Digitalization',
            digitalProducts: 'Digital Products',
            dataManagement: 'Data Management',
            culture: 'Digital Culture',
            cybersecurity: 'Cybersecurity',
            aiMaturity: 'AI/ML Capability'
        };

        const name = axisNames[context.primaryAxis] || 'Digital Transformation';

        return {
            name: `${name} Initiative`,
            description: `Initiative to improve ${name.toLowerCase()} maturity and close identified gaps.`,
            summary: `This initiative addresses critical gaps in ${name.toLowerCase()}. By implementing targeted improvements, we expect to enhance organizational capability and drive business value.`,
            oneLiner: `Transforming ${name.toLowerCase()} to drive competitive advantage.`,
            strategicIntent: 'Build Capability',
            objectives: [
                'Close identified maturity gaps',
                'Improve operational efficiency',
                'Build sustainable capabilities'
            ],
            hypothesis: `If we invest in ${name.toLowerCase()}, then we will see measurable improvement in maturity scores and business outcomes.`,
            deliverables: [
                'Assessment report',
                'Transformation roadmap',
                'Implementation plan',
                'Training materials'
            ]
        };
    }

    static getDefaultProblem(context) {
        return {
            symptom: 'Organization is experiencing gaps in digital capabilities that impact operational efficiency and competitive position.',
            rootCause: 'Historical underinvestment in digital infrastructure and skills development.',
            costOfInaction: 'Risk of falling behind competitors by 2-3 years in digital maturity, potential 15-20% efficiency loss.'
        };
    }

    static getDefaultTargetState(primaryAxis) {
        return {
            process: [
                'Automated key workflows with 80% reduction in manual steps',
                'Real-time visibility into process performance'
            ],
            behavior: [
                'Teams actively use digital tools for daily operations',
                'Data-driven decision making is standard practice'
            ],
            capability: [
                'Modern digital infrastructure deployed',
                'Internal expertise to maintain and evolve solutions'
            ]
        };
    }

    static getDefaultKillCriteria() {
        return [
            'If ROI falls below 0.5x at 6-month review, stop initiative',
            'If team adoption rate is below 30% after pilot, reconsider approach',
            'If budget overrun exceeds 50%, pause and reassess',
            'If key sponsor leaves without replacement, suspend project'
        ];
    }

    static getDefaultRisks() {
        return [
            { risk: 'Change resistance from teams', mitigation: 'Early stakeholder engagement and change management program', metric: 'Medium' },
            { risk: 'Technical integration challenges', mitigation: 'Thorough technical assessment and phased rollout', metric: 'Medium' },
            { risk: 'Budget overrun', mitigation: 'Regular financial reviews and contingency buffer', metric: 'Low' }
        ];
    }

    static getDefaultTasks(primaryAxis) {
        return [
            { id: uuidv4(), title: 'Discovery & Assessment', taskType: 'ANALYSIS', status: 'todo', priority: 'high', estimatedHours: 40, stepPhase: 'design' },
            { id: uuidv4(), title: 'Solution Design', taskType: 'DESIGN', status: 'todo', priority: 'high', estimatedHours: 60, stepPhase: 'design' },
            { id: uuidv4(), title: 'Pilot Planning', taskType: 'DESIGN', status: 'todo', priority: 'medium', estimatedHours: 20, stepPhase: 'design' },
            { id: uuidv4(), title: 'Pilot Implementation', taskType: 'BUILD', status: 'todo', priority: 'high', estimatedHours: 80, stepPhase: 'pilot' },
            { id: uuidv4(), title: 'Pilot Validation', taskType: 'VALIDATION', status: 'todo', priority: 'high', estimatedHours: 40, stepPhase: 'pilot' },
            { id: uuidv4(), title: 'Go/No-Go Decision', taskType: 'DECISION', status: 'todo', priority: 'high', estimatedHours: 8, stepPhase: 'pilot' },
            { id: uuidv4(), title: 'Rollout Preparation', taskType: 'BUILD', status: 'todo', priority: 'medium', estimatedHours: 60, stepPhase: 'rollout' },
            { id: uuidv4(), title: 'Change Management', taskType: 'CHANGE_MGMT', status: 'todo', priority: 'medium', estimatedHours: 40, stepPhase: 'rollout' }
        ];
    }

    static getDefaultTeam() {
        return [
            { id: uuidv4(), role: 'CONTRIBUTOR', title: 'Project Manager', allocation: 100, reason: 'Full-time project leadership' },
            { id: uuidv4(), role: 'CONTRIBUTOR', title: 'Business Analyst', allocation: 80, reason: 'Requirements and process mapping' },
            { id: uuidv4(), role: 'SME', title: 'Technical Lead', allocation: 60, reason: 'Technical direction and architecture' },
            { id: uuidv4(), role: 'STAKEHOLDER', title: 'Business Sponsor', allocation: 20, reason: 'Executive oversight and decisions' },
            { id: uuidv4(), role: 'REVIEWER', title: 'QA Lead', allocation: 40, reason: 'Quality assurance and validation' }
        ];
    }
}

module.exports = AICharterGeneratorService;





