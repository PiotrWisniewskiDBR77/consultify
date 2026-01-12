import { Project, ProjectSchema } from '../../schemas/project.schema';
import { API_URL, fetchWithRetry, getHeaders, handleResponse } from '../apiUtils';

export const ProjectService = {
    getProjects: async (): Promise<Project[]> => {
        const res = await fetchWithRetry(`${API_URL}/projects`, { headers: getHeaders() });
        const data = await handleResponse(res, 'Failed to fetch projects');
        return data.map((p: any) => ProjectSchema.parse(p));
    },

    createProject: async (data: { name: string; ownerId?: string }): Promise<Project> => {
        const res = await fetchWithRetry(`${API_URL}/projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        const json = await handleResponse(res, 'Failed to create project');
        return ProjectSchema.parse(json);
    },

    deleteProject: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        await handleResponse(res, 'Failed to delete project');
    },

    getProjectDetails: async (id: string): Promise<Project> => {
        const res = await fetchWithRetry(`${API_URL}/projects/${id}`, { headers: getHeaders() });
        const json = await handleResponse(res, 'Failed to fetch project details');
        return ProjectSchema.parse(json);
    },

    updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
        const res = await fetchWithRetry(`${API_URL}/projects/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        const json = await handleResponse(res, 'Failed to update project');
        return ProjectSchema.parse(json);
    },

    getAssessmentReports: async (projectId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/assessment-reports?projectId=${projectId}`, {
            headers: getHeaders(),
        });
        const data = await handleResponse(res, 'Failed to list reports');
        return data.reports || [];
    },

    generateAssessmentReport: async (projectId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/assessment-reports`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ assessmentId: projectId, projectId }),
        });
        return handleResponse(res, 'Failed to generate report');
    },

    getAssessmentReport: async (reportId: string): Promise<any> => {
        const res = await fetchWithRetry(`${API_URL}/assessment-reports/${reportId}`, {
            headers: getHeaders(),
        });
        return handleResponse(res, 'Failed to load report');
    },

    suggestInitiativeTasks: async (initiativeId: string): Promise<any[]> => {
        const res = await fetchWithRetry(`${API_URL}/initiatives/${initiativeId}/tasks/suggest`, {
            method: 'POST',
            headers: getHeaders(),
        });
        return handleResponse(res, 'Failed to suggest tasks');
    },
};
