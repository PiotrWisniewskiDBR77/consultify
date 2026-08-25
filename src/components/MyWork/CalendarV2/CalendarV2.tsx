import React from 'react';

import { CalendarView } from '../Calendar/CalendarView';

/**
 * Default-on Calendar V2 entry point (DEC-2026-08-25-50). It deliberately
 * composes the proven calendar read/grid/sidebar surfaces and changes only
 * the owner-approved default to week; legacy CalendarView remains
 * month-first if the flag is explicitly opted out.
 */
export const CalendarV2: React.FC<React.ComponentProps<typeof CalendarView>> = (props) => (
  <div className="h-full" data-testid="my-work-calendar-v2">
    <CalendarView {...props} initialViewMode="week" includeOwnEvents />
  </div>
);
