/**
 * AI Decision Governance Service
 * 
 * Supports decision-making in PMO with AI-generated briefs and tracking.
 * AI NEVER takes decisions autonomously - always recommends, never approves.
 * 
 * "In PMO, the most expensive mistakes are decisional, not task-related."
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

// Decision types by organizational level
const DECISION_TYPES = {
    STRATEGIC: 'strategic',           // Board/C-level (org-wide impact)
    PROGRAM: 'program',              // Portfolio/program level
    INITIATIVE: 'initiative',        // Initiative approval/scope changes
    EXECUTION: 'execution'           // Task blockers, resource allocation
};

// Decision status lifecycle
const DECISION_STATUS = {
    PROPOSED: 'proposed',     // AI or user suggested
    PENDING: 'pending',       // Awaiting decision owner
    APPROVED: 'approved',     // Decision made - proceed
    REJECTED: 'rejected',     // Decision made - do not proceed
    DEFERRED: 'deferred',     // Postponed to later
    SUPERSEDED: 'superseded'  // Replaced by another decision
};

// Decision urgency levels
const DECISION_URGENCY = {
    LOW: 'low',           // Can wait 2+ weeks
    MEDIUM: 'medium',     // Should decide within 1-2 weeks
    HIGH: 'high',         // Need decision within days
    CRITICAL: 'critical'  // Blocking work, immediate
};

const AIDecisionGovernance = {
    DECISION_TYPES,
    DECISION_STATUS,
    DECISION_URGENCY,

    // ==========================================
    // DECISION DETECTION
    // ==========================================

    /**
     * Detect when a decision is required based on context
     */
    detectDecisionNeeded: async (context) => {
        const { projectId, entityType, entityId, trigger } = context;
        const decisionsNeeded = [];

        // 1. Phase transition requires gate approval
        if (trigger === 'phase_transition') {
            decisionsNeeded.push({
                type: DECISION_TYPES.PROGRAM,
                reason: 'Phase transition requires gate review',
                urgency: DECISION_URGENCY.HIGH,
                suggestedOwner: 'project_sponsor'
            });
        }

        // 2. Initiative status change to APPROVED
        if (trigger === 'initiative_approval' && entityType === 'initiative') {
            decisionsNeeded.push({
                type: DECISION_TYPES.INITIATIVE,
                reason: 'Initiative requires formal approval before execution',
                urgency: DECISION_URGENCY.MEDIUM,
                suggestedOwner: 'initiative_owner'
            });
        }

        // 3. Blocked task needs unblock decision
        if (trigger === 'task_blocked' && entityType === 'task') {
            const task = await AIDecisionGovernance._getEntity('tasks', entityId);
            if (task && task.blocked_reason) {
                decisionsNeeded.push({
                    type: DECISION_TYPES.EXECUTION,
                    reason: `Task blocked: ${task.blocked_reason}`,
                    urgency: DECISION_URGENCY.HIGH,
                    suggestedOwner: 'task_owner'
                });
            }
        }

        // 4. Budget threshold exceeded
        if (trigger === 'budget_threshold') {
            decisionsNeeded.push({
                type: DECISION_TYPES.STRATEGIC,
                reason: 'Budget threshold exceeded - requires approval to continue',
                urgency: DECISION_URGENCY.CRITICAL,
                suggestedOwner: 'project_sponsor'
            });
        }

        // 5. Scope change detected
        if (trigger === 'scope_change') {
            decisionsNeeded.push({
                type: DECISION_TYPES.INITIATIVE,
                reason: 'Scope change detected - requires change control approval',
                urgency: DECISION_URGENCY.MEDIUM,
                suggestedOwner: 'change_board'
            });
        }

        return {
            projectId,
            decisionsNeeded,
            count: decisionsNeeded.length,
            hasBlockingDecisions: decisionsNeeded.some(d => d.urgency === DECISION_URGENCY.CRITICAL)
        };
    },

    /**
     * Get pending decisions blocking work
     */
    getBlockingDecisions: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT d.*, 
                    u.first_name as owner_first, u.last_name as owner_last,
                    (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = 1) as blocked_items
                FROM decisions d
                LEFT JOIN users u ON d.decision_owner_id = u.id
                WHERE d.project_id = ? 
                AND d.status IN ('PENDING', 'proposed')
                ORDER BY 
                    CASE d.status WHEN 'PENDING' THEN 0 ELSE 1 END,
                    d.created_at ASC
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else resolve((rows || []).map(row => ({
                    ...row,
                    ownerName: row.owner_first ? `${row.owner_first} ${row.owner_last}` : 'Unassigned',
                    daysWaiting: Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24))
                })));
            });
        });
    },

    // ==========================================
    // DECISION BRIEF GENERATION
    // ==========================================

    /**
     * Prepare AI-generated decision brief with context, options, and risks
     */
    prepareDecisionBrief: async (decisionId, context = {}) => {
        // Get decision details
        const decision = await AIDecisionGovernance._getDecision(decisionId);
        if (!decision) {
            throw new Error('Decision not found');
        }

        // Get impacted entities
        const impacts = await AIDecisionGovernance.getDecisionImpacts(decisionId);

        // Get related context
        const relatedEntity = await AIDecisionGovernance._getEntity(
            decision.related_object_type.toLowerCase() + 's',
            decision.related_object_id
        );

        // Generate brief components
        const contextSummary = AIDecisionGovernance._generateContextSummary(decision, relatedEntity, impacts);
        const options = AIDecisionGovernance._generateOptions(decision);
        const risks = AIDecisionGovernance._identifyRisks(decision, impacts);
        const recommendation = AIDecisionGovernance._generateRecommendation(decision, options, risks);

        // Store brief
        const briefId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO decision_briefs 
                (id, decision_id, context_summary, options, risks, ai_recommendation, 
                 recommendation_rationale, recommendation_confidence, data_sources_used)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                briefId, decisionId, contextSummary,
                JSON.stringify(options), JSON.stringify(risks),
                recommendation.action, recommendation.rationale, recommendation.confidence,
                JSON.stringify(['project_data', 'historical_decisions', 'impact_analysis'])
            ], function (err) {
                if (err) reject(err);
                else resolve();
            });
        });

        return {
            briefId,
            decisionId,
            decision: {
                title: decision.title,
                type: decision.decision_type,
                status: decision.status,
                owner: decision.decision_owner_id
            },
            contextSummary,
            options,
            risks,
            recommendation: {
                action: recommendation.action,
                rationale: recommendation.rationale,
                confidence: recommendation.confidence,
                disclaimer: 'AI recommendation only. Final decision rests with the decision owner.'
            },
            impactedItems: impacts.length,
            generatedAt: new Date().toISOString()
        };
    },

    /**
     * Generate context summary for decision brief
     */
    _generateContextSummary: (decision, relatedEntity, impacts) => {
        const parts = [];

        parts.push(`Decision Type: ${decision.decision_type}`);
        parts.push(`Related To: ${decision.related_object_type} - ${relatedEntity?.name || relatedEntity?.title || 'Unknown'}`);

        if (impacts.length > 0) {
            parts.push(`Blocked Items: ${impacts.filter(i => i.is_blocker).length}`);
        }

        const daysWaiting = Math.floor((Date.now() - new Date(decision.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysWaiting > 7) {
            parts.push(`⚠️ Pending for ${daysWaiting} days`);
        }

        return parts.join('\n');
    },

    /**
     * Generate decision options with pros/cons
     */
    _generateOptions: (decision) => {
        const options = [];

        // Option 1: Approve
        options.push({
            id: 'approve',
            title: 'Approve',
            description: `Proceed with ${decision.title}`,
            pros: ['Unblocks dependent work', 'Maintains momentum'],
            cons: ['Commits resources', 'May have downstream impacts']
        });

        // Option 2: Reject
        options.push({
            id: 'reject',
            title: 'Reject',
            description: `Do not proceed with ${decision.title}`,
            pros: ['Preserves resources', 'Avoids potential risks'],
            cons: ['Blocks dependent work', 'May require alternative approach']
        });

        // Option 3: Defer (if applicable)
        if (decision.decision_type !== 'execution') {
            options.push({
                id: 'defer',
                title: 'Defer',
                description: 'Postpone decision to gather more information',
                pros: ['More time for analysis', 'Reduced uncertainty'],
                cons: ['Delays execution', 'May increase decision debt']
            });
        }

        return options;
    },

    /**
     * Identify risks associated with decision
     */
    _identifyRisks: (decision, impacts) => {
        const risks = [];

        // Risk of delay
        const daysWaiting = Math.floor((Date.now() - new Date(decision.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysWaiting > 7) {
            risks.push({
                type: 'delay',
                severity: daysWaiting > 14 ? 'high' : 'medium',
                description: `Decision pending for ${daysWaiting} days may impact timelines`
            });
        }

        // Risk of blocking
        const blockedCount = impacts.filter(i => i.is_blocker).length;
        if (blockedCount > 0) {
            risks.push({
                type: 'blocking',
                severity: blockedCount > 3 ? 'high' : 'medium',
                description: `${blockedCount} item(s) blocked pending this decision`
            });
        }

        // Risk of scope
        if (decision.decision_type === 'initiative') {
            risks.push({
                type: 'scope',
                severity: 'medium',
                description: 'Approval may commit scope that affects other initiatives'
            });
        }

        return risks;
    },

    /**
     * Generate AI recommendation (suggest only, never approve)
     */
    _generateRecommendation: (decision, options, risks) => {
        // Simple heuristic-based recommendation
        const highRisks = risks.filter(r => r.severity === 'high').length;
        const blockedItems = risks.find(r => r.type === 'blocking');

        let action, rationale, confidence;

        if (highRisks >= 2) {
            action = 'Review carefully before deciding';
            rationale = 'Multiple high-severity risks identified. Recommend thorough review.';
            confidence = 0.6;
        } else if (blockedItems && blockedItems.severity === 'high') {
            action = 'Consider approving to unblock work';
            rationale = 'Multiple items blocked. Continued delay may impact project timeline.';
            confidence = 0.7;
        } else {
            action = 'Standard review recommended';
            rationale = 'No critical factors identified. Normal decision process applies.';
            confidence = 0.8;
        }

        return { action, rationale, confidence };
    },

    // ==========================================
    // DECISION DEBT TRACKING
    // ==========================================

    /**
     * Get decision debt (pending decisions blocking execution)
     */
    getDecisionDebt: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    d.id, d.title, d.decision_type, d.status, d.created_at,
                    u.first_name, u.last_name,
                    (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = 1) as blocked_count
                FROM decisions d
                LEFT JOIN users u ON d.decision_owner_id = u.id
                WHERE d.project_id = ?
                AND d.status IN ('PENDING', 'proposed')
                ORDER BY d.created_at ASC
            `, [projectId], (err, rows) => {
                if (err) reject(err);
                else {
                    const decisions = (rows || []).map(row => ({
                        id: row.id,
                        title: row.title,
                        type: row.decision_type,
                        owner: row.first_name ? `${row.first_name} ${row.last_name}` : 'Unassigned',
                        daysWaiting: Math.floor((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)),
                        blockedCount: row.blocked_count
                    }));

                    const totalDebt = decisions.reduce((sum, d) => sum + d.daysWaiting, 0);
                    const totalBlocked = decisions.reduce((sum, d) => sum + d.blockedCount, 0);

                    resolve({
                        projectId,
                        pendingDecisions: decisions.length,
                        totalDebtDays: totalDebt,
                        averageWaitDays: decisions.length > 0 ? Math.round(totalDebt / decisions.length) : 0,
                        totalBlockedItems: totalBlocked,
                        oldestDecision: decisions[0] || null,
                        decisions,
                        healthStatus: totalDebt > 30 ? 'critical' : totalDebt > 14 ? 'warning' : 'healthy'
                    });
                }
            });
        });
    },

    // ==========================================
    // DECISION IMPACT MANAGEMENT
    // ==========================================

    /**
     * Register an impact for a decision
     */
    registerImpact: async (decisionId, { impactedType, impactedId, description, isBlocker = false }) => {
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO decision_impacts 
                (id, decision_id, impacted_type, impacted_id, impact_description, is_blocker, blocking_since)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                id, decisionId, impactedType, impactedId, description,
                isBlocker ? 1 : 0, isBlocker ? new Date().toISOString() : null
            ], function (err) {
                if (err) reject(err);
                else resolve({ id, decisionId, impactedType, impactedId, isBlocker });
            });
        });
    },

    /**
     * Get impacts for a decision
     */
    getDecisionImpacts: async (decisionId) => {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM decision_impacts 
                WHERE decision_id = ?
                ORDER BY is_blocker DESC, created_at ASC
            `, [decisionId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    // ==========================================
    // AI SUGGESTION (NEVER APPROVES)
    // ==========================================

    /**
     * AI suggests but NEVER approves decisions
     */
    suggestDecision: async (decisionId, context = {}) => {
        const brief = await AIDecisionGovernance.prepareDecisionBrief(decisionId, context);

        return {
            decisionId,
            suggestion: brief.recommendation,
            brief,
            // Critical: AI cannot approve
            canApprove: false,
            approvalNote: 'Decisions must be made by the designated decision owner. AI provides analysis only.',
            nextAction: `Review brief and make decision as ${brief.decision.owner || 'decision owner'}`
        };
    },

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    _getDecision: async (decisionId) => {
        return new Promise((resolve) => {
            db.get(`SELECT * FROM decisions WHERE id = ?`, [decisionId], (err, row) => {
                resolve(row || null);
            });
        });
    },

    _getEntity: async (tableName, entityId) => {
        return new Promise((resolve) => {
            // Sanitize table name to prevent SQL injection
            const allowedTables = ['initiatives', 'tasks', 'projects', 'roadmaps'];
            if (!allowedTables.includes(tableName)) {
                resolve(null);
                return;
            }
            db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [entityId], (err, row) => {
                resolve(row || null);
            });
        });
    },

    /**
     * Get all decisions for a project with briefs
     */
    getDecisionsWithBriefs: async (projectId, status = null) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT d.*, db.id as brief_id, db.ai_recommendation, db.recommendation_confidence
                FROM decisions d
                LEFT JOIN decision_briefs db ON d.id = db.decision_id
                WHERE d.project_id = ?
            `;
            const params = [projectId];

            if (status) {
                sql += ` AND d.status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY d.created_at DESC`;

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
};

module.exports = AIDecisionGovernance;
