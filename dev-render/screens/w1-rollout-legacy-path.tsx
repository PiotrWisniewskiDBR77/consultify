/**
 * W1 (DEC-573, KANAL Wpis 82) — legacy pathname variant: `/rollout` must redirect to the
 * canonical Execution list (`RedirectToCanonicalTab tab="list"` in `src/routes/AppRoutes.tsx`),
 * never 404 and never a retired tab. Same harness contract as
 * `w1-execution-retired-deeplink.tsx` (real `<AppRoutes/>`, seeded demo session, no second
 * router — `AppProviders` already owns `<BrowserRouter>`).
 *
 * URL: ?screen=w1-rollout-legacy-path&lang=en&theme=light|dark
 */
import React from 'react';

import { AppRoutes } from '../../src/routes/AppRoutes';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { stubApiFetch } from '../mocks/apiFetchStub';
import { seedRealisticSession } from '../mocks/seedStore';

stubApiFetch();
seedRealisticSession();
// Same up-front presenter setup as w1-execution-retired-deeplink: the sales_demo first paint
// would auto-open the StoryRail tour over the redirect proof.
useAppStore.setState({ demoExperienceType: 'workspace_demo' });
localStorage.setItem('demo_story_rail_dismissed', 'true');
window.history.replaceState({}, '', '/rollout');

export default function W1RolloutLegacyPathScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div className="h-screen bg-c-bg">
        <AppRoutes />
      </div>
    </AppProviders>
  );
}
