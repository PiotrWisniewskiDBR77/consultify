/**
 * W1 (DEC-573, plan row 39, KANAL Wpis 82) — proof that a RETIRED Execution deep link
 * lands on the canonical Execution list instead of a dead surface.
 *
 * Mounts the REAL `<AppRoutes/>` (not the screen component alone) so the shot proves the
 * shipped routing chain: `ExecutionRetiredTabGate` in `src/routes/AppRoutes.tsx` asks
 * `buildExecutionRetiredTabRedirect` (`src/components/Execution/executionNavigationState.ts`)
 * for the canonical target and `<Navigate replace>` rewrites `?tab=rollout` (or
 * `resources`/`summary`) to `?tab=list` BEFORE the lazy `ExecutionHub` mounts. The legacy
 * pathname variant proves `/rollout` redirects to the same list (never a 404).
 *
 * `seedRealisticSession()` unlocks the full provider tree (`AppProviders` mounts V8/Org/
 * AccessPolicy when `currentUser?.id` exists) with `isDemoMode:true`, so the real /execution
 * calls fall back to built-in demo data instead of an empty error screen.
 *
 * NOTE: `AppProviders` already contains `<BrowserRouter>` (`src/providers/AppProviders.tsx:137`)
 * — do NOT wrap in a second router. The initial path is set with `window.history.replaceState`
 * BEFORE mount, exactly like a real browser navigation (same pattern as `z41-pmo-projekty-off`).
 *
 * URL: ?screen=w1-execution-retired-deeplink|w1-rollout-legacy-path&lang=en&theme=light|dark
 */
import React from 'react';

import { AppRoutes } from '../../src/routes/AppRoutes';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { stubApiFetch } from '../mocks/apiFetchStub';
import { seedRealisticSession } from '../mocks/seedStore';

stubApiFetch();
seedRealisticSession();
// DemoSessionManager auto-opens the StoryRail tour on the FIRST sales_demo paint, before
// /api/demo/status resolves to workspace_demo — seed the presenter experience up front and
// keep the product's own permanent-dismiss key so the tour never covers the routing proof.
useAppStore.setState({ demoExperienceType: 'workspace_demo' });
localStorage.setItem('demo_story_rail_dismissed', 'true');
window.history.replaceState({}, '', '/execution?tab=rollout');

export default function W1ExecutionRetiredDeepLinkScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div className="h-screen bg-c-bg">
        <AppRoutes />
      </div>
    </AppProviders>
  );
}
