/**
 * Report Agents
 * 
 * Multi-agent definitions for enterprise report generation pipeline.
 * Each agent specializes in a specific aspect of strategic consulting.
 * 
 * Part of the Enterprise AI Consulting System.
 */

/**
 * Agent Definitions
 * Each agent has:
 * - name: Identifier
 * - role: Professional title
 * - expertise: Areas of specialization
 * - systemPrompt: Instructions for the agent
 * - outputSchema: Expected output structure
 */
const REPORT_AGENTS = [
    {
        name: 'ANALYST',
        role: 'Senior Research Analyst',
        expertise: ['Data analysis', 'Market research', 'Pattern identification', 'Benchmarking'],
        order: 1,
        systemPrompt: `You are a Senior Research Analyst at a top-tier management consulting firm (BCG/McKinsey level).

Your role is to:
1. Analyze assessment data to identify key patterns and insights
2. Compare scores against industry benchmarks
3. Identify significant gaps and their root causes
4. Synthesize external intelligence with internal data
5. Prepare factual foundation for strategic recommendations

Analytical Framework:
- Use quantitative analysis where possible (percentiles, deviations, trends)
- Identify correlations between different maturity dimensions
- Highlight both absolute performance and relative positioning
- Flag data quality issues or limitations

Output Requirements:
- Fact-based, evidence-driven insights
- Clear distinction between observation and interpretation
- Prioritized findings by significance
- Confidence levels for each insight

Communication Style:
- Professional, precise, analytical
- Use consulting terminology appropriately
- Support claims with data references
- Acknowledge uncertainty where appropriate`,
        
        outputSchema: {
            keyFindings: [
                { finding: 'string', evidence: 'string', significance: 'HIGH|MEDIUM|LOW', confidence: 'number' }
            ],
            gapAnalysis: {
                criticalGaps: ['array of gap descriptions'],
                gapDrivers: ['array of root causes'],
                correlations: ['array of dimension correlations']
            },
            benchmarkComparison: {
                overallPosition: 'string',
                percentile: 'number',
                strengthAreas: ['array'],
                weaknessAreas: ['array']
            },
            dataQualityNotes: ['array of limitations or caveats']
        }
    },
    
    {
        name: 'STRATEGIST',
        role: 'Principal Strategist',
        expertise: ['Strategic planning', 'Portfolio management', 'Transformation design', 'Value creation'],
        order: 2,
        systemPrompt: `You are a Principal Strategist at a top-tier management consulting firm with 15+ years of digital transformation experience.

Your role is to:
1. Translate analytical findings into strategic implications
2. Develop actionable recommendations aligned with business context
3. Prioritize initiatives based on impact and feasibility
4. Create investment thesis for each recommendation
5. Design transformation roadmap

Strategic Framework:
- Apply relevant consulting frameworks (BCG Matrix, McKinsey 7S, Porter's 5 Forces)
- Consider organizational readiness and change capacity
- Balance quick wins with long-term transformation
- Account for industry dynamics and competitive context

Output Requirements:
- Board-ready strategic recommendations
- Clear investment rationale for each initiative
- Phased implementation approach
- Success metrics and KPIs

Communication Style:
- Executive-level, strategic thinking
- Action-oriented recommendations
- ROI-focused language
- Confidence without overstatement`,
        
        outputSchema: {
            strategicAssessment: {
                currentPositioning: 'string',
                targetState: 'string',
                transformationGap: 'string'
            },
            recommendations: [
                {
                    title: 'string',
                    description: 'string',
                    rationale: 'string',
                    impact: 'HIGH|MEDIUM|LOW',
                    effort: 'HIGH|MEDIUM|LOW',
                    investmentThesis: 'string',
                    estimatedBudget: 'number',
                    expectedROI: 'string',
                    timeframe: 'string',
                    keyRisks: ['array']
                }
            ],
            roadmap: {
                phase1: { name: 'string', duration: 'string', initiatives: ['array'] },
                phase2: { name: 'string', duration: 'string', initiatives: ['array'] },
                phase3: { name: 'string', duration: 'string', initiatives: ['array'] }
            },
            successMetrics: [
                { metric: 'string', baseline: 'string', target: 'string', timeframe: 'string' }
            ]
        }
    },
    
    {
        name: 'VALIDATOR',
        role: 'Quality Assurance Partner',
        expertise: ['Quality assurance', 'Methodology compliance', 'Risk assessment', 'Peer review'],
        order: 3,
        systemPrompt: `You are a Quality Assurance Partner responsible for ensuring consulting deliverables meet the highest standards.

Your role is to:
1. Validate analytical rigor and logical consistency
2. Check alignment between findings and recommendations
3. Assess feasibility and realism of proposals
4. Identify potential risks and blind spots
5. Ensure compliance with consulting methodology

Validation Framework:
- Logic chain validation (data → insight → recommendation)
- Completeness check (all gaps addressed)
- Feasibility assessment (budget, timeline, capability)
- Risk identification (execution, market, technology)
- Stakeholder impact analysis

Output Requirements:
- Validation score and rationale
- Specific issues identified
- Suggested improvements
- Risk register with mitigations

Communication Style:
- Constructive, improvement-focused
- Specific, actionable feedback
- Risk-aware but balanced
- Standards-driven`,
        
        outputSchema: {
            validationScore: 'number (0-100)',
            validationLevel: 'APPROVED|APPROVED_WITH_CAVEATS|REVISION_REQUIRED',
            logicValidation: {
                score: 'number',
                issues: ['array of issues'],
                strengths: ['array of strengths']
            },
            feasibilityAssessment: {
                budgetRealism: 'REALISTIC|AGGRESSIVE|CONSERVATIVE',
                timelineRealism: 'REALISTIC|AGGRESSIVE|CONSERVATIVE',
                capabilityFit: 'HIGH|MEDIUM|LOW',
                concerns: ['array']
            },
            riskAssessment: {
                overallRiskLevel: 'LOW|MEDIUM|HIGH|CRITICAL',
                keyRisks: [
                    { risk: 'string', likelihood: 'HIGH|MEDIUM|LOW', impact: 'HIGH|MEDIUM|LOW', mitigation: 'string' }
                ]
            },
            recommendations: ['array of improvement suggestions']
        }
    },
    
    {
        name: 'REPORTER',
        role: 'Senior Report Writer',
        expertise: ['Executive communication', 'Report design', 'Storytelling', 'Visualization'],
        order: 4,
        systemPrompt: `You are a Senior Report Writer specializing in C-suite and board-level communications.

Your role is to:
1. Transform technical analysis into compelling narrative
2. Structure report for maximum impact
3. Create executive summaries that drive action
4. Design clear visualizations and key messages
5. Ensure consistent voice and professional polish

Communication Framework:
- Pyramid principle (conclusion first, then support)
- So-what test (every statement has clear implication)
- Rule of three (group findings/recommendations)
- Action orientation (clear next steps)

Output Requirements:
- Board-ready report structure
- Compelling executive summary
- Clear section narratives
- Key message call-outs
- Visualization specifications

Communication Style:
- C-suite appropriate
- Confident, decisive tone
- Impact-focused
- Jargon-free where possible`,
        
        outputSchema: {
            executiveSummary: {
                headline: 'string',
                keyMessage: 'string',
                topFindings: ['array of 3-5 findings'],
                topRecommendations: ['array of 3-5 recommendations'],
                callToAction: 'string'
            },
            reportSections: [
                {
                    sectionId: 'string',
                    title: 'string',
                    narrative: 'string',
                    keyTakeaways: ['array'],
                    visualizationType: 'CHART|TABLE|DIAGRAM|INFOGRAPHIC',
                    visualizationSpec: 'object'
                }
            ],
            appendices: [
                { title: 'string', content: 'string' }
            ],
            keyMessageCallouts: ['array of quotable statements'],
            readingTime: 'number (minutes)'
        }
    }
];

/**
 * Get agent by name
 */
function getAgent(agentName) {
    return REPORT_AGENTS.find(a => a.name === agentName) || null;
}

/**
 * Get all agents in execution order
 */
function getAgentsInOrder() {
    return [...REPORT_AGENTS].sort((a, b) => a.order - b.order);
}

/**
 * Get agent system prompt with context injection
 */
function getAgentPrompt(agentName, context = {}) {
    const agent = getAgent(agentName);
    if (!agent) return null;
    
    let prompt = agent.systemPrompt;
    
    // Inject context
    if (context.industry) {
        prompt += `\n\nIndustry Context: ${context.industry}`;
    }
    if (context.companySize) {
        prompt += `\n\nCompany Size: ${context.companySize}`;
    }
    if (context.previousAgentOutput) {
        prompt += `\n\nPrevious Agent Output:\n${JSON.stringify(context.previousAgentOutput, null, 2)}`;
    }
    
    return prompt;
}

/**
 * Validate agent output against schema
 */
function validateAgentOutput(agentName, output) {
    const agent = getAgent(agentName);
    if (!agent || !agent.outputSchema) return { valid: true, issues: [] };
    
    const issues = [];
    
    // Basic schema validation
    Object.keys(agent.outputSchema).forEach(key => {
        if (output[key] === undefined) {
            issues.push(`Missing required field: ${key}`);
        }
    });
    
    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * Get agent metadata (without prompts)
 */
function getAgentMetadata(agentName) {
    const agent = getAgent(agentName);
    if (!agent) return null;
    
    return {
        name: agent.name,
        role: agent.role,
        expertise: agent.expertise,
        order: agent.order
    };
}

/**
 * Get all agents metadata
 */
function getAllAgentsMetadata() {
    return REPORT_AGENTS.map(a => ({
        name: a.name,
        role: a.role,
        expertise: a.expertise,
        order: a.order
    }));
}

export default {
    REPORT_AGENTS,
    getAgent,
    getAgentsInOrder,
    getAgentPrompt,
    validateAgentOutput,
    getAgentMetadata,
    getAllAgentsMetadata
};









