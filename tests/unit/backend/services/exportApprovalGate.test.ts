/**
 * M17 integrity fix (07-15 audit) — export-approval gate unit contract.
 *
 * See server/src/services/v8/exportApprovalGate.ts for the shadow/enforce
 * rationale: `v8_publish_records` rows only exist for artifacts that
 * explicitly entered the wave5 review workflow, so a NULL publishState must
 * never block (legacy/ungated), while a non-null, non-approved state
 * (someone put it under review and it's not yet approved) is gated and only
 * actually 403s once EXPORT_APPROVAL_ENFORCE=true.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  evaluateExportApproval,
  isExportApprovalEnforced,
  applyExportApprovalGate,
} from '../../../../server/src/services/v8/exportApprovalGate.js';

describe('evaluateExportApproval', () => {
  it('allows a NULL publish state (never entered review) regardless of enforce mode', () => {
    expect(evaluateExportApproval(null, false)).toEqual({
      allowed: true,
      publishState: null,
      gated: false,
    });
    expect(evaluateExportApproval(null, true)).toEqual({
      allowed: true,
      publishState: null,
      gated: false,
    });
    expect(evaluateExportApproval(undefined, true).allowed).toBe(true);
  });

  it('allows approved/published states regardless of enforce mode', () => {
    expect(evaluateExportApproval('approved', false).allowed).toBe(true);
    expect(evaluateExportApproval('approved', true).allowed).toBe(true);
    expect(evaluateExportApproval('published', true).allowed).toBe(true);
    expect(evaluateExportApproval('approved', true).gated).toBe(false);
  });

  it.each(['private_draft', 'reviewable_share', 'changes_requested', 'some_future_state'])(
    'flags a gated state (%s) but only BLOCKS when enforced',
    (state) => {
      const shadow = evaluateExportApproval(state, false);
      expect(shadow.gated).toBe(true);
      expect(shadow.allowed).toBe(true); // shadow mode never blocks

      const enforced = evaluateExportApproval(state, true);
      expect(enforced.gated).toBe(true);
      expect(enforced.allowed).toBe(false); // enforce mode blocks a gated state
    }
  );
});

describe('isExportApprovalEnforced (env flag)', () => {
  const ORIGINAL = process.env.EXPORT_APPROVAL_ENFORCE;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.EXPORT_APPROVAL_ENFORCE;
    else process.env.EXPORT_APPROVAL_ENFORCE = ORIGINAL;
  });

  it('defaults to shadow (false) when unset', () => {
    delete process.env.EXPORT_APPROVAL_ENFORCE;
    expect(isExportApprovalEnforced()).toBe(false);
  });

  it('is false for anything other than the literal string "true"', () => {
    process.env.EXPORT_APPROVAL_ENFORCE = '1';
    expect(isExportApprovalEnforced()).toBe(false);
    process.env.EXPORT_APPROVAL_ENFORCE = 'yes';
    expect(isExportApprovalEnforced()).toBe(false);
  });

  it('is true when set to "true" (case-insensitive)', () => {
    process.env.EXPORT_APPROVAL_ENFORCE = 'true';
    expect(isExportApprovalEnforced()).toBe(true);
    process.env.EXPORT_APPROVAL_ENFORCE = 'TRUE';
    expect(isExportApprovalEnforced()).toBe(true);
  });
});

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
}

describe('applyExportApprovalGate (Express helper)', () => {
  beforeEach(() => {
    delete process.env.EXPORT_APPROVAL_ENFORCE;
  });

  it('shadow mode (default): gated artifact proceeds (200 path), warning header set', () => {
    const res = mockRes();
    const proceed = applyExportApprovalGate({
      res,
      organizationId: 'org-1',
      userId: 'user-1',
      originRuntime: 'report',
      originRecordId: 'report-1',
      format: 'pdf',
      publishState: 'changes_requested',
    });
    expect(proceed).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Export-Approval-Warning']).toBe('EXPORT_NOT_APPROVED');
  });

  it('enforce mode: gated artifact is blocked with 403 EXPORT_NOT_APPROVED', () => {
    process.env.EXPORT_APPROVAL_ENFORCE = 'true';
    const res = mockRes();
    const proceed = applyExportApprovalGate({
      res,
      organizationId: 'org-1',
      userId: 'user-1',
      originRuntime: 'report',
      originRecordId: 'report-1',
      format: 'pdf',
      publishState: 'changes_requested',
    });
    expect(proceed).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'EXPORT_NOT_APPROVED',
      publishState: 'changes_requested',
    });
  });

  it('enforce mode: approved artifact proceeds', () => {
    process.env.EXPORT_APPROVAL_ENFORCE = 'true';
    const res = mockRes();
    const proceed = applyExportApprovalGate({
      res,
      organizationId: 'org-1',
      userId: 'user-1',
      originRuntime: 'report',
      originRecordId: 'report-1',
      format: 'pdf',
      publishState: 'approved',
    });
    expect(proceed).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('enforce mode: NULL publish state (legacy, never reviewed) still proceeds — never blocked', () => {
    process.env.EXPORT_APPROVAL_ENFORCE = 'true';
    const res = mockRes();
    const proceed = applyExportApprovalGate({
      res,
      organizationId: 'org-1',
      userId: 'user-1',
      originRuntime: 'report',
      originRecordId: 'report-1',
      format: 'pdf',
      publishState: null,
    });
    expect(proceed).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers['X-Export-Approval-Warning']).toBeUndefined();
  });
});
