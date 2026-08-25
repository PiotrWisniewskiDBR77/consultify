import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetTableColumns = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));
vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

import calendarRoutes from '../calendar.routes.js';

const ORG = 'org-a';
const USER = 'user-a';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.userId = USER;
    req.organizationId = ORG;
    req.db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    next();
  });
  app.use('/api/my-work', calendarRoutes);
  return app;
}

describe('calendar event and meeting behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTableColumns.mockImplementation((table: string) =>
      Promise.resolve(
        table === 'meetings'
          ? new Map([
              ['start_at', { name: 'start_at' }],
              ['end_at', { name: 'end_at' }],
              ['created_by', { name: 'created_by' }],
              ['attendees_json', { name: 'attendees_json' }],
            ])
          : new Map()
      )
    );
  });

  it.each([
    ['creator', { id: 'meeting-owner', created_by: USER, attendees_json: '[]' }],
    ['attendee', { id: 'meeting-attendee', created_by: 'other', attendees_json: `["${USER}"]` }],
  ])('returns a same-organization meeting for its %s', async (_label, row) => {
    mockQueryAll.mockImplementation(async (sql: string, params: unknown[]) => {
      if (!sql.includes('FROM meetings')) return [];
      expect(sql).toContain('m.organization_id = ?');
      expect(sql).toContain('(m.created_by = ? OR m.attendees_json LIKE ?)');
      expect(params.slice(0, 3)).toEqual([ORG, USER, `%"${USER}"%`]);
      return [{
        ...row,
        title: 'Allowed',
        start_at: '2026-08-25T09:00:00Z',
        end_at: '2026-08-25T10:00:00Z',
        agenda_json: JSON.stringify({ calendarSource: 'consultify' }),
      }];
    });
    const res = await request(createApp()).get('/api/my-work/calendar/unified').query({
      start: '2026-08-25',
      end: '2026-08-26',
      sources: 'meeting',
    });
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'consultify', title: expect.stringContaining('Allowed') }),
      ])
    );
  });

  it('does not return a meeting when the caller is neither creator nor attendee', async () => {
    mockQueryAll.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/my-work/calendar/unified').query({
      start: '2026-08-25', end: '2026-08-26', sources: 'meeting',
    });
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
  });

  it('keeps the organization constraint ahead of creator/attendee matching', async () => {
    mockQueryAll.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM meetings')) {
        expect(sql).toMatch(/m\.organization_id = \?[\s\S]*m\.created_by = \?/);
        expect(params[0]).toBe(ORG);
      }
      return [];
    });
    const res = await request(createApp()).get('/api/my-work/calendar/unified').query({
      start: '2026-08-25', end: '2026-08-26', sources: 'meeting',
    });
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
  });

  // FIX-13 (Day 3 layer-2 acceptance, P0): a live-runtime pass found that
  // POST-created calendar_events never reappeared after a reload — the
  // unified GET route had an `if (requestedSources.includes('event'))`
  // branch, but 'event' was missing from the DEFAULT source list used
  // whenever the client omits `?sources=` (the common real-world path, see
  // src/services/api.ts getMyWorkCalendarUnified()'s V8-detour fallback and
  // src/components/MyWork/Calendar/useCalendarData.ts's ALL_SOURCES — both
  // fixed alongside this route). These two cases prove the regression is
  // closed for both the row owner and a non-creator attendee.
  it.each([
    ['owner', { id: 'event-1', owner_id: USER, attendees_json: '[]', visibility: 'private' }],
    [
      'attendee (not creator)',
      { id: 'event-2', owner_id: 'other-user', attendees_json: `["${USER}"]`, visibility: 'private' },
    ],
  ])(
    'includes a real calendar_events row for its %s with no `sources` query param at all',
    async (_label, row) => {
      mockQueryAll.mockImplementation(async (sql: string, params: unknown[]) => {
        if (!sql.includes('FROM calendar_events')) return [];
        expect(sql).toContain('e.organization_id = ?');
        expect(sql).toContain("e.owner_id = ? OR e.attendees_json LIKE ? OR e.visibility = 'org'");
        expect(params.slice(0, 3)).toEqual([ORG, USER, `%"${USER}"%`]);
        return [
          {
            ...row,
            title: 'Client kickoff',
            start_at: '2026-08-25T09:00:00Z',
            end_at: '2026-08-25T10:00:00Z',
            all_day: 0,
            status: 'confirmed',
          },
        ];
      });
      const res = await request(createApp())
        .get('/api/my-work/calendar/unified')
        // Deliberately no `sources` param — this is the path the frontend
        // actually takes when nothing is filtered out.
        .query({ start: '2026-08-25', end: '2026-08-26' });
      expect(res.status).toBe(200);
      expect(res.body.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: 'event', title: 'Client kickoff' }),
        ])
      );
    }
  );

  it('rejects malformed timestamps on owner update without writing', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'event-1', owner_id: USER, start_at: '2026-08-25T09:00:00Z',
      end_at: '2026-08-25T10:00:00Z', attendees_json: '[]',
    });
    const res = await request(createApp())
      .put('/api/my-work/calendar/events/event-1')
      .send({ startAt: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(mockQueryRun).not.toHaveBeenCalled();
  });
});
