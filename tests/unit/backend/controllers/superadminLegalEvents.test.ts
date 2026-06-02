/**
 * SuperAdmin Legal Events Controller — hardened contract test
 *
 * Mirrors the same anti-fragility contract that getAdminAuditLogs got after
 * the May remediation: a single malformed `metadata` row coming from the DB
 * must NOT turn the whole endpoint into a 500. The endpoint should report a
 * counter via `integrity.malformedMetadataCount` so the UI can warn the
 * operator without losing the rest of the events list.
 */

import type { NextFunction, Request, Response } from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import SuperAdminController from '@/../server/src/controllers/SuperAdminController';
import { setDependencies } from '@/../server/src/controllers/superadmin/shared';

function buildRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const setHeader = vi.fn();
  const send = vi.fn();
  const res = { json, status, setHeader, send } as unknown as Response;
  return { res, json, status };
}

const buildReq = (query: Record<string, any> = {}): Request =>
  ({ query, headers: {}, get: () => undefined } as unknown as Request);

const next: NextFunction = (() => {}) as any;

const eventsHappy = [
  {
    id: 'le-1',
    event_type: 'legal.document.viewed',
    metadata: JSON.stringify({ documentId: 'doc-1', orgId: 'org-1' }),
    created_at: '2026-04-26T00:00:00.000Z',
  },
  {
    id: 'le-2',
    event_type: 'legal.document.signed',
    metadata: { documentId: 'doc-2', alreadyParsed: true },
    created_at: '2026-04-26T00:00:01.000Z',
  },
];

const eventsWithGarbage = [
  {
    id: 'le-3',
    event_type: 'legal.document.viewed',
    metadata: '{not-valid-json',
    created_at: '2026-04-26T00:00:02.000Z',
  },
  {
    id: 'le-4',
    event_type: 'legal.document.signed',
    metadata: null,
    created_at: '2026-04-26T00:00:03.000Z',
  },
];

describe('SuperAdminController.getLegalEvents', () => {
  let originalLogger: any;

  beforeAll(() => {
    originalLogger = (SuperAdminController as any).deps?.LegalEventLogger;
  });

  afterAll(() => {
    if (originalLogger !== undefined) {
      setDependencies({ LegalEventLogger: originalLogger } as any);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses string metadata and passes object metadata through unchanged', async () => {
    setDependencies({
      LegalEventLogger: { getEvents: async () => eventsHappy },
    } as any);
    const { res, json } = buildRes();

    await SuperAdminController.getLegalEvents(buildReq({ limit: 10 }), res, next);

    expect(json).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0][0] as any;
    expect(payload.count).toBe(2);
    expect(payload.events[0].metadata).toEqual({ documentId: 'doc-1', orgId: 'org-1' });
    expect(payload.events[1].metadata).toEqual({ documentId: 'doc-2', alreadyParsed: true });
    expect(payload.integrity).toEqual({
      degraded: false,
      malformedMetadataCount: 0,
    });
  });

  it('does not throw when metadata is malformed; reports the count instead', async () => {
    setDependencies({
      LegalEventLogger: { getEvents: async () => eventsWithGarbage },
    } as any);
    const { res, json } = buildRes();

    await SuperAdminController.getLegalEvents(buildReq(), res, next);

    expect(json).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0][0] as any;
    expect(payload.count).toBe(2);
    expect(payload.events[0].metadata).toEqual({});
    expect(payload.events[0].metadataRaw).toBe('{not-valid-json');
    // The null metadata branch should NOT be parsed and should NOT count as malformed.
    expect(payload.events[1].metadata).toBeNull();
    expect(payload.integrity).toEqual({
      degraded: true,
      malformedMetadataCount: 1,
    });
  });
});
