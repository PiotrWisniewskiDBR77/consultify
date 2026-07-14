/**
 * Dev-render host dla I1-I3 Faza 0 — UnifiedCreateLauncher ("+ Nowy" chooser).
 *
 * Mounts the REAL `UnifiedCreateLauncher` component (Krok 0 — wybór typu),
 * not a mock reproduction — unlike canvas-new-doc.tsx, this step has ZERO
 * Api/store dependencies (only useTranslation), so it mounts cleanly here.
 *
 * NOTE: clicking one of the 3 cards advances the component to render the real
 * generator (InsightCreatorModal / InitiativeCharterWizard / NewDecisionModal)
 * — those DO pull Api/store data and are NOT expected to mount cleanly in this
 * harness (no backend, no logged-in store). This story exists to review the
 * Krok 0 chooser's own look (CLAUDE.md #7) — don't click through for the
 * screenshot pass.
 *
 * URL params: ?screen=unified-create-launcher&theme=light|dark&lang=pl|en
 */
import React from 'react';

import { UnifiedCreateLauncher } from '../../src/components/shared/UnifiedCreateLauncher';

export default function UnifiedCreateLauncherScreen(): React.ReactElement {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-navy-950">
      <UnifiedCreateLauncher isOpen onClose={() => {}} />
    </div>
  );
}
