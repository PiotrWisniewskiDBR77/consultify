/**
 * Dev-render: Gen. Deck catch-up (2026-07-22) — content hints per slide.
 *
 * Mounts the REAL `PresentationTemplateArchitectView`
 * (src/components/Presentations/PresentationTemplateArchitectView.tsx) with
 * the presentation-templates API mocked (dev-render/mocks/…) so the new
 * `contentHints` field (server/src/services/presentationTemplateDraftService.ts)
 * can be screenshotted BEFORE the owner sees it (CLAUDE.md #7) — no
 * backend, no DB, no login.
 *
 * Click through: select "Steering Committee Deck Template" (draft, already
 * has content-hints on 3 of 5 slides) to see the new textarea under each
 * outline row; or draft a new template with "Refine with AI" checked to see
 * the mock LLM populate hints on a fresh draft.
 */
import React, { useEffect, useState } from 'react';

import { installPresentationTemplateArchitectApiMock } from '../mocks/presentationTemplateArchitectMocks';

export default function GenDeckContentHintsScreen(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dispose = installPresentationTemplateArchitectApiMock();
    setReady(true);
    return dispose;
  }, []);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  const PresentationTemplateArchitectView = React.lazy(
    () => import('@/components/Presentations/PresentationTemplateArchitectView')
  );

  return (
    <div className="h-screen w-screen overflow-y-auto bg-c-bg p-8">
      <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
        <PresentationTemplateArchitectView />
      </React.Suspense>
    </div>
  );
}
