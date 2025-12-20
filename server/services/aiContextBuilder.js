// AI Context Builder - Builds 6-layer context for every AI interaction
// AI Core Layer — Enterprise PMO Brain

const db = require('../database');
// Step A: Import PMOHealthService for canonical health snapshot
let PMOHealthService;
try {
    PMOHealthService = require('./pmoHealthService');
} catch (e) {
    console.warn('[AIContextBuilder] PMOHealthService not available, pmo.healthSnapshot will be null');
}

const AIContextBuilder = {
    /**
     * Build complete 6-layer context + PMO health snapshot
     */
    buildContext: async (userId, organizationId, projectId = null, options = {}) => {
        const platform = await AIContextBuilder._buildPlatformContext(userId, organizationId);
        const organization = await AIContextBuilder._buildOrganizationContext(organizationId);
        const project = projectId ? await AIContextBuilder._buildProjectContext(projectId) : null;
        const execution = await AIContextBuilder._buildExecutionContext(userId, projectId);
        const knowledge = await AIContextBuilder._buildKnowledgeContext(projectId);
        const external = await AIContextBuilder._buildExternalContext(organizationId);

        // Step A: Fetch PMOHealthSnapshot for AI context (same data as UI sees)
        let pmo = { healthSnapshot: null };
        if (projectId && PMOHealthService) {
            try {
                pmo.healthSnapshot = await PMOHealthService.getHealthSnapshot(projectId);
            } catch (err) {
                console.warn('[AIContextBuilder] Failed to get PMO health snapshot:', err.message);
            }
        }

        const context = {
            platform,
            organization,
            project,
            execution,
            knowledge,
            external,
            pmo, // Step A: PMO health data for AI
            builtAt: new Date().toISOString(),
            contextHash: AIContextBuilder._generateHash(platform, organization, project),
            currentScreen: options.currentScreen || null,
            selectedObjectId: options.selectedObjectId || null,
            selectedObjectType: options.selectedObjectType || null
        };

        return context;
    },

    /**
     * Layer 1: Platform Context
     */
    _buildPlatformContext: async (userId, organizationId) => {
        // Get user role
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT role FROM users WHERE id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        // Get AI policies
        const policies = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ai_policies WHERE organization_id = ?`, [organizationId], (err, row) => {
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
            db.get(`SELECT * FROM organizations WHERE id = ?`, [organizationId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        const projects = await new Promise((resolve, reject) => {
            db.all(`SELECT id FROM projects WHERE organization_id = ? AND is_closed = 0`,
                [organizationId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        const memory = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ai_organization_memory WHERE organization_id = ?`,
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
            db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        if (!project) return null;

        const initiatives = await new Promise((resolve, reject) => {
            db.get(`SELECT 
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
            db.all(sql, params, (err, rows) => {
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
            db.all(sql, params, (err, rows) => {
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
            db.all(sql, params, (err, rows) => {
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
            db.all(sql, params, (err, rows) => {
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
     */
    _buildKnowledgeContext: async (projectId) => {
        if (!projectId) {
            return {
                ragDisabled: false,
                projectDocuments: [],
                previousDecisions: [],
                changeRequests: [],
                lessonsLearned: [],
                phaseHistory: []
            };
        }

        // GAP-03: Check if RAG is enabled for project
        const project = await new Promise((resolve) => {
            db.get(`SELECT rag_enabled FROM projects WHERE id = ?`, [projectId], (err, row) => {
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
            db.all(`SELECT id, title, outcome FROM decisions 
                    WHERE project_id = ? AND status != 'PENDING' 
                    ORDER BY decided_at DESC LIMIT 10`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Phase history from project
        const projectInfo = await new Promise((resolve, reject) => {
            db.get(`SELECT phase_history FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        let phaseHistory = [];
        try {
            phaseHistory = JSON.parse(projectInfo.phase_history || '[]');
        } catch { }

        return {
            projectDocuments: [], // Could integrate document storage
            previousDecisions: decisions.map(d => ({
                id: d.id, title: d.title, outcome: d.outcome || 'N/A'
            })),
            changeRequests: [],
            lessonsLearned: [],
            phaseHistory: phaseHistory.map(ph => ({
                phase: ph.phase, enteredAt: ph.enteredAt
            }))
        };
    },

    /**
     * Layer 6: External Context
     */
    _buildExternalContext: async (organizationId) => {
        const policies = await new Promise((resolve, reject) => {
            db.get(`SELECT internet_enabled FROM ai_policies WHERE organization_id = ?`,
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
     * Generate context hash for caching/comparison
     */
    _generateHash: (platform, organization, project) => {
        const data = `${platform.tenantId}-${organization.organizationId}-${project?.projectId || 'none'}-${Date.now()}`;
        return Buffer.from(data).toString('base64').substring(0, 16);
    }
};

module.exports = AIContextBuilder;
