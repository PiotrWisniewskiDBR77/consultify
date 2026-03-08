/**
 * TemplatePreview — Preview panel for templates
 * Golden standard §6.10a: Entity Meta → Content → Actions
 */

import { BookTemplate, FileText, Presentation } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { TEMPLATE_TYPE_META, type TemplateItem } from '../types';

interface TemplatePreviewProps {
  template: TemplateItem;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ template }) => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language?.startsWith('pl');
  const typeMeta = TEMPLATE_TYPE_META[template.type];

  return (
    <div className="space-y-4">
      {/* Entity Meta Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-500/10">
          <span className={`w-2 h-2 rounded-full ${typeMeta.dotColor}`} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {isPolish ? typeMeta.labelPl : typeMeta.label}
          </span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
          {template.category}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
          {template.scope === 'application'
            ? isPolish
              ? 'System'
              : 'Application'
            : isPolish
              ? 'Organizacja'
              : 'Organization'}
        </span>
      </div>

      {/* Icon + brief */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-200 dark:bg-navy-700 flex items-center justify-center">
          {template.type === 'report' ? (
            <FileText size={20} className="text-blue-400" />
          ) : (
            <Presentation size={20} className="text-purple-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
            {template.description || (isPolish ? 'Brak opisu' : 'No description')}
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2">
        <DetailRow label={isPolish ? 'Autor' : 'Author'} value={template.createdBy} />
        <DetailRow
          label={isPolish ? 'Ostatnia zmiana' : 'Last updated'}
          value={new Date(template.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        />
        {template.sectionCount != null && (
          <DetailRow
            label={isPolish ? 'Sekcje' : 'Sections'}
            value={String(template.sectionCount)}
          />
        )}
        {template.slideCount != null && (
          <DetailRow label={isPolish ? 'Slajdy' : 'Slides'} value={String(template.slideCount)} />
        )}
      </div>

      {/* CTA */}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium transition-colors"
        onClick={() => {
          const path =
            template.type === 'presentation'
              ? `/presentations/wizard?templateId=${encodeURIComponent(template.id)}`
              : `/reports/builder?templateId=${encodeURIComponent(template.id)}`;
          navigate(path);
        }}
      >
        <BookTemplate size={14} />
        {t('rap.preview.useTemplate', 'Użyj tego wzorca')}
      </button>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-slate-700 dark:text-slate-200 font-medium">{value}</span>
  </div>
);
