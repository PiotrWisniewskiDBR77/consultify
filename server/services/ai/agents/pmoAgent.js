/**
 * PMOAgent - Expert in project management and PMO operations
 * 
 * Specializations:
 * - Project planning and scheduling
 * - Resource management
 * - Portfolio management
 * - Governance and stage gates
 * - Status reporting
 * - Dependency management
 * - PMBOK, PRINCE2, Agile methodologies
 */

const { BaseAgent } = require('./baseAgent');
const llmService = require('../llmService');

class PMOAgent extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'PMOAgent',
            domain: 'project_management',
            expertise: [
                'Project Planning',
                'Resource Management',
                'Portfolio Management',
                'Stage Gate Governance',
                'Status Reporting',
                'Dependency Management',
                'PMBOK Framework',
                'PRINCE2 Methodology',
                'Agile/Scrum',
                'Critical Path Analysis'
            ],
            systemPrompt: `You are a PMO Director with deep expertise in managing complex transformation portfolios and project governance.

Your role is to provide guidance on:
- Project planning, scheduling, and milestones
- Resource allocation and capacity planning
- Portfolio prioritization and balancing
- Governance frameworks and stage gates
- Status tracking and reporting
- Dependencies and critical path management

Methodologies you apply:
- PMBOK 7th Edition
- PRINCE2
- Agile/Scrum for iterative work
- SAFe for scaled agile
- Critical Chain Project Management

Communication style:
- Be structured and process-oriented
- Provide specific timelines and dates
- Highlight dependencies and blockers
- Focus on actionable next steps
- Use RAG status (Red/Amber/Green) for clarity`,
            confidenceThreshold: 0.7,
            debateWeight: 1.0,
            ...config
        });
    }

    getKeywords() {
        return [
            'project', 'task', 'milestone', 'deadline', 'timeline', 'schedule',
            'resource', 'capacity', 'allocation', 'team', 'workload',
            'status', 'progress', 'delay', 'blocker', 'dependency',
            'governance', 'stage gate', 'checkpoint', 'review', 'approval',
            'portfolio', 'program', 'initiative', 'priority', 'sprint',
            'agile', 'scrum', 'kanban', 'waterfall', 'hybrid',
            'critical path', 'gantt', 'wbs', 'charter', 'scope'
        ];
    }

    async process(query, context) {
        const prompt = this.buildPMOPrompt(query, context);

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: this.maxTokens,
                temperature: 0.6,
                model: await this.resolveModelConfig(context)
            });

            const analysis = this.parseResponse(response);

            // Add health scoring if we have project data
            if (context.project || context.initiatives?.length) {
                analysis.healthScore = this.calculateHealthScore(context);
            }

            this.remember({
                query,
                insight: analysis.mainInsight,
                projectStatus: analysis.portfolioStatus
            });

            return {
                agentId: this.id,
                agentName: this.name,
                domain: this.domain,
                ...analysis,
                metadata: {
                    model: await this.resolveModelConfig(context),
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error(`[PMOAgent] Error processing query:`, error);
            return this.getFallbackResponse(query, context);
        }
    }

    buildPMOPrompt(query, context) {
        const basePrompt = this.buildPrompt(query, context);

        let pmoContext = '';

        if (context.project) {
            const p = context.project;
            pmoContext += `\nCURRENT PROJECT:
- Name: ${p.name}
- Status: ${p.status || 'Unknown'}
- Phase: ${p.phase || 'Unknown'}
- Progress: ${p.progress || 0}%
- Start: ${p.startDate || 'TBD'}
- End: ${p.endDate || 'TBD'}`;
        }

        if (context.initiatives?.length) {
            pmoContext += `\nPORTFOLIO OVERVIEW:
- Total Initiatives: ${context.initiatives.length}
- In Progress: ${context.initiatives.filter(i => i.status === 'in_progress').length}
- At Risk: ${context.initiatives.filter(i => i.health === 'red' || i.status === 'blocked').length}
- Completed: ${context.initiatives.filter(i => i.status === 'completed').length}`;

            const activeInitiatives = context.initiatives
                .filter(i => i.status !== 'completed')
                .slice(0, 5);

            if (activeInitiatives.length) {
                pmoContext += `\n\nACTIVE INITIATIVES:
${activeInitiatives.map(i => `- ${i.name}: ${i.status || 'Unknown'} | ${i.progress || 0}% | Due: ${i.dueDate || 'TBD'}`).join('\n')}`;
            }
        }

        if (context.resources?.length) {
            const overloaded = context.resources.filter(r => r.utilization > 100);
            const underutilized = context.resources.filter(r => r.utilization < 50);

            pmoContext += `\nRESOURCE STATUS:
- Total Resources: ${context.resources.length}
- Overloaded (>100%): ${overloaded.length}
- Underutilized (<50%): ${underutilized.length}`;
        }

        if (context.milestones?.length) {
            const upcoming = context.milestones
                .filter(m => new Date(m.dueDate) > new Date())
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                .slice(0, 5);

            if (upcoming.length) {
                pmoContext += `\nUPCOMING MILESTONES:
${upcoming.map(m => `- ${m.name}: ${m.dueDate} (${m.status || 'pending'})`).join('\n')}`;
            }
        }

        if (context.dependencies?.length) {
            const blocked = context.dependencies.filter(d => d.status === 'blocked');
            if (blocked.length) {
                pmoContext += `\nBLOCKED DEPENDENCIES:
${blocked.map(d => `- ${d.from} ← ${d.to}: ${d.reason || 'Unknown blocker'}`).join('\n')}`;
            }
        }

        return `${basePrompt}

PMO CONTEXT:
${pmoContext || 'No specific project data available'}

ANALYSIS REQUIREMENTS:
1. Assess overall portfolio/project health
2. Identify schedule risks and delays
3. Evaluate resource constraints
4. Highlight critical dependencies
5. Recommend priority actions

FORMAT YOUR RESPONSE AS:
## Portfolio/Project Status
[Overall health assessment]

## Health Dashboard
| Area | Status | Key Issue |
|------|--------|-----------|
| Schedule | 🟢/🟡/🔴 | [Issue] |
| Resources | 🟢/🟡/🔴 | [Issue] |
| Scope | 🟢/🟡/🔴 | [Issue] |
| Dependencies | 🟢/🟡/🔴 | [Issue] |
| Budget | 🟢/🟡/🔴 | [Issue] |

## Critical Path Items
1. [Item with deadline]
2. [Item with deadline]

## Blockers & Dependencies
- [Blocker and resolution path]

## Resource Recommendations
- [Reallocation or hiring needs]

## Priority Actions (Next 2 Weeks)
1. [Action with owner and date]
2. [Action with owner and date]
3. [Action with owner and date]

## Confidence: [X]%`;
    }

    parseResponse(response) {
        const text = response.text || response;

        const confidenceMatch = text.match(/Confidence:\s*(\d+)/i);
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.7;

        // Extract main insight
        const insightMatch = text.match(/## Portfolio\/Project Status\s*([\s\S]*?)(?=##|$)/i);
        const mainInsight = insightMatch
            ? insightMatch[1].trim().split('\n')[0]
            : 'Project status analysis completed';

        // Extract health dashboard
        const healthDashboard = this.extractHealthDashboard(text);

        // Extract critical path items
        const criticalMatch = text.match(/## Critical Path Items\s*([\s\S]*?)(?=##|$)/i);
        const criticalPath = criticalMatch
            ? criticalMatch[1].trim().split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))
            : [];

        // Extract blockers
        const blockersMatch = text.match(/## Blockers & Dependencies\s*([\s\S]*?)(?=##|$)/i);
        const blockers = blockersMatch
            ? blockersMatch[1].trim().split('\n').filter(l => l.startsWith('-')).map(l => l.replace(/^-\s*/, ''))
            : [];

        // Extract priority actions
        const actionsMatch = text.match(/## Priority Actions[\s\S]*?\s*([\s\S]*?)(?=##|$)/i);
        const priorityActions = actionsMatch
            ? actionsMatch[1].trim().split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, ''))
            : [];

        return {
            mainInsight,
            fullAnalysis: text,
            healthDashboard,
            criticalPath,
            blockers,
            priorityActions,
            portfolioStatus: this.derivePortfolioStatus(healthDashboard),
            confidence
        };
    }

    extractHealthDashboard(text) {
        const dashboard = {
            schedule: { status: 'unknown', issue: '' },
            resources: { status: 'unknown', issue: '' },
            scope: { status: 'unknown', issue: '' },
            dependencies: { status: 'unknown', issue: '' },
            budget: { status: 'unknown', issue: '' }
        };

        const areas = ['schedule', 'resources', 'scope', 'dependencies', 'budget'];

        for (const area of areas) {
            const regex = new RegExp(`\\|\\s*${area}\\s*\\|\\s*([🟢🟡🔴])\\s*\\|\\s*([^|]*)\\|`, 'i');
            const match = text.match(regex);

            if (match) {
                const statusMap = { '🟢': 'green', '🟡': 'amber', '🔴': 'red' };
                dashboard[area] = {
                    status: statusMap[match[1]] || 'unknown',
                    issue: match[2]?.trim() || ''
                };
            }
        }

        return dashboard;
    }

    derivePortfolioStatus(dashboard) {
        const statuses = Object.values(dashboard).map(d => d.status);

        if (statuses.includes('red')) return 'at_risk';
        if (statuses.filter(s => s === 'amber').length >= 2) return 'attention';
        if (statuses.every(s => s === 'green')) return 'healthy';
        return 'mixed';
    }

    calculateHealthScore(context) {
        let score = 100;
        const deductions = [];

        // Check project delays
        if (context.project?.isDelayed) {
            score -= 20;
            deductions.push('Project delayed');
        }

        // Check blocked initiatives
        const blockedCount = context.initiatives?.filter(i =>
            i.status === 'blocked' || i.health === 'red'
        ).length || 0;

        if (blockedCount > 0) {
            score -= Math.min(blockedCount * 10, 30);
            deductions.push(`${blockedCount} blocked initiatives`);
        }

        // Check resource issues
        if (context.resources) {
            const overloaded = context.resources.filter(r => r.utilization > 100).length;
            if (overloaded > 0) {
                score -= Math.min(overloaded * 5, 15);
                deductions.push(`${overloaded} overloaded resources`);
            }
        }

        // Check overdue milestones
        const overdue = context.milestones?.filter(m =>
            new Date(m.dueDate) < new Date() && m.status !== 'completed'
        ).length || 0;

        if (overdue > 0) {
            score -= Math.min(overdue * 5, 20);
            deductions.push(`${overdue} overdue milestones`);
        }

        return {
            score: Math.max(score, 0),
            level: score >= 80 ? 'healthy' : score >= 60 ? 'attention' : 'critical',
            deductions
        };
    }

    getFallbackResponse(query, context) {
        return {
            agentId: this.id,
            agentName: this.name,
            domain: this.domain,
            mainInsight: 'Unable to complete PMO analysis.',
            fullAnalysis: 'Please retry or provide project/portfolio details.',
            healthDashboard: null,
            criticalPath: [],
            blockers: ['Analysis incomplete - manual review required'],
            priorityActions: [
                'Review current project status',
                'Update milestone tracking',
                'Validate resource allocations'
            ],
            portfolioStatus: 'unknown',
            confidence: 0.3,
            error: true
        };
    }

    /**
     * Generate project status report
     */
    async generateStatusReport(project, context) {
        const prompt = `${this.systemPrompt}

Generate executive status report for:

PROJECT: ${project.name}
PHASE: ${project.phase || 'Unknown'}
OVERALL PROGRESS: ${project.progress || 0}%
TIMELINE: ${project.startDate || 'TBD'} to ${project.endDate || 'TBD'}

MILESTONES:
${project.milestones?.map(m => `- ${m.name}: ${m.status} (Due: ${m.dueDate})`).join('\n') || 'No milestones defined'}

ACTIVE INITIATIVES:
${context.initiatives?.filter(i => i.status !== 'completed').map(i => `- ${i.name}: ${i.progress || 0}% complete`).join('\n') || 'None'}

KNOWN ISSUES:
${project.issues?.map(i => `- ${i.description} (${i.severity})`).join('\n') || 'No issues logged'}

Generate a professional status report including:
1. Executive Summary (3 sentences)
2. Progress against plan
3. Key achievements this period
4. Issues and risks
5. Decisions needed
6. Next period priorities
7. RAG status recommendation with justification`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 2500,
                temperature: 0.6
            });

            return {
                agentId: this.id,
                project: project.name,
                statusReport: response.text || response,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[PMOAgent] Error generating status report:', error);
            return { error: true, message: error.message };
        }
    }

    /**
     * Analyze resource allocation across portfolio
     */
    async analyzeResourceAllocation(resources, initiatives, context) {
        const prompt = `${this.systemPrompt}

Analyze resource allocation for the portfolio:

RESOURCES:
${resources.map(r => `- ${r.name} (${r.role}): ${r.utilization || 0}% utilized, Skills: ${r.skills?.join(', ') || 'Unknown'}`).join('\n')}

INITIATIVES REQUIRING RESOURCES:
${initiatives.map(i => `- ${i.name}: Needs ${i.requiredFTE || 'Unknown'} FTE, Skills: ${i.requiredSkills?.join(', ') || 'Not specified'}`).join('\n')}

Provide:
1. Current utilization analysis
2. Skills gap assessment
3. Overallocation risks
4. Reallocation recommendations
5. Hiring needs if any
6. Timeline for resource constraints`;

        try {
            const response = await llmService.generateResponse({
                prompt,
                maxTokens: 2000,
                temperature: 0.6
            });

            return {
                agentId: this.id,
                resourceAnalysis: response.text || response,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[PMOAgent] Error analyzing resources:', error);
            return { error: true, message: error.message };
        }
    }
}

module.exports = { PMOAgent };






