/**
 * Demo Service
 * 
 * Handles creation and cleanup of demo organizations.
 * Demo orgs are ephemeral, read-only, and expire after 24 hours.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const AccessPolicyService = require('./accessPolicyService');
const ActivityService = require('./activityService');

const DemoService = {
    /**
     * Create a new demo organization with seeded data
     * @param {string} templateId - Optional template ID to seed from
     * @param {string} email - Optional email for lightweight registration
     * @returns {Promise<Object>} - { organizationId, userId, token }
     */
    createDemoOrganization: async (templateId = null, email = null) => {
        const orgId = `demo-${uuidv4().split('-')[0]}`;
        const userId = email ? uuidv4() : `demo-user-${uuidv4().split('-')[0]}`;
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Create demo organization
                db.run(
                    `INSERT INTO organizations (id, name, plan, status, organization_type, trial_started_at, is_active, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orgId,
                        'Demo Organization',
                        'demo',
                        'active',
                        AccessPolicyService.ORG_TYPES.DEMO,
                        now,
                        1,
                        now
                    ],
                    function (err) {
                        if (err) return reject(err);
                    }
                );

                // Create demo user (no password for demo)
                db.run(
                    `INSERT INTO users (id, organization_id, email, first_name, last_name, role, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        orgId,
                        email || `demo-${Date.now()}@demo.consultify.app`,
                        'Demo',
                        'User',
                        'ADMIN',
                        'active',
                        now
                    ],
                    function (err) {
                        if (err) return reject(err);
                    }
                );

                // Create demo limits
                AccessPolicyService.createDefaultLimits(orgId, AccessPolicyService.ORG_TYPES.DEMO)
                    .then(() => {
                        // Seed demo data if template provided
                        if (templateId) {
                            return DemoService.seedDemoData(orgId, templateId);
                        }
                        return DemoService.seedDefaultDemoData(orgId);
                    })
                    .then(() => {
                        // Log activity
                        ActivityService.log({
                            organizationId: orgId,
                            userId: userId,
                            action: 'demo_created',
                            entityType: 'organization',
                            entityId: orgId,
                            entityName: 'Demo Organization'
                        });

                        resolve({
                            organizationId: orgId,
                            userId: userId,
                            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                        });
                    })
                    .catch(reject);
            });
        });
    },

    /**
     * Seed demo data from a template
     * @param {string} organizationId 
     * @param {string} templateId 
     */
    seedDemoData: async (organizationId, templateId) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT seed_data_json FROM demo_templates WHERE id = ? AND is_active = 1`,
                [templateId],
                async (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve(); // No template, skip

                    try {
                        const seedData = JSON.parse(row.seed_data_json);
                        await DemoService._applySeedData(organizationId, seedData);
                        resolve();
                    } catch (parseErr) {
                        reject(parseErr);
                    }
                }
            );
        });
    },

    /**
     * Seed default demo data from Legolex Manufacturing template
     * @param {string} organizationId 
     */
    seedDefaultDemoData: async (organizationId) => {
        const path = require('path');
        const fs = require('fs');
        const now = new Date().toISOString();
        const projectId = uuidv4();

        // Load comprehensive seed data from JSON
        let seedData;
        try {
            const seedPath = path.join(__dirname, '../seeds/demo_legolex.json');
            seedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
        } catch (e) {
            console.warn('[DemoService] Could not load demo_legolex.json, using minimal fallback');
            seedData = null;
        }

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Update organization name if seed data available
                if (seedData?.organization?.name) {
                    db.run(
                        `UPDATE organizations SET name = ? WHERE id = ?`,
                        [seedData.organization.name, organizationId]
                    );
                }

                // Create demo project
                const projectName = seedData?.project?.name || 'Demo Transformation Project';
                const projectPhase = seedData?.project?.current_phase || 'Context';
                db.run(
                    `INSERT INTO projects (id, organization_id, name, status, governance_model, current_phase, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [projectId, organizationId, projectName, 'active', 'STANDARD', projectPhase, now]
                );

                // Create initiatives from seed data
                const initiatives = seedData?.initiatives || [
                    { name: 'Digital Process Automation', summary: 'Automate key business processes.', status: 'IN_PROGRESS', priority: 'HIGH', tasks: [] }
                ];

                const initiativeIds = {};
                let taskInsertCount = 0;
                const totalTasks = initiatives.reduce((sum, init) => sum + (init.tasks?.length || 0), 0);

                for (const init of initiatives) {
                    const initId = uuidv4();
                    initiativeIds[init.name] = initId;

                    db.run(
                        `INSERT INTO initiatives (id, organization_id, project_id, name, summary, status, priority, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [initId, organizationId, projectId, init.name, init.summary || '', init.status || 'DRAFT', init.priority || 'MEDIUM', now]
                    );

                    // Create tasks for this initiative
                    if (init.tasks && init.tasks.length > 0) {
                        for (const task of init.tasks) {
                            const isLast = taskInsertCount === totalTasks - 1;
                            db.run(
                                `INSERT INTO tasks (id, project_id, organization_id, title, description, status, priority, initiative_id, created_at)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [uuidv4(), projectId, organizationId, task.title, task.description || '', task.status || 'todo', task.priority || 'medium', initId, now],
                                isLast ? (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                } : undefined
                            );
                            taskInsertCount++;
                        }
                    }
                }

                // If no tasks, resolve immediately
                if (totalTasks === 0) {
                    resolve();
                }
            });
        });
    },

    /**
     * Check if an organization is a demo org
     * @param {string} organizationId 
     * @returns {Promise<boolean>}
     */
    isDemoOrg: async (organizationId) => {
        const orgInfo = await AccessPolicyService.getOrganizationType(organizationId);
        return orgInfo?.organizationType === AccessPolicyService.ORG_TYPES.DEMO;
    },

    /**
     * Cleanup expired demo organizations (run via cron)
     * @returns {Promise<number>} - Number of deleted orgs
     */
    cleanupExpiredDemos: async () => {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        return new Promise((resolve, reject) => {
            // Get expired demo orgs
            db.all(
                `SELECT id FROM organizations 
                 WHERE organization_type = ? AND trial_started_at < ?`,
                [AccessPolicyService.ORG_TYPES.DEMO, cutoffTime],
                async (err, rows) => {
                    if (err) return reject(err);
                    if (!rows || rows.length === 0) return resolve(0);

                    const orgIds = rows.map(r => r.id);

                    // Delete in cascade (FK constraints will clean up related data)
                    db.serialize(() => {
                        for (const orgId of orgIds) {
                            // Delete org (cascades to users, projects, etc.)
                            db.run(`DELETE FROM organizations WHERE id = ?`, [orgId]);

                            console.log(`[DemoService] Cleaned up expired demo org: ${orgId}`);
                        }
                    });

                    resolve(orgIds.length);
                }
            );
        });
    },

    /**
     * Get all active demo templates
     * @returns {Promise<Array>}
     */
    getTemplates: async () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT id, name, description FROM demo_templates WHERE is_active = 1`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    },

    // Private helper
    _applySeedData: async (organizationId, seedData) => {
        // Apply projects
        if (seedData.project) {
            const project = seedData.project;
            project.id = uuidv4();
            project.organization_id = organizationId;

            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO projects (id, organization_id, name, status, governance_model, current_phase, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [project.id, organizationId, project.name, project.status || 'active', project.governance_model || 'STANDARD', project.current_phase || 'Context'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Apply initiatives
            if (seedData.initiatives) {
                for (const init of seedData.initiatives) {
                    init.id = uuidv4();
                    init.organization_id = organizationId;
                    init.project_id = project.id;

                    await new Promise((resolve, reject) => {
                        db.run(
                            `INSERT INTO initiatives (id, organization_id, project_id, name, summary, status, priority, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                            [init.id, organizationId, project.id, init.name, init.summary || '', init.status || 'DRAFT', init.priority || 'MEDIUM'],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    // Apply tasks for this initiative
                    if (init.tasks) {
                        for (const task of init.tasks) {
                            await new Promise((resolve, reject) => {
                                db.run(
                                    `INSERT INTO tasks (id, project_id, organization_id, title, description, status, priority, initiative_id, created_at)
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                                    [uuidv4(), project.id, organizationId, task.title, task.description || '', task.status || 'todo', task.priority || 'medium', init.id],
                                    (err) => err ? reject(err) : resolve()
                                );
                            });
                        }
                    }
                }
            }
        }
    },

    /**
     * Check if there's an active demo for the given email
     * Used for demo abuse protection (max 1 active demo per email)
     * @param {string} email 
     * @returns {Promise<boolean>}
     */
    hasActiveDemoForEmail: async (email) => {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT o.id FROM organizations o
                 JOIN users u ON u.organization_id = o.id
                 WHERE o.organization_type = ? 
                 AND o.trial_started_at > ?
                 AND u.email = ?`,
                [AccessPolicyService.ORG_TYPES.DEMO, cutoffTime, email],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(!!row);
                }
            );
        });
    }
};

module.exports = DemoService;
