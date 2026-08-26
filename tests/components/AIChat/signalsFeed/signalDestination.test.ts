/**
 * signalDestination.test.ts — FIX-4 (dyżur 26 chat-signals-front, odbiór
 * P0.4, pozycja A.2 minimum DoD: ≥4 testy).
 *
 * A.2 wymaga: trasa istnieje / `allowed=false` / `allowed=null` → dozwolone
 * (aktywna trasa) / typ nieznany → `NO_ROUTE`. Zero `navigate()` w ciemno —
 * `resolveDestination` nigdy nie buduje trasy z `dto.destination.route`.
 */
import { describe, expect, it } from 'vitest';

import { resolveDestination } from '@/components/AIChat/signalsFeed/signalDestination';
import type { SignalDTO } from '@/components/AIChat/signalsFeed/signalTypes';

const base: SignalDTO = {
  key: 'signal-1',
  type: 'kpi_threshold_breached',
  title: 'KPI',
  body: '',
  severity: 'CRITICAL',
  severityRaw: 'critical',
  createdAt: '2026-08-20T10:00:00Z',
  projectId: 'p1',
  projectName: 'Metalpol',
  entityType: 'initiative',
  entityId: 'kpi-1',
  domain: 'RESULTS',
  origin: 'DETERMINISTIC',
  source: { evidence: [], ruleId: 'res.kpi_threshold_breached', ruleVersion: 1 },
  freshness: { lastObservedAt: '2026-08-26T10:00:00Z', runAt: '2026-08-26T10:00:00Z', nextRunAt: null },
  destination: {
    // Deliberately a route the app does NOT know — resolveDestination must
    // never trust it (ERRATA §1.2 poz. 6/7 — "nie wolno ufać trasie z DTO").
    kind: 'route',
    route: '/some/server-only/route/that/does/not/exist/in/the/spa',
    params: {},
    permission: 'read',
    allowed: null,
  },
  isMine: false,
  firstObservedAt: '2026-08-20T10:00:00Z',
  status: 'OPEN',
};

describe('resolveDestination (A.2 — never a dead/blind click)', () => {
  it('a known type with a real SPA route and allowed=null resolves to ROUTE using the local table, not dto.destination.route', () => {
    const result = resolveDestination(base);
    expect(result).toEqual({ kind: 'ROUTE', href: '/results/kpi/kpi-1' });
  });

  it('allowed === false always wins as FORBIDDEN, even when a real route exists', () => {
    const result = resolveDestination({
      ...base,
      destination: { ...base.destination, allowed: false },
    });
    expect(result).toEqual({ kind: 'FORBIDDEN', reason: 'chatSignals.destination.forbidden' });
  });

  it('allowed === null (unknown) does not block a resolvable route — treated as allowed', () => {
    const result = resolveDestination({
      ...base,
      destination: { ...base.destination, allowed: null },
    });
    expect(result.kind).toBe('ROUTE');
  });

  it('a type outside the 8-entry table resolves to NO_ROUTE, never a guessed navigate()', () => {
    const result = resolveDestination({ ...base, type: 'unknown_signal_type_xyz' });
    expect(result).toEqual({ kind: 'NO_ROUTE', reason: 'chatSignals.destination.unavailable' });
  });

  it('a known type without a detail route (7 of 8 entries) resolves to NO_ROUTE, not a list fallback', () => {
    const result = resolveDestination({ ...base, type: 'task_overdue', allowed: undefined as never });
    expect(result.kind).toBe('NO_ROUTE');
  });

  it('all 8 signal types from the source-of-truth table resolve without throwing and only kpi_threshold_breached is ROUTE', () => {
    const types = [
      'task_overdue',
      'task_due_soon_not_started',
      'task_blocked_stale',
      'initiative_no_baseline',
      'decision_pending_stale',
      'decision_blocking_dependents',
      'kpi_threshold_breached',
      'budget_overspend',
    ];
    const verdicts = types.map((type) => resolveDestination({ ...base, type }).kind);
    expect(verdicts).toEqual([
      'NO_ROUTE',
      'NO_ROUTE',
      'NO_ROUTE',
      'NO_ROUTE',
      'NO_ROUTE',
      'NO_ROUTE',
      'ROUTE',
      'NO_ROUTE',
    ]);
  });
});
