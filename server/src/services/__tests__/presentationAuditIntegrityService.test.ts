/**
 * Unit tests for `presentationAuditIntegrityService` — Epic K3 closure.
 *
 * These tests exercise the *pure* `evaluateAuditIntegrity` verifier only.
 * The DB wrapper (`buildAuditIntegrityReport`) lives behind a schema-tolerant
 * adapter and is exercised separately by the CLI smoke step.
 */

import { describe, expect, it } from 'vitest';

import {
  AUDIT_LATENCY_BUDGET_MS,
  ISSUE_CAP,
  type AgentEditInput,
  type AuditEventInput,
  type EvaluateInput,
  type ExportInput,
  evaluateAuditIntegrity,
} from '../presentationAuditIntegrityService.js';

const ORG = 'org_acme';
const NOW_ISO = '2026-05-07T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function isoOffset(ms: number): string {
  return new Date(NOW_MS + ms).toISOString();
}

function makeEdit(overrides: Partial<AgentEditInput> = {}): AgentEditInput {
  return {
    id: 'op_1',
    deckId: 'deck_1',
    appliedAt: isoOffset(-60_000),
    ...overrides,
  };
}

function makeExport(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    id: 'exp_1',
    deckId: 'deck_1',
    completedAt: isoOffset(-30_000),
    status: 'completed',
    ...overrides,
  };
}

function makeAudit(overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    id: 'ae_1',
    deckId: 'deck_1',
    action: 'agent_edit_applied',
    relatedId: 'op_1',
    occurredAt: isoOffset(-59_000),
    ...overrides,
  };
}

function baseInput(overrides: Partial<EvaluateInput> = {}): EvaluateInput {
  return {
    agentEdits: [],
    exports: [],
    auditEvents: [],
    windowDays: 7,
    organizationId: ORG,
    nowIso: NOW_ISO,
    ...overrides,
  };
}

describe('evaluateAuditIntegrity', () => {
  // 1
  it('empty inputs produce a PASS verdict and zero counts', () => {
    const report = evaluateAuditIntegrity(baseInput());
    expect(report.verdict).toBe('PASS');
    expect(report.totals).toEqual({
      agentEditsScanned: 0,
      exportsScanned: 0,
      auditEventsScanned: 0,
      issuesFound: 0,
      p1: 0,
      p2: 0,
    });
    expect(report.issues).toEqual([]);
    expect(report.truncated).toBe(false);
    expect(report.warnings).toEqual([]);
    expect(report.organizationId).toBe(ORG);
    expect(report.windowDays).toBe(7);
    expect(report.generatedAt).toBe(NOW_ISO);
  });

  // 2
  it('agent edit with a matching audit event passes', () => {
    const edit = makeEdit();
    const audit = makeAudit({ relatedId: edit.id });
    const report = evaluateAuditIntegrity(
      baseInput({ agentEdits: [edit], auditEvents: [audit] })
    );
    expect(report.verdict).toBe('PASS');
    expect(report.issues).toHaveLength(0);
    expect(report.totals.agentEditsScanned).toBe(1);
    expect(report.totals.auditEventsScanned).toBe(1);
  });

  // 3
  it('agent edit without any audit event triggers BLOCKED_P1', () => {
    const edit = makeEdit();
    const report = evaluateAuditIntegrity(baseInput({ agentEdits: [edit] }));
    expect(report.verdict).toBe('BLOCKED_P1');
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.type).toBe('missing_audit_for_agent_edit');
    expect(report.issues[0]?.severity).toBe('P1');
    expect(report.issues[0]?.referenceId).toBe(edit.id);
    expect(report.totals.p1).toBe(1);
    expect(report.totals.p2).toBe(0);
  });

  // 4
  it('completed export without an audit event triggers BLOCKED_P1', () => {
    const exp = makeExport();
    const report = evaluateAuditIntegrity(baseInput({ exports: [exp] }));
    expect(report.verdict).toBe('BLOCKED_P1');
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.type).toBe('missing_audit_for_export');
    expect(report.issues[0]?.severity).toBe('P1');
    expect(report.issues[0]?.referenceId).toBe(exp.id);
  });

  // 5
  it('late audit record (10 minutes after) downgrades to PASS_WITH_P2', () => {
    const edit = makeEdit({ appliedAt: isoOffset(-15 * 60_000) });
    // Audit event arrives ~10min AFTER the edit, exceeding the 5min budget.
    const audit = makeAudit({
      relatedId: edit.id,
      occurredAt: isoOffset(-5 * 60_000),
    });
    const report = evaluateAuditIntegrity(
      baseInput({ agentEdits: [edit], auditEvents: [audit] })
    );
    expect(report.verdict).toBe('PASS_WITH_P2');
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]?.type).toBe('late_audit_record');
    expect(report.issues[0]?.severity).toBe('P2');
  });

  // 6
  it('duplicate audit events within 5 minutes raise a P2', () => {
    const edit = makeEdit();
    const audit1 = makeAudit({ id: 'ae_1', relatedId: edit.id, occurredAt: isoOffset(-60_000) });
    const audit2 = makeAudit({ id: 'ae_2', relatedId: edit.id, occurredAt: isoOffset(-30_000) });
    const report = evaluateAuditIntegrity(
      baseInput({ agentEdits: [edit], auditEvents: [audit1, audit2] })
    );
    expect(report.verdict).toBe('PASS_WITH_P2');
    const dup = report.issues.find((i) => i.type === 'duplicate_audit_event');
    expect(dup).toBeDefined();
    expect(dup?.severity).toBe('P2');
    expect(dup?.referenceId).toBe('ae_2');
  });

  // 7
  it('orphan audit event (unknown deckId) raises a P1', () => {
    const audit = makeAudit({
      id: 'ae_orphan',
      deckId: 'deck_unknown',
      relatedId: 'op_unknown',
    });
    const report = evaluateAuditIntegrity(baseInput({ auditEvents: [audit] }));
    expect(report.verdict).toBe('BLOCKED_P1');
    const orphan = report.issues.find((i) => i.type === 'orphan_audit_event');
    expect(orphan).toBeDefined();
    expect(orphan?.severity).toBe('P1');
    expect(orphan?.deckId).toBe('deck_unknown');
  });

  // 8
  it('multiple P1 issues aggregate cleanly into BLOCKED_P1 totals', () => {
    const edit1 = makeEdit({ id: 'op_a', deckId: 'deck_a' });
    const edit2 = makeEdit({ id: 'op_b', deckId: 'deck_b' });
    const exp = makeExport({ id: 'exp_a', deckId: 'deck_a' });
    const report = evaluateAuditIntegrity(
      baseInput({
        agentEdits: [edit1, edit2],
        exports: [exp],
      })
    );
    expect(report.verdict).toBe('BLOCKED_P1');
    expect(report.totals.p1).toBe(3);
    expect(report.totals.p2).toBe(0);
    const types = report.issues.map((i) => i.type).sort();
    expect(types).toEqual([
      'missing_audit_for_agent_edit',
      'missing_audit_for_agent_edit',
      'missing_audit_for_export',
    ]);
  });

  // 9
  it('mixed P1 + P2 issues still verdict BLOCKED_P1', () => {
    const editMissing = makeEdit({ id: 'op_missing' });
    const editLate = makeEdit({
      id: 'op_late',
      deckId: 'deck_2',
      appliedAt: isoOffset(-20 * 60_000),
    });
    const lateAudit = makeAudit({
      id: 'ae_late',
      deckId: 'deck_2',
      relatedId: 'op_late',
      occurredAt: isoOffset(-5 * 60_000),
    });
    const report = evaluateAuditIntegrity(
      baseInput({
        agentEdits: [editMissing, editLate],
        auditEvents: [lateAudit],
      })
    );
    expect(report.verdict).toBe('BLOCKED_P1');
    expect(report.totals.p1).toBeGreaterThanOrEqual(1);
    expect(report.totals.p2).toBeGreaterThanOrEqual(1);
  });

  // 10
  it('only-P2 issues collapse to PASS_WITH_P2', () => {
    const edit = makeEdit({ appliedAt: isoOffset(-20 * 60_000) });
    // Only a late audit event — no missing-audit failures.
    const audit = makeAudit({
      relatedId: edit.id,
      occurredAt: isoOffset(-5 * 60_000),
    });
    const report = evaluateAuditIntegrity(
      baseInput({ agentEdits: [edit], auditEvents: [audit] })
    );
    expect(report.verdict).toBe('PASS_WITH_P2');
    expect(report.totals.p1).toBe(0);
    expect(report.totals.p2).toBe(1);
  });

  // 11
  it('failed exports do NOT require an audit row', () => {
    const failed = makeExport({ status: 'failed' });
    const blocked = makeExport({ id: 'exp_b', status: 'blocked' });
    const started = makeExport({ id: 'exp_s', status: 'started' });
    const report = evaluateAuditIntegrity(
      baseInput({ exports: [failed, blocked, started] })
    );
    expect(report.verdict).toBe('PASS');
    expect(report.issues).toHaveLength(0);
    expect(report.totals.exportsScanned).toBe(3);
  });

  // 12
  it('issues array hard-caps at ISSUE_CAP and flips truncated', () => {
    const edits: AgentEditInput[] = [];
    for (let i = 0; i < ISSUE_CAP + 50; i++) {
      edits.push({
        id: 'op_bulk_' + i,
        deckId: 'deck_bulk_' + i,
        appliedAt: isoOffset(-60_000),
      });
    }
    const report = evaluateAuditIntegrity(baseInput({ agentEdits: edits }));
    expect(report.issues.length).toBe(ISSUE_CAP);
    expect(report.truncated).toBe(true);
    expect(report.verdict).toBe('BLOCKED_P1');
    expect(report.totals.issuesFound).toBe(ISSUE_CAP);
  });

  // 13
  it('produces a JSON-serializable report', () => {
    const edit = makeEdit();
    const audit = makeAudit({ relatedId: edit.id });
    const report = evaluateAuditIntegrity(
      baseInput({ agentEdits: [edit], auditEvents: [audit] })
    );
    const roundTripped = JSON.parse(JSON.stringify(report));
    expect(roundTripped).toEqual(report);
  });

  // 14
  it('never throws on malformed timestamps; treats them as orphan / late', () => {
    const edit = makeEdit({ appliedAt: 'not-a-date' });
    const exp = makeExport({ id: 'exp_bad', completedAt: '???' });
    const audit = makeAudit({
      id: 'ae_bad',
      relatedId: edit.id,
      occurredAt: 'still-not-a-date',
    });
    expect(() =>
      evaluateAuditIntegrity(
        baseInput({
          agentEdits: [edit],
          exports: [exp],
          auditEvents: [audit],
        })
      )
    ).not.toThrow();

    const report = evaluateAuditIntegrity(
      baseInput({
        agentEdits: [edit],
        exports: [exp],
        auditEvents: [audit],
      })
    );
    // Malformed timestamps are surfaced as documented issues, never thrown.
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.verdict).not.toBe('PASS');
  });

  // 15
  it('respects the windowDays filter (out-of-window rows ignored)', () => {
    const inWindow = makeEdit({ id: 'op_in', appliedAt: isoOffset(-60_000) });
    const outOfWindow = makeEdit({
      id: 'op_old',
      // 30 days ago: outside the 7-day window.
      appliedAt: isoOffset(-30 * 24 * 60 * 60_000),
    });
    const audit = makeAudit({ relatedId: inWindow.id });
    const report = evaluateAuditIntegrity(
      baseInput({
        agentEdits: [inWindow, outOfWindow],
        auditEvents: [audit],
        windowDays: 7,
      })
    );
    expect(report.totals.agentEditsScanned).toBe(1);
    expect(report.verdict).toBe('PASS');
  });

  // 16 — extra: confirm orphan detection ignores untracked actions.
  it('untracked audit actions are NOT flagged as orphan', () => {
    const audit: AuditEventInput = {
      id: 'ae_unrelated',
      deckId: 'deck_unknown',
      action: 'create',
      relatedId: 'res_unknown',
      occurredAt: isoOffset(-30_000),
    };
    const report = evaluateAuditIntegrity(baseInput({ auditEvents: [audit] }));
    expect(report.verdict).toBe('PASS');
    expect(report.issues).toHaveLength(0);
  });

  // 17 — extra: latency budget boundary is inclusive.
  it('latency exactly at the budget boundary is NOT flagged as late', () => {
    const edit = makeEdit({ appliedAt: isoOffset(-AUDIT_LATENCY_BUDGET_MS - 60_000) });
    const audit = makeAudit({
      relatedId: edit.id,
      occurredAt: isoOffset(-60_000),
    });
    const report = evaluateAuditIntegrity(
      baseInput({ agentEdits: [edit], auditEvents: [audit] })
    );
    expect(report.verdict).toBe('PASS');
  });
});
