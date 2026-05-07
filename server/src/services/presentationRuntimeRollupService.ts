export interface PresentationRuntimeEventRow {
  id: string;
  organization_id: string;
  deck_id: string | null;
  user_id: string | null;
  event_type: string;
  status: string | null;
  scope: string | null;
  metadata_json?: string | null;
  created_at: string;
}

export interface PresentationRuntimeRollupTotals {
  proposalsCreated: number;
  editsApplied: number;
  editsRejected: number;
  exportsBlocked: number;
  noops: number;
  total: number;
}

export interface PresentationRuntimeRollup {
  windowDays: number;
  generatedAt: string;
  totals: PresentationRuntimeRollupTotals;
  byEventType: Array<{ eventType: string; count: number; lastAt: string | null }>;
  lastActivityAt: string | null;
}

const TYPE_TO_KEY: Record<string, keyof PresentationRuntimeRollupTotals> = {
  agent_edit_proposal_created: 'proposalsCreated',
  agent_edit_applied: 'editsApplied',
  agent_edit_rejected: 'editsRejected',
  agent_edit_noop: 'noops',
  export_blocked: 'exportsBlocked',
};

export function buildPresentationRuntimeRollup(params: {
  rows: PresentationRuntimeEventRow[];
  windowDays?: number;
  now?: Date;
}): PresentationRuntimeRollup {
  const windowDays = params.windowDays && params.windowDays > 0 ? params.windowDays : 7;
  const now = params.now || new Date();
  const cutoffMs = now.getTime() - windowDays * 86_400_000;

  const totals: PresentationRuntimeRollupTotals = {
    proposalsCreated: 0,
    editsApplied: 0,
    editsRejected: 0,
    exportsBlocked: 0,
    noops: 0,
    total: 0,
  };

  const byType = new Map<string, { count: number; lastAt: string | null }>();
  let lastActivity: string | null = null;

  for (const row of params.rows || []) {
    if (!row?.created_at) continue;
    const createdAtMs = Date.parse(String(row.created_at));
    if (!Number.isFinite(createdAtMs) || createdAtMs < cutoffMs) continue;

    totals.total += 1;
    const key = TYPE_TO_KEY[row.event_type];
    if (key) totals[key] += 1;

    const existing = byType.get(row.event_type) || { count: 0, lastAt: null };
    existing.count += 1;
    if (!existing.lastAt || Date.parse(existing.lastAt) < createdAtMs) {
      existing.lastAt = new Date(createdAtMs).toISOString();
    }
    byType.set(row.event_type, existing);

    if (!lastActivity || Date.parse(lastActivity) < createdAtMs) {
      lastActivity = new Date(createdAtMs).toISOString();
    }
  }

  const byEventType = Array.from(byType.entries())
    .map(([eventType, value]) => ({
      eventType,
      count: value.count,
      lastAt: value.lastAt,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    windowDays,
    generatedAt: now.toISOString(),
    totals,
    byEventType,
    lastActivityAt: lastActivity,
  };
}
