/**
 * Dev-render: Gen. Excel catch-up (W1) — zakładka huba "Generator szablonów Excel".
 *
 * Mounts the REAL `ExceleParametricTemplates` (the content of the new
 * ff_workbook_templates hub tab) with Api.listWorkbookTemplates/
 * buildWorkbookTemplate mocked, so the new surface can be screenshotted
 * BEFORE the owner sees it (rule #7). No backend/DB/login.
 *
 * URL: ?screen=gen-excel-templates-tab[&lang=pl|en][&theme=light|dark]
 */
import React, { useEffect, useState } from 'react';

import { installWorkbookTemplatesApiMock } from '../mocks/workbookTemplatesMocks';

export default function GenExcelTemplatesTabScreen(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dispose = installWorkbookTemplatesApiMock();
    setReady(true);
    return dispose;
  }, []);

  if (!ready) return <div className="h-screen w-screen bg-c-bg" />;

  const ExceleParametricTemplates = React.lazy(
    () => import('@/components/AIChat/KimiWorkspace/ExceleParametricTemplates')
  );

  return (
    <div className="h-screen w-screen overflow-y-auto bg-c-bg p-8">
      <React.Suspense fallback={<div className="text-c-text-muted text-sm">Loading…</div>}>
        <ExceleParametricTemplates isPolish={true} />
      </React.Suspense>
    </div>
  );
}
