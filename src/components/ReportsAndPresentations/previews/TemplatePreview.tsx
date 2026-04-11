import React from 'react';

import type { TemplateItem } from '../types';

export const TemplatePreviewBody: React.FC<{ template: TemplateItem }> = ({ template }) => (
  <div className="space-y-3">
    <div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{template.title}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {template.type} | {template.status}
      </div>
    </div>
    <div className="text-sm text-slate-600 dark:text-slate-300">
      Scope: {template.scope}
    </div>
  </div>
);

export const TemplatePreviewFooter: React.FC<{ template: TemplateItem }> = ({ template }) => (
  <div className="text-xs text-slate-500 dark:text-slate-400">
    Updated: {template.updatedAt}
  </div>
);
