import { apiDelete, apiGet } from './api/baseClient';
export interface AdminSession {
  id: string;
  user_id: string;
  user_email: string;
  first_name?: string;
  last_name?: string;
  device_info?: string;
  user_agent?: string;
  ip_address?: string;
  location?: string;
  last_activity?: string;
  expires_at?: string;
}
export async function getAdminSessions() {
  return (await apiGet<{ sessions: AdminSession[] }>('/admin/sessions')).sessions ?? [];
}
export async function revokeAdminSession(id: string) {
  await apiDelete(`/admin/sessions/${encodeURIComponent(id)}`);
  return getAdminSessions();
}
