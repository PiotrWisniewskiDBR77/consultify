import { apiDelete, apiGet, apiPost, apiPut } from './api/baseClient';

export type DomainVerificationStatus =
  | 'verified'
  | 'token_mismatch'
  | 'no_record'
  | 'domain_not_found'
  | 'timeout'
  | 'dns_error'
  | 'invalid_token';

export interface AdminDomain {
  id: string;
  domain: string;
  autoJoin: boolean;
  verified: boolean;
  verifiedAt: string | null;
  verificationMethod: string;
  verificationToken: string;
  addedAt: string;
}

export interface DnsInstruction {
  name: string;
  type: 'TXT';
  value: string;
}

export interface DomainVerificationOutcome {
  status: DomainVerificationStatus;
  checkedNames: string[];
  foundRecordCount: number;
  checkedAt: string;
  detail?: string;
}

export const getAdminDomains = async () =>
  (await apiGet<{ success: true; domains: AdminDomain[] }>('/admin/domains')).domains;

export const createAdminDomain = async (body: { domain: string; autoJoin: boolean }) =>
  apiPost<{ success: true; domain: AdminDomain; instruction: DnsInstruction }>(
    '/admin/domains',
    body
  );

export const updateAdminDomain = async (id: string, autoJoin: boolean) =>
  apiPut(`/admin/domains/${encodeURIComponent(id)}`, { autoJoin });

export const deleteAdminDomain = async (id: string) =>
  apiDelete(`/admin/domains/${encodeURIComponent(id)}`);

export const verifyAdminDomain = async (id: string) =>
  (
    await apiPost<{ success: true; outcome: DomainVerificationOutcome }>(
      `/admin/domains/${encodeURIComponent(id)}/verify`,
      {}
    )
  ).outcome;
