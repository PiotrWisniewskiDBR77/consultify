import { apiGet, apiPost } from './api/baseClient';

export interface PlatformTarget {
  id: string;
  name: string;
  status?: string;
}

const listPayload = (value: unknown, keys: string[]): any[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, any>;
  for (const key of keys) if (Array.isArray(record[key])) return record[key];
  if (record.data) return listPayload(record.data, keys);
  return [];
};

export const getPlatformOperationTargets = async () => {
  const [organizationsResponse, usersResponse] = await Promise.all([
    apiGet<unknown>('/superadmin/organizations'),
    apiGet<unknown>('/superadmin/users'),
  ]);
  return {
    organizations: listPayload(organizationsResponse, ['organizations', 'items']).map((item) => ({
      id: String(item.id),
      name: String(item.name || item.organization_name || item.id),
      status: String(item.status || ''),
    })),
    users: listPayload(usersResponse, ['users', 'items']).map((item) => ({
      id: String(item.id),
      name: String(item.email || item.name || item.id),
      status: String(item.status || ''),
    })),
  };
};

export const runPlatformOperation = (
  path: string,
  body: { confirmation: true; reason: string; confirmTenantName?: string }
) => apiPost<Record<string, unknown>>(`/superadmin${path}`, body);
