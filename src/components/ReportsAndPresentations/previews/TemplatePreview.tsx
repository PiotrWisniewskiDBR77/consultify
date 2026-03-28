/**
 * TemplatePreview — Preview panel for templates
 * Uses shared PreviewPane building blocks for consistent UX.
 * Exports Body + Footer for proper TableWithPreviewLayout split.
 */

import { BookTemplate, FileText, Presentation } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
} from '@/components/shared/PreviewPane';

import { TEMPLATE_TYPE_META, type TemplateItem } from '../types';

interface TemplatePreviewProps {
  template: TemplateItem;
}

function useTemplatePreviewData(template: TemplateItem) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const isPolish = i18n.language?.startsWith('pl');
  const typeMeta = TEMPLATE_TYPE_META[template.type];

  const pills: MetaPill[] = [
    {
      label: isPolish ? typeMeta.labelPl : typeMeta.label,
      className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
      dot: typeMeta.dotColor,
    },
    {
      label: template.category,
      className: 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300',
    },
    {
      label:
        template.scope === 'application'
          ? isPolish
            ? 'System'
            : 'Application'
          : isPolish
            ? 'Organizacja'
            : 'Organization',
      className: 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400',
    },
  ];

  const detailParts = [
    `${isPolish ? 'Autor' : 'Author'}: ${template.createdBy}`,
    `${isPolish ? 'Ostatnia zmiana' : 'Last updated'}: ${new Date(template.updatedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    ...(template.sectionCount != null
      ? [`${isPolish ? 'Sekcje' : 'Sections'}: ${template.sectionCount}`]
      : []),
    ...(template.slideCount != null
      ? [`${isPolish ? 'Slajdy' : 'Slides'}: ${template.slideCount}`]
      : []),
  ];

  return { isPolish, t, navigate, typeMeta, pills, detailParts };
}

export const TemplatePreviewBody: React.FC<TemplatePreviewProps> = ({ template }) => {
  const { isPolish, pills, detailParts } = useTemplatePreviewData(template);

  return (
    <div className="space-y-4">
      <PreviewMetaCard pills={pills} />

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

      <PreviewDetailsSection
        text={detailParts.join('\n')}
        label={isPolish ? 'SZCZEGÓŁY' : 'DETAILS'}
      />
    </div>
  );
};

export const TemplatePreviewFooter: React.FC<TemplatePreviewProps> = ({ template }) => {
  const { isPolish, t, navigate } = useTemplatePreviewData(template);

  const actionRows: ActionRow[] = [
    {
      buttons: [
        {
          label: t('rap.preview.useTemplate', 'Użyj tego wzorca'),
          icon: BookTemplate,
          onClick: () => {
            const path =
              template.type === 'presentation'
                ? `/presentations/wizard?templateId=${encodeURIComponent(template.id)}`
                : `/reports/builder?templateId=${encodeURIComponent(template.id)}`;
            navigate(path);
          },
          colorScheme: 'primary',
          flex: true,
          shortcut: 'U',
        },
      ],
    },
  ];

  const dividerClass = 'border-t border-slate-200/50 dark:border-white/[0.06] my-3';

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip
          hints={[isPolish ? 'Wzorzec gotowy do użycia' : 'Template ready to use']}
        />
      </div>
      <div className={dividerClass} />
      <PreviewActionBar rows={actionRows} />
    </div>
  );
};

/** @deprecated Use TemplatePreviewBody + TemplatePreviewFooter for Body/Footer split */
export const TemplatePreview: React.FC<TemplatePreviewProps> = (props) => {
  return (
    <>
      <TemplatePreviewBody {...props} />
      <TemplatePreviewFooter {...props} />
    </>
  );
};
