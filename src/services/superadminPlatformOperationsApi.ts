import { apiGet, apiPost } from './api/baseClient';

export interface PlatformTarget {
  id: string;
  name: string;
  status?: string;
  affectedTenants?: number;
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
  const responses = await Promise.allSettled([
    apiGet<unknown>('/superadmin/organizations'),
    apiGet<unknown>('/superadmin/users'),
    apiGet<unknown>('/superadmin/connectors'),
    apiGet<unknown>('/virtual-workers'),
  ]);
  const value = (index: number) =>
    responses[index]?.status === 'fulfilled' ? responses[index].value : undefined;
  const organizationsResponse = value(0);
  const usersResponse = value(1);
  const connectorsResponse = value(2);
  const workersResponse = value(3);
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
    connectors: listPayload(connectorsResponse, ['connectors', 'items']).map((item) => ({
      id: String(item.id),
      name: String(item.name || item.id),
      affectedTenants: Number(item.affectedTenants || 0),
    })),
    virtualWorkers: listPayload(workersResponse, ['workers', 'items']).map((item) => ({
      id: String(item.id),
      name: String(item.name || item.slug || item.id),
      status: String(item.status || ''),
    })),
  };
};

export const runPlatformOperation = (
  path: string,
  body: { confirmation: true; reason: string; confirmTenantName?: string }
) => apiPost<Record<string, unknown>>(`/superadmin${path}`, body);
