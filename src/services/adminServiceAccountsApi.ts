import { apiDelete, apiGet, apiPost } from './api/baseClient';

export interface ServiceAccount {
  id: string;
  name: string;
  description: string | null;
  token_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}
interface Envelope<T> {
  success: boolean;
  data?: T;
}

export const getServiceAccounts = async () =>
  (await apiGet<Envelope<ServiceAccount[]>>('/admin/service-accounts')).data ?? [];
export const createServiceAccount = async (body: {
  name: string;
  description?: string;
  scopes: string[];
  expiresInDays?: number;
}) =>
  (
    await apiPost<Envelope<{ account: ServiceAccount; token: string }>>(
      '/admin/service-accounts',
      body
    )
  ).data!;
export const revokeServiceAccount = async (id: string) =>
  apiDelete(`/admin/service-accounts/${encodeURIComponent(id)}`);
