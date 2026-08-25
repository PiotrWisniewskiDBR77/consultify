import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  isMyWorkCalendarV2Enabled,
  resetMyWorkCalendarV2FlagCache,
} from '../myWorkCalendarV2Flag';

describe('My Work Calendar V2 opt-in flag', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    resetMyWorkCalendarV2FlagCache();
  });

  it('defaults OFF with no query or local opt-in', () => {
    expect(isMyWorkCalendarV2Enabled()).toBe(false);
  });

  it('enables only through an explicit opt-in and can be explicitly disabled', () => {
    window.localStorage.setItem('ff.my_work_calendar_v2', '1');
    resetMyWorkCalendarV2FlagCache();
    expect(isMyWorkCalendarV2Enabled()).toBe(true);
    resetMyWorkCalendarV2FlagCache();
    window.localStorage.setItem('ff.my_work_calendar_v2', 'off');
    expect(isMyWorkCalendarV2Enabled()).toBe(false);
  });

  it('routes OFF to the legacy CalendarView and ON to CalendarV2', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MyWork/MyWorkHub.tsx'),
      'utf8'
    );
    const flag = source.indexOf('if (isMyWorkCalendarV2Enabled())');
    const start = source.lastIndexOf("case 'calendar'", flag);
    const end = source.indexOf("case 'inbox'", flag);
    expect(flag).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const calendarCase = source.slice(start, end);
    expect(calendarCase).toContain('if (isMyWorkCalendarV2Enabled())');
    expect(calendarCase.indexOf('<CalendarV2')).toBeLessThan(calendarCase.indexOf('<CalendarView'));
    expect(calendarCase).toContain('<React.Suspense fallback={lazyFallback}>');
  });
});
