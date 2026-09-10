/**
 * Dev-render host for P6 — przewodnik "Jak zacząć" w aplikacji (koszyk 2 MVP,
 * pozycja 2.7, kryterium 7, lista S2.11).
 *
 * Renders the REAL `<AppIntroView>` — the same component the live route
 * `/app-intro` mounts (see `src/routes/AppRoutes.tsx`) and the same screen
 * the live Help side panel's "Start here" tab opens via `openIntroScreen()`
 * (`src/components/Help/HelpSidePanel.tsx`). No re-implementation: the
 * 6-step journey cards, their links, and the time/requirement sentences all
 * come from the real `HELP_SYSTEM_OVERVIEW.journeyCards` data
 * (`src/config/helpExperience.ts`), extended for P6 with an `org_context`
 * step (kontekst organizacji) and per-card `route`/`timeLabel`/
 * `requirementLabel` fields.
 *
 * No backend calls: `AppIntroView` only reads local i18n language + calls
 * synchronous Zustand store actions (`setCurrentView`, `setChatKickoffMessage`).
 * No `window.fetch` stub needed.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppIntroView } from '@/views/AppIntroView';

function P6PrzewodnikJakZaczacScreen() {
  return (
    <MemoryRouter initialEntries={['/app-intro']}>
      <div style={{ height: '100vh' }}>
        <AppIntroView />
      </div>
    </MemoryRouter>
  );
}

export default P6PrzewodnikJakZaczacScreen;
