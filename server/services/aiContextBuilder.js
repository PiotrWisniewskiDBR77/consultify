// AI Context Builder - Builds 6-layer context for every AI interaction
// AI Core Layer — Enterprise PMO Brain
// Enhanced with HITL pending approvals context

import { getDatabase } from '../src/database/index.js';
const db = getDatabase();
import crypto from 'crypto';

// Lazy loading dependencies to avoid circular dependencies in ESM
let _pmoHealthService = null;
async function getPMOHealthService() {
    if (!_pmoHealthService) {
        try {
            const mod = await import('./pmoHealthService.js');
            _pmoHealthService = mod.default || mod.pmoHealthService || mod;
        } catch (e) {
            console.warn('[AIContextBuilder] PMOHealthService not available, pmo.healthSnapshot will be null');
        }
    }
    return _pmoHealthService;
}

let _aiActionExecutor = null;
async function getAIActionExecutor() {
    if (!_aiActionExecutor) {
        try {
            const mod = await import('./aiActionExecutor.js');
            _aiActionExecutor = mod.default || mod.aiActionExecutor || mod;
        } catch (e) {
            console.warn('[AIContextBuilder] AIActionExecutor not available, pendingApprovals will be empty');
        }
    }
    return _aiActionExecutor;
}

let _aiSettingsService = null;
async function getAISettingsService() {
    if (!_aiSettingsService) {
        try {
            const mod = await import('./aiSettingsService.js');
            _aiSettingsService = mod.default || mod.aiSettingsService || mod;
        } catch (e) {
            console.warn('[AIContextBuilder] AISettingsService not available, effectiveSettings will be null');
        }
    }
    return _aiSettingsService;
}

// Dependency injection container (for deterministic unit tests)
const deps = {
    db,
    get PMOHealthService() { return _pmoHealthService; },
    get AIActionExecutor() { return _aiActionExecutor; },
    get AISettingsService() { return _aiSettingsService; }
};

export const AIContextBuilder = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        if (newDeps.db) deps.db = newDeps.db;
        if (newDeps.PMOHealthService) _pmoHealthService = newDeps.PMOHealthService;
        if (newDeps.AIActionExecutor) _aiActionExecutor = newDeps.AIActionExecutor;
        if (newDeps.AISettingsService) _aiSettingsService = newDeps.AISettingsService;
    },
    /**
     * Build complete 6-layer context + PMO health snapshot
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @param {string|null} projectId - Project ID (optional)
     * @param {Object} options - Additional options
     * @param {string} options.focusMode - Focus mode for context filtering ('all' | 'pmo-docs' | 'project-data' | 'research' | 'web')
     * @param {string} options.currentScreen - Current screen/view
     * @param {string} options.selectedObjectId - Selected object ID
     * @param {string} options.selectedObjectType - Selected object type
     */
    buildContext: async (userId, organizationId, projectId = null, options = {}) => {
        const focusMode = options.focusMode || 'all';

        // Ensure lazy dependencies are loaded
        const PMOHealthService = await getPMOHealthService();
        const AISettingsService = await getAISettingsService();

        // Build all context layers (some may be filtered based on focusMode)
        const platform = await AIContextBuilder._buildPlatformContext(userId, organizationId);
        const organization = await AIContextBuilder._buildOrganizationContext(organizationId);
        const project = projectId ? await AIContextBuilder._buildProjectContext(projectId) : null;
        const execution = await AIContextBuilder._buildExecutionContext(userId, projectId);
        const knowledge = await AIContextBuilder._buildKnowledgeContext(projectId, focusMode);
        const external = await AIContextBuilder._buildExternalContext(organizationId, focusMode);

        // Step A: Fetch PMOHealthSnapshot for AI context (same data as UI sees)
        // Only include for 'all', 'pmo-docs', or 'project-data' focus modes
        let pmo = { healthSnapshot: null };
        if (projectId && PMOHealthService && ['all', 'pmo-docs', 'project-data'].includes(focusMode)) {
            try {
                pmo.healthSnapshot = await PMOHealthService.getHealthSnapshot(projectId);
            } catch (err) {
                console.warn('[AIContextBuilder] Failed to get PMO health snapshot:', err.message);
            }
        }

        // Step B: Fetch pending approvals for HITL context
        const pendingApprovals = await AIContextBuilder._buildPendingApprovalsContext(userId, organizationId, projectId);

        // Step C: Fetch effective AI settings for the user
        let aiSettings = null;
        if (AISettingsService) {
            try {
                aiSettings = await AISettingsService.getEffectiveSettings(userId, organizationId);
            } catch (err) {
                console.warn('[AIContextBuilder] Failed to get AI settings:', err.message);
            }
        }

        // Apply focus mode filtering to context
        const filteredContext = AIContextBuilder._applyFocusModeFilter({
            platform,
            organization,
            project,
            execution,
            knowledge,
            external,
            pmo,
            pendingApprovals,
            aiSettings
        }, focusMode);

        const context = {
            ...filteredContext,
            focusMode, // Include focusMode in context for transparency
            builtAt: new Date().toISOString(),
            contextHash: AIContextBuilder._generateHash(platform, organization, project),
            currentScreen: options.currentScreen || null,
            selectedObjectId: options.selectedObjectId || null,
            selectedObjectType: options.selectedObjectType || null
        };

        return context;
    },

    /**
     * Apply focus mode filtering to reduce context to relevant sources only
     * @param {Object} fullContext - Full context with all layers
     * @param {string} focusMode - Focus mode
     * @returns {Object} Filtered context
     */
    _applyFocusModeFilter: (fullContext, focusMode) => {
        switch (focusMode) {
            case 'pmo-docs':
                // Only PMO documentation and standards
                return {
                    platform: fullContext.platform,
                    organization: {
                        name: fullContext.organization?.name,
                        // Keep minimal org info
                    },
                    project: null, // Exclude project-specific data
                    execution: null, // Exclude execution data
                    knowledge: {
                        // Only include framework/standards knowledge
                        ragDisabled: fullContext.knowledge?.ragDisabled,
                        projectDocuments: [], // No project docs
                        previousDecisions: [],
                        frameworkKnowledge: fullContext.knowledge?.frameworkKnowledge || [],
                        pmoStandards: fullContext.knowledge?.pmoStandards || fullContext.knowledge
                    },
                    external: null, // No external data
                    pmo: fullContext.pmo, // Include PMO health data
                    pendingApprovals: []
                };

            case 'project-data':
                // Only current project context
                return {
                    platform: fullContext.platform,
                    organization: fullContext.organization,
                    project: fullContext.project,
                    execution: fullContext.execution,
                    knowledge: {
                        ragDisabled: fullContext.knowledge?.ragDisabled,
                        projectDocuments: fullContext.knowledge?.projectDocuments || [],
                        previousDecisions: fullContext.knowledge?.previousDecisions || [],
                        // Exclude framework knowledge for pure project focus
                    },
                    external: null, // No external data
                    pmo: fullContext.pmo,
                    pendingApprovals: fullContext.pendingApprovals
                };

            case 'research':
                // Deep analysis mode - include all internal sources
                return {
                    platform: fullContext.platform,
                    organization: fullContext.organization,
                    project: fullContext.project,
                    execution: fullContext.execution,
                    knowledge: fullContext.knowledge, // Full knowledge base
                    external: null, // No web search
                    pmo: fullContext.pmo,
                    pendingApprovals: fullContext.pendingApprovals
                };

            case 'web':
                // Web search focus - minimal internal context
                return {
                    platform: {
                        role: fullContext.platform?.role,
                        // Minimal platform info for web search context
                    },
                    organization: {
                        name: fullContext.organization?.name,
                        industry: fullContext.organization?.industry,
                        // Minimal org info for web search context
                    },
                    project: fullContext.project ? {
                        name: fullContext.project?.name,
                        // Minimal project info
                    } : null,
                    execution: null,
                    knowledge: null, // Skip internal knowledge
                    external: {
                        ...fullContext.external,
                        webSearchEnabled: true,
                        webSearchPriority: 'high'
                    },
                    pmo: null,
                    pendingApprovals: []
                };

            case 'all':
            default:
                // Full context - no filtering
                return fullContext;
        }
    },

    /**
     * Layer 1: Platform Context
     */
    _buildPlatformContext: async (userId, organizationId) => {
        // Get user role
        const user = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT role FROM users WHERE id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        // Get AI policies
        const policies = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_policies WHERE organization_id = ?`, [organizationId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        // Map role
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
                auditRequired: policies.audit_required !== 0
            }
        };
    },

    /**
     * Layer 2: Organization Context
     */
    _buildOrganizationContext: async (organizationId) => {
        const org = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM organizations WHERE id = ?`, [organizationId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        const projects = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT id FROM projects WHERE organization_id = ? AND is_closed = 0`,
                [organizationId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        const memory = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_organization_memory WHERE organization_id = ?`,
                [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
        });

        return {
            organizationId,
            organizationName: org.name || 'Unknown',
            locations: [], // Could be expanded
            activeProjectIds: projects.map(p => p.id),
            activeProjectCount: projects.length,
            pmoMaturityLevel: memory.pmo_maturity || 'BASIC'
        };
    },

    /**
     * Layer 3: Project Context
     */
    _buildProjectContext: async (projectId) => {
        const project = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        if (!project) return null;

        const initiatives = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
                    FROM initiatives WHERE project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || { total: 0, completed: 0 });
                });
        });

        const PHASE_ORDER = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];
        const phaseNumber = PHASE_ORDER.indexOf(project.current_phase || 'Context') + 1;

        let governanceRules = {};
        try {
            governanceRules = JSON.parse(project.governance_settings || '{}');
        } catch { }

        return {
            projectId,
            projectName: project.name,
            currentPhase: project.current_phase || 'Context',
            phaseNumber,
            governanceRules: {
                requireApprovalForPhaseTransition: governanceRules.requireApprovalForPhaseTransition || false,
                stageGatesEnabled: governanceRules.stageGatesEnabled || false,
                aiPolicyOverride: null
            },
            sponsorId: project.sponsor_id,
            projectManagerId: project.project_manager_id,
            roadmapStatus: project.status,
            initiativeCount: initiatives.total,
            completedInitiatives: initiatives.completed
        };
    },

    /**
     * Layer 4: Execution Context
     */
    _buildExecutionContext: async (userId, projectId) => {
        // User tasks
        const tasks = await new Promise((resolve, reject) => {
            let sql = `SELECT id, title, status, due_date FROM tasks WHERE assignee_id = ? AND status NOT IN ('done', 'DONE')`;
            const params = [userId];
            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }
            sql += ` ORDER BY due_date ASC LIMIT 10`;
            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // User initiatives
        const initiatives = await new Promise((resolve, reject) => {
            let sql = `SELECT id, name, status FROM initiatives WHERE owner_business_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`;
            const params = [userId];
            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }
            sql += ` LIMIT 10`;
            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Pending decisions
        const decisions = await new Promise((resolve, reject) => {
            let sql = `SELECT id, title, created_at FROM decisions WHERE decision_owner_id = ? AND status = 'PENDING'`;
            const params = [userId];
            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }
            sql += ` LIMIT 10`;
            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Blockers
        const blockers = await new Promise((resolve, reject) => {
            let sql = `SELECT id, 'TASK' as type, blocked_reason as description FROM tasks 
                       WHERE assignee_id = ? AND status IN ('blocked', 'BLOCKED')`;
            const params = [userId];
            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }
            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        // Capacity status
        let capacityStatus = 'HEALTHY';
        if (tasks.length > 15) capacityStatus = 'OVERLOADED';
        else if (tasks.length > 8) capacityStatus = 'WARNING';

        return {
            userId,
            userTasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, dueDate: t.due_date })),
            userInitiatives: initiatives.map(i => ({ id: i.id, name: i.name, status: i.status })),
            pendingDecisions: decisions.map(d => ({ id: d.id, title: d.title, createdAt: d.created_at })),
            blockers: blockers.map(b => ({ id: b.id, type: b.type, description: b.description || 'No reason provided' })),
            capacityStatus
        };
    },

    /**
     * Layer 5: Knowledge Context
     * @param {string|null} projectId - Project ID
     * @param {string} focusMode - Focus mode for potential pre-filtering
     */
    _buildKnowledgeContext: async (projectId, focusMode = 'all') => {
        const { default: KnowledgeService } = await import('./knowledgeService.js');

        // Get organization ID from project
        let organizationId = null;
        if (projectId) {
            const project = await new Promise((resolve) => {
                deps.db.get(`SELECT organization_id FROM projects WHERE id = ?`, [projectId], (err, row) => {
                    resolve(row || {});
                });
            });
            organizationId = project.organization_id;
        }

        // Get global strategic directions (always available at org level)
        let strategicDirections = [];
        if (organizationId) {
            try {
                strategicDirections = await KnowledgeService.getActiveStrategies();
            } catch (err) {
                console.warn('[AIContextBuilder] Failed to load strategic directions:', err.message);
            }
        }

        // Get approved ideas (organization-level knowledge)
        let approvedIdeas = [];
        if (organizationId) {
            try {
                approvedIdeas = await KnowledgeService.getApprovedIdeas({});
            } catch (err) {
                console.warn('[AIContextBuilder] Failed to load approved ideas:', err.message);
            }
        }

        if (!projectId) {
            return {
                ragDisabled: false,
                projectDocuments: [],
                previousDecisions: [],
                changeRequests: [],
                lessonsLearned: [],
                phaseHistory: [],
                strategicDirections: strategicDirections.map(s => ({
                    title: s.title,
                    description: s.description,
                    priority: s.priority,
                    progress_percentage: s.progress_percentage
                })),
                approvedIdeas: approvedIdeas.slice(0, 5).map(i => ({
                    content: i.content,
                    category: i.category,
                    tags: i.tags || []
                }))
            };
        }

        // GAP-03: Check if RAG is enabled for project
        const project = await new Promise((resolve) => {
            deps.db.get(`SELECT rag_enabled FROM projects WHERE id = ?`, [projectId], (err, row) => {
                resolve(row || { rag_enabled: 1 });
            });
        });

        if (project.rag_enabled === 0) {
            return {
                ragDisabled: true,
                projectDocuments: [],
                previousDecisions: [],
                changeRequests: [],
                lessonsLearned: [],
                phaseHistory: [],
                message: 'RAG is disabled for this project'
            };
        }

        // Previous decisions
        const decisions = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT id, title, outcome FROM decisions 
                    WHERE project_id = ? AND status != 'PENDING' 
                    ORDER BY decided_at DESC LIMIT 10`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Phase history from project
        const projectInfo = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT phase_history FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        let phaseHistory = [];
        try {
            phaseHistory = JSON.parse(projectInfo.phase_history || '[]');
        } catch { }

        // Get global knowledge documents (organization-level)
        let documents = [];
        if (organizationId) {
            try {
                documents = await KnowledgeService.getDocuments(organizationId);
            } catch (err) {
                console.warn('[AIContextBuilder] Failed to load documents:', err.message);
            }
        }

        return {
            ragDisabled: false,
            projectDocuments: documents.map(d => ({
                id: d.id,
                filename: d.filename,
                category: d.category || null,
                tags: d.tags ? (typeof d.tags === 'string' ? JSON.parse(d.tags) : d.tags) : []
            })),
            previousDecisions: decisions.map(d => ({
                id: d.id, title: d.title, outcome: d.outcome || 'N/A'
            })),
            changeRequests: [],
            lessonsLearned: [],
            phaseHistory: phaseHistory.map(ph => ({
                phase: ph.phase, enteredAt: ph.enteredAt
            })),
            strategicDirections: strategicDirections.map(s => ({
                title: s.title,
                description: s.description,
                priority: s.priority,
                progress_percentage: s.progress_percentage,
                success_metrics: s.success_metrics || []
            })),
            approvedIdeas: approvedIdeas.slice(0, 5).map(i => ({
                content: i.content,
                category: i.category,
                tags: i.tags || [],
                impact_score: i.impact_score
            }))
        };
    },

    /**
     * Layer 6: External Context
     * @param {string} organizationId - Organization ID
     * @param {string} focusMode - Focus mode for potential pre-filtering
     */
    _buildExternalContext: async (organizationId, focusMode = 'all') => {
        const policies = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT internet_enabled FROM ai_policies WHERE organization_id = ?`,
                [organizationId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
        });

        return {
            internetEnabled: policies.internet_enabled === 1,
            externalSourcesUsed: []
        };
    },

    /**
     * Step B: Pending Approvals Context for HITL Learning System
     * Provides AI with awareness of pending approvals so it can proactively mention them
     */
    _buildPendingApprovalsContext: async (userId, organizationId, projectId) => {
        const AIActionExecutor = await getAIActionExecutor();
        if (!AIActionExecutor) {
            return { count: 0, actions: [], summary: null };
        }

        try {
            const pendingActions = await AIActionExecutor.getPendingActions(userId, projectId, organizationId);

            if (!pendingActions || pendingActions.length === 0) {
                return { count: 0, actions: [], summary: null };
            }

            // Get pattern info for each action
            const actionsWithPatterns = await Promise.all(
                pendingActions.slice(0, 5).map(async (action) => {
                    let patternInfo = null;
                    try {
                        patternInfo = await AIActionExecutor.getPatternInfo(
                            userId,
                            action.action_type,
                            action.payload || {}
                        );
                    } catch (e) {
                        // Pattern info is optional
                    }

                    return {
                        id: action.id,
                        actionType: action.action_type,
                        title: action.draftContent?.title || action.draftContent?.name || action.action_type,
                        riskLevel: action.payload?.riskLevel || 'LOW',
                        createdAt: action.created_at,
                        patternInfo
                    };
                })
            );

            // Generate summary for AI prompt
            const byType = {};
            pendingActions.forEach(a => {
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
                hasLearnedPatterns: actionsWithPatterns.some(a => a.patternInfo?.decisionCount > 1)
            };
        } catch (error) {
            console.error('[AIContextBuilder] Failed to get pending approvals:', error);
            return { count: 0, actions: [], summary: null };
        }
    },

    /**
     * Generate context hash for caching/comparison
     */
    _generateHash: (platform, organization, project) => {
        // Deterministic hash (no time component) for caching/comparison
        const data = JSON.stringify({
            tenantId: platform?.tenantId,
            organizationId: organization?.organizationId,
            projectId: project?.projectId || null,
            role: platform?.role,
            policyLevel: platform?.policyLevel
        });
        return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
    }
};

export default AIContextBuilder;
