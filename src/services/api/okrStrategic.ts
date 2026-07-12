/**
 * OKR CRUD client — Results/M15 pair 3 (D7 slice).
 *
 * Thin wrapper over `Api.get/post/patch/delete` targeting
 * `server/src/routes/resultsStrategic.routes.ts` (`/api/results-strategic/...`),
 * backed by `server/src/services/results/okrService.ts`. Mirrors the
 * KPICreateModal pattern: components call these functions directly, then
 * `onSuccess()`/refetch — no client-side cache/store.
 *
 * Mutations are gated `requireProjectCapability(..., { shadow: true })`
 * server-side (D11, Faza 1 capability rollout) — log-only today, so every
 * call below succeeds regardless of role until CAPABILITY_ENFORCE=enforce.
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_RESULTS_2026-07-10.md §3.3 (D7/D8).
 */
import { Api } from '@/services/api';

type ApiEnvelope<T> = { data?: T } & Partial<T>;

function unwrap<T>(res: ApiEnvelope<T>): T {
  return ((res as any)?.data ?? res) as T;
}

// ─── Cycles ─────────────────────────────────────────────────────────────

export interface OkrCycle {
  id: string;
  organizationId: string;
  name: string;
  periodQuarter: number | null;
  periodYear: number;
  status: 'draft' | 'active' | 'grading' | 'closed';
  deptId: string | null;
  teamId: string | null;
  closedAt: string | null;
  createdAt: string;
}

export async function listOkrCycles(projectId = 'all'): Promise<OkrCycle[]> {
  const res = await Api.get(`/results-strategic/${projectId}/okr/cycles`);
  return unwrap<{ cycles: OkrCycle[] }>(res).cycles ?? [];
}

export async function createOkrCycle(
  projectId: string | undefined,
  input: { name: string; periodYear: number; periodQuarter?: number | null; deptId?: string | null; teamId?: string | null }
): Promise<OkrCycle> {
  const res = await Api.post(`/results-strategic/${projectId || 'all'}/okr/cycles`, input);
  return unwrap<{ cycle: OkrCycle }>(res).cycle;
}

export async function closeOkrCycle(
  projectId: string | undefined,
  cycleId: string
): Promise<{ cycle: OkrCycle; objectives: Array<{ objectiveId: string; score: number; status: string }>; avgScore: number }> {
  const res = await Api.post(`/results-strategic/${projectId || 'all'}/okr/cycles/${cycleId}/close`, {});
  return unwrap(res);
}

// ─── Objectives ─────────────────────────────────────────────────────────

export interface CreateObjectiveInput {
  label: string;
  parentId?: string | null;
  cycleId?: string | null;
  ownerUserId?: string | null;
  description?: string | null;
}

export async function createOkrObjective(
  projectId: string | undefined,
  input: CreateObjectiveInput
): Promise<{ id: string }> {
  const res = await Api.post(`/results-strategic/${projectId || 'all'}/okr/objectives`, input);
  return unwrap(res);
}

export interface UpdateObjectiveInput {
  label?: string;
  parentId?: string | null;
  cycleId?: string | null;
  ownerUserId?: string | null;
  description?: string | null;
  status?: string;
}

export async function updateOkrObjective(
  projectId: string | undefined,
  id: string,
  patch: UpdateObjectiveInput
): Promise<void> {
  await Api.patch(`/results-strategic/${projectId || 'all'}/okr/objectives/${id}`, patch);
}

export async function deleteOkrObjective(projectId: string | undefined, id: string): Promise<void> {
  await Api.delete(`/results-strategic/${projectId || 'all'}/okr/objectives/${id}`);
}

// ─── Key Results ────────────────────────────────────────────────────────

export interface CreateKeyResultInput {
  label: string;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  weight?: number | null;
  kpiId?: string | null;
  krType?: 'metric' | 'milestone';
  kind?: 'committed' | 'aspirational';
  ownerUserId?: string | null;
}

export async function createOkrKeyResult(
  projectId: string | undefined,
  objectiveId: string,
  input: CreateKeyResultInput
): Promise<{ id: string; score: number }> {
  const res = await Api.post(
    `/results-strategic/${projectId || 'all'}/okr/objectives/${objectiveId}/key-results`,
    input
  );
  return unwrap(res);
}

export type UpdateKeyResultInput = Partial<CreateKeyResultInput>;

export async function updateOkrKeyResult(
  projectId: string | undefined,
  id: string,
  patch: UpdateKeyResultInput
): Promise<{ score: number }> {
  const res = await Api.patch(`/results-strategic/${projectId || 'all'}/okr/key-results/${id}`, patch);
  return unwrap(res);
}

export async function deleteOkrKeyResult(projectId: string | undefined, id: string): Promise<void> {
  await Api.delete(`/results-strategic/${projectId || 'all'}/okr/key-results/${id}`);
}

// ─── Check-ins ──────────────────────────────────────────────────────────

export interface OkrCheckIn {
  id: string;
  keyResultId: string;
  confidence: 'green' | 'amber' | 'red' | null;
  value: number | null;
  score: number | null;
  note: string | null;
  checkedAt: string;
  checkedBy: string | null;
}

export async function listOkrCheckIns(
  projectId: string | undefined,
  keyResultId: string
): Promise<OkrCheckIn[]> {
  const res = await Api.get(`/results-strategic/${projectId || 'all'}/okr/key-results/${keyResultId}/check-ins`);
  return unwrap<{ checkIns: OkrCheckIn[] }>(res).checkIns ?? [];
}

export interface CreateCheckInInput {
  confidence?: 'green' | 'amber' | 'red' | null;
  value?: number | null;
  score?: number | null;
  note?: string | null;
}

export async function createOkrCheckIn(
  projectId: string | undefined,
  keyResultId: string,
  input: CreateCheckInInput
): Promise<{ checkIn: OkrCheckIn; score: number }> {
  const res = await Api.post(
    `/results-strategic/${projectId || 'all'}/okr/key-results/${keyResultId}/check-in`,
    input
  );
  return unwrap(res);
}
