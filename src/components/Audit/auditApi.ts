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
  /** Ids of interview assignments created by bulk generation (#19). */
  generatedAssignmentIds?: string[];
  /** Snapshot of the last generation run. */
  generation?: {
    requested: number;
    created: number;
    failed: number;
    at: string;
  };
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

/** Paginated list envelope from GET /audit/programs (#19e). */
export interface ListProgramsResult {
  programs: AuditProgram[];
  total: number;
  limit: number;
  offset: number;
}

/** Result of POST /audit/programs/:id/generate-surveys (#19). */
export interface GenerateSurveysResult {
  program: AuditProgram;
  requested: number;
  created: number;
  failed: number;
  errors: Array<{ templateId: string; assigneeId: string; message: string; code?: string }>;
  alreadyGenerated: boolean;
}

/** Completion rollup from GET /audit/programs/:id/completion (#19e). */
export interface ProgramCompletion {
  generated: boolean;
  total: number;
  done: number;
  percent: number;
  byStatus: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Program CRUD
// ---------------------------------------------------------------------------

export interface ListProgramsParams {
  limit?: number;
  offset?: number;
  /** Free-text search (server-side, L-02). Matched over name/objective/description. */
  search?: string;
  /** Status filter ('all' or omitted = no filter). */
  status?: AuditProgramStatus | 'all';
}

export async function listPrograms(params: ListProgramsParams = {}): Promise<ListProgramsResult> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set('limit', String(params.limit));
  if (params.offset !== undefined) search.set('offset', String(params.offset));
  if (params.search && params.search.trim()) search.set('search', params.search.trim());
  if (params.status && params.status !== 'all') search.set('status', params.status);
  const qs = search.toString();
  const res = await Api.get(`/audit/programs${qs ? `?${qs}` : ''}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = res?.data ?? {};
  const programs = (data.programs ?? []) as AuditProgram[];
  return {
    programs,
    total: Number(data.total ?? programs.length),
    limit: Number(data.limit ?? programs.length),
    offset: Number(data.offset ?? 0),
  };
}

export async function getProgram(id: string): Promise<AuditProgram | null> {
  const res = await Api.get(`/audit/programs/${id}`);
  return (res?.data?.program ?? null) as AuditProgram | null;
}

export async function createProgram(input: CreateProgramInput): Promise<AuditProgram> {
  const res = await Api.post('/audit/programs', input);
  return res?.data?.program as AuditProgram;
}

/** Edit base program fields through the signed-in beta editor. */
export async function updateProgram(id: string, input: UpdateProgramInput): Promise<AuditProgram> {
  const res = await Api.patch(`/audit/programs/${id}`, input);
  return res?.data?.program as AuditProgram;
}

export async function reopenProgram(id: string): Promise<AuditProgram> {
  const res = await Api.post(`/audit/programs/${id}/reopen`, {});
  return res?.data?.program as AuditProgram;
}

export async function deleteProgram(id: string): Promise<void> {
  await Api.delete(`/audit/programs/${id}`);
}

/**
 * Bulk-generate the underlying interview assignments for a program (#19):
 * cartesian of selected templateIds × assigneeIds, created via the canonical
 * interview assignment path server-side. Idempotent + partial-failure aware.
 */
export async function generateSurveys(id: string): Promise<GenerateSurveysResult> {
  const res = await Api.post(`/audit/programs/${id}/generate-surveys`, {});
  return res?.data as GenerateSurveysResult;
}

/** Completion rollup for a program (#19e). */
export async function getCompletion(id: string): Promise<ProgramCompletion> {
  const res = await Api.get(`/audit/programs/${id}/completion`);
  return (res?.data?.completion ?? {
    generated: false,
    total: 0,
    done: 0,
    percent: 0,
    byStatus: {},
  }) as ProgramCompletion;
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
