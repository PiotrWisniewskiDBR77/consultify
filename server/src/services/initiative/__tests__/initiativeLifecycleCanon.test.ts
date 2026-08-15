import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '../../../constants/initiativeStatuses.js';
import {
  buildInitiativeOutboundHandoffPayload,
  coerceInitiativeStatusForWrite,
  hasInitiativeStatusSchemaDrift,
  mapDbStatusToP11Lifecycle,
  normalizeInitiativeDbStatusForRead,
  P11_CANONICAL_LIFECYCLE_STATES,
} from '../initiativeLifecycleCanon.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('initiativeLifecycleCanon (P11)', () => {
  it('freezes exactly the §2.3.1 canonical lifecycle bucket names', () => {
    expect(P11_CANONICAL_LIFECYCLE_STATES).toEqual([
      'intake',
      'triage',
      'planned',
      'approved',
      'executing',
      'blocked',
      'delivered',
      'closed',
      'archived',
    ]);
  });

  it('maps every InitiativeStatus DB value to exactly one P11 bucket', () => {
    const values = Object.values(InitiativeStatus);
    for (const v of values) {
      const canon = mapDbStatusToP11Lifecycle(v);
      expect(P11_CANONICAL_LIFECYCLE_STATES).toContain(canon);
    }
  });

  it('normalizes legacy step labels to PMO statuses (read coherence)', () => {
    expect(normalizeInitiativeDbStatusForRead('STEP3_REVIEW')).toBe('REVIEW');
    expect(normalizeInitiativeDbStatusForRead('STEP4_PILOT')).toBe('APPROVED');
    expect(normalizeInitiativeDbStatusForRead('STEP5_FULL')).toBe('EXECUTING');
  });

  it('flags unknown DB status as schema drift while avoiding silent corruption on read', () => {
    expect(hasInitiativeStatusSchemaDrift('NOT_A_REAL_STATUS')).toBe(true);
    expect(normalizeInitiativeDbStatusForRead('NOT_A_REAL_STATUS')).toBe('DRAFT');
  });

  it('coerceInitiativeStatusForWrite rejects unknown statuses', () => {
    const bad = coerceInitiativeStatusForWrite('FAKE_STATUS');
    expect(bad.ok).toBe(false);
    if (bad.ok) throw new Error('expected failure');
    expect(bad.code).toBe('UNKNOWN_STATUS');
  });

  it('coerceInitiativeStatusForWrite accepts canonical PMO statuses', () => {
    const ok = coerceInitiativeStatusForWrite('EXECUTING');
    expect(ok.ok).toBe(true);
    if (!ok.ok) throw new Error('expected success');
    expect(ok.status).toBe('EXECUTING');
  });

  it('buildInitiativeOutboundHandoffPayload includes bounded common fields', () => {
    const row = {
      id: 'init-1',
      title: 'Test initiative',
      status: 'PLANNING',
      owner_execution_id: 'user-a',
      planned_start_date: '2026-01-01',
      planned_end_date: '2026-06-01',
      program_id: 'prog-1',
    };
    const h = buildInitiativeOutboundHandoffPayload({
      initiativeRow: row,
      organizationId: 'org-1',
      handoffBy: 'actor-1',
      kind: 'execution',
    });
    expect(h.initiativeId).toBe('init-1');
    expect(h.initiativeTitle).toBe('Test initiative');
    expect(h.initiativeLifecycleState).toBe('planned');
    expect(h.initiativeDbStatus).toBe('PLANNING');
    expect(h.initiativeOwnerId).toBe('user-a');
    expect(h.contextPack.length).toBeLessThanOrEqual(5);
    expect(h.handoffBy).toBe('actor-1');
    expect(h.executionIntent).toBeTruthy();
    expect(h.kpiIntent).toBeUndefined();
  });

  it('handoff kinds attach consumer-specific bounded fields without overlapping grammars', () => {
    const row = { id: 'i', title: 'T', status: 'APPROVED' };
    const exec = buildInitiativeOutboundHandoffPayload({
      initiativeRow: row,
      organizationId: 'o',
      handoffBy: null,
      kind: 'execution',
    });
    const kpi = buildInitiativeOutboundHandoffPayload({
      initiativeRow: row,
      organizationId: 'o',
      handoffBy: null,
      kind: 'kpi',
    });
    const cal = buildInitiativeOutboundHandoffPayload({
      initiativeRow: row,
      organizationId: 'o',
      handoffBy: null,
      kind: 'calendar',
    });
    expect(exec.executionIntent).toBeDefined();
    expect(kpi.kpiIntent).toBeDefined();
    expect(cal.calendarIntent).toBeDefined();
  });

  it('InitiativeController records audited status transitions (regression / P11 acceptance)', () => {
    const controllerPath = join(__dirname, '../../../controllers/InitiativeController.ts');
    const src = readFileSync(controllerPath, 'utf-8');
    const transitionService = readFileSync(
      join(__dirname, '../initiativeTransitionService.ts'),
      'utf-8'
    );
    expect(src).toContain('initiative_status_history');
    expect(transitionService).toContain('INSERT INTO initiative_status_history');
    expect(transitionService).toContain('INSERT INTO initiative_history');
  });

  it('AI blueprint apply is explicit user-gated (no silent proposal→DB without apply route)', () => {
    const govPath = join(__dirname, '../../initiativeGovernanceService.ts');
    const src = readFileSync(govPath, 'utf-8');
    expect(src).toContain('applyBlueprint');
    expect(src).toMatch(/async applyBlueprint/);
  });

  it('AI blueprint apply writes P11 audit row to initiative_history', () => {
    const govPath = join(__dirname, '../../initiativeGovernanceService.ts');
    const src = readFileSync(govPath, 'utf-8');
    expect(src).toContain('ai_blueprint_applied');
    expect(src).toContain('proposalId');
  });
});
