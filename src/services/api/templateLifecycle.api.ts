/**
 * Template Lifecycle API Client (Block A · EPIC-T6).
 *
 * Wraps the lifecycle endpoints introduced in A-S1:
 *
 *   GET  /api/table-platform/templates/lifecycle?status=&category=
 *   POST /api/table-platform/templates/:id/approve
 *   POST /api/table-platform/templates/:id/deprecate
 *
 * The read endpoint is open to any tenant member; mutations require
 * super-admin server-side. UI affordances must mirror that gate via the
 * `isSuperAdmin` prop on each component — server is always authoritative.
 */

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

const BASE = `${API_URL}/table-platform`;

export type TemplateStatus = 'draft' | 'approved' | 'deprecated';

export interface ApprovalHistoryEntry {
  event: 'approved' | 'deprecated' | 'reverted_to_draft' | 'auto_promoted_from_legacy_featured';
  at: string;
  actor: string;
  note?: string;
  previous_status?: TemplateStatus;
}

export interface LifecycleTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  schema_snapshot: Record<string, unknown>;
  is_featured: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  status: TemplateStatus;
  version: string;
  owner_user_id: string | null;
  approval_history: ApprovalHistoryEntry[];
  governance_rules: Record<string, unknown>;
}

export interface ListLifecycleOptions {
  status?: TemplateStatus;
  category?: string;
}

export async function listLifecycleTemplates(
  options: ListLifecycleOptions = {}
): Promise<LifecycleTemplate[]> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.category) params.set('category', options.category);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchWithRetry(`${BASE}/templates/lifecycle${qs}`, {
    headers: getHeaders(),
  });
  const body = await handleResponse<LifecycleTemplate[] | { items?: LifecycleTemplate[] }>(
    res,
    'Failed to list lifecycle templates'
  );
  if (Array.isArray(body)) return body;
  return body?.items ?? [];
}

export async function approveTemplate(
  templateId: string,
  note?: string
): Promise<LifecycleTemplate> {
  const res = await fetchWithRetry(`${BASE}/templates/${templateId}/approve`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(note ? { note } : {}),
  });
  return handleResponse<LifecycleTemplate>(res, 'Failed to approve template');
}

export async function deprecateTemplate(
  templateId: string,
  note?: string
): Promise<LifecycleTemplate> {
  const res = await fetchWithRetry(`${BASE}/templates/${templateId}/deprecate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(note ? { note } : {}),
  });
  return handleResponse<LifecycleTemplate>(res, 'Failed to deprecate template');
}

export async function getTemplate(templateId: string): Promise<LifecycleTemplate> {
  const res = await fetchWithRetry(`${BASE}/templates/${templateId}`, {
    headers: getHeaders(),
  });
  return handleResponse<LifecycleTemplate>(res, 'Failed to load template');
}
