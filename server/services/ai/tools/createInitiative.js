/**
 * Create Initiative Tool Handler
 * MUTATION - Requires user approval before execution
 */

const db = require('../../../database');
const { v4: uuidv4 } = require('uuid');

async function createInitiative(params, context) {
    const { projectId, title, description, priority, estimatedEffort } = params;
    const { userId, organizationId } = context;

    const id = uuidv4();

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO initiatives (id, project_id, title, description, priority, estimated_effort, status, created_by, organization_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'PROPOSED', ?, ?, datetime('now'))`,
            [id, projectId, title, description, priority, estimatedEffort || null, userId, organizationId],
            function (err) {
                if (err) {
                    // If table doesn't exist, return simulated success
                    if (err.message.includes('no such table')) {
                        resolve({
                            id,
                            status: 'SIMULATED',
                            message: `Initiative "${title}" would be created (table not yet created)`
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    resolve({
                        id,
                        status: 'CREATED',
                        message: `Initiative "${title}" created successfully`
                    });
                }
            }
        );
    });
}

module.exports = { createInitiative };



