import { describe, expect, it } from 'vitest';

import {
  getDemoAnchorDate,
  materializeRelativeDate,
  materializeRelativeIso,
} from '../../../../server/src/services/demo/demoRelativeDate.ts';

describe('demoRelativeDate', () => {
  it('normalizes the anchor date to UTC start-of-day', () => {
    const anchor = getDemoAnchorDate('2026-04-12T15:23:49.000Z');
    expect(anchor.toISOString()).toBe('2026-04-12T00:00:00.000Z');
  });

  it('supports simple day offsets', () => {
    const value = materializeRelativeIso('+14d', { anchorDate: '2026-04-12T00:00:00.000Z' });
    expect(value).toBe('2026-04-26T00:00:00.000Z');
  });

  it('supports quarter-relative presets', () => {
    const value = materializeRelativeIso('currentQuarterEnd', {
      anchorDate: '2026-04-12T00:00:00.000Z',
      asEndOfDay: true,
    });
    expect(value).toBe('2026-06-30T23:59:59.999Z');
  });

  it('supports next board meeting calculations', () => {
    const value = materializeRelativeDate('nextBoardMeeting', {
      anchorDate: '2026-04-12T00:00:00.000Z',
    });
    expect(value.toISOString()).toBe('2026-04-14T00:00:00.000Z');
  });
});
