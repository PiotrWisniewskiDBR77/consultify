/**
 * Tool: get_project_details
 * Fetches full project data from the database.
 */

import * as DbPromise from '../../../utils/DbPromise.js';

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
    // Silent-degr fix: projects has no `progress`/`end_date` columns
    // (real: progress_pct, target_end_date/actual_end_date). With fallback:false
    // this query THREW on every call, so getProjectDetails always errored out.
    `SELECT
            p.id, p.name, p.description, p.status, p.progress_pct AS progress,
            p.start_date, COALESCE(p.actual_end_date, p.target_end_date) AS end_date,
            p.owner_id, p.organization_id,
            p.created_at, p.updated_at
         FROM projects p
         WHERE p.id = ?`,
    [projectId],
    { fallback: false }
  );

  if (!project) {
    return { error: 'Project not found', id: projectId };
  }

  let team: TeamRow[] = [];
  try {
    team = await DbPromise.all<TeamRow>(
      // Silent-degr fix: users has no `name` (first_name/last_name), and
      // project_members has no `role` (project_role/normalized_project_role).
      // Both bogus columns errored the whole query -> DbPromise fallback -> [].
      `SELECT u.id,
              COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.display_name, u.email) as name,
              u.email,
              COALESCE(pm.normalized_project_role, pm.project_role) as role
             FROM project_members pm
             JOIN users u ON pm.user_id = u.id
             WHERE pm.project_id = ?`,
      [projectId],
      { fallback: true }
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
