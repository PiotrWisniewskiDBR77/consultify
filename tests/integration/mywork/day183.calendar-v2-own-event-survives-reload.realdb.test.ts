/**
 * FIX-183 (day183-kalendarz-on resume) regression: a real own `calendar_events`
 * row, created through the client `Api` layer, must still be present after a
 * CalendarV2-style full reload through the real `useCalendarData` hook.
 *
 * Root cause this guards (see the FIX-183 comment block in
 * src/components/MyWork/Calendar/useCalendarData.ts): `useCalendarData`
 * omitted the `sources` query param whenever "everything" was selected,
 * trusting that the server-side default it fell back to matched
 * ALL_SOURCES. Api.getMyWorkCalendarUnified only takes the 'event'-aware
 * legacy route (server/src/routes/my-work/calendar.routes.ts) when the
 * caller's `sources` array *explicitly* includes 'event'; an omitted param
 * falls through to the V8 route (server/src/routes/v8/my-work.routes.ts),
 * which has no 'event' handling at all. So a CalendarV2 "everything
 * selected" reload silently dropped every own event.
 *
 * This test exercises the REAL client stack end to end — the real
 * `useCalendarData` hook, the real `Api.getMyWorkCalendarUnified` /
 * `Api.createMyWorkCalendarEvent`, a real HTTP server mounting the real
 * `ApiGateway`, and a real, disposable Postgres — because the bug lives
 * entirely in a client-side routing decision that a server-only (supertest)
 * test cannot see: hitting the legacy endpoint directly always worked.
 *
 * MUTATION CHECK (recorded in the FIX-183 report, not re-run automatically):
 * temporarily restoring the pre-fix `useCalendarData.ts` (duplicate 'event'
 * push left unresolved, `sources` omitted whenever nothing was deselected)
 * turns the second `it` below red; restoring the fix turns it green again.
 */
import { randomUUID } from 'node:crypto';
import type http from 'node:http';

import { renderHook, waitFor } from '@testing-library/react';
import jwt from 'jsonwebtoken';
import nodeFetch from 'node-fetch';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.endsWith('/fix183');

describe.skipIf(!REAL_DB)('FIX-183 CalendarV2 own event survives full reload', () => {
  const prefix = `fix183_${randomUUID().replaceAll('-', '')}`;
  const organizationId = randomUUID();
  const userId = randomUUID();
  const rangeStart = '2026-08-30T00:00:00.000Z';
  const rangeEnd = '2026-08-31T00:00:00.000Z';

  let sql: Client;
  let server: http.Server;
  let baseUrl = '';
  let eventId = '';
  let ApiModule: typeof import('@/services/api');
  let useCalendarDataModule: typeof import('@/components/MyWork/Calendar/useCalendarData');
  let restoreFetch: (() => void) | null = null;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment({ expectedDatabase: 'fix183' });

    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [organizationId, `${prefix}_org`]
    );
    await sql.query(
      `INSERT INTO users
         (id, organization_id, email, password, first_name, last_name, role, status, created_at)
       VALUES ($1, $2, $3, 'x', 'Day', 'One Eighty Three', 'ADMIN', 'active', now())`,
      [userId, organizationId, `${prefix}_owner@fix183.local`]
    );
    await sql.query(
      `INSERT INTO organization_members
         (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
      [`${prefix}_member`, organizationId, userId]
    );

    // Mount the real Gateway (both the legacy and V8 calendar routes — the
    // mutation check needs V8 reachable too, since the pre-fix code routes
    // there) on a real, ephemeral TCP port. A server-only supertest call
    // can't reproduce this bug: the bug is which URL the *client* decides
    // to hit, so the client's own fetch has to leave the process.
    const express = (await import('express')).default;
    const { ApiGateway } = await import('../../../server/src/Gateway.js');
    const app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    server = await new Promise<http.Server>((resolve) => {
      const mounted = app.listen(0, '127.0.0.1', () => resolve(mounted));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fix183_calendar_address_missing');
    baseUrl = `http://127.0.0.1:${address.port}`;

    // src/services/api.ts computes API_URL from `import.meta.env.VITE_API_URL`
    // at module-evaluation time, so the env var has to be set *before* the
    // module (and useCalendarData.ts, which imports it) is first evaluated.
    process.env.VITE_API_URL = baseUrl;
    vi.resetModules();
    ApiModule = await import('@/services/api');
    useCalendarDataModule = await import('@/components/MyWork/Calendar/useCalendarData');

    // tests/setup.ts stubs `global.fetch` to a canned in-memory mock so no
    // test accidentally makes a real network call. This test's entire point
    // is to exercise the real client `fetch` calls in Api.ts against the
    // real server above, so it swaps in a real, network-capable fetch here
    // and restores the mock in afterAll.
    const previousFetch = global.fetch;
    vi.stubGlobal('fetch', nodeFetch as unknown as typeof fetch);
    restoreFetch = () => {
      global.fetch = previousFetch;
    };

    const token = jwt.sign(
      {
        id: userId,
        email: `${prefix}_owner@fix183.local`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      (await import('../../../server/src/config/Config.js')).default.JWT_SECRET,
      { expiresIn: '1h' }
    );
    localStorage.setItem('token', token);
    localStorage.setItem('consultify_current_org_id', organizationId);

    const created = await ApiModule.Api.createMyWorkCalendarEvent({
      title: `${prefix}_event`,
      description: 'FIX-183 own event survives reload',
      startAt: '2026-08-30T09:00:00.000Z',
      endAt: '2026-08-30T10:00:00.000Z',
      source: 'event',
    });
    expect(created?.id, JSON.stringify(created)).toBeTruthy();
    eventId = created.id;
  }, 60_000);

  afterAll(async () => {
    restoreFetch?.();
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!sql) return;
    if (eventId) await sql.query('DELETE FROM calendar_events WHERE id = $1', [eventId]);
    await sql.query('DELETE FROM organization_members WHERE organization_id = $1', [
      organizationId,
    ]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await sql.end();
  });

  it('persists the own event via the real POST endpoint', async () => {
    const row = await sql.query(
      `SELECT organization_id, owner_id, status FROM calendar_events WHERE id = $1`,
      [eventId]
    );
    expect(row.rows[0]).toEqual(
      expect.objectContaining({
        organization_id: organizationId,
        owner_id: userId,
        status: 'confirmed',
      })
    );
  });

  it('is returned by useCalendarData after a full reload with no query/local override (CalendarV2 default)', async () => {
    // Mirrors exactly how CalendarV2 mounts CalendarView: `includeOwnEvents`
    // defaults true there, which is what feeds `additionalSources=['event']`
    // into useCalendarData (src/components/MyWork/Calendar/CalendarView.tsx:125).
    const { result } = renderHook(() =>
      useCalendarDataModule.useCalendarData({ start: rangeStart, end: rangeEnd }, 0, ['event'])
    );

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10_000 });

    expect(result.current.error).toBeNull();
    expect(result.current.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'event', sourceId: eventId })])
    );
  });
});
