/**
 * @vitest-environment jsdom
 *
 * Unit tests for the Presentation Studio layout-capacity admin API
 * client (Sprint S20). Covers:
 *
 *   - GET /admin/layout-capacity (200 + 403 visibility-gate path)
 *   - POST /admin/layout-capacity/propose (200 + 412 validation)
 *   - POST /admin/layout-capacity/execute (200 + 403 ticket failures)
 *   - POST /admin/layout-capacity/reset/propose (200)
 *   - POST /admin/layout-capacity/reset/execute (200 + 403 ticket failures)
 *   - typed `LayoutCapacityAdminApiError` shape on every error path
 *
 * Mocks `baseClient.fetchWithRetry` so the tests never touch the
 * network. The mock receives the full URL + RequestInit and returns a
 * `Response`-shaped object so the api client's `await res.json()`
 * path runs through the real code.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LayoutCapacityAdminApiError,
  PresentationStudioLayoutCapacityAdminApi,
} from '../presentationStudioLayoutCapacityAdmin.api';

vi.mock('../baseClient', async () => {
  const actual = await vi.importActual<typeof import('../baseClient')>('../baseClient');
  return {
    ...actual,
    fetchWithRetry: vi.fn(),
    getHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
  };
});

import { fetchWithRetry } from '../baseClient';

const mockedFetch = fetchWithRetry as unknown as ReturnType<typeof vi.fn>;

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  mockedFetch.mockReset();
});

afterEach(() => {
  mockedFetch.mockReset();
});

describe('PresentationStudioLayoutCapacityAdminApi.get', () => {
  it('resolves with snapshot + defaults + null loadWarning on a clean SUPERADMIN read', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          current: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          defaults: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          scope: 'process_global',
          loadWarning: null,
        },
      })
    );

    const result = await PresentationStudioLayoutCapacityAdminApi.get();
    expect(result.scope).toBe('process_global');
    expect(result.loadWarning).toBeNull();
    expect(result.current.densityBudgets.balanced.titleMaxChars).toBe(80);
    expect(result.defaults.densityBudgets.balanced.titleMaxChars).toBe(80);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const call = mockedFetch.mock.calls[0];
    expect(call[0]).toBe('/api/presentation-studio/admin/layout-capacity');
    expect(call[1].method).toBe('GET');
  });

  it('surfaces a populated loadWarning verbatim so the panel can render the honest degraded state', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          current: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          defaults: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          scope: 'process_global',
          loadWarning: {
            reason: 'corrupt',
            sourcePath: '/tmp/persisted.json',
            details: 'Unexpected token in JSON at position 0',
            raisedAt: '2026-05-09T00:00:00.000Z',
          },
        },
      })
    );

    const result = await PresentationStudioLayoutCapacityAdminApi.get();
    expect(result.loadWarning).toEqual({
      reason: 'corrupt',
      sourcePath: '/tmp/persisted.json',
      details: 'Unexpected token in JSON at position 0',
      raisedAt: '2026-05-09T00:00:00.000Z',
    });
  });

  it('surfaces signature_mismatch loadWarning verbatim so tamper evidence reaches the UI', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          current: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          defaults: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          scope: 'process_global',
          loadWarning: {
            reason: 'signature_mismatch',
            sourcePath: '/tmp/persisted.json',
            details: 'signature does not match persisted override contents',
            raisedAt: '2026-05-09T00:00:00.000Z',
          },
        },
      })
    );

    const result = await PresentationStudioLayoutCapacityAdminApi.get();
    expect(result.loadWarning).toEqual({
      reason: 'signature_mismatch',
      sourcePath: '/tmp/persisted.json',
      details: 'signature does not match persisted override contents',
      raisedAt: '2026-05-09T00:00:00.000Z',
    });
  });

  it('throws LayoutCapacityAdminApiError with status 403 + code PERMISSION_DENIED for non-SuperAdmin', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(403, {
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED',
      })
    );

    let caught: unknown;
    try {
      await PresentationStudioLayoutCapacityAdminApi.get();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityAdminApiError);
    const err = caught as LayoutCapacityAdminApiError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('PERMISSION_DENIED');
    expect(err.message).toBe('Permission denied');
  });
});

describe('PresentationStudioLayoutCapacityAdminApi.proposeOverrides', () => {
  it('resolves with the minted ticket on a clean propose', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          ticket: {
            ticketId: 'pssa_abc',
            organizationId: 'org-Sys',
            userId: 'admin-1',
            payloadFingerprint: 'a'.repeat(64),
            createdAt: '2026-05-09T00:00:00.000Z',
            expiresAt: '2026-05-09T00:10:00.000Z',
            consumedAt: null,
          },
          payloadFingerprint: 'a'.repeat(64),
          overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
        },
      })
    );

    const result = await PresentationStudioLayoutCapacityAdminApi.proposeOverrides({
      overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
      reason: 'tightening for executive decks',
    });
    expect(result.ticket.ticketId).toBe('pssa_abc');
    expect(result.payloadFingerprint).toMatch(/^[a-f0-9]{64}$/);

    const call = mockedFetch.mock.calls[0];
    expect(call[0]).toBe('/api/presentation-studio/admin/layout-capacity/propose');
    expect(call[1].method).toBe('POST');
    const sentBody = JSON.parse(call[1].body as string);
    expect(sentBody.overrides.densityBudgets.balanced.titleMaxChars).toBe(100);
    expect(sentBody.reason).toBe('tightening for executive decks');
  });

  it('throws LayoutCapacityAdminApiError with INVALID_OVERRIDES_PAYLOAD + errors[] on validation failure', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(412, {
        success: false,
        code: 'INVALID_OVERRIDES_PAYLOAD',
        reason: 'validation_failed',
        errors: [
          {
            path: 'densityBudgets.balanced.titleMaxChars',
            reason: 'must be a finite positive number',
          },
        ],
      })
    );

    let caught: unknown;
    try {
      await PresentationStudioLayoutCapacityAdminApi.proposeOverrides({
        overrides: { densityBudgets: { balanced: { titleMaxChars: -1 } } },
        reason: 'sentinel',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityAdminApiError);
    const err = caught as LayoutCapacityAdminApiError;
    expect(err.status).toBe(412);
    expect(err.code).toBe('INVALID_OVERRIDES_PAYLOAD');
    expect(err.reason).toBe('validation_failed');
    expect(err.errors).toHaveLength(1);
    expect(err.errors?.[0].path).toBe('densityBudgets.balanced.titleMaxChars');
  });

  it('serializes a missing reason as null (server normalizes both ways)', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          ticket: {
            ticketId: 'pssa_abc',
            organizationId: 'org-Sys',
            userId: 'admin-1',
            payloadFingerprint: 'a'.repeat(64),
            createdAt: '2026-05-09T00:00:00.000Z',
            expiresAt: '2026-05-09T00:10:00.000Z',
            consumedAt: null,
          },
          payloadFingerprint: 'a'.repeat(64),
          overrides: {},
        },
      })
    );

    await PresentationStudioLayoutCapacityAdminApi.proposeOverrides({ overrides: {} });
    const sentBody = JSON.parse(mockedFetch.mock.calls[0][1].body as string);
    expect(sentBody.reason).toBeNull();
  });
});

describe('PresentationStudioLayoutCapacityAdminApi.executeOverrides', () => {
  it('resolves with post-merge snapshot + audit event on a clean redeem', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          ticketId: 'pssa_abc',
          registrySnapshotAfter: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 100, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          auditEvent: 'presentation_studio_layout_capacity_overrides_applied',
        },
      })
    );

    const result = await PresentationStudioLayoutCapacityAdminApi.executeOverrides({
      approvalTicket: 'pssa_abc',
      overrides: { densityBudgets: { balanced: { titleMaxChars: 100 } } },
      reason: 'rationale',
    });
    expect(result.auditEvent).toBe('presentation_studio_layout_capacity_overrides_applied');
    expect(result.registrySnapshotAfter.densityBudgets.balanced.titleMaxChars).toBe(100);

    const call = mockedFetch.mock.calls[0];
    expect(call[0]).toBe('/api/presentation-studio/admin/layout-capacity/execute');
  });

  it('throws INVALID_APPROVAL_TICKET with typed reason on payload_mismatch', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(403, {
        success: false,
        code: 'INVALID_APPROVAL_TICKET',
        reason: 'payload_mismatch',
      })
    );

    let caught: unknown;
    try {
      await PresentationStudioLayoutCapacityAdminApi.executeOverrides({
        approvalTicket: 'pssa_abc',
        overrides: { densityBudgets: { balanced: { titleMaxChars: 999 } } },
        reason: 'rationale',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityAdminApiError);
    const err = caught as LayoutCapacityAdminApiError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('INVALID_APPROVAL_TICKET');
    expect(err.reason).toBe('payload_mismatch');
  });
});

describe('PresentationStudioLayoutCapacityAdminApi.proposeReset', () => {
  it('resolves with a reset ticket bound to the reason fingerprint', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          ticket: {
            ticketId: 'pssa_reset',
            organizationId: 'org-Sys',
            userId: 'admin-1',
            payloadFingerprint: 'b'.repeat(64),
            createdAt: '2026-05-09T00:00:00.000Z',
            expiresAt: '2026-05-09T00:10:00.000Z',
            consumedAt: null,
          },
          payloadFingerprint: 'b'.repeat(64),
        },
      })
    );

    const result = await PresentationStudioLayoutCapacityAdminApi.proposeReset({
      reason: 'returning to defaults',
    });
    expect(result.ticket.ticketId).toBe('pssa_reset');

    const call = mockedFetch.mock.calls[0];
    expect(call[0]).toBe('/api/presentation-studio/admin/layout-capacity/reset/propose');
    const sentBody = JSON.parse(call[1].body as string);
    expect(sentBody.reason).toBe('returning to defaults');
  });
});

describe('PresentationStudioLayoutCapacityAdminApi.executeReset', () => {
  it('resolves with pre + post snapshots + reset audit event on a clean redeem', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(200, {
        success: true,
        data: {
          ticketId: 'pssa_reset',
          registrySnapshotBefore: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 100, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: { synthetic: 'Universal' },
          },
          registrySnapshotAfter: {
            densityBudgets: {
              visual: { titleMaxChars: 60, keyMessageMaxChars: 100, blocksMax: 5 },
              balanced: { titleMaxChars: 80, keyMessageMaxChars: 200, blocksMax: 6 },
              document: { titleMaxChars: 100, keyMessageMaxChars: 400, blocksMax: 8 },
            },
            templateFamilyOverrides: {},
            familyAliasByDeckType: {},
          },
          auditEvent: 'presentation_studio_layout_capacity_overrides_reset',
        },
      })
    );

    const result = await PresentationStudioLayoutCapacityAdminApi.executeReset({
      approvalTicket: 'pssa_reset',
      reason: 'returning to defaults',
    });
    expect(result.auditEvent).toBe('presentation_studio_layout_capacity_overrides_reset');
    // Pre-state captures the override that was wiped.
    expect(result.registrySnapshotBefore.densityBudgets.balanced.titleMaxChars).toBe(100);
    expect(result.registrySnapshotBefore.familyAliasByDeckType.synthetic).toBe('Universal');
    // Post-state matches canonical defaults.
    expect(result.registrySnapshotAfter.densityBudgets.balanced.titleMaxChars).toBe(80);
    expect(result.registrySnapshotAfter.familyAliasByDeckType).toEqual({});
  });

  it('throws PRECONDITION_REQUIRED when ticket id is missing on the server', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(403, {
        success: false,
        code: 'PRECONDITION_REQUIRED',
        error: 'Approval ticket required.',
      })
    );

    let caught: unknown;
    try {
      await PresentationStudioLayoutCapacityAdminApi.executeReset({
        approvalTicket: '',
        reason: 'rationale',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(LayoutCapacityAdminApiError);
    const err = caught as LayoutCapacityAdminApiError;
    expect(err.status).toBe(403);
    expect(err.code).toBe('PRECONDITION_REQUIRED');
  });

  it('throws INVALID_APPROVAL_TICKET with reason consumed on a double-redeem', async () => {
    mockedFetch.mockResolvedValueOnce(
      makeResponse(403, {
        success: false,
        code: 'INVALID_APPROVAL_TICKET',
        reason: 'consumed',
      })
    );

    let caught: unknown;
    try {
      await PresentationStudioLayoutCapacityAdminApi.executeReset({
        approvalTicket: 'pssa_already_used',
        reason: 'rationale',
      });
    } catch (err) {
      caught = err;
    }
    const err = caught as LayoutCapacityAdminApiError;
    expect(err.code).toBe('INVALID_APPROVAL_TICKET');
    expect(err.reason).toBe('consumed');
  });
});

describe('LayoutCapacityAdminApiError', () => {
  it('carries status, code, reason, errors, and message — instanceof Error', () => {
    const err = new LayoutCapacityAdminApiError({
      status: 412,
      code: 'INVALID_OVERRIDES_PAYLOAD',
      message: 'Validation failed',
      reason: 'validation_failed',
      errors: [{ path: 'a.b', reason: 'must be positive' }],
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LayoutCapacityAdminApiError);
    expect(err.name).toBe('LayoutCapacityAdminApiError');
    expect(err.status).toBe(412);
    expect(err.code).toBe('INVALID_OVERRIDES_PAYLOAD');
    expect(err.reason).toBe('validation_failed');
    expect(err.errors?.[0].path).toBe('a.b');
  });

  it('omits optional fields when not provided', () => {
    const err = new LayoutCapacityAdminApiError({
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'Permission denied',
    });
    expect(err.reason).toBeUndefined();
    expect(err.errors).toBeUndefined();
  });
});
