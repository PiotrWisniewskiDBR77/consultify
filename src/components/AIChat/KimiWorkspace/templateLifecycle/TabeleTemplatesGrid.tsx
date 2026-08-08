/**
 * TabeleTemplatesGrid — lane=tabele template grid backed by the Block A
 * `tp_base_templates` lifecycle endpoint (Block A · EPIC-T6 · A-S5b).
 *
 * Renders:
 *   * `<TemplateLifecycleFilter>` — sticky chip strip above the grid
 *     (defaults to `approved` per A-P1).
 *   * Cards driven by `useTpBaseTemplates(status)`.
 *   * `<TemplateLifecycleBadge variant="dot">` on each card so the grid
 *     stays compact (A-P3 mitigation).
 *   * "Governance" secondary action that opens the
 *     `<TemplateGovernanceDrawer>` against the picked template.
 *
 * Mount conditions live in the parent (`ArtifactModuleHome`):
 *   * lane === 'tabele', AND
 *   * `isTemplateLifecycleEnabled() === true`.
 *
 * The grid does not duplicate the legacy "create from prompt" hook:
 *   * `tp_base_templates` rows are created via `POST
 *     /api/table-platform/templates/:id/use` server-side. The host
 *     supplies the `onTemplateClick(templateId)` callback so the
 *     navigation behaviour stays consistent with the other lanes.
 */

import { Loader2, ShieldCheck, Star } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LifecycleTemplate } from '@/services/api/templateLifecycle.api';

import { TemplateGovernanceDrawer } from './TemplateGovernanceDrawer';
import { TemplateLifecycleBadge } from './TemplateLifecycleBadge';
import { TemplateLifecycleFilter } from './TemplateLifecycleFilter';
import { useTpBaseTemplates } from './useTpBaseTemplates';

export interface TabeleTemplatesGridProps {
  onTemplateClick: (templateId: string) => void;
  /** Optional category filter. Forwarded to the lifecycle endpoint. */
  category?: string;
  /** Render the governance drawer trigger (super-admin / power user). */
  enableGovernanceDrawer?: boolean;
  testId?: string;
}

export const TabeleTemplatesGrid: React.FC<TabeleTemplatesGridProps> = ({
  onTemplateClick,
  category,
  enableGovernanceDrawer = true,
  testId = 'tabele-templates-grid',
}) => {
  const { t } = useTranslation();
  const { templates, status, setStatus, loading, error } = useTpBaseTemplates({ category });
  const [governanceTarget, setGovernanceTarget] = useState<LifecycleTemplate | null>(null);

  return (
    <div className="space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TemplateLifecycleFilter value={status} onChange={setStatus} />
        {loading && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] text-c-text-secondary"
            data-testid={`${testId}-loading`}
          >
            <Loader2 size={12} className="animate-spin" aria-hidden />
            {t('kimi.template.grid.loading', 'Loading…')}
          </span>
        )}
      </div>

      {error && (
        <p
          className="text-[12px] text-danger-600 dark:text-danger-300"
          role="alert"
          data-testid={`${testId}-error`}
        >
          {error.message}
        </p>
      )}

      {!loading && !error && templates.length === 0 && (
        <p
          className="text-sm text-c-text-secondary text-center py-12"
          data-testid={`${testId}-empty`}
        >
          {t('kimi.template.grid.empty', 'No templates in status "{{status}}".', { status })}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            data-testid={`${testId}-card`}
            className="group relative text-left p-4 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface hover:border-brand/40 dark:hover:border-brand/30 hover:shadow-sm transition-all"
          >
            <button
              type="button"
              onClick={() => onTemplateClick(tpl.id)}
              className="block w-full text-left"
              data-testid={`${testId}-card-${tpl.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-c-text group-hover:text-brand transition-colors line-clamp-1 flex-1">
                  {tpl.name}
                </p>
                <TemplateLifecycleBadge
                  status={tpl.status}
                  variant="dot"
                  testId={`${testId}-card-${tpl.id}-status`}
                />
              </div>
              {tpl.description && (
                <p className="text-xs text-c-text-secondary mt-1 line-clamp-2">{tpl.description}</p>
              )}
              {(tpl.usage_count > 0 || tpl.is_featured) && (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-c-text-secondary tabular-nums">
                  {tpl.is_featured && (
                    <>
                      <Star size={11} aria-hidden />
                      <span>{t('kimi.template.grid.featured', 'Featured')}</span>
                      <span aria-hidden>·</span>
                    </>
                  )}
                  {t('kimi.template.grid.used', 'Used')}: {tpl.usage_count}
                </p>
              )}
            </button>
            {enableGovernanceDrawer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setGovernanceTarget(tpl);
                }}
                className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-c-text-secondary hover:bg-c-surface-raised opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-c-focus"
                title={t('kimi.template.grid.governanceTitle', 'Governance')}
                data-testid={`${testId}-card-${tpl.id}-governance`}
              >
                <ShieldCheck size={11} aria-hidden />
                {t('kimi.template.grid.governanceShort', 'Govern.')}
              </button>
            )}
          </div>
        ))}
      </div>

      <TemplateGovernanceDrawer
        open={governanceTarget !== null}
        template={governanceTarget}
        onClose={() => setGovernanceTarget(null)}
      />
    </div>
  );
};

export default TabeleTemplatesGrid;
