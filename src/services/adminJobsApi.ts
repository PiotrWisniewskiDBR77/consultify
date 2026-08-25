import { apiGet } from './api/baseClient';
export interface AdminJob {
  id: string;
  job_type: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempt_count: number;
  max_attempts: number;
  last_error?: string | null;
  available_at: string;
  created_at: string;
}
export async function getAdminJobs(status = '', limit = 50): Promise<AdminJob[]> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (status) query.set('status', status);
  return (await apiGet<{ jobs: AdminJob[] }>(`/admin/health-panel/jobs?${query}`)).jobs ?? [];
}
