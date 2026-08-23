import { Copy, ExternalLink, Pencil, Trash2, UserPlus } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InterviewTemplate {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  scope?: string;
  isDefault?: boolean;
  questionCount?: number;
  estimatedTimeMinutes?: number;
  areaTags?: string[];
  createdAt?: string;
  audience?: string;
}

export interface TemplateQuestion {
  questionText?: string;
  text?: string;
  title?: string;
  question?: string;
}

// ─── InterviewTemplatePreviewBody ────────────────────────────────────────────

export interface InterviewTemplatePreviewBodyProps {
  template: InterviewTemplate;
  isPolish: boolean;
  questions: TemplateQuestion[];
  questionsLoading: boolean;
  getTemplateSourceLabel: (scope: string | undefined, t: (key: string) => string) => string;
  getTemplateAreaTagLabel: (tag: string, t: (key: string) => string) => string;
  onDetailsAction: (action: string) => void;
  /** Show Delete action in Details kebab (e.g. when canAssign && !template.isDefault) */
  canDelete?: boolean;
}

const TEMPLATE_BADGE_CLASS = 'border border-c-info/20 bg-c-info/10 text-[var(--c-info)]';
const NEUTRAL_PILL_CLASS =
  'border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]';

export const InterviewTemplatePreviewBody: React.FC<InterviewTemplatePreviewBodyProps> = ({
  template,
  isPolish,
  questions,
  questionsLoading,
  getTemplateSourceLabel,
  getTemplateAreaTagLabel,
  onDetailsAction,
  canDelete = false,
}) => {
  const { t } = useTranslation();
  const pills: MetaPill[] = [
    { label: t('interview.templatePreview.template'), className: TEMPLATE_BADGE_CLASS },
    ...((template.category
      ? [{ label: template.category, className: NEUTRAL_PILL_CLASS }]
      : []) as MetaPill[]),
    ...((template.scope
      ? [{ label: getTemplateSourceLabel(template.scope, t), className: NEUTRAL_PILL_CLASS }]
      : []) as MetaPill[]),
    {
      label: template.isDefault
        ? t('interview.templatePreview.default')
        : t('interview.templatePreview.active'),
      className: NEUTRAL_PILL_CLASS,
    },
    {
      label: `${template.questionCount ?? 0} ${t('interview.templatePreview.questions')}`,
      className: NEUTRAL_PILL_CLASS,
    },
    ...((template.estimatedTimeMinutes
      ? [{ label: `${template.estimatedTimeMinutes} min`, className: NEUTRAL_PILL_CLASS }]
      : []) as MetaPill[]),
    ...((template.areaTags || []).map((tag) => ({
      label: getTemplateAreaTagLabel(tag, t),
      className: NEUTRAL_PILL_CLASS,
    })) as MetaPill[]),
  ];

  const descriptionText = (template.description || '').trim()
    ? template.description!
    : t('interview.templatePreview.noDescription');

  const detailsActions = [
    {
      id: 'edit',
      label: t('interview.templatePreview.edit'),
      icon: Pencil,
      onClick: () => onDetailsAction('edit'),
    },
    {
      id: 'duplicate',
      label: t('interview.templatePreview.duplicate'),
      icon: Copy,
      onClick: () => onDetailsAction('duplicate'),
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            label: t('interview.templatePreview.delete'),
            icon: Trash2,
            onClick: () => onDetailsAction('delete'),
          },
        ]
      : []),
  ];

  const questionItems = questions.slice(0, 12).filter((q) => {
    const text = String(q?.questionText || q?.text || q?.title || q?.question || '').trim();
    return text.length > 0;
  });

  return (
    <div className="space-y-4">
      <PreviewMetaCard
        pills={pills}
        trailing={
          <span className="text-[11px] text-[var(--c-text-muted)]">
            {t('interview.templatePreview.created')}:{' '}
            {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : '—'}
          </span>
        }
      >
        <div className="mt-2 text-xs text-[var(--c-text-secondary)] line-clamp-2">
          {descriptionText}
        </div>
        {template.audience ? (
          <div className="mt-1 text-[11px] text-[var(--c-text-muted)]">
            {t('interview.templatePreview.audience')}: {template.audience}
          </div>
        ) : null}
      </PreviewMetaCard>

      <PreviewDetailsSection
        text={descriptionText}
        label={t('interview.templatePreview.details')}
        customActions={detailsActions}
      />

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--c-text-muted)]">
          {t('interview.templatePreview.questions2')}
        </div>
        <div className="space-y-1.5">
          {questionsLoading ? (
            <div className="text-xs text-[var(--c-text-muted)]">
              {t('interview.templatePreview.loading')}
            </div>
          ) : questionItems.length > 0 ? (
            questionItems.map((q, idx) => {
              const text = String(
                q?.questionText || q?.text || q?.title || q?.question || ''
              ).trim();
              return (
                <div key={`${template.id}:q:${idx}`} className="text-xs text-[var(--c-text)]">
                  <span className="text-[var(--c-text-muted)] mr-2">{idx + 1}.</span>
                  <span className="line-clamp-2">{text}</span>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-[var(--c-text-muted)]">
              {t('interview.templatePreview.noQuestionsToPreview')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── InterviewTemplatePreviewFooter ───────────────────────────────────────────

export interface InterviewTemplatePreviewFooterProps {
  template: { id: string; category?: string; isDefault?: boolean };
  isPolish: boolean;
  canAssign: boolean;
  usageCount: number;
  onOpenFull: () => void;
  onAssign?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  aiHints: string[];
  onRunAiHint: (hint: string) => void;
}

export const InterviewTemplatePreviewFooter: React.FC<InterviewTemplatePreviewFooterProps> = ({
  template,
  isPolish,
  canAssign,
  usageCount,
  onOpenFull,
  onAssign,
  onClone,
  onDelete,
  aiHints,
  onRunAiHint,
}) => {
  const { t } = useTranslation();
  const relationItems: RelationItem[] = [
    { label: `${t('interview.templatePreview.category')}: ${template.category || '—'}` },
    { label: `${t('interview.templatePreview.used')}: ${usageCount}` },
  ];

  const actionRows: ActionRow[] = [
    {
      buttons: [
        ...(onAssign
          ? [
              {
                label: t('interview.templatePreview.assign'),
                icon: UserPlus,
                onClick: onAssign,
                colorScheme: 'primary' as const,
                flex: true,
                shortcut: 'A',
              },
            ]
          : []),
        ...(canAssign
          ? [
              {
                // Object-specific Edit is valid here; the only generic Open
                // remains in PreviewPaneShell's header (INT-PREV-OWN-001).
                label: t('interview.templatePreview.edit'),
                icon: ExternalLink,
                onClick: onOpenFull,
                colorScheme: 'primary' as const,
                flex: true,
                shortcut: 'E',
              },
            ]
          : []),
        ...(onClone
          ? [
              {
                label: t('interview.templatePreview.duplicate'),
                icon: Copy,
                onClick: onClone,
                colorScheme: 'neutral' as const,
                flex: true,
              },
            ]
          : []),
      ],
    },
    ...(onDelete && canAssign && !template.isDefault
      ? [
          {
            buttons: [
              {
                label: t('interview.templatePreview.delete'),
                icon: Trash2,
                onClick: onDelete,
                colorScheme: 'red' as const,
                flex: true,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    // canon §7.3: space-y-2.5, NO border-t dividers between footer cards
    <div className="space-y-2.5">
      <div className="rounded-token-md border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] p-2.5">
        <PreviewAIHintStrip hints={aiHints} onRunHint={onRunAiHint} />
      </div>

      <PreviewRelations items={relationItems} />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
