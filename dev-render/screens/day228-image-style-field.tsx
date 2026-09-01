/**
 * Dev-render host for FIX-228 pkt 3 — pole „Styl obrazu" w edytorze motywu
 * prezentacji, teraz za flagą `presentationImageStyleUiV1` (domyślnie OFF).
 *
 * Mounts the REAL `PresentationTemplateArchitectView`
 * (src/components/Presentations/PresentationTemplateArchitectView.tsx) with
 * the presentation-templates API mocked (dev-render/mocks/…) so the
 * supervisor can screenshot the field ON and OFF BEFORE the owner sees it
 * (CLAUDE.md #7). No backend, no DB, no login.
 *
 * URL: ?screen=day228-image-style-field[&lang=pl|en][&theme=light|dark]
 *   &scene=on|off   (default on)
 *
 * Selects the mock draft template that already carries
 * `layout_policy_json.imageStylePrompt` so the field (when the flag is ON)
 * renders with real content, not an empty placeholder.
 */
import React, { useEffect, useState } from 'react';

import { PRESENTATION_IMAGE_STYLE_UI_FLAG_ID } from '../../src/hooks/usePresentationImageStyleUiFlag';
import { installPresentationTemplateArchitectApiMock } from '../mocks/presentationTemplateArchitectMocks';

const params = new URLSearchParams(window.location.search);
const scene = (params.get('scene') as 'on' | 'off' | null) ?? 'on';

// Explicit true/false (not "skip when off") — localStorage persists across page.goto()
// within the same browser context (see finance-comments-panel.tsx for the bug this avoids).
{
  const raw = window.localStorage.getItem('consultify_feature_flags');
  const overrides = raw ? JSON.parse(raw) : {};
  overrides[PRESENTATION_IMAGE_STYLE_UI_FLAG_ID] = scene !== 'off';
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify(overrides));
}

const DRAFT_TEMPLATE_ID = 'tpl-dev-render-draft-1';

export default function Day228ImageStyleFieldScreen(): React.ReactElement {
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
    <div
      className="h-screen w-screen overflow-y-auto bg-c-bg p-8"
      data-testid="day228-image-style-field-screen"
      data-scene={scene}
    >
      <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
        <AutoSelectDraft>
          <PresentationTemplateArchitectView />
        </AutoSelectDraft>
      </React.Suspense>
    </div>
  );
}

/**
 * The real view has no `?select=` URL prop — it opens whatever row you click
 * in its own table. For a repeatable, unattended screenshot we click the
 * draft template row (by its visible name) right after the table renders.
 */
function AutoSelectDraft({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    const id = window.setInterval(() => {
      const row = Array.from(document.querySelectorAll('[data-testid], tr, div')).find((el) =>
        (el.textContent || '').includes('Steering Committee Deck Template')
      );
      if (row) {
        (row as HTMLElement).click();
        window.clearInterval(id);
      }
    }, 150);
    return () => window.clearInterval(id);
  }, []);
  void DRAFT_TEMPLATE_ID;
  return <>{children}</>;
}
