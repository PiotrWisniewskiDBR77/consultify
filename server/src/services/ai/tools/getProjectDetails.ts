/**
 * Tool: get_project_details
 * Fetches full project data from the database.
 */

import * as DbPromise from '../../../utils/DbPromise.ts';

type ProjectParams = {
    projectId: string;
};

type ProjectRow = {
    id: string;
    name: string;
    description?: string;
    status?: string;
    progress?: number;
    start_date?: string | null;
    end_date?: string | null;
    owner_id?: string;
    organization_id?: string;
    created_at?: string;
    updated_at?: string;
};

type TeamRow = {
    id: string;
    name: string;
    email?: string;
    role?: string;
};

export async function getProjectDetails(params: ProjectParams): Promise<Record<string, unknown>> {
    const { projectId } = params;

    const project = await DbPromise.get<ProjectRow>(
        `SELECT 
            p.id, p.name, p.description, p.status, p.progress,
            p.start_date, p.end_date, p.owner_id, p.organization_id,
            p.created_at, p.updated_at
         FROM projects p 
         WHERE p.id = ?`,
        [projectId],
        { fallback: false },
    );

    if (!project) {
        return { error: 'Project not found', id: projectId };
    }

    let team: TeamRow[] = [];
    try {
        team = await DbPromise.all<TeamRow>(
            `SELECT u.id, u.name, u.email, pm.role
             FROM project_members pm
             JOIN users u ON pm.user_id = u.id
             WHERE pm.project_id = ?`,
            [projectId],
            { fallback: true },
        );
    } catch {
        team = [];
    }

    return {
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
                ? Math.ceil((new Date(project.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null,
        },
    };
}

export default { getProjectDetails };
