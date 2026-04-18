/**
 * feedbackShape
 *
 * Pure helpers that turn raw feedback rows + `metadata_json` blobs into the
 * canonical shape consumed by the Superadmin UI and the Cursor brief.
 *
 * Extracted from `routes/feedback.routes.ts` so it can be unit-tested in
 * isolation without standing up Express, middleware or a DB mock.
 */
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeedbackWorkflowRecord = {
  owner?: string | null;
  cluster?: string | null;
  source?: string | null;
  branch?: string | null;
  prUrl?: string | null;
  taskUrl?: string | null;
  linkedTaskId?: string | null;
  deployStatus?: string | null;
  deployTargets?: string[];
  deployedAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  waitingOn?: string | null;
  lastUpdatedAt?: string | null;
};

export type FeedbackResolutionRecord = {
  type?: string | null;
  summary?: string | null;
  rootCause?: string | null;
  verificationNotes?: string | null;
  testPlan?: string[];
};

export type FeedbackWorkflowTimelineEntry = {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  note?: string | null;
  changes?: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function safeJsonParse<T = unknown>(raw: unknown, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function compactObject<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === undefined) return false;
      if (value === null) return false;
      if (typeof value === 'string' && !value.trim()) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  ) as Partial<T>;
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
}

export function normalizeWorkflowMeta(meta: Record<string, unknown>): FeedbackWorkflowRecord {
  const raw = meta.workflow;
  const workflow =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return compactObject({
    owner: typeof workflow.owner === 'string' ? (workflow.owner as string) : null,
    cluster: typeof workflow.cluster === 'string' ? (workflow.cluster as string) : null,
    source: typeof workflow.source === 'string' ? (workflow.source as string) : null,
    branch: typeof workflow.branch === 'string' ? (workflow.branch as string) : null,
    prUrl: typeof workflow.prUrl === 'string' ? (workflow.prUrl as string) : null,
    taskUrl: typeof workflow.taskUrl === 'string' ? (workflow.taskUrl as string) : null,
    linkedTaskId:
      typeof workflow.linkedTaskId === 'string'
        ? (workflow.linkedTaskId as string)
        : typeof meta.linkedTaskId === 'string'
          ? (meta.linkedTaskId as string)
          : null,
    deployStatus:
      typeof workflow.deployStatus === 'string' ? (workflow.deployStatus as string) : null,
    deployTargets: normalizeStringArray(workflow.deployTargets),
    deployedAt: typeof workflow.deployedAt === 'string' ? (workflow.deployedAt as string) : null,
    verifiedBy: typeof workflow.verifiedBy === 'string' ? (workflow.verifiedBy as string) : null,
    verifiedAt: typeof workflow.verifiedAt === 'string' ? (workflow.verifiedAt as string) : null,
    waitingOn: typeof workflow.waitingOn === 'string' ? (workflow.waitingOn as string) : null,
    lastUpdatedAt:
      typeof workflow.lastUpdatedAt === 'string' ? (workflow.lastUpdatedAt as string) : null,
  });
}

export function normalizeResolutionMeta(meta: Record<string, unknown>): FeedbackResolutionRecord {
  const raw = meta.resolution;
  const resolution =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return compactObject({
    type: typeof resolution.type === 'string' ? (resolution.type as string) : null,
    summary: typeof resolution.summary === 'string' ? (resolution.summary as string) : null,
    rootCause: typeof resolution.rootCause === 'string' ? (resolution.rootCause as string) : null,
    verificationNotes:
      typeof resolution.verificationNotes === 'string'
        ? (resolution.verificationNotes as string)
        : null,
    testPlan: normalizeStringArray(resolution.testPlan),
  });
}

export function normalizeWorkflowTimeline(
  meta: Record<string, unknown>
): FeedbackWorkflowTimelineEntry[] {
  const raw = meta.workflowTimeline;
  if (!Array.isArray(raw)) return [];
  const entries: FeedbackWorkflowTimelineEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    entries.push({
      id: typeof record.id === 'string' ? (record.id as string) : uuidv4(),
      at: typeof record.at === 'string' ? (record.at as string) : new Date().toISOString(),
      actor: typeof record.actor === 'string' ? (record.actor as string) : null,
      action: typeof record.action === 'string' ? (record.action as string) : 'updated',
      note: typeof record.note === 'string' ? (record.note as string) : null,
      changes: normalizeStringArray(record.changes),
    });
  }
  return entries;
}

export function shapeFeedbackRow(row: Record<string, unknown>): Record<string, unknown> {
  const meta = safeJsonParse<Record<string, unknown>>(row.metadata, {});
  const resolvedUserEmail = row.user_email || (meta.userEmail as string | undefined) || null;
  const resolvedUserName =
    row.user_name || (meta.userName as string | undefined) || row.user_id || null;
  const workflow = normalizeWorkflowMeta(meta);
  const resolution = normalizeResolutionMeta(meta);
  const workflowTimeline = normalizeWorkflowTimeline(meta);

  // Triage surface: duplicate count + signatureHash as top-level fields so
  // list / board cards don't have to re-parse metadata_json on the client.
  const duplicateCandidatesRaw = Array.isArray(
    (meta as Record<string, unknown>).duplicateCandidates
  )
    ? ((meta as Record<string, unknown>).duplicateCandidates as Array<{
        id?: string;
        title?: string | null;
      }>)
    : [];
  const duplicateCount =
    typeof (meta as Record<string, unknown>).duplicateCount === 'number'
      ? ((meta as Record<string, unknown>).duplicateCount as number)
      : duplicateCandidatesRaw.length;
  const signatureHash =
    typeof (meta as Record<string, unknown>).signatureHash === 'string' &&
    ((meta as Record<string, unknown>).signatureHash as string).trim()
      ? String((meta as Record<string, unknown>).signatureHash).trim()
      : null;
  const dossier =
    (meta as Record<string, unknown>).dossier &&
    typeof (meta as Record<string, unknown>).dossier === 'object'
      ? ((meta as Record<string, unknown>).dossier as Record<string, unknown>)
      : null;
  const hasScreenshot =
    !!dossier && typeof dossier.screenshot === 'object' && dossier.screenshot !== null;
  const hasDiagnostics =
    !!dossier &&
    (Array.isArray(dossier.consoleLogs) ||
      Array.isArray(dossier.networkErrors) ||
      Array.isArray(dossier.breadcrumbs) ||
      !!dossier.lastUncaughtError);

  return {
    ...row,
    user_email: resolvedUserEmail,
    user_name: resolvedUserName,
    route_path:
      (meta.routePath as string | undefined) || (meta.context as string | undefined) || null,
    device_type: (meta.deviceType as string | undefined) || null,
    screen_size: (meta.screenSize as string | undefined) || null,
    ui_language: (meta.uiLanguage as string | undefined) || null,
    ui_theme: (meta.uiTheme as string | undefined) || null,
    metadata: row.metadata ? String(row.metadata) : null,
    workflow,
    resolution,
    workflowTimeline,
    owner: workflow.owner || null,
    cluster: workflow.cluster || null,
    pr_url: workflow.prUrl || null,
    branch: workflow.branch || null,
    deploy_status: workflow.deployStatus || null,
    deploy_targets: workflow.deployTargets || [],
    resolution_summary: resolution.summary || null,
    duplicate_count: duplicateCount,
    duplicate_of: (meta as Record<string, unknown>).duplicateOf || null,
    signature_hash: signatureHash,
    has_screenshot: hasScreenshot,
    has_diagnostics: hasDiagnostics,
  };
}
