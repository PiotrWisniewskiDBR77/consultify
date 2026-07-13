/**
 * Dev-render: #83c — wspólny START kreatora (nazwa → typ → dostępność).
 * Modal na tle roboczej powierzchni.
 */
import React from 'react';

import { TemplateCreateWizard } from '@/components/TemplateBuilder';

export default function TemplateCreateWizardScreen(): React.ReactElement {
  return (
    <div className="h-screen w-screen bg-c-bg">
      <TemplateCreateWizard
        open
        onCancel={() => {
          /* dev-render: noop */
        }}
        onComplete={(p) => {
          // eslint-disable-next-line no-console
          console.log('[dev-render] wizard complete', p);
        }}
      />
    </div>
  );
}
