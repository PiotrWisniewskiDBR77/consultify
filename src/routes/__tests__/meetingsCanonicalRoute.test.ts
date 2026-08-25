import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppView } from '../../types';
import { getAppViewFromPath, getRouteFromAppView, ROUTES } from '../routeConfig';

/**
 * DEC-2026-08-24-07 (OWNER_DECISION_LEDGER): canonical Meeting address
 * grammar is `/meetings` (list) + `/meetings/:meetingId` (object card) +
 * `/meetings/:meetingId/{minutes|decisions}` + `/meetings/:meetingId/notes/:noteId`.
 * `/meeting` (singular) and `/meeting?meetingId=X` are permanent legacy
 * redirects, not a second mounted identity for the module.
 */
describe('Meetings canonical route (DEC-2026-08-24-07)', () => {
  it('defines the ROUTES.MEETINGS grammar', () => {
    expect(ROUTES.MEETINGS.ROOT).toBe('/meetings');
    expect(ROUTES.MEETINGS.OBJECT).toBe('/meetings/:meetingId');
    expect(ROUTES.MEETINGS.MINUTES).toBe('/meetings/:meetingId/minutes');
    expect(ROUTES.MEETINGS.DECISIONS).toBe('/meetings/:meetingId/decisions');
    expect(ROUTES.MEETINGS.NOTE).toBe('/meetings/:meetingId/notes/:noteId');
  });

  it('keeps the legacy singular /meeting constant for the redirect route only', () => {
    expect(ROUTES.MEETING).toBe('/meeting');
  });

  it('resolves AppView.MEETING to the canonical /meetings list, not the legacy alias', () => {
    expect(getRouteFromAppView(AppView.MEETING)).toBe(ROUTES.MEETINGS.ROOT);
  });

  it.each([ROUTES.MEETINGS.ROOT, `${ROUTES.MEETINGS.ROOT}/mtg-123`, ROUTES.MEETING])(
    'classifies %s as AppView.MEETING',
    (path) => {
      expect(getAppViewFromPath(path)).toBe(AppView.MEETING);
    }
  );

  describe('AppRoutes.tsx wiring (source-slice)', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

    it('redirects the legacy /meeting route via MeetingLegacyRedirect, not MeetingHub', () => {
      const routeIndex = source.indexOf('path={ROUTES.MEETING}');
      expect(routeIndex).toBeGreaterThan(-1);
      const routeSlice = source.slice(routeIndex, routeIndex + 200);
      expect(routeSlice).toContain('<MeetingLegacyRedirect');
      expect(routeSlice).not.toContain('<MeetingHub');
    });

    it('mounts MeetingHub directly on the canonical /meetings list route', () => {
      const routeIndex = source.indexOf('path={ROUTES.MEETINGS.ROOT}');
      expect(routeIndex).toBeGreaterThan(-1);
      const routeSlice = source.slice(routeIndex, routeIndex + 500);
      expect(routeSlice).toContain('<MeetingHub');
      expect(routeSlice).toContain('BetaGate moduleId="MODULE_MEETING"');
    });

    it('mounts MeetingObjectPage on the object card route', () => {
      const routeIndex = source.indexOf('path={ROUTES.MEETINGS.OBJECT}');
      expect(routeIndex).toBeGreaterThan(-1);
      const routeSlice = source.slice(routeIndex, routeIndex + 700);
      expect(routeSlice).toContain('<MeetingObjectPage');
    });

    it.each(['MINUTES', 'DECISIONS', 'NOTE'] as const)(
      'mounts ROUTES.MEETINGS.%s on a real page, not left unregistered',
      (key) => {
        const routeIndex = source.indexOf(`path={ROUTES.MEETINGS.${key}}`);
        expect(routeIndex).toBeGreaterThan(-1);
        const routeSlice = source.slice(routeIndex, routeIndex + 700);
        expect(routeSlice).toContain('<MeetingObjectPage');
      }
    );

    it('rewrites ?meetingId= onto the object path instead of just carrying the query along', () => {
      const componentIndex = source.indexOf('const MeetingLegacyRedirect');
      expect(componentIndex).toBeGreaterThan(-1);
      const componentSlice = source.slice(componentIndex, componentIndex + 900);
      expect(componentSlice).toContain("searchParams.get('meetingId')");
      expect(componentSlice).toContain('ROUTES.MEETINGS.ROOT');
    });
  });

  describe('MeetingHub.tsx wiring (source-slice)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/Meeting/MeetingHub.tsx'),
      'utf8'
    );

    it('opening a meeting navigates to the object route instead of appending ?meetingId=', () => {
      const fnIndex = source.indexOf('const openMeetingDocument');
      expect(fnIndex).toBeGreaterThan(-1);
      const fnSlice = source.slice(fnIndex, fnIndex + 300);
      expect(fnSlice).toContain('navigate(`${ROUTES.MEETINGS.ROOT}/');
      expect(fnSlice).not.toContain("next.set('meetingId'");
      expect(fnSlice).not.toContain('setSearchParams(');
    });
  });
});
