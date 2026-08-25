import { apiDelete, apiGet, apiPost, apiPut } from './api/baseClient';
export interface SecurityRole {
  id: string;
  name: string;
  permissions: string[];
  created_at?: string;
  updated_at?: string;
}
export async function getSecurityRoles() {
  return (await apiGet<{ roles: SecurityRole[] }>('/security/roles')).roles ?? [];
}
export async function createSecurityRole(name: string, permissions: string[]) {
  await apiPost('/security/roles', { name, permissions });
  return getSecurityRoles();
}
export async function updateSecurityRole(id: string, name: string, permissions: string[]) {
  await apiPut(`/security/roles/${encodeURIComponent(id)}`, { name, permissions });
  return getSecurityRoles();
}
export async function deleteSecurityRole(id: string) {
  await apiDelete(`/security/roles/${encodeURIComponent(id)}`);
  return getSecurityRoles();
}
