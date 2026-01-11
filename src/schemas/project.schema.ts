/**
 * Project Schema
 */

export interface CreateProjectRequest {
  name: string;
  description?: string;
  organizationId: string;
  methodology?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
}

export const validateCreateProjectRequest = (req: any): req is CreateProjectRequest => {
  return (
    typeof req.name === 'string' && req.name.length > 0 && typeof req.organizationId === 'string'
  );
};

export interface Project {
  id: string;
  name: string;
  organizationId: string;
}

export const ProjectSchema = {
  CreateProjectRequest: {} as CreateProjectRequest,
  UpdateProjectRequest: {} as UpdateProjectRequest,
  Project: {} as Project,
};
