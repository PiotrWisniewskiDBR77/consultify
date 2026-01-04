/**
 * AI Context Builder - Builds 6-layer context for every AI interaction
 * AI Core Layer — Enterprise PMO Brain
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// Mutable dependencies for injection
let all = dbAll;
let get = dbGet;
let _pmoHealthServiceOverride: any = null;
let _aiActionExecutorOverride: any = null;
let _aiSettingsServiceOverride: any = null;
let _knowledgeServiceOverride: any = null;

let _pmoHealthService: any = null;
let _aiActionExecutor: any = null;
let _aiSettingsService: any = null;
let _knowledgeService: any = null;

// Interfaces
export interface ContextOptions {
    focusMode?: 'all' | 'pmo-docs' | 'project-data' | 'research' | 'web';
    currentScreen?: string | null;
    selectedObjectId?: string | null;
    selectedObjectType?: string | null;
}

export interface AIContext {
    platform: any;
    organization: any;
    project: any;
    execution: any;
    knowledge: any;
    external: any;
    pmo: any;
    pendingApprovals: any;
    aiSettings: any;
    focusMode: string;
    builtAt: string;
    contextHash: string;
    currentScreen: string | null;
    selectedObjectId: string | null;
    selectedObjectType: string | null;
}

// Lazy load dependencies to avoid circular dependencies
async function getPMOHealthService() {
    if (_pmoHealthServiceOverride) return _pmoHealthServiceOverride;
    if (!_pmoHealthService) {
        try {
            const mod = (await import('../../services/pmoHealthService.js')) as any;
            _pmoHealthService = mod.default || mod.pmoHealthService || mod;
        } catch (e: unknown) {
            logger.warn('[AIContextBuilder] PMOHealthService not available');
        }
    }
    return _pmoHealthService;
}

async function getAIActionExecutor() {
    if (_aiActionExecutorOverride) return _aiActionExecutorOverride;
    if (!_aiActionExecutor) {
        try {
            // Import from the local JS file (compiled TS)
            const mod = (await import('./aiActionExecutor.js')) as any;
            _aiActionExecutor = mod.default || mod.aiActionExecutor || mod;
        } catch (e: unknown) {
            logger.warn('[AIContextBuilder] AIActionExecutor not available');
        }
    }
    return _aiActionExecutor;
}

async function getAISettingsService() {
    if (_aiSettingsServiceOverride) return _aiSettingsServiceOverride;
    if (!_aiSettingsService) {
        try {
            const mod = (await import('../../services/aiSettingsService.js')) as any;
            _aiSettingsService = mod.default || mod.aiSettingsService || mod;
        } catch (e: unknown) {
            logger.warn('[AIContextBuilder] AISettingsService not available');
        }
    }
    return _aiSettingsService;
}

async function getKnowledgeService() {
    if (_knowledgeServiceOverride) return _knowledgeServiceOverride;
    if (!_knowledgeService) {
        try {
            const mod = (await import('../../services/knowledgeService.js')) as any;
            _knowledgeService = mod.default || mod.knowledgeService || mod;
        } catch (e: unknown) {
            logger.warn('[AIContextBuilder] KnowledgeService not available');
        }
    }
    return _knowledgeService;
}

export const AIContextBuilder = {
    /**
     * Set dependencies for testing
     */
    setDependencies(deps: any) {
        if (deps.db) {
            all = deps.db.all;
            get = deps.db.get;
        }
        if (deps.PMOHealthService) _pmoHealthServiceOverride = deps.PMOHealthService;
        if (deps.AIActionExecutor) _aiActionExecutorOverride = deps.AIActionExecutor;
        if (deps.AISettingsService) _aiSettingsServiceOverride = deps.AISettingsService;
        if (deps.KnowledgeService) _knowledgeServiceOverride = deps.KnowledgeService;
    },

    /**
     * Build complete 6-layer context + PMO health snapshot
     */
    buildContext: async (
        userId: string,
        organizationId: string,
        projectId: string | null = null,
        options: ContextOptions = {},
    ): Promise<AIContext> => {
        const focusMode = options.focusMode || 'all';

        const PMOHealthService = await getPMOHealthService();
        const AISettingsService = await getAISettingsService();

        // Build all context layers
        const platform = await AIContextBuilder._buildPlatformContext(userId, organizationId);
        const organization = await AIContextBuilder._buildOrganizationContext(organizationId);
        const project = projectId ? await AIContextBuilder._buildProjectContext(projectId) : null;
        const execution = await AIContextBuilder._buildExecutionContext(userId, projectId);
        const knowledge = await AIContextBuilder._buildKnowledgeContext(projectId, focusMode);
        const external = await AIContextBuilder._buildExternalContext(organizationId, focusMode);

        // Fetch PMOHealthSnapshot
        const pmo = { healthSnapshot: null };
        if (projectId && PMOHealthService && ['all', 'pmo-docs', 'project-data'].includes(focusMode)) {
            try {
                pmo.healthSnapshot = await PMOHealthService.getHealthSnapshot(projectId);
            } catch (err: unknown) {
                logger.warn('[AIContextBuilder] Failed to get PMO health snapshot:', (err as Error).message);
            }
        }

        // Fetch pending approvals for HITL context
        const pendingApprovals = await AIContextBuilder._buildPendingApprovalsContext(
            userId,
            organizationId,
            projectId,
        );

        // Fetch effective AI settings
        let aiSettings = null;
        if (AISettingsService) {
            try {
                aiSettings = await AISettingsService.getEffectiveSettings(userId, organizationId);
            } catch (err: unknown) {
                logger.warn('[AIContextBuilder] Failed to get AI settings:', (err as Error).message);
            }
        }

        const fullContext = {
            platform,
            organization,
            project,
            execution,
            knowledge,
            external,
            pmo,
            pendingApprovals,
            aiSettings,
        };

        const filteredContext = AIContextBuilder._applyFocusModeFilter(fullContext, focusMode);

        return {
            ...filteredContext,
            focusMode,
            builtAt: new Date().toISOString(),
            contextHash: AIContextBuilder._generateHash(platform, organization, project),
            currentScreen: options.currentScreen || null,
            selectedObjectId: options.selectedObjectId || null,
            selectedObjectType: options.selectedObjectType || null,
        } as AIContext;
    },

    /**
     * Apply focus mode filtering
     */
    _applyFocusModeFilter: (fullContext: any, focusMode: string) => {
        switch (focusMode) {
            case 'pmo-docs':
                return {
                    platform: fullContext.platform,
                    organization: { name: fullContext.organization?.name },
                    project: null,
                    execution: null,
                    knowledge: {
                        ragDisabled: fullContext.knowledge?.ragDisabled,
                        projectDocuments: [],
                        previousDecisions: [],
                        frameworkKnowledge: fullContext.knowledge?.frameworkKnowledge || [],
                        pmoStandards: fullContext.knowledge?.pmoStandards || fullContext.knowledge,
                    },
                    external: null,
                    pmo: fullContext.pmo,
                    pendingApprovals: [],
                };

            case 'project-data':
                return {
                    platform: fullContext.platform,
                    organization: fullContext.organization,
                    project: fullContext.project,
                    execution: fullContext.execution,
                    knowledge: {
                        ragDisabled: fullContext.knowledge?.ragDisabled,
                        projectDocuments: fullContext.knowledge?.projectDocuments || [],
                        previousDecisions: fullContext.knowledge?.previousDecisions || [],
                    },
                    external: null,
                    pmo: fullContext.pmo,
                    pendingApprovals: fullContext.pendingApprovals,
                };

            case 'research':
                return {
                    platform: fullContext.platform,
                    organization: fullContext.organization,
                    project: fullContext.project,
                    execution: fullContext.execution,
                    knowledge: fullContext.knowledge,
                    external: null,
                    pmo: fullContext.pmo,
                    pendingApprovals: fullContext.pendingApprovals,
                };

            case 'web':
                return {
                    platform: { role: fullContext.platform?.role },
                    organization: {
                        name: fullContext.organization?.name,
                        industry: fullContext.organization?.industry,
                    },
                    project: fullContext.project ? { name: fullContext.project?.name } : null,
                    execution: null,
                    knowledge: null,
                    external: {
                        ...fullContext.external,
                        webSearchEnabled: true,
                        webSearchPriority: 'high',
                    },
                    pmo: null,
                    pendingApprovals: [],
                };

            case 'all':
            default:
                return fullContext;
        }
    },

    /**
     * Layer 1: Platform Context
     */
    _buildPlatformContext: async (userId: string, organizationId: string) => {
        const user: any = (await get(`SELECT role FROM users WHERE id = ?`, [userId])) || {};
        const policies: any =
            (await get(`SELECT * FROM ai_policies WHERE organization_id = ?`, [organizationId])) || {};

        let platformRole = 'USER';
        if (user.role === 'SUPERADMIN') platformRole = 'SUPERADMIN';
        else if (user.role === 'ADMIN') platformRole = 'ADMIN';

        return {
            role: platformRole,
            tenantId: organizationId,
            userId,
            policyLevel: policies.policy_level || 'ADVISORY',
            globalPolicies: {
                internetEnabled: policies.internet_enabled === 1,
                maxPolicyLevel: policies.max_policy_level || 'ASSISTED',
                auditRequired: policies.audit_required !== 0,
            },
        };
    },

    /**
     * Layer 2: Organization Context
     */
    _buildOrganizationContext: async (organizationId: string) => {
        const org: any = (await get(`SELECT * FROM organizations WHERE id = ?`, [organizationId])) || {};
        const projects =
            (await all(`SELECT id FROM projects WHERE organization_id = ? AND is_closed = 0`, [organizationId])) || [];
        const memory: any =
            (await get(`SELECT * FROM ai_organization_memory WHERE organization_id = ?`, [organizationId])) || {};

        return {
            organizationId,
            organizationName: org.name || 'Unknown',
            locations: [],
            activeProjectIds: projects.map((p: any) => p.id),
            activeProjectCount: projects.length,
            pmoMaturityLevel: memory.pmo_maturity || 'BASIC',
        };
    },

    /**
     * Layer 3: Project Context
     */
    _buildProjectContext: async (projectId: string) => {
        const project: any = (await get(`SELECT * FROM projects WHERE id = ?`, [projectId])) || {};
        if (!project.id) return null;

        const initiatives: any = (await get(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
                FROM initiatives WHERE project_id = ?`,
            [projectId],
        )) || { total: 0, completed: 0 };

        const PHASE_ORDER = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];
        const phaseNumber = PHASE_ORDER.indexOf(project.current_phase || 'Context') + 1;

        let governanceRules = {};
        try {
            governanceRules = JSON.parse(project.governance_settings || '{}');
        } catch {}

        return {
            projectId,
            projectName: project.name,
            currentPhase: project.current_phase || 'Context',
            phaseNumber,
            governanceRules: {
                requireApprovalForPhaseTransition: (governanceRules as any).requireApprovalForPhaseTransition || false,
                stageGatesEnabled: (governanceRules as any).stageGatesEnabled || false,
                aiPolicyOverride: null,
            },
            sponsorId: project.sponsor_id,
            projectManagerId: project.project_manager_id,
            roadmapStatus: project.status,
            initiativeCount: initiatives.total,
            completedInitiatives: initiatives.completed,
        };
    },

    /**
     * Layer 4: Execution Context
     */
    _buildExecutionContext: async (userId: string, projectId: string | null) => {
        let taskSql = `SELECT id, title, status, due_date FROM tasks WHERE assignee_id = ? AND status NOT IN ('done', 'DONE')`;
        const taskParams = [userId];
        if (projectId) {
            taskSql += ` AND project_id = ?`;
            taskParams.push(projectId);
        }
        taskSql += ` ORDER BY due_date ASC LIMIT 10`;
        const tasks = await all(taskSql, taskParams);

        let initiativeSql = `SELECT id, name, status FROM initiatives WHERE owner_business_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`;
        const initiativeParams = [userId];
        if (projectId) {
            initiativeSql += ` AND project_id = ?`;
            initiativeParams.push(projectId);
        }
        initiativeSql += ` LIMIT 10`;
        const initiatives = await all(initiativeSql, initiativeParams);

        let decisionSql = `SELECT id, title, created_at FROM decisions WHERE decision_owner_id = ? AND status = 'PENDING'`;
        const decisionParams = [userId];
        if (projectId) {
            decisionSql += ` AND project_id = ?`;
            decisionParams.push(projectId);
        }
        decisionSql += ` LIMIT 10`;
        const decisions = await all(decisionSql, decisionParams);

        let blockerSql = `SELECT id, 'TASK' as type, blocked_reason as description FROM tasks 
                   WHERE assignee_id = ? AND status IN ('blocked', 'BLOCKED')`;
        const blockerParams = [userId];
        if (projectId) {
            blockerSql += ` AND project_id = ?`;
            blockerParams.push(projectId);
        }
        const blockers = await all(blockerSql, blockerParams);

        let capacityStatus = 'HEALTHY';
        if (tasks.length > 15) capacityStatus = 'OVERLOADED';
        else if (tasks.length > 8) capacityStatus = 'WARNING';

        return {
            userId,
            userTasks: tasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.due_date })),
            userInitiatives: initiatives.map((i: any) => ({ id: i.id, name: i.name, status: i.status })),
            pendingDecisions: decisions.map((d: any) => ({ id: d.id, title: d.title, createdAt: d.created_at })),
            blockers: blockers.map((b: any) => ({
                id: b.id,
                type: b.type,
                description: b.description || 'No reason provided',
            })),
            capacityStatus,
        };
    },

    /**
     * Layer 5: Knowledge Context
     */
    _buildKnowledgeContext: async (projectId: string | null, _focusMode: string = 'all') => {
        const KnowledgeService = await getKnowledgeService();

        let organizationId = null;
        if (projectId) {
            const project: any = (await get(`SELECT organization_id FROM projects WHERE id = ?`, [projectId])) || {};
            organizationId = project.organization_id;
        }

        let strategicDirections = [];
        if (organizationId && KnowledgeService) {
            try {
                strategicDirections = await KnowledgeService.getActiveStrategies();
            } catch (err: unknown) {
                logger.warn('[AIContextBuilder] Failed to load strategic directions:', (err as Error).message);
            }
        }

        let approvedIdeas = [];
        if (organizationId && KnowledgeService) {
            try {
                approvedIdeas = await KnowledgeService.getApprovedIdeas({});
            } catch (err: unknown) {
                logger.warn('[AIContextBuilder] Failed to load approved ideas:', (err as Error).message);
            }
        }

        if (!projectId) {
            return {
                ragDisabled: false,
                projectDocuments: [],
                strategicDirections: (strategicDirections || []).map((s: any) => ({
                    title: s.title,
                    description: s.description,
                    priority: s.priority,
                    progress_percentage: s.progress_percentage,
                })),
                approvedIdeas: (approvedIdeas || []).slice(0, 5).map((i: any) => ({
                    content: i.content,
                    category: i.category,
                    tags: i.tags || [],
                })),
            };
        }

        const project: any = (await get(`SELECT rag_enabled FROM projects WHERE id = ?`, [projectId])) || {
            rag_enabled: 1,
        };
        if (project.rag_enabled === 0) {
            return { ragDisabled: true, projectDocuments: [], message: 'RAG is disabled for this project' };
        }

        const decisions = await all(
            `SELECT id, title, outcome FROM decisions 
                WHERE project_id = ? AND status != 'PENDING' 
                ORDER BY decided_at DESC LIMIT 10`,
            [projectId],
        );

        const projectInfo: any = (await get(`SELECT phase_history FROM projects WHERE id = ?`, [projectId])) || {};
        let phaseHistory = [];
        try {
            phaseHistory = JSON.parse(projectInfo.phase_history || '[]');
        } catch {}

        let documents = [];
        if (organizationId && KnowledgeService) {
            try {
                documents = await KnowledgeService.getDocuments(organizationId);
            } catch (err: unknown) {}
        }

        return {
            ragDisabled: false,
            projectDocuments: documents.map((d: any) => ({
                id: d.id,
                filename: d.filename,
                category: d.category || null,
                tags: d.tags ? (typeof d.tags === 'string' ? JSON.parse(d.tags) : d.tags) : [],
            })),
            previousDecisions: decisions.map((d: any) => ({ id: d.id, title: d.title, outcome: d.outcome || 'N/A' })),
            phaseHistory: phaseHistory.map((ph: any) => ({ phase: ph.phase, enteredAt: ph.enteredAt })),
            strategicDirections: (strategicDirections || []).map((s: any) => ({
                title: s.title,
                description: s.description,
                priority: s.priority,
                progress_percentage: s.progress_percentage,
                success_metrics: s.success_metrics || [],
            })),
            approvedIdeas: (approvedIdeas || []).slice(0, 5).map((i: any) => ({
                content: i.content,
                category: i.category,
                tags: i.tags || [],
                impact_score: i.impact_score,
            })),
        };
    },

    /**
     * Layer 6: External Context
     */
    _buildExternalContext: async (organizationId: string, _focusMode: string = 'all') => {
        const policies: any =
            (await get(`SELECT internet_enabled FROM ai_policies WHERE organization_id = ?`, [organizationId])) || {};
        return {
            internetEnabled: policies.internet_enabled === 1,
            externalSourcesUsed: [],
        };
    },

    /**
     * Pending Approvals Context for HITL Learning System
     */
    _buildPendingApprovalsContext: async (userId: string, organizationId: string, projectId: string | null) => {
        const AIActionExecutor = await getAIActionExecutor();
        if (!AIActionExecutor) return { count: 0, actions: [], summary: null };

        try {
            const pendingActions = await AIActionExecutor.getPendingActions(userId, projectId, organizationId);
            if (!pendingActions || pendingActions.length === 0) return { count: 0, actions: [], summary: null };

            const actionsWithPatterns = await Promise.all(
                pendingActions.slice(0, 5).map(async (action: any) => {
                    let patternInfo = null;
                    try {
                        patternInfo = await AIActionExecutor.getPatternInfo(
                            userId,
                            action.action_type,
                            action.payload || {},
                        );
                    } catch (e: unknown) {}

                    return {
                        id: action.id,
                        actionType: action.action_type,
                        title: action.draftContent?.title || action.draftContent?.name || action.action_type,
                        riskLevel: action.payload?.riskLevel || 'LOW',
                        createdAt: action.created_at,
                        patternInfo,
                    };
                }),
            );

            const byType: any = {};
            pendingActions.forEach((a: any) => {
                byType[a.action_type] = (byType[a.action_type] || 0) + 1;
            });

            const typeSummary = Object.entries(byType)
                .map(([type, count]) => `${count} ${type.replace(/_/g, ' ').toLowerCase()}`)
                .join(', ');

            return {
                count: pendingActions.length,
                actions: actionsWithPatterns,
                summary: `User has ${pendingActions.length} pending AI actions awaiting approval: ${typeSummary}`,
                oldestCreatedAt: pendingActions[pendingActions.length - 1]?.created_at,
                hasLearnedPatterns: actionsWithPatterns.some((a: any) => a.patternInfo?.decisionCount > 1),
            };
        } catch (error: unknown) {
            logger.error('[AIContextBuilder] Failed to get pending approvals:', error);
            return { count: 0, actions: [], summary: null };
        }
    },

    /**
     * Generate context hash
     */
    _generateHash: (platform: any, organization: any, project: any) => {
        const data = JSON.stringify({
            tenantId: platform?.tenantId,
            organizationId: organization?.organizationId,
            projectId: project?.projectId || null,
            role: platform?.role,
            policyLevel: platform?.policyLevel,
        });
        return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
    },
};

export default AIContextBuilder;
