// PMO Validation Middleware
// Step 3: Enforces PMO rules for initiatives and tasks

const db = require('../database');
const StatusMachine = require('../services/statusMachine');

const PMOValidation = {
    /**
     * Validate initiative creation (owner required)
     */
    validateInitiative: (req, res, next) => {
        const { ownerId, owner_business_id, ownerBusinessId } = req.body;
        const owner = ownerId || owner_business_id || ownerBusinessId;

        if (!owner) {
            return res.status(400).json({
                error: 'Initiative must have an owner',
                rule: 'INITIATIVE_OWNER_REQUIRED'
            });
        }

        next();
    },

    /**
     * Validate task creation (initiative required)
     */
    validateTask: (req, res, next) => {
        const { initiativeId, initiative_id } = req.body;
        const initId = initiativeId || initiative_id;

        if (!initId) {
            return res.status(400).json({
                error: 'Task must belong to an initiative',
                rule: 'TASK_INITIATIVE_REQUIRED'
            });
        }

        // Verify initiative exists
        db.get(`SELECT id FROM initiatives WHERE id = ?`, [initId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) {
                return res.status(400).json({
                    error: 'Initiative not found',
                    rule: 'TASK_INITIATIVE_REQUIRED'
                });
            }
            next();
        });
    },

    /**
     * Validate initiative status transition
     */
    validateInitiativeStatus: (req, res, next) => {
        const { status, blockedReason, blocked_reason } = req.body;

        if (!status) return next();

        db.get(`SELECT status, project_id FROM initiatives WHERE id = ?`, [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Initiative not found' });

            const validation = StatusMachine.validateInitiativeTransition(row.status, status, {
                blockedReason: blockedReason || blocked_reason
            });

            if (!validation.valid) {
                return res.status(400).json({
                    error: validation.reason,
                    rule: 'INVALID_STATUS_TRANSITION',
                    currentStatus: row.status,
                    requestedStatus: status
                });
            }

            // Store current status for audit
            req.previousStatus = row.status;
            req.projectId = row.project_id;
            next();
        });
    },

    /**
     * Validate task status transition
     */
    validateTaskStatus: (req, res, next) => {
        const { status, blockedReason, blocked_reason, blockerType, blocker_type } = req.body;

        if (!status) return next();

        db.get(`SELECT status, initiative_id FROM tasks WHERE id = ?`, [req.params.id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Task not found' });

            const validation = StatusMachine.validateTaskTransition(row.status, status, {
                blockedReason: blockedReason || blocked_reason,
                blockerType: blockerType || blocker_type
            });

            if (!validation.valid) {
                return res.status(400).json({
                    error: validation.reason,
                    rule: 'INVALID_STATUS_TRANSITION',
                    currentStatus: row.status,
                    requestedStatus: status
                });
            }

            req.previousStatus = row.status;
            req.initiativeId = row.initiative_id;
            next();
        });
    },

    /**
     * Log status transition to audit log
     */
    logStatusChange: (entityType) => {
        return (req, res, next) => {
            const originalSend = res.json.bind(res);

            res.json = (data) => {
                // Only log if successful and status changed
                if (res.statusCode < 400 && req.previousStatus && req.body.status) {
                    const logSql = `INSERT INTO activity_logs 
                        (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
                        VALUES (?, ?, ?, 'status_changed', ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

                    const { v4: uuidv4 } = require('uuid');
                    db.run(logSql, [
                        uuidv4(),
                        req.organizationId || 'unknown',
                        req.userId,
                        entityType,
                        req.params.id,
                        JSON.stringify({ status: req.previousStatus }),
                        JSON.stringify({ status: req.body.status })
                    ], () => { });
                }

                return originalSend(data);
            };

            next();
        };
    }
};

module.exports = PMOValidation;
