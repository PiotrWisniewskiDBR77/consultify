/**
 * Seed Test Assessments
 * Creates 3 test DRD assessments with sample data for testing:
 * - 1 Draft assessment (in progress)
 * - 1 In Review assessment
 * - 1 Approved assessment (can create report)
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

async function seedTestAssessments() {
    console.log('[Seed] Starting test assessments seeding...');

    try {
        // First, we need to find the DBR77 organization and user
        const dbr77Org = await new Promise((resolve, reject) => {
            db.get(`SELECT id FROM organizations WHERE name LIKE '%DBR77%'`, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!dbr77Org) {
            console.log('[Seed] No DBR77 organization found, using default organization');
        }

        const organizationId = dbr77Org?.id || 'default-org-id';

        // Find a project for this org
        const project = await new Promise((resolve, reject) => {
            db.get(`SELECT id, name FROM projects WHERE organization_id = ? LIMIT 1`, [organizationId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // If no project exists, create one
        let projectId, projectName;
        if (!project) {
            projectId = uuidv4();
            projectName = 'Test DRD Project';
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO projects (id, name, organization_id, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
                    [projectId, projectName, organizationId],
                    (err) => err ? reject(err) : resolve()
                );
            });
            console.log(`[Seed] Created project: ${projectName}`);
        } else {
            projectId = project.id;
            projectName = project.name;
            console.log(`[Seed] Using existing project: ${projectName}`);
        }

        // Find a user
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT id, first_name, last_name FROM users WHERE organization_id = ? LIMIT 1`, [organizationId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        const userId = user?.id || 'system';

        // Create assessment_workflows table if not exists
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS assessment_workflows (
                    id TEXT PRIMARY KEY,
                    assessment_id TEXT NOT NULL,
                    organization_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    assessment_type TEXT DEFAULT 'DRD',
                    workflow_state TEXT DEFAULT 'DRAFT',
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => err ? reject(err) : resolve());
        });
        console.log('[Seed] assessment_workflows table ready');

        // Clear existing test data
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM assessment_workflows WHERE organization_id = ?`, [organizationId], (err) => err ? reject(err) : resolve());
        });

        // Test Assessments Data
        const testAssessments = [
            {
                id: uuidv4(),
                assessmentId: uuidv4(),
                workflowState: 'DRAFT',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
            },
            {
                id: uuidv4(),
                assessmentId: uuidv4(),
                workflowState: 'IN_REVIEW',
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            },
            {
                id: uuidv4(),
                assessmentId: uuidv4(),
                workflowState: 'APPROVED',
                createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
            }
        ];

        // Insert assessment workflows
        for (const assessment of testAssessments) {
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO assessment_workflows (id, assessment_id, organization_id, project_id, assessment_type, workflow_state, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'DRD', ?, ?, ?, datetime('now'))
                `, [
                    assessment.id,
                    assessment.assessmentId,
                    organizationId,
                    projectId,
                    assessment.workflowState,
                    userId,
                    assessment.createdAt
                ], (err) => err ? reject(err) : resolve());
            });
            console.log(`[Seed] Created assessment: ${assessment.workflowState}`);
        }

        // Create DRD axis data for maturity_assessments table
        const drdAxisData = {
            processes: { asIs: 3, toBe: 5, completed: true },
            digitalProducts: { asIs: 2, toBe: 4, completed: true },
            businessModels: { asIs: 4, toBe: 6, completed: true },
            dataManagement: { asIs: 2, toBe: 5, completed: true },
            culture: { asIs: 3, toBe: 5, completed: true },
            cybersecurity: { asIs: 2, toBe: 4, completed: true },
            aiMaturity: { asIs: 1, toBe: 4, completed: true }
        };

        // Calculate axis scores for table format
        const axisScores = Object.entries(drdAxisData).map(([axis, scores]) => ({
            axis,
            asIs: scores.asIs,
            toBe: scores.toBe
        }));

        // Calculate overall scores
        const overallAsIs = axisScores.reduce((sum, s) => sum + s.asIs, 0) / 7;
        const overallToBe = axisScores.reduce((sum, s) => sum + s.toBe, 0) / 7;
        const overallGap = overallToBe - overallAsIs;

        // Create maturity_assessments table if not exists
        await new Promise((resolve, reject) => {
            db.run(`
                CREATE TABLE IF NOT EXISTS maturity_assessments (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    axis_scores TEXT,
                    completed_axes TEXT,
                    overall_as_is REAL,
                    overall_to_be REAL,
                    overall_gap REAL,
                    is_complete INTEGER DEFAULT 0,
                    assessment_status TEXT DEFAULT 'IN_PROGRESS',
                    finalized_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => err ? reject(err) : resolve());
        });

        // Delete existing maturity assessment for this project
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM maturity_assessments WHERE project_id = ?`, [projectId], (err) => err ? reject(err) : resolve());
        });

        // Insert maturity assessment with full DRD data
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO maturity_assessments (id, project_id, axis_scores, completed_axes, overall_as_is, overall_to_be, overall_gap, is_complete, assessment_status, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'FINALIZED', datetime('now'))
            `, [
                uuidv4(),
                projectId,
                JSON.stringify(axisScores),
                JSON.stringify(Object.keys(drdAxisData)),
                overallAsIs.toFixed(2),
                overallToBe.toFixed(2),
                overallGap.toFixed(2)
            ], (err) => err ? reject(err) : resolve());
        });

        console.log(`[Seed] Created maturity assessment data with scores:`);
        console.log(`       Overall As-Is: ${overallAsIs.toFixed(1)}, To-Be: ${overallToBe.toFixed(1)}, Gap: ${overallGap.toFixed(1)}`);

        console.log('[Seed] ✓ Test assessments seeding complete!');
        console.log(`[Seed] Created 3 assessments: 1 Draft, 1 In Review, 1 Approved`);

        return { success: true, projectId, organizationId };
    } catch (error) {
        console.error('[Seed] Error:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    seedTestAssessments()
        .then(() => {
            console.log('[Seed] Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('[Seed] Failed:', err);
            process.exit(1);
        });
}

module.exports = seedTestAssessments;
