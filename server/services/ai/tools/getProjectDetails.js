/**
 * Tool: get_project_details
 * Fetches full project data from the database
 */

const db = require('../../../database');

async function getProjectDetails(params, context) {
    const { projectId } = params;

    return new Promise((resolve, reject) => {
        db.get(
            `SELECT 
                p.id, p.name, p.description, p.status, p.progress,
                p.start_date, p.end_date, p.owner_id, p.organization_id,
                p.created_at, p.updated_at
             FROM projects p 
             WHERE p.id = ?`,
            [projectId],
            async (err, project) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!project) {
                    resolve({ error: 'Project not found', id: projectId });
                    return;
                }

                // Fetch team members
                db.all(
                    `SELECT u.id, u.name, u.email, pm.role
                     FROM project_members pm
                     JOIN users u ON pm.user_id = u.id
                     WHERE pm.project_id = ?`,
                    [projectId],
                    (err, team) => {
                        if (err) {
                            // Continue without team data
                            team = [];
                        }

                        resolve({
                            id: project.id,
                            name: project.name,
                            description: project.description,
                            status: project.status || 'active',
                            progress: project.progress || 0,
                            startDate: project.start_date,
                            endDate: project.end_date,
                            team: team || [],
                            metrics: {
                                daysRemaining: project.end_date
                                    ? Math.ceil((new Date(project.end_date) - new Date()) / (1000 * 60 * 60 * 24))
                                    : null
                            }
                        });
                    }
                );
            }
        );
    });
}

export default { getProjectDetails };
