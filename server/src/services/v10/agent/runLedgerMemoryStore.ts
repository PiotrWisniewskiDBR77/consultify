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

function keyFor(tenantId: TenantId, runId: RunId): string {
  return `${String(tenantId)}::${String(runId)}`;
}

function matchesRunQuery(run: RunRow, query: LedgerQuery): boolean {
  if (query.id && run.id !== query.id) return false;
  if (query.correlationId && run.correlationId !== query.correlationId) return false;
  if (query.conversationId && run.conversationId !== query.conversationId) return false;
  if (query.origin && run.origin !== query.origin) return false;
  if (query.runType && run.runType !== query.runType) return false;
  if (query.parentRunId && run.parentRunId !== query.parentRunId) return false;
  if (query.status && run.status !== query.status) return false;
  if (query.severity && run.severity !== query.severity) return false;
  if (query.startedAtFrom && run.startedAt && run.startedAt < query.startedAtFrom) return false;
  if (query.startedAtTo && run.startedAt && run.startedAt > query.startedAtTo) return false;
  return true;
}

export class InMemoryAgentRuntimeLedgerStore implements AgentRuntimeLedgerStore {
  private readonly runs = new Map<string, RunRow>();
  private readonly runtimeStates = new Map<string, RunState>();
  private readonly events: AgentRuntimeLedgerEvent[] = [];

  async upsertRun(run: RunRow): Promise<RunRow> {
    assertTenantScoped(run, run.tenantId);
    this.runs.set(keyFor(run.tenantId, run.id), run);
    return run;
  }

  async getRun(runId: RunId, tenantId: TenantId): Promise<RunRow | null> {
    return this.runs.get(keyFor(tenantId, runId)) ?? null;
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
    this.runs.set(keyFor(tenantId, runId), next);
    return next;
  }

  async appendEvent(event: AgentRuntimeLedgerEvent): Promise<AgentRuntimeLedgerEvent> {
    this.events.push(event);
    return event;
  }

  async query(query: LedgerQuery): Promise<AgentRuntimeLedgerQueryResult> {
    assertLedgerQueryWhitelisted(query as unknown as Record<string, unknown>);

    const limit = query.limit ?? 50;
    const runs = Array.from(this.runs.values())
      .filter((run) => {
        assertTenantScoped(run, query.tenantId);
        return matchesRunQuery(run, query);
      })
      .sort((left, right) => {
        const leftAt = left.startedAt ?? '';
        const rightAt = right.startedAt ?? '';
        return rightAt.localeCompare(leftAt);
      })
      .slice(0, limit);

    const runIds = new Set(runs.map((run) => String(run.id)));
    const events = this.events
      .filter(
        (event) =>
          event.tenantId === query.tenantId &&
          (runIds.size === 0 || runIds.has(String(event.runId)))
      )
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));

    return { runs, events };
  }

  async summarize(runId: RunId, tenantId: TenantId): Promise<AgentRuntimeLedgerSummary> {
    const run = await this.getRun(runId, tenantId);
    const runtimeState = await this.getRuntimeState(runId, tenantId);
    const relevantEvents = this.events.filter(
      (event) => event.tenantId === tenantId && event.runId === runId
    );
    const categories = relevantEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.category] = (acc[event.category] ?? 0) + 1;
      return acc;
    }, {});

    return {
      runId,
      tenantId,
      run,
      runtimeState,
      eventCount: relevantEvents.length,
      categories,
      lastRecordedAt:
        relevantEvents.length > 0 ? relevantEvents[relevantEvents.length - 1].recordedAt : null,
    };
  }

  async setRuntimeState(runId: RunId, tenantId: TenantId, state: RunState): Promise<void> {
    this.runtimeStates.set(keyFor(tenantId, runId), state);
  }

  async getRuntimeState(runId: RunId, tenantId: TenantId): Promise<RunState | null> {
    return this.runtimeStates.get(keyFor(tenantId, runId)) ?? null;
  }
}

export function createInMemoryAgentRuntimeLedgerStore(): AgentRuntimeLedgerStore {
  return new InMemoryAgentRuntimeLedgerStore();
}
