import { describe, expect, it } from 'vitest';

import {
  isShowcaseOrg,
  planAggregateAlignment,
  stageGroup,
} from '../../../server/scripts/align-initiative-aggregate-state.js';

/**
 * D-19 (Wpis 60 · STAGE-1 · DEC-539) — the align script's PURE decision rule.
 * The DB-run proof (dry-run/apply/idempotency on a staging-dump copy) lives in
 * the Wpis 60 report; these unit tests pin the mapping so a regression in the
 * status->stage derivation cannot silently re-diverge the showcase orgs.
 */
describe('planAggregateAlignment — status → canonical aggregate stage', () => {
  it('advances a stale REGISTERED_DRAFT aggregate to the column status group', () => {
    // The measured Atelier Toys defect: column IN_EXECUTION, aggregate stuck at
    // REGISTERED_DRAFT (group DRAFT). Aligning must land IN_EXECUTION.
    expect(planAggregateAlignment('IN_EXECUTION', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'IN_EXECUTION',
    });
    expect(planAggregateAlignment('APPROVED', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'APPROVED_BACKLOG',
    });
    expect(planAggregateAlignment('PENDING_APPROVAL', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'READY_FOR_DECISION',
    });
    expect(planAggregateAlignment('CLOSED', 'REGISTERED_DRAFT')).toEqual({
      action: 'align',
      targetStage: 'CLOSED',
    });
  });

  it('is case-insensitive on the column status', () => {
    expect(planAggregateAlignment('in_execution', 'REGISTERED_DRAFT').action).toBe('align');
  });

  it('leaves an already-consistent aggregate alone (idempotent, no write)', () => {
    expect(planAggregateAlignment('IN_EXECUTION', 'IN_EXECUTION').action).toBe('skip-aligned');
    expect(planAggregateAlignment('DRAFT', 'REGISTERED_DRAFT').action).toBe('skip-aligned');
    expect(planAggregateAlignment('DRAFT', 'DEFINED').action).toBe('skip-aligned');
  });

  it('never downgrades a more precise stage within the same 7-code group', () => {
    // SCHEDULED and APPROVED_BACKLOG are both group APPROVED. The DBR77 reverse
    // case (aggregate AHEAD of column) must not be flattened to the first stage.
    expect(planAggregateAlignment('APPROVED', 'SCHEDULED').action).toBe('skip-aligned');
    expect(planAggregateAlignment('APPROVED', 'APPROVED_BACKLOG').action).toBe('skip-aligned');
    expect(planAggregateAlignment('PENDING_APPROVAL', 'ANALYZING').action).toBe('skip-aligned');
  });

  it('skips dispositions / pre-registration — no engine stage, register short-circuits', () => {
    expect(planAggregateAlignment('REJECTED', 'REGISTERED_DRAFT')).toEqual({
      action: 'skip-short-circuit',
      targetStage: null,
    });
    expect(planAggregateAlignment('PROPOSED', 'REGISTERED_DRAFT')).toEqual({
      action: 'skip-short-circuit',
      targetStage: null,
    });
  });

  it('re-aligns a dirty out-of-vocabulary aggregate value (the 07.09 EXECUTING row)', () => {
    // 'EXECUTING' is not one of the 12 stages, so it has no group and must be
    // realigned to the column status group.
    expect(stageGroup('EXECUTING')).toBeNull();
    expect(planAggregateAlignment('IN_EXECUTION', 'EXECUTING')).toEqual({
      action: 'align',
      targetStage: 'IN_EXECUTION',
    });
  });

  it('aligns when the aggregate row exists but carries no lifecycleState', () => {
    expect(planAggregateAlignment('IN_EXECUTION', null)).toEqual({
      action: 'align',
      targetStage: 'IN_EXECUTION',
    });
  });
});

describe('stageGroup — 12-stage → 7-code group', () => {
  it('maps stages onto their compatibility status', () => {
    expect(stageGroup('APPROVED_BACKLOG')).toBe('APPROVED');
    expect(stageGroup('SCHEDULED')).toBe('APPROVED');
    expect(stageGroup('READY_FOR_DECISION')).toBe('PENDING_APPROVAL');
    expect(stageGroup('DELIVERED')).toBe('CLOSED');
    expect(stageGroup('IN_EXECUTION')).toBe('IN_EXECUTION');
  });

  it('returns null for unknown / empty values', () => {
    expect(stageGroup('EXECUTING')).toBeNull();
    expect(stageGroup('')).toBeNull();
    expect(stageGroup(null)).toBeNull();
    expect(stageGroup(undefined)).toBeNull();
  });
});

describe('isShowcaseOrg — hard allow-list', () => {
  it('allows Atelier Toys demo-session orgs by id pattern and by name', () => {
    expect(isShowcaseOrg('ateliertoys-demo-session-1bd9863714-mu3crllf', null)).toBe(true);
    expect(isShowcaseOrg('some-other-id', 'Atelier Toys')).toBe(true);
  });

  it('allows Northwind Manufacturing Ltd. by name', () => {
    expect(isShowcaseOrg('468b234c-66c4-54e1-b626-5e0fb3a92f6a', 'Northwind Manufacturing Ltd.')).toBe(
      true
    );
  });

  it('refuses DBR77 and any non-showcase org', () => {
    expect(isShowcaseOrg('a3e05d4a-5397-419d-b486-8e44366c0063', 'DBR77')).toBe(false);
    expect(isShowcaseOrg('random-org-id', 'Some Tester Org')).toBe(false);
    expect(isShowcaseOrg('', '')).toBe(false);
  });
});
