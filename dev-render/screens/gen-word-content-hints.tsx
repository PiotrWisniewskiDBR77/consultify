/**
 * Dev-render: Gen. Word W2 — content hints per sekcja w Word Template Architect.
 *
 * Mounts the REAL `DocumentStudioTemplateArchitectView` with the
 * /api/document-studio/templates endpoints mocked (window.fetch), so the new
 * per-section `contentHints` textarea + read-only chips can be screenshotted
 * BEFORE the owner sees it (rule #7). Structure editor is behind
 * ff_tpl_editor (default ON per prior acceptance) — append &ff_tpl_editor=1
 * to be explicit. No backend/DB/login.
 *
 * URL: ?screen=gen-word-content-hints[&lang=pl|en][&theme=light|dark]
 */
import React, { useEffect, useState } from 'react';

import { installDocumentTemplateArchitectFetchMock } from '../mocks/documentTemplateArchitectMocks';

export default function GenWordContentHintsScreen(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dispose = installDocumentTemplateArchitectFetchMock();
    setReady(true);
    return dispose;
  }, []);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  const DocumentStudioTemplateArchitectView = React.lazy(() =>
    import('@/components/DocumentStudio/DocumentStudioTemplateArchitectView').then((m) => ({
      default: m.DocumentStudioTemplateArchitectView,
    }))
  );

  return (
    <div className="h-screen w-screen overflow-y-auto bg-c-bg p-8">
      <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
        <DocumentStudioTemplateArchitectView />
      </React.Suspense>
    </div>
  );
}
