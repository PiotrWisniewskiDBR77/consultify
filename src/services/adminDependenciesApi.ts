import { apiGet } from './api/baseClient';

export type DependencyStatus = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface AdminDependency {
  dependencyId: string;
  label: string;
  kind: 'database' | 'internal_service' | 'queue' | 'external_provider';
  status: DependencyStatus;
  probeIds: string[];
  lastCheckedAt: string | null;
}

export interface AdminDependenciesResponse {
  success: true;
  dependencies: AdminDependency[];
  undeclaredProbes: string[];
  generatedAt: string;
}

export const getAdminDependencies = () =>
  apiGet<AdminDependenciesResponse>('/admin/health-panel/dependencies');
