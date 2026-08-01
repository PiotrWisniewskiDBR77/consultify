import { v8Delete, v8Get, v8Post, v8PostMultipart, v8Put } from './client';

export type V8MyWorkRoofStatus = 'mixed_truth' | 'partially_coherent' | 'coherent';
export type V8MyWorkRoofMaturity =
  | 'backed_by_real_service'
  | 'partial_stitched'
  | 'placeholder_non_canonical';

export interface V8MyWorkRoofSummary {
  generatedAt: string;
  overallStatus: V8MyWorkRoofStatus;
  surfaceMode: string;
  contracts: {
    homeV2Endpoint: boolean;
    radarEndpoint: boolean;
    homeViewUsesAggregatedContract: boolean;
    outputsBridgeVisible: boolean;
  };
  homeBlocks: Array<{
    blockName: string;
    maturityLevel: V8MyWorkRoofMaturity;
    serviceRef: string | null;
    lastAuditedAt: string;
    source: 'persisted' | 'derived';
    rationale: string;
  }>;
  counts: Record<V8MyWorkRoofMaturity, number>;
  inboxMaterialization: {
    avgLatencyMs: number;
    latencyBandDistribution: {
      near_realtime: number;
      operational: number;
      degraded: number;
    };
    status: 'observed' | 'not_proven_yet';
  };
  calendar: Array<{
    phaseName: string;
    status: string;
    blockedBy: string | null;
    source: 'persisted' | 'derived';
    rationale: string;
  }>;
}

export interface V8CanonicalInboxStats {
  total: number;
  byPriority: Record<string, number>;
  bySection: Record<string, number>;
  byStatus: Record<string, number>;
  bySlaStatus: Record<string, number>;
}

export interface V8CanonicalInboxItem {
  id: string;
  userId: string;
  organizationId: string;
  itemType: 'task' | 'decision' | 'approval' | 'signal' | 'mention' | 'escalation';
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description?: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  section: string;
  status: 'pending' | 'triaged' | 'delegated' | 'resolved' | 'snoozed';
  slaDeadline?: string;
  slaStatus: 'on_track' | 'at_risk' | 'breached' | 'resolved';
  delegatedTo?: string;
  delegatedAt?: string;
  delegatedBy?: string;
  delegationNotes?: string;
  metadata?: Record<string, unknown>;
  /**
   * Status of the SOURCE task/decision at materialization time — distinct
   * from this inbox item's own triage `status` above. Copied at upsert time
   * (server: inboxService.ts rowToItem), not a live join. Always undefined
   * for notification-sourced items. Genuinely optional/nullable.
   */
  sourceStatus?: string;
  /**
   * initiative_id of the SOURCE task/decision, copied at materialization
   * time. Always undefined for notification-sourced items. Genuinely
   * optional/nullable.
   */
  initiativeId?: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface V8CanonicalInboxMaterializeResult {
  success: boolean;
  upserted?: number;
}

export type V8InboxTriageAction =
  | 'accept_today'
  | 'accept_week'
  | 'accept_later'
  | 'schedule'
  | 'delegate'
  | 'archive'
  | 'dismiss'
  | 'done'
  | 'save'
  | 'reject';

export interface V8InboxTriageResult {
  success: boolean;
  triagedAt: string;
  item: V8CanonicalInboxItem | null;
}

export interface V8InboxBulkTriageResult {
  success: boolean;
  triagedAt: string;
  processed: number;
}

export interface V8InboxAiAssistResult {
  brief: string;
  bullets: string[];
  recommendedAction: V8InboxTriageAction;
  recommendedReason: string;
}

export interface V8CanonicalInboxTableParams {
  section?: string;
  status?: 'pending' | 'resolved' | 'snoozed';
  priority?: string;
  slaStatus?: string;
  limit?: number;
  offset?: number;
}

export interface V8NotebookPage {
  id: string;
  ownerUserId?: string;
  organizationId?: string;
  projectId?: string | null;
  visibility?: string | null;
  title: string;
  contentJson: Record<string, unknown>;
  contentText?: string | null;
  tags: string[];
  maturity?: string | null;
  icon?: string | null;
  summary?: string | null;
  status: string;
  pinned: boolean;
  verificationStatus?: string;
  reviewCadence?: string;
  staleAt?: string | null;
  lastReviewedAt?: string | null;
  captureSource?: string | null;
  captureMetadata?: {
    captureSource?: string | null;
    url?: string | null;
    emailFrom?: string | null;
    fileOriginalname?: string | null;
    fileMimetype?: string | null;
    storedSourceFile?: boolean;
    sourceFileSizeBytes?: number | null;
    [key: string]: unknown;
  } | null;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
    uploadedBy?: string;
  }>;
  convertedTo?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface V8NotebookPageFilters {
  projectId?: string | null;
  status?: string;
  pinned?: boolean;
  sort?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface V8NotebookClassification {
  pageId: string;
  suggestedType: string;
  reason: string;
  maturity?: string | null;
  /** L-06: classification is rule-based keyword scoring, NOT an LLM. */
  method?: 'heuristic';
}

export interface V8NotebookAIProposal {
  id: string;
  pageId: string;
  actorId: string;
  proposalType: 'insert' | 'replace' | 'append';
  blockContent: Record<string, unknown>;
  rationale?: string;
  status: 'proposed' | 'accepted' | 'rejected';
  createdAt?: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface V8CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: string;
  sourceId: string;
  color?: string;
  status?: string;
  priority?: string;
  description?: string;
  visibilityClass?: 'free_busy_only' | 'details';
  editAuthority?: 'none' | 'local_only' | 'remote_owner' | 'delegate';
  syncState?: 'in_sync' | 'pending' | 'conflict' | 'blocked' | 'stale';
  permissionGradient?: 'free_busy' | 'read' | 'write' | 'delegate';
  etag?: string;
}

export interface V8CalendarConflictItem {
  id: string;
  title: string;
  due_date?: string | null;
  deadline?: string | null;
}

export interface V8CalendarConflicts {
  date: string;
  tasks: V8CalendarConflictItem[];
  decisions: V8CalendarConflictItem[];
  totalItems: number;
  hasConflicts: boolean;
  suggestion?: string | null;
}

export interface V8CalendarUnifiedFilters {
  start?: string;
  end?: string;
  sources?: string[];
  projectId?: string;
  ownership?: 'any' | 'assignee' | 'owner';
}

export const V8MyWorkApi = {
  getRoofSummary: () => v8Get<V8MyWorkRoofSummary>('/my-work/roof/summary'),
  getCanonicalInboxTable: (params?: V8CanonicalInboxTableParams) =>
    v8Get<{ items: V8CanonicalInboxItem[] }>(
      '/my-work/inbox/canonical',
      params
        ? Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]))
        : undefined
    ),
  getCanonicalInboxStats: () => v8Get<V8CanonicalInboxStats>('/my-work/inbox/canonical/stats'),
  materializeCanonicalInbox: () =>
    v8Post<V8CanonicalInboxMaterializeResult>('/my-work/inbox/canonical/materialize'),
  triageCanonicalInboxItem: (
    itemId: string,
    body: {
      action: V8InboxTriageAction;
      itemKey: string;
      params?: Record<string, unknown>;
      fromAISuggestion?: boolean;
      confidence?: number;
    }
  ) => v8Post<V8InboxTriageResult>(`/my-work/inbox/${encodeURIComponent(itemId)}/triage`, body),
  bulkTriageCanonicalInbox: (body: {
    items?: Array<{ itemId?: string; itemKey: string }>;
    itemKeys: string[];
    action: V8InboxTriageAction;
    params?: Record<string, unknown>;
    aiItems?: Array<{ itemKey: string; confidence?: number | null }>;
  }) => v8Post<V8InboxBulkTriageResult>('/my-work/inbox/bulk-triage', body),
  /**
   * Golden-flow Inbox close, keyed by the Task (source of truth) — Step 2 of
   * Task-assigned → Inbox item → accept/in-progress → Inbox closes.
   * `taskId`, not the inbox item id: server re-reads the task and derives
   * ownership/org from the auth context, never trusting the caller. The
   * optional `expectedStatus` lets a caller assert the status it just read
   * back from Step 1, surfacing a 409 (INBOX_CLOSE_STATE_MISMATCH) if the
   * task changed underneath it instead of silently closing against stale
   * state. See server/src/routes/v8/my-work.routes.ts
   * `POST /inbox/tasks/:taskId/close` — errors carry `.data.code` (e.g.
   * `V8_ORG_DISABLED`, `INBOX_CLOSE_FORBIDDEN`, `INBOX_CLOSE_STATE_MISMATCH`,
   * `INBOX_CLOSE_RECOVERY_REQUIRED`) via the shared `handleResponse` error
   * shape (`err.status` / `err.data`).
   */
  closeInboxTaskItem: (taskId: string, body?: { expectedStatus?: string }) =>
    v8Post<{
      success: boolean;
      taskId: string;
      status: 'closed' | 'already_closed' | 'not_materialized';
      inboxItem: V8CanonicalInboxItem | null;
    }>(`/my-work/inbox/tasks/${encodeURIComponent(taskId)}/close`, body),
  aiAssistInboxItem: (body: {
    language?: string;
    item: {
      title: string;
      description?: string;
      type?: string;
      section?: string;
      urgency?: string;
      receivedAt?: string;
      dueDate?: string;
      sla?: {
        level?: string;
        remainingMs?: number;
        isBreached?: boolean;
      } | null;
      reason?: string;
      linkedTaskId?: string;
      linkedDecisionId?: string;
      source?: { type?: 'user' | 'system' | 'ai'; userName?: string } | null;
    };
  }) => v8Post<{ result: V8InboxAiAssistResult }>('/my-work/inbox/ai-assist', body),
  getNotebookPages: (filters?: V8NotebookPageFilters) =>
    v8Get<V8NotebookPage[]>(
      '/my-work/notebook/pages',
      filters
        ? Object.fromEntries(
            Object.entries(filters)
              .filter(([, value]) => value !== undefined && value !== null)
              .map(([key, value]) => [
                key,
                typeof value === 'boolean' ? (value ? '1' : '0') : String(value),
              ])
          )
        : undefined
    ),
  getNotebookPage: (id: string) =>
    v8Get<V8NotebookPage>(`/my-work/notebook/pages/${encodeURIComponent(id)}`),
  uploadNotebookAttachments: (id: string, files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('files', file));
    return v8PostMultipart<V8NotebookPage>(
      `/my-work/notebook/pages/${encodeURIComponent(id)}/attachments`,
      formData
    );
  },
  deleteNotebookAttachment: (id: string, attachmentId: string) =>
    v8Delete<V8NotebookPage>(
      `/my-work/notebook/pages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`
    ),
  notebookCaptureUpload: (
    file: File,
    options?: { title?: string; projectId?: string; tags?: string[] }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.title) formData.append('title', options.title);
    if (options?.projectId) formData.append('projectId', options.projectId);
    for (const tag of options?.tags || []) {
      formData.append('tags', tag);
    }
    return v8PostMultipart<{ pageId: string; source: string }>(
      '/my-work/notebook/capture/upload',
      formData
    );
  },
  createNotebookPage: (page: {
    title?: string;
    projectId?: string | null;
    visibility?: string;
    tags?: string[];
    contentJson?: unknown;
    contentText?: string;
    icon?: string | null;
    status?: string;
    template?: string;
  }) => v8Post<V8NotebookPage>('/my-work/notebook/pages', page),
  updateNotebookPage: (id: string, updates: Record<string, unknown>) =>
    v8Put<V8NotebookPage>(`/my-work/notebook/pages/${encodeURIComponent(id)}`, updates),
  deleteNotebookPage: (id: string) =>
    v8Delete<{ success: boolean; id: string }>(`/my-work/notebook/pages/${encodeURIComponent(id)}`),
  pinNotebookPage: (id: string) =>
    v8Put<{ id: string; pinned: boolean }>(`/my-work/notebook/pages/${encodeURIComponent(id)}/pin`),
  setNotebookPageStatus: (id: string, status: string) =>
    v8Put<{ id: string; status: string }>(
      `/my-work/notebook/pages/${encodeURIComponent(id)}/status`,
      { status }
    ),
  classifyNotebookPage: (id: string) =>
    v8Post<V8NotebookClassification>(`/my-work/notebook/pages/${encodeURIComponent(id)}/classify`),
  convertNotebookPage: (
    id: string,
    target: 'task' | 'decision' | 'initiative' | 'report' | 'presentation' | 'assessment',
    extra?: {
      title?: string;
      description?: string;
      assessmentType?: 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
    }
  ) =>
    v8Post<{ id: string; type: string; title: string; sourceSessionId?: string }>(
      `/my-work/notebook/pages/${encodeURIComponent(id)}/convert`,
      { target, ...extra }
    ),
  createNotebookAIProposal: (
    id: string,
    proposal: {
      proposalType: 'insert' | 'replace' | 'append';
      blockContent: Record<string, unknown>;
      rationale: string;
    }
  ) =>
    v8Post<V8NotebookAIProposal>(
      `/my-work/notebook/pages/${encodeURIComponent(id)}/ai-proposals`,
      proposal
    ),
  getNotebookAIProposals: (id: string, options?: { status?: string; limit?: number }) =>
    v8Get<{ proposals: V8NotebookAIProposal[] }>(
      `/my-work/notebook/pages/${encodeURIComponent(id)}/ai-proposals`,
      options
        ? (Object.fromEntries(
            Object.entries(options)
              .filter(([, value]) => value !== undefined && value !== null)
              .map(([key, value]) => [key, String(value)])
          ) as Record<string, string>)
        : undefined
    ),
  resolveNotebookAIProposal: (proposalId: string, action: 'accepted' | 'rejected') =>
    v8Post<V8NotebookAIProposal>(
      `/my-work/notebook/ai-proposals/${encodeURIComponent(proposalId)}/resolve`,
      { action }
    ),
  getCalendarUnified: (filters?: V8CalendarUnifiedFilters) =>
    v8Get<{ events: V8CalendarEvent[] }>(
      '/my-work/calendar/unified',
      filters
        ? (Object.fromEntries(
            Object.entries({
              ...filters,
              sources:
                Array.isArray(filters.sources) && filters.sources.length > 0
                  ? filters.sources.join(',')
                  : undefined,
            }).filter(([, value]) => value !== undefined && value !== null && value !== '')
          ) as Record<string, string>)
        : undefined
    ),
  getCalendarConflicts: (date: string) =>
    v8Get<V8CalendarConflicts>('/my-work/calendar/conflicts', { date }),
  createCalendarEvent: (body: {
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    source?: 'task' | 'initiative' | 'decision';
    description?: string;
    recurrence?: {
      preset: 'daily' | 'weekly' | 'monthly';
    };
  }) => v8Post<{ id: string; source: string; message: string }>('/my-work/calendar/events', body),
  updateCalendarEvent: (
    source: 'task' | 'initiative' | 'decision',
    sourceId: string,
    body: { start: string; end?: string; allDay?: boolean }
  ) =>
    v8Put<{ id: string; source: string; message: string }>(
      `/my-work/calendar/events/${encodeURIComponent(source)}/${encodeURIComponent(sourceId)}`,
      body
    ),
};
