import { v8Get } from './client';

export interface V8SyncCredentialHealthSummary {
  total: number;
  healthy: number;
  failing: number;
  escalated: number;
}

export const V8SyncApi = {
  getAuthHealth: () => v8Get<{ summary: V8SyncCredentialHealthSummary }>('/sync/auth/health'),
};
