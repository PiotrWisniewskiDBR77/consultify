import type { RunState } from '../../../models/agent/InterruptVerbs.js';
import {
  assertLedgerQueryWhitelisted,
  assertRunTransition,
  assertTenantScoped,
  type LedgerQuery,
  type RunId,
  type RunRow,
  type RunStatus,
  type TenantId,
} from '../../../models/agent/RunLedger.js';
import type {
  AgentRuntimeLedgerEvent,
  AgentRuntimeLedgerQueryResult,
  AgentRuntimeLedgerStore,
  AgentRuntimeLedgerSummary,
} from '../../../types/v10/agent-runtime.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../../utils/DbPromise.js';

let ensureRuntimeLedgerTablesPromise: Promise<void> | null = null;

function parseRunRow(row: any): RunRow | null {
  if (!row?.id || !row?.tenantId) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    correlationId: String(row.correlationId || ''),
    conversationId: row.conversationId ? String(row.conversationId) : null,
    origin: row.origin ? String(row.origin) : null,
    runType: row.runType ? String(row.runType) : null,
    parentRunId: row.parentRunId ? row.parentRunId : null,
    approvalState: row.approvalState ? String(row.approvalState) : null,
    latestBarrierState: row.latestBarrierState ? String(row.latestBarrierState) : null,
    latestInterruptState: row.latestInterruptState ? String(row.latestInterruptState) : null,
    status: row.status,
    severity: row.severity,
    startedAt: row.startedAt ? String(row.startedAt) : null,
    finishedAt: row.finishedAt ? String(row.finishedAt) : null,
    budgetUsed: {
      wallMs: Number(row.budgetWallMs || 0),
      costCents: Number(row.budgetCostCents || 0),
      toolCalls: Number(row.budgetToolCalls || 0),
      tokens: Number(row.budgetTokens || 0),
    },
  };
}

function parseEvent(row: any): AgentRuntimeLedgerEvent {
  let payload: unknown = null;
  try {
    payload = row.payloadJson ? JSON.parse(String(row.payloadJson)) : null;
  } catch {
    payload = row.payloadJson ?? null;
  }
  return {
    id: String(row.id),
    tenantId: row.tenantId,
    runId: row.runId,
    category: row.category,
    recordedAt: String(row.recordedAt),
    actorId: row.actorId ? String(row.actorId) : null,
    payload,
  };
}

function buildWhereClause(query: LedgerQuery): { sql: string; params: unknown[] } {
  const clauses = ['tenant_id = ?'];
  const params: unknown[] = [query.tenantId];
  if (query.id) {
    clauses.push('id = ?');
    params.push(query.id);
  }
  if (query.correlationId) {
    clauses.push('correlation_id = ?');
    params.push(query.correlationId);
  }
  if (query.conversationId) {
    clauses.push('conversation_id = ?');
    params.push(query.conversationId);
  }
  if (query.origin) {
    clauses.push('origin = ?');
    params.push(query.origin);
  }
  if (query.runType) {
    clauses.push('run_type = ?');
    params.push(query.runType);
  }
  if (query.parentRunId) {
    clauses.push('parent_run_id = ?');
    params.push(query.parentRunId);
  }
  if (query.status) {
    clauses.push('status = ?');
    params.push(query.status);
  }
  if (query.severity) {
    clauses.push('severity = ?');
    params.push(query.severity);
  }
  if (query.startedAtFrom) {
    clauses.push('(started_at IS NOT NULL AND started_at >= ?)');
    params.push(query.startedAtFrom);
  }
  if (query.startedAtTo) {
    clauses.push('(started_at IS NOT NULL AND started_at <= ?)');
    params.push(query.startedAtTo);
  }
  return { sql: clauses.join(' AND '), params };
}

function inferRunPatchFromEvent(event: AgentRuntimeLedgerEvent): Partial<RunRow> {
  const payload: any = event.payload || {};
  if (event.category === 'approval_barrier_planned') {
    return {
      approvalState: 'awaiting_approval',
      latestBarrierState: String(payload?.outcome || 'planned'),
    };
  }
  if (event.category === 'approval_barrier_resumed') {
    return {
      approvalState: payload?.outcome === 'cancelled' ? 'rejected' : 'approved',
      latestBarrierState: String(payload?.outcome || 'resumed'),
    };
  }
  if (event.category === 'interrupt_submitted') {
    return {
      latestInterruptState: String(payload?.verb || payload?.decision?.nextState || ''),
    };
  }
  if (event.category === 'run_status_synced') {
    return {
      status: payload?.status,
    } as Partial<RunRow>;
  }
  if (event.category === 'custom' && payload && typeof payload === 'object') {
    return {
      approvalState:
        typeof payload.approvalState === 'string' ? String(payload.approvalState) : undefined,
      latestBarrierState:
        typeof payload.latestBarrierState === 'string' ? String(payload.latestBarrierState) : undefined,
      latestInterruptState:
        typeof payload.latestInterruptState === 'string'
          ? String(payload.latestInterruptState)
          : undefined,
      origin: typeof payload.origin === 'string' ? String(payload.origin) : undefined,
      runType: typeof payload.runType === 'string' ? String(payload.runType) : undefined,
      conversationId:
        typeof payload.conversationId === 'string' ? String(payload.conversationId) : undefined,
    };
  }
  return {};
}

export async function ensureRuntimeLedgerTables(): Promise<void> {
  if (!ensureRuntimeLedgerTablesPromise) {
    ensureRuntimeLedgerTablesPromise = (async () => {
      await dbRun(
        `CREATE TABLE IF NOT EXISTS v10_agent_runs (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          correlation_id TEXT NOT NULL,
          conversation_id TEXT NULL,
          origin TEXT NULL,
          run_type TEXT NULL,
          parent_run_id TEXT NULL,
          approval_state TEXT NULL,
          latest_barrier_state TEXT NULL,
          latest_interrupt_state TEXT NULL,
          runtime_state TEXT NULL,
          status TEXT NOT NULL,
          severity TEXT NOT NULL,
          started_at TEXT NULL,
          finished_at TEXT NULL,
          budget_wall_ms INTEGER NOT NULL DEFAULT 0,
          budget_cost_cents INTEGER NOT NULL DEFAULT 0,
          budget_tool_calls INTEGER NOT NULL DEFAULT 0,
          budget_tokens INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE TABLE IF NOT EXISTS v10_agent_run_events (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          category TEXT NOT NULL,
          recorded_at TEXT NOT NULL,
          actor_id TEXT NULL,
          payload_json TEXT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_v10_agent_runs_tenant_status
           ON v10_agent_runs (tenant_id, status, started_at)`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_v10_agent_runs_correlation
           ON v10_agent_runs (tenant_id, correlation_id)`,
        [],
        { fallback: false } as any
      );
      await dbRun(
        `CREATE INDEX IF NOT EXISTS idx_v10_agent_run_events_run
           ON v10_agent_run_events (tenant_id, run_id, recorded_at)`,
        [],
        { fallback: false } as any
      );
    })().catch((error) => {
      ensureRuntimeLedgerTablesPromise = null;
      throw error;
    });
  }
  await ensureRuntimeLedgerTablesPromise;
}

export class DatabaseBackedAgentRuntimeLedgerStore implements AgentRuntimeLedgerStore {
  async upsertRun(run: RunRow): Promise<RunRow> {
    assertTenantScoped(run, run.tenantId);
    await ensureRuntimeLedgerTables();
    const existing = await this.getRun(run.id, run.tenantId);
    if (existing) {
      await dbRun(
        `UPDATE v10_agent_runs
         SET correlation_id = ?,
             conversation_id = ?,
             origin = ?,
             run_type = ?,
             parent_run_id = ?,
             approval_state = ?,
             latest_barrier_state = ?,
             latest_interrupt_state = ?,
             status = ?,
             severity = ?,
             started_at = ?,
             finished_at = ?,
             budget_wall_ms = ?,
             budget_cost_cents = ?,
             budget_tool_calls = ?,
             budget_tokens = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [
          run.correlationId,
          run.conversationId || null,
          run.origin || null,
          run.runType || null,
          run.parentRunId || null,
          run.approvalState || null,
          run.latestBarrierState || null,
          run.latestInterruptState || null,
          run.status,
          run.severity,
          run.startedAt || null,
          run.finishedAt || null,
          run.budgetUsed.wallMs,
          run.budgetUsed.costCents,
          run.budgetUsed.toolCalls,
          run.budgetUsed.tokens,
          run.id,
          run.tenantId,
        ],
        { fallback: false } as any
      );
      return run;
    }

    await dbRun(
      `INSERT INTO v10_agent_runs (
         id, tenant_id, correlation_id, conversation_id, origin, run_type, parent_run_id,
         approval_state, latest_barrier_state, latest_interrupt_state, runtime_state,
         status, severity, started_at, finished_at,
         budget_wall_ms, budget_cost_cents, budget_tool_calls, budget_tokens,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        run.id,
        run.tenantId,
        run.correlationId,
        run.conversationId || null,
        run.origin || null,
        run.runType || null,
        run.parentRunId || null,
        run.approvalState || null,
        run.latestBarrierState || null,
        run.latestInterruptState || null,
        run.status,
        run.severity,
        run.startedAt || null,
        run.finishedAt || null,
        run.budgetUsed.wallMs,
        run.budgetUsed.costCents,
        run.budgetUsed.toolCalls,
        run.budgetUsed.tokens,
      ],
      { fallback: false } as any
    );
    return run;
  }

  async getRun(runId: RunId, tenantId: TenantId): Promise<RunRow | null> {
    await ensureRuntimeLedgerTables();
    const row = (await dbGet(
      `SELECT
          id,
          tenant_id as tenantId,
          correlation_id as correlationId,
          conversation_id as conversationId,
          origin,
          run_type as runType,
          parent_run_id as parentRunId,
          approval_state as approvalState,
          latest_barrier_state as latestBarrierState,
          latest_interrupt_state as latestInterruptState,
          status,
          severity,
          started_at as startedAt,
          finished_at as finishedAt,
          budget_wall_ms as budgetWallMs,
          budget_cost_cents as budgetCostCents,
          budget_tool_calls as budgetToolCalls,
          budget_tokens as budgetTokens
        FROM v10_agent_runs
        WHERE id = ? AND tenant_id = ?
        LIMIT 1`,
      [runId, tenantId]
    ).catch(() => null)) as any;
    return parseRunRow(row);
  }

  async transitionRun(
    runId: RunId,
    tenantId: TenantId,
    status: RunStatus,
    at: string
  ): Promise<RunRow | null> {
    const current = await this.getRun(runId, tenantId);
    if (current === null) return null;

    if (current.status !== status) {
      assertRunTransition(current.status, status);
    }

    const next: RunRow = {
      ...current,
      status,
      startedAt: status === 'running' ? (current.startedAt ?? at) : current.startedAt,
      finishedAt:
        status === 'succeeded' || status === 'failed' || status === 'cancelled'
          ? at
          : current.finishedAt,
    };
    await this.upsertRun(next);
    return next;
  }

  async appendEvent(event: AgentRuntimeLedgerEvent): Promise<AgentRuntimeLedgerEvent> {
    await ensureRuntimeLedgerTables();
    await dbRun(
      `INSERT INTO v10_agent_run_events
         (id, tenant_id, run_id, category, recorded_at, actor_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        event.id,
        event.tenantId,
        event.runId,
        event.category,
        event.recordedAt,
        event.actorId || null,
        event.payload != null ? JSON.stringify(event.payload) : null,
      ],
      { fallback: false } as any
    );

    const current = await this.getRun(event.runId, event.tenantId);
    if (current) {
      await this.upsertRun({
        ...current,
        ...inferRunPatchFromEvent(event),
      });
    }
    return event;
  }

  async query(query: LedgerQuery): Promise<AgentRuntimeLedgerQueryResult> {
    assertLedgerQueryWhitelisted(query as unknown as Record<string, unknown>);
    await ensureRuntimeLedgerTables();

    const { sql, params } = buildWhereClause(query);
    const limit = query.limit ?? 50;
    const runRows = (await dbAll(
      `SELECT
          id,
          tenant_id as tenantId,
          correlation_id as correlationId,
          conversation_id as conversationId,
          origin,
          run_type as runType,
          parent_run_id as parentRunId,
          approval_state as approvalState,
          latest_barrier_state as latestBarrierState,
          latest_interrupt_state as latestInterruptState,
          status,
          severity,
          started_at as startedAt,
          finished_at as finishedAt,
          budget_wall_ms as budgetWallMs,
          budget_cost_cents as budgetCostCents,
          budget_tool_calls as budgetToolCalls,
          budget_tokens as budgetTokens
        FROM v10_agent_runs
        WHERE ${sql}
        ORDER BY COALESCE(started_at, created_at) DESC
        LIMIT ?`,
      [...params, limit]
    ).catch(() => [])) as any[];
    const runs = runRows.map(parseRunRow).filter(Boolean) as RunRow[];

    if (runs.length === 0) {
      return { runs: [], events: [] };
    }

    const events = (await dbAll(
      `SELECT
          id,
          tenant_id as tenantId,
          run_id as runId,
          category,
          recorded_at as recordedAt,
          actor_id as actorId,
          payload_json as payloadJson
        FROM v10_agent_run_events
        WHERE tenant_id = ?
          AND run_id IN (${runs.map(() => '?').join(', ')})
        ORDER BY recorded_at ASC`,
      [query.tenantId, ...runs.map((run) => run.id)]
    ).catch(() => [])) as any[];

    return {
      runs,
      events: events.map(parseEvent),
    };
  }

  async summarize(runId: RunId, tenantId: TenantId): Promise<AgentRuntimeLedgerSummary> {
    await ensureRuntimeLedgerTables();
    const [run, runtimeState, eventRows] = await Promise.all([
      this.getRun(runId, tenantId),
      this.getRuntimeState(runId, tenantId),
      dbAll(
        `SELECT
            id,
            tenant_id as tenantId,
            run_id as runId,
            category,
            recorded_at as recordedAt,
            actor_id as actorId,
            payload_json as payloadJson
          FROM v10_agent_run_events
          WHERE tenant_id = ? AND run_id = ?
          ORDER BY recorded_at ASC`,
        [tenantId, runId]
      ).catch(() => []),
    ]);
    const events = (eventRows as any[]).map(parseEvent);
    const categories = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.category] = (acc[event.category] ?? 0) + 1;
      return acc;
    }, {});

    return {
      runId,
      tenantId,
      run,
      runtimeState,
      eventCount: events.length,
      categories,
      lastRecordedAt: events.length > 0 ? events[events.length - 1].recordedAt : null,
    };
  }

  async setRuntimeState(runId: RunId, tenantId: TenantId, state: RunState): Promise<void> {
    await ensureRuntimeLedgerTables();
    await dbRun(
      `UPDATE v10_agent_runs
       SET runtime_state = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [state, runId, tenantId],
      { fallback: false } as any
    );
  }

  async getRuntimeState(runId: RunId, tenantId: TenantId): Promise<RunState | null> {
    await ensureRuntimeLedgerTables();
    const row = (await dbGet(
      `SELECT runtime_state as runtimeState
       FROM v10_agent_runs
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [runId, tenantId]
    ).catch(() => null)) as any;
    return row?.runtimeState ? (String(row.runtimeState) as RunState) : null;
  }
}

export function createDatabaseBackedAgentRuntimeLedgerStore(): AgentRuntimeLedgerStore {
  return new DatabaseBackedAgentRuntimeLedgerStore();
}
