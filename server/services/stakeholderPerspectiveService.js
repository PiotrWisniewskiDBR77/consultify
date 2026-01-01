/**
 * Stakeholder Perspective Service
 * 
 * Provides AI-generated perspectives tailored to different executive roles:
 * - CEO: Strategic vision, business impact, competitive positioning
 * - CFO: Financial implications, ROI, budget, risk
 * - CTO: Technical feasibility, architecture, innovation
 * - CHRO: People impact, change management, culture
 * - COO: Operational efficiency, process, execution
 */

const { getCoordinator } = require('./ai/agents');
const llmService = require('./ai/llmService');
const { v4: uuidv4 } = require('uuid');

// Stakeholder personas
const PERSONAS = {
    CEO: {
        id: 'ceo',
        title: 'Chief Executive Officer',
        focus: [
            'Strategic alignment with vision',
            'Competitive advantage',
            'Market positioning',
            'Shareholder value',
            'Board communication'
        ],
        concerns: [
            'Strategic risk',
            'Brand impact',
            'Growth trajectory',
            'Leadership alignment'
        ],
        communicationStyle: 'Executive summary, strategic implications, key decisions needed',
        systemPrompt: `You are advising a CEO. Focus on:
- Strategic vision alignment
- Competitive positioning and market impact
- Key business outcomes and value creation
- Leadership decisions required
- Board and stakeholder communication points

Be concise, strategic, and focus on high-level implications.
Avoid technical details unless they have strategic significance.`
    },
    CFO: {
        id: 'cfo',
        title: 'Chief Financial Officer',
        focus: [
            'Return on Investment (ROI)',
            'Total Cost of Ownership (TCO)',
            'Budget allocation',
            'Cash flow impact',
            'Financial risk'
        ],
        concerns: [
            'Budget overruns',
            'Hidden costs',
            'Revenue impact',
            'Audit compliance'
        ],
        communicationStyle: 'Numbers-driven, risk-aware, investment language',
        systemPrompt: `You are advising a CFO. Focus on:
- Financial impact and ROI analysis
- Cost breakdown and budget implications
- Cash flow and working capital effects
- Financial risks and mitigation
- Investment justification and payback period

Use specific numbers where possible.
Highlight financial risks and opportunities.
Consider audit and compliance implications.`
    },
    CTO: {
        id: 'cto',
        title: 'Chief Technology Officer',
        focus: [
            'Technical architecture',
            'Technology selection',
            'Integration complexity',
            'Scalability',
            'Technical debt'
        ],
        concerns: [
            'Technology risk',
            'Vendor lock-in',
            'Security vulnerabilities',
            'Technical talent'
        ],
        communicationStyle: 'Technical depth, architectural considerations, innovation opportunities',
        systemPrompt: `You are advising a CTO. Focus on:
- Technical architecture and design decisions
- Technology selection and evaluation criteria
- Integration requirements and complexity
- Security and compliance considerations
- Scalability and performance implications
- Technical team requirements and skills

Be technically precise.
Consider long-term maintainability.
Highlight innovation opportunities.`
    },
    CHRO: {
        id: 'chro',
        title: 'Chief Human Resources Officer',
        focus: [
            'People impact',
            'Change management',
            'Culture transformation',
            'Talent development',
            'Employee experience'
        ],
        concerns: [
            'Resistance to change',
            'Skill gaps',
            'Talent retention',
            'Organizational culture'
        ],
        communicationStyle: 'People-centric, empathetic, change-aware',
        systemPrompt: `You are advising a CHRO. Focus on:
- People impact and workforce implications
- Change management requirements
- Training and capability building needs
- Culture and engagement considerations
- Communication strategy for employees
- Talent attraction and retention implications

Be empathetic to human concerns.
Consider adoption and resistance factors.
Highlight skill development opportunities.`
    },
    COO: {
        id: 'coo',
        title: 'Chief Operating Officer',
        focus: [
            'Operational efficiency',
            'Process optimization',
            'Service delivery',
            'Quality management',
            'Resource utilization'
        ],
        concerns: [
            'Operational disruption',
            'Process gaps',
            'Service continuity',
            'Resource constraints'
        ],
        communicationStyle: 'Process-focused, efficiency-driven, execution-oriented',
        systemPrompt: `You are advising a COO. Focus on:
- Operational impact and process changes
- Efficiency gains and productivity improvements
- Service delivery implications
- Resource requirements and constraints
- Implementation timeline and phases
- Business continuity considerations

Be practical and execution-focused.
Consider day-to-day operational realities.
Highlight efficiency opportunities.`
    }
};

const StakeholderPerspectiveService = {
    PERSONAS,

    /**
     * Generate perspective for a specific stakeholder
     * @param {string} stakeholderId - CEO, CFO, CTO, CHRO, COO
     * @param {string} topic - Topic to analyze
     * @param {object} context - Project/organizational context
     */
    generatePerspective: async (stakeholderId, topic, context) => {
        const persona = PERSONAS[stakeholderId.toUpperCase()];
        if (!persona) {
            throw new Error(`Unknown stakeholder: ${stakeholderId}`);
        }

        const prompt = StakeholderPerspectiveService.buildPrompt(persona, topic, context);

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 1500,
                temperature: 0.7
            });

            return {
                stakeholderId: persona.id,
                stakeholderTitle: persona.title,
                topic,
                perspective: response.text || response,
                focusAreas: persona.focus,
                keyQuestions: StakeholderPerspectiveService.extractQuestions(response.text || response),
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(`[StakeholderPerspective] Error generating ${stakeholderId} perspective:`, error);
            return {
                stakeholderId: persona.id,
                stakeholderTitle: persona.title,
                topic,
                perspective: `Unable to generate ${persona.title} perspective at this time.`,
                error: true
            };
        }
    },

    /**
     * Generate all stakeholder perspectives for a topic
     */
    generateAllPerspectives: async (topic, context) => {
        const perspectives = {};

        const stakeholders = Object.keys(PERSONAS);
        const promises = stakeholders.map(async (id) => {
            perspectives[id] = await StakeholderPerspectiveService.generatePerspective(id, topic, context);
        });

        await Promise.all(promises);

        return {
            topic,
            perspectives,
            synthesis: await StakeholderPerspectiveService.synthesizePerspectives(topic, perspectives),
            generatedAt: new Date().toISOString()
        };
    },

    /**
     * Build prompt for stakeholder perspective
     */
    buildPrompt: (persona, topic, context) => {
        let contextInfo = '';

        if (context.project) {
            contextInfo += `\nPROJECT: ${context.project.name}
Status: ${context.project.status || 'Active'}
Phase: ${context.project.phase || 'Unknown'}
Budget: ${context.project.budget ? '$' + context.project.budget : 'Not specified'}`;
        }

        if (context.organization) {
            contextInfo += `\nORGANIZATION: ${context.organization.name}
Industry: ${context.organization.industry || 'Unknown'}
Size: ${context.organization.employeeCount || 'Unknown'} employees`;
        }

        if (context.initiatives?.length) {
            contextInfo += `\nACTIVE INITIATIVES: ${context.initiatives.length}`;
        }

        return `${persona.systemPrompt}

CONTEXT:${contextInfo}

TOPIC FOR ANALYSIS: ${topic}

KEY FOCUS AREAS for ${persona.title}:
${persona.focus.map(f => `- ${f}`).join('\n')}

TYPICAL CONCERNS:
${persona.concerns.map(c => `- ${c}`).join('\n')}

Provide your analysis from the ${persona.title}'s perspective. Include:
1. Executive Summary (2-3 sentences)
2. Key Implications for your domain
3. Specific Questions you would ask
4. Recommendations for the leadership team
5. Risk factors relevant to your role

Be specific to this topic and context. Use ${persona.communicationStyle}.`;
    },

    /**
     * Extract key questions from perspective
     */
    extractQuestions: (text) => {
        const questions = [];
        const lines = text.split('\n');

        for (const line of lines) {
            if (line.includes('?')) {
                const trimmed = line.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
                if (trimmed.length > 10 && trimmed.length < 200) {
                    questions.push(trimmed);
                }
            }
        }

        return questions.slice(0, 5);
    },

    /**
     * Synthesize multiple perspectives into unified view
     */
    synthesizePerspectives: async (topic, perspectives) => {
        const summaries = Object.entries(perspectives)
            .filter(([_, p]) => !p.error)
            .map(([id, p]) => `${p.stakeholderTitle}: ${(p.perspective || '').substring(0, 300)}...`)
            .join('\n\n');

        const synthesisPrompt = `You are synthesizing multiple executive perspectives on: "${topic}"

PERSPECTIVES:
${summaries}

Provide a unified synthesis that:
1. Identifies points of alignment
2. Highlights areas of tension or different priorities
3. Recommends how to balance competing concerns
4. Suggests key decisions for leadership alignment

Be balanced and acknowledge all viewpoints.`;

        try {
            const response = await llmService.generateResponse({
                prompt: synthesisPrompt,
                maxTokens: 800,
                temperature: 0.6
            });

            return {
                synthesis: response.text || response,
                alignmentPoints: [],
                tensionAreas: [],
                recommendations: []
            };

        } catch (error) {
            return {
                synthesis: 'Unable to synthesize perspectives.',
                error: true
            };
        }
    },

    /**
     * Get perspective for project initiative
     */
    getInitiativePerspective: async (initiative, stakeholderId, context) => {
        const topic = `Initiative: ${initiative.name}
Description: ${initiative.description || 'Not provided'}
Status: ${initiative.status}
Budget: ${initiative.estimatedCost ? '$' + initiative.estimatedCost : 'TBD'}
Expected ROI: ${initiative.expectedROI || 'Not calculated'}%`;

        return StakeholderPerspectiveService.generatePerspective(stakeholderId, topic, context);
    },

    /**
     * Format perspective for presentation
     */
    formatForPresentation: (perspective) => {
        const persona = PERSONAS[perspective.stakeholderId.toUpperCase()];

        return {
            title: `${persona.title} Perspective`,
            subtitle: perspective.topic,
            icon: StakeholderPerspectiveService.getStakeholderIcon(perspective.stakeholderId),
            content: perspective.perspective,
            questions: perspective.keyQuestions || [],
            focusAreas: persona.focus
        };
    },

    /**
     * Get icon for stakeholder
     */
    getStakeholderIcon: (stakeholderId) => {
        const icons = {
            ceo: 'crown',
            cfo: 'dollar-sign',
            cto: 'cpu',
            chro: 'users',
            coo: 'settings'
        };
        return icons[stakeholderId.toLowerCase()] || 'user';
    }
};

module.exports = StakeholderPerspectiveService;


