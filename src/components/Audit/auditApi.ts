/**
 * auditApi — thin frontend client for the Audit Orchestrator backend
 * (/api/audit/programs) plus the supporting lookups (interview templates, org
 * users) the wizard needs.
 *
 * Uses the shared `Api` helper (axios-like { data } envelope, auth headers,
 * retry) from src/services/api.ts — same client the rest of the interview
 * module uses (e.g. AssignInterviewModal). Org scoping + auth are enforced
 * server-side; the client just sends the bearer token via Api's getHeaders().
 */

import { Api } from '@/services/api';

// ---------------------------------------------------------------------------
// Types (mirror the backend AuditProgram shape)
// ---------------------------------------------------------------------------

export type AuditProgramStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface AuditProgramConfig {
  templateIds?: string[];
  assigneeIds?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan?: AuditPlanRow[] | any[];
  surveysGenerated?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** One advisory "who fills what" row produced by the planner / preset. */
export interface AuditPlanRow {
  /** Section / control area label (bilingual-ready label string). */
  area: string;
  /** Suggested role for the area (e.g. "CISO", "IT Lead"). */
  suggestedRole?: string;
  /** Chosen template id, if mapped. */
  templateId?: string;
  /** Chosen assignee user id, if mapped. */
  assigneeId?: string;
}

export interface AuditProgram {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  objective: string | null;
  status: AuditProgramStatus;
  preset: string | null;
  config: AuditProgramConfig;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProgramInput {
  name: string;
  description?: string | null;
  objective?: string | null;
  status?: AuditProgramStatus;
  preset?: string | null;
  config?: AuditProgramConfig;
}

export type UpdateProgramInput = Partial<CreateProgramInput>;

/** Minimal template/user lookups the wizard renders as multi-select options. */
export interface AuditTemplateOption {
  id: string;
  name: string;
  category?: string;
}

export interface AuditUserOption {
  id: string;
  name: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Program CRUD
// ---------------------------------------------------------------------------

export async function listPrograms(): Promise<AuditProgram[]> {
  const res = await Api.get('/audit/programs');
  return (res?.data?.programs ?? []) as AuditProgram[];
}

export async function getProgram(id: string): Promise<AuditProgram | null> {
  const res = await Api.get(`/audit/programs/${id}`);
  return (res?.data?.program ?? null) as AuditProgram | null;
}

export async function createProgram(input: CreateProgramInput): Promise<AuditProgram> {
  const res = await Api.post('/audit/programs', input);
  return res?.data?.program as AuditProgram;
}

export async function updateProgram(id: string, input: UpdateProgramInput): Promise<AuditProgram> {
  const res = await Api.patch(`/audit/programs/${id}`, input);
  return res?.data?.program as AuditProgram;
}

export async function deleteProgram(id: string): Promise<void> {
  await Api.delete(`/audit/programs/${id}`);
}

// ---------------------------------------------------------------------------
// Lookups for the wizard multi-selects
// ---------------------------------------------------------------------------

/**
 * Interview templates available to pick. Mirrors AssignInterviewModal's
 * `Api.get('/interview/templates')`. Defensive about response shape.
 */
export async function listTemplateOptions(): Promise<AuditTemplateOption[]> {
  try {
    const res = await Api.get('/interview/templates');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = res?.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.templates)
        ? raw.templates
        : [];
    return (
      arr
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((t: any) => ({
          id: String(t.id ?? t.templateId ?? ''),
          name: String(t.name ?? t.title ?? 'Untitled template'),
          category: t.category ? String(t.category) : undefined,
        }))
        .filter((t) => t.id)
    );
  } catch {
    return [];
  }
}

/**
 * Org users available as assignees. Mirrors AssignInterviewModal's
 * `Api.get('/users')` which returns { users, total } or a bare array.
 */
export async function listUserOptions(): Promise<AuditUserOption[]> {
  try {
    const res = await Api.get('/users');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = res?.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = Array.isArray(raw?.users) ? raw.users : Array.isArray(raw) ? raw : [];
    return (
      arr
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((u: any) => ({
          id: String(u.id ?? u.userId ?? ''),
          name: String(u.name ?? u.fullName ?? u.email ?? 'Unknown'),
          email: u.email ? String(u.email) : undefined,
        }))
        .filter((u) => u.id)
    );
  } catch {
    return [];
  }
}
