/**
 * Dev-render host for the REAL `<CalendarView>` (MyWork → Calendar) —
 * MW-07 Codex FINAL UX FIX_REQUIRED: narrow-viewport sidebar-overlap fix.
 *
 * No re-implementation: `CalendarView` fetches through `Api.*`
 * (services/api.ts), so we monkeypatch the `Api` methods it calls directly
 * (`Api.getMyWorkCalendarUnified`, `Api.getIntegrations`,
 * `Api.getMyWorkCalendarConflicts`) rather than stubbing `window.fetch` —
 * this is the established pattern in this harness (see
 * dev-render/screens/vault-scope-selector.tsx) and avoids the "stub the
 * wrong layer" trap noted in Gen.Deck/Gen.Excel catch-up work.
 *
 * `CalendarSidebar` calls `useNavigate()`, so this needs a Router in scope —
 * a plain `BrowserRouter` is enough (Calendar/* has no dependency on
 * AppProviders' org/auth/feature-flag context).
 *
 * URL: ?screen=mw-007-calendar-narrow-viewport
 *      [&theme=light|dark]
 * Used by dev-render/shot.mjs (see scripts/dev/mw007-visual-qa.sh) to save
 * PNGs to artifacts/visual-qa/mw-007/ at desktop (1280px) and narrow
 * (375px) widths, matching the behavior already covered by
 * tests/components/MyWork/CalendarView.responsive.test.tsx.
 */
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import { CalendarView } from '../../src/components/MyWork/Calendar/CalendarView';
import { Api } from '../../src/services/api';

const TODAY = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);

(Api as any).getMyWorkCalendarUnified = async () => ({
  events: [
    {
      id: 'task-golden-mw007',
      title: 'Przygotuj plan wdrożenia Q3',
      start: iso(TODAY),
      allDay: true,
      source: 'task',
      sourceId: 'task-golden-mw007',
      projectId: 'proj-atelier',
      projectName: 'Atelier Toys — Rollout',
      provider: 'internal',
      version: '842',
      editAuthority: 'local_only',
    },
    {
      id: 'meeting-mw007',
      title: 'Warsztat z zespołem operacyjnym',
      start: iso(TODAY),
      end: iso(TODAY),
      allDay: true,
      source: 'consultify',
      sourceId: 'meeting-mw007',
      provider: 'internal',
    },
  ],
});

(Api as any).getIntegrations = async () => [];

(Api as any).getMyWorkCalendarConflicts = async () => ({
  totalItems: 1,
  hasConflicts: false,
  tasks: [{ id: 'task-golden-mw007', title: 'Przygotuj plan wdrożenia Q3' }],
  decisions: [],
  suggestion: null,
});

(Api as any).updateMyWorkCalendarEvent = async () => ({ ok: true });

export default function MW007CalendarNarrowViewportScreen(): React.ReactElement {
  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <BrowserRouter>
        <CalendarView />
      </BrowserRouter>
    </div>
  );
}
