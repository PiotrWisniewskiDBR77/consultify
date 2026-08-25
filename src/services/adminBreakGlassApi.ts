import { apiDelete, apiGet, apiPost } from './api/baseClient';
export interface BreakGlassSession {
  id: string;
  adminId: string;
  expiresAt: string;
  breakGlassReason?: string;
  approvedBy?: string;
  sessionType: string;
}
export interface BreakGlassData {
  sessions: BreakGlassSession[];
  policy: { breakGlassEnabled: boolean; breakGlassApprovers: string[] };
  approvers: { id: string; email: string; first_name?: string; last_name?: string }[];
}
export async function getBreakGlass() {
  return apiGet<BreakGlassData>('/admin/break-glass/sessions');
}
export async function createBreakGlass(breakGlassReason: string, approvedBy: string) {
  return apiPost<BreakGlassData>('/admin/break-glass/sessions', { breakGlassReason, approvedBy });
}
export async function revokeBreakGlass(id: string) {
  return apiDelete<BreakGlassData>(`/admin/break-glass/sessions/${encodeURIComponent(id)}`);
}
