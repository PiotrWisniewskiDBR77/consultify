import type { RunState } from '../../../../../src/models/agent/InterruptVerbs.js';
import {
  assertLedgerQueryWhitelisted,
  assertRunTransition,
  assertTenantScoped,
  type LedgerQuery,
  type RunId,
  type RunRow,
  type RunStatus,
  type TenantId,
} from '../../../../../src/models/agent/RunLedger.js';
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

  upsertRun(run: RunRow): RunRow {
    assertTenantScoped(run, run.tenantId);
    this.runs.set(keyFor(run.tenantId, run.id), run);
    return run;
  }

  getRun(runId: RunId, tenantId: TenantId): RunRow | null {
    return this.runs.get(keyFor(tenantId, runId)) ?? null;
  }

  transitionRun(runId: RunId, tenantId: TenantId, status: RunStatus, at: string): RunRow | null {
    const current = this.getRun(runId, tenantId);
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

  appendEvent(event: AgentRuntimeLedgerEvent): AgentRuntimeLedgerEvent {
    this.events.push(event);
    return event;
  }

  query(query: LedgerQuery): AgentRuntimeLedgerQueryResult {
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

  summarize(runId: RunId, tenantId: TenantId): AgentRuntimeLedgerSummary {
    const run = this.getRun(runId, tenantId);
    const runtimeState = this.getRuntimeState(runId, tenantId);
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

  setRuntimeState(runId: RunId, tenantId: TenantId, state: RunState): void {
    this.runtimeStates.set(keyFor(tenantId, runId), state);
  }

  getRuntimeState(runId: RunId, tenantId: TenantId): RunState | null {
    return this.runtimeStates.get(keyFor(tenantId, runId)) ?? null;
  }
}

export function createInMemoryAgentRuntimeLedgerStore(): AgentRuntimeLedgerStore {
  return new InMemoryAgentRuntimeLedgerStore();
}
