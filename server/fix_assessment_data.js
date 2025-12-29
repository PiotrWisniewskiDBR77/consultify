const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

async function fixAssessmentData() {
    console.log('Starting Assessment Data Fix...');

    try {
        // 1. Map orphaned project_ids to their organizations BEFORE updating
        const mapping = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT project_id, organization_id 
                FROM assessment_workflows 
                WHERE project_id NOT IN (SELECT id FROM projects) OR project_id IS NULL
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`Found ${mapping.length} orphaned project mappings in workflows.`);

        const orgToTargetProject = {};

        for (const item of mapping) {
            const orgId = item.organization_id;
            const oldProjectId = item.project_id;

            if (!orgToTargetProject[orgId]) {
                const targetProject = await new Promise((resolve, reject) => {
                    db.get(`SELECT id FROM projects WHERE organization_id = ? LIMIT 1`, [orgId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                if (targetProject) {
                    orgToTargetProject[orgId] = targetProject.id;
                }
            }

            const targetProjectId = orgToTargetProject[orgId];
            if (targetProjectId) {
                console.log(`Processing org ${orgId}: old_project=${oldProjectId} -> target_project=${targetProjectId}`);

                // Update assessment_workflows
                await new Promise((resolve, reject) => {
                    db.run(`
                        UPDATE assessment_workflows 
                        SET project_id = ? 
                        WHERE organization_id = ? AND (project_id = ? OR (project_id IS NULL AND ? IS NULL))
                    `, [targetProjectId, orgId, oldProjectId, oldProjectId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Update maturity_assessments if orphaned
                if (oldProjectId) {
                    await new Promise((resolve, reject) => {
                        db.get(`SELECT count(*) as count FROM maturity_assessments WHERE project_id = ?`, [targetProjectId], (err, row) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            if (row.count > 0) {
                                console.log(`Project ${targetProjectId} already has a maturity record. Deleting orphaned record ${oldProjectId}.`);
                                db.run(`DELETE FROM maturity_assessments WHERE project_id = ?`, [oldProjectId], (e) => {
                                    if (e) reject(e); else resolve();
                                });
                            } else {
                                db.run(`UPDATE maturity_assessments SET project_id = ? WHERE project_id = ?`, [targetProjectId, oldProjectId], (e) => {
                                    if (e) reject(e); else resolve();
                                });
                            }
                        });
                    });
                }
            } else {
                console.warn(`No valid project found for organization ${orgId}. Cannot relink.`);
            }
        }

        console.log('Data fix completed successfully.');

    } catch (error) {
        console.error('Error during data fix:', error);
    } finally {
        db.close();
    }
}

fixAssessmentData();
