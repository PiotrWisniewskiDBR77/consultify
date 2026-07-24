import { AlertTriangle, Building2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useOrganizationContext } from '@/hooks/discovery/useOrganizationContext';

import { TEMPLATE_STATUS_META, TEMPLATE_TYPE_META, type TemplateItem } from '../types';
import { useTrustState } from '../useTrustState';

const SCOPE_LABELS: Record<string, { label: string; labelPl: string }> = {
  personal: { label: 'Personal', labelPl: 'Osobisty' },
  system: { label: 'System', labelPl: 'System' },
  // legacy alias (wpisy sprzed kanonu materials.ts)
  application: { label: 'System', labelPl: 'System' },
  organization: { label: 'Organization', labelPl: 'Organizacja' },
  unknown: { label: 'Unknown', labelPl: 'Nieznany' },
};

export const TemplatePreviewBody: React.FC<{ template: TemplateItem }> = ({ template }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const typeMeta = TEMPLATE_TYPE_META[template.type];
  const statusMeta = TEMPLATE_STATUS_META[template.status] || TEMPLATE_STATUS_META.unknown;
  const scopeLabel = SCOPE_LABELS[template.scope];
  const { context: orgCtx } = useOrganizationContext();
  const governance = useTrustState(template.id, template.governance ?? null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-500/10">
          <span className={`w-1.5 h-1.5 rounded-full ${typeMeta.dotColor}`} />
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {isPolish ? typeMeta.labelPl : typeMeta.label}
          </span>
        </div>
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-500/10">
          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {isPolish ? statusMeta.labelPl : statusMeta.label}
          </span>
        </div>
      </div>

      {template.scope === 'organization' && orgCtx?.profile?.companyName && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/5 border border-indigo-200/40 dark:border-indigo-500/20">
          <Building2 size={12} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-600 dark:text-indigo-300">
            {orgCtx.profile.companyName}
            {orgCtx.profile.industry ? ` · ${orgCtx.profile.industry}` : ''}
          </span>
        </div>
      )}

      {template.description && (
        <p className="text-sm text-slate-600 dark:text-slate-300">{template.description}</p>
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {t('rap.preview.scope', 'Zakres')}
          </span>
          <span className="text-slate-700 dark:text-slate-200">
            {scopeLabel ? (isPolish ? scopeLabel.labelPl : scopeLabel.label) : template.scope}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {t('rap.preview.category', 'Kategoria')}
          </span>
          <span className="text-slate-700 dark:text-slate-200">{template.category}</span>
        </div>
        {template.sectionCount != null && (
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              {t('rap.preview.sections', 'Sekcje')}
            </span>
            <span className="text-slate-700 dark:text-slate-200">{template.sectionCount}</span>
          </div>
        )}
        {template.slideCount != null && (
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              {t('rap.preview.slides', 'Slajdy')}
            </span>
            <span className="text-slate-700 dark:text-slate-200">{template.slideCount}</span>
          </div>
        )}
      </div>

      {governance?.publishState && (
        <div className="space-y-1 text-sm border-t border-slate-200/60 dark:border-navy-700/40 pt-2">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              {t('rap.preview.publishState', 'Publish')}
            </span>
            <span className="text-slate-700 dark:text-slate-200">{governance.publishState}</span>
          </div>
          {governance.validationState && (
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {t('rap.preview.validationState', 'Walidacja')}
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                {governance.validationState}
              </span>
            </div>
          )}
          {governance.reviewGateCount != null && governance.reviewGateCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {t('rap.preview.reviewGates', 'Review gates')}
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                {governance.reviewGateCount}
              </span>
            </div>
          )}
        </div>
      )}

      {template.status === 'deprecated' && (
        <div className="rounded-lg border border-amber-300/50 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10 p-3">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={14} />
            <span className="text-xs font-semibold">
              {t('rap.preview.deprecated', 'Wycofany wzorzec')}
            </span>
          </div>
          {template.deprecationReason && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
              {template.deprecationReason}
            </p>
          )}
          {template.migrationHint && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
              {t('rap.preview.migrationHint', 'Zamiennik')}: {template.migrationHint}
            </p>
          )}
          {template.replacedByArtifactId && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
              {t('rap.preview.replacedBy', 'Nowy wzorzec')}:{' '}
              <a
                href={`/presentations?tab=templates&artifactId=${template.replacedByArtifactId}`}
                className="underline hover:text-amber-700 dark:hover:text-amber-200"
              >
                {template.replacedByArtifactId.slice(0, 8)}…
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const TemplatePreviewFooter: React.FC<{ template: TemplateItem }> = ({ template }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  // Brak daty = „—". Nie podstawiamy dnia dzisiejszego (patrz mapper w useRapData).
  const d = template.updatedAt ? new Date(template.updatedAt) : null;
  const formatted =
    d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  return (
    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <span>
        {t('rap.preview.updatedAt', 'Ostatnia zmiana')}: {formatted}
      </span>
      <span>{template.createdBy}</span>
    </div>
  );
};
