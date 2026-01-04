/**
 * DecisionTriggerService - Auto-create decisions based on system events
 * 
 * Triggers:
 * - Initiative: PLANNING -> REVIEW (requires approval)
 * - Task: status -> BLOCKED (requires unblock decision)
 * - Phase: transition (requires gate approval)
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



class DecisionTriggerService {
    /**
     * Create a decision with standard audit trail
     */
    static async createDecision({
        projectId,
        decisionType,
        relatedObjectType,
        relatedObjectId,
        decisionOwnerId,
        title,
        description,
        priority = 'MEDIUM',
        requestedById,
        dueDate
    }) {
        const id = uuidv4();
        const auditTrail = JSON.stringify([{
            action: 'AUTO_CREATED',
            by: 'SYSTEM',
            at: new Date().toISOString(),
            trigger: decisionType
        }]);

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO decisions (
                id, project_id, decision_type, related_object_type, related_object_id,
                decision_owner_id, requested_by_id, title, description, priority, 
                due_date, required, status, audit_trail
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', ?)`;

            db.run(sql, [
                id, projectId, decisionType, relatedObjectType, relatedObjectId,
                decisionOwnerId, requestedById, title, description, priority,
                dueDate, auditTrail
            ], function(err) {
                if (err) reject(err);
                else resolve({ id, title, decisionType, status: 'PENDING' });
            });
        });
    }

    /**
     * Trigger: Initiative phase transition
     * When initiative moves to REVIEW status, create approval decision
     */
    static async onInitiativeStatusChange(initiative, oldStatus, newStatus, triggeredBy) {
        // PLANNING -> REVIEW: Requires approval to proceed
        if (oldStatus === 'PLANNING' && newStatus === 'REVIEW') {
            // Find project owner or manager
            const projectOwner = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT p.owner_id, u.first_name, u.last_name 
                    FROM projects p
                    LEFT JOIN users u ON p.owner_id = u.id
                    WHERE p.id = ?
                `, [initiative.project_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            return this.createDecision({
                projectId: initiative.project_id,
                decisionType: 'INITIATIVE_APPROVAL',
                relatedObjectType: 'INITIATIVE',
                relatedObjectId: initiative.id,
                decisionOwnerId: projectOwner?.owner_id || triggeredBy,
                requestedById: triggeredBy,
                title: `Approve Initiative: ${initiative.name}`,
                description: `The initiative "${initiative.name}" is ready for review. Please evaluate and approve to proceed to execution phase.`,
                priority: initiative.priority || 'MEDIUM'
            });
        }

        // EXECUTING -> COMPLETED: Requires closure approval
        if (oldStatus === 'EXECUTING' && newStatus === 'COMPLETED') {
            const projectOwner = await new Promise((resolve, reject) => {
                db.get(`SELECT owner_id FROM projects WHERE id = ?`, 
                    [initiative.project_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            return this.createDecision({
                projectId: initiative.project_id,
                decisionType: 'INITIATIVE_APPROVAL',
                relatedObjectType: 'INITIATIVE',
                relatedObjectId: initiative.id,
                decisionOwnerId: projectOwner?.owner_id || triggeredBy,
                requestedById: triggeredBy,
                title: `Approve Closure: ${initiative.name}`,
                description: `The initiative "${initiative.name}" is submitted for completion. Please review deliverables and approve closure.`,
                priority: 'HIGH'
            });
        }

        return null;
    }

    /**
     * Trigger: Task blocked
     * When task moves to BLOCKED status, create unblock decision
     */
    static async onTaskBlocked(task, blockerReason, triggeredBy) {
        // Find task assignee's manager or project owner
        let decisionOwner = null;

        if (task.assignee_id) {
            const assigneeManager = await new Promise((resolve, reject) => {
                db.get(`SELECT manager_id FROM users WHERE id = ?`, 
                    [task.assignee_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.manager_id);
                });
            });
            decisionOwner = assigneeManager;
        }

        if (!decisionOwner && task.project_id) {
            const projectOwner = await new Promise((resolve, reject) => {
                db.get(`SELECT owner_id FROM projects WHERE id = ?`, 
                    [task.project_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row?.owner_id);
                });
            });
            decisionOwner = projectOwner;
        }

        return this.createDecision({
            projectId: task.project_id,
            decisionType: 'TASK_UNBLOCK',
            relatedObjectType: 'TASK',
            relatedObjectId: task.id,
            decisionOwnerId: decisionOwner || triggeredBy,
            requestedById: triggeredBy,
            title: `Unblock Task: ${task.title}`,
            description: `The task "${task.title}" is blocked and requires intervention. Reason: ${blockerReason || 'Not specified'}`,
            priority: 'HIGH'
        });
    }

    /**
     * Trigger: Phase gate transition
     * When project reaches a phase gate, create gate approval decision
     */
    static async onPhaseTransition(project, fromPhase, toPhase, triggeredBy) {
        const gateTypes = {
            'INITIATION_TO_PLANNING': 'Project Planning Gate',
            'PLANNING_TO_EXECUTION': 'Execution Readiness Gate',
            'EXECUTION_TO_MONITORING': 'Progress Gate',
            'MONITORING_TO_CLOSING': 'Closure Gate'
        };

        const gateKey = `${fromPhase?.toUpperCase()}_TO_${toPhase?.toUpperCase()}`;
        const gateTitle = gateTypes[gateKey] || `Phase Transition: ${fromPhase} → ${toPhase}`;

        return this.createDecision({
            projectId: project.id,
            decisionType: 'PHASE_TRANSITION',
            relatedObjectType: 'PROJECT',
            relatedObjectId: project.id,
            decisionOwnerId: project.owner_id || triggeredBy,
            requestedById: triggeredBy,
            title: gateTitle,
            description: `Project "${project.name}" is requesting transition from ${fromPhase} to ${toPhase}. Please review gate criteria and approve.`,
            priority: 'HIGH'
        });
    }

    /**
     * Trigger: Budget threshold exceeded
     */
    static async onBudgetExceeded(project, currentSpend, budgetLimit, triggeredBy) {
        const percentOver = Math.round(((currentSpend - budgetLimit) / budgetLimit) * 100);

        return this.createDecision({
            projectId: project.id,
            decisionType: 'BUDGET',
            relatedObjectType: 'PROJECT',
            relatedObjectId: project.id,
            decisionOwnerId: project.owner_id || triggeredBy,
            requestedById: triggeredBy,
            title: `Budget Approval Required: ${project.name}`,
            description: `Project "${project.name}" has exceeded budget by ${percentOver}%. Current spend: ${currentSpend}, Budget: ${budgetLimit}. Approval needed to continue.`,
            priority: 'CRITICAL'
        });
    }

    /**
     * Trigger: Scope change request
     */
    static async onScopeChangeRequest(initiative, changeDescription, impactLevel, triggeredBy) {
        const projectOwner = await new Promise((resolve, reject) => {
            db.get(`SELECT owner_id FROM projects WHERE id = ?`, 
                [initiative.project_id], (err, row) => {
                if (err) reject(err);
                else resolve(row?.owner_id);
            });
        });

        return this.createDecision({
            projectId: initiative.project_id,
            decisionType: 'SCOPE_CHANGE',
            relatedObjectType: 'INITIATIVE',
            relatedObjectId: initiative.id,
            decisionOwnerId: projectOwner || triggeredBy,
            requestedById: triggeredBy,
            title: `Scope Change: ${initiative.name}`,
            description: changeDescription,
            priority: impactLevel === 'HIGH' ? 'CRITICAL' : impactLevel === 'MEDIUM' ? 'HIGH' : 'MEDIUM'
        });
    }

    /**
     * Check for existing pending decision for same object
     * Returns existing decision if found, null otherwise
     */
    static async findExistingDecision(relatedObjectType, relatedObjectId, decisionType) {
        return new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM decisions 
                WHERE related_object_type = ? 
                AND related_object_id = ? 
                AND decision_type = ?
                AND status = 'PENDING'
                LIMIT 1
            `, [relatedObjectType, relatedObjectId, decisionType], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Safe trigger wrapper - prevents duplicate decisions
     */
    static async safeTrigger(triggerFn, relatedObjectType, relatedObjectId, decisionType) {
        // Check for existing
        const existing = await this.findExistingDecision(relatedObjectType, relatedObjectId, decisionType);
        if (existing) {
            console.log(`Decision already exists for ${relatedObjectType}:${relatedObjectId} type:${decisionType}`);
            return existing;
        }
        
        // Create new
        return triggerFn();
    }
}

export default DecisionTriggerService;














