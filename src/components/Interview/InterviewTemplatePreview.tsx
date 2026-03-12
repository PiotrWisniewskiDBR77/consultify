import { Copy, ExternalLink, Pencil, Trash2, UserPlus } from 'lucide-react';
import React from 'react';

import {
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type ActionRow,
  type MetaPill,
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
  getTemplateSourceLabel: (scope: string | undefined, isPolish: boolean) => string;
  getTemplateAreaTagLabel: (tag: string, isPolish: boolean) => string;
  onDetailsAction: (action: string) => void;
  /** Show Delete action in Details kebab (e.g. when canAssign && !template.isDefault) */
  canDelete?: boolean;
}

const TEMPLATE_BADGE_CLASS =
  'border border-slate-200/70 dark:border-white/[0.08] bg-blue-500/10 text-blue-600 dark:text-blue-300';
const NEUTRAL_PILL_CLASS =
  'border border-slate-200/70 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300';

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
  const pills: MetaPill[] = [
    { label: isPolish ? 'Szablon' : 'Template', className: TEMPLATE_BADGE_CLASS },
    ...(template.category
      ? [{ label: template.category, className: NEUTRAL_PILL_CLASS }]
      : []) as MetaPill[],
    ...(template.scope
      ? [{ label: getTemplateSourceLabel(template.scope, isPolish), className: NEUTRAL_PILL_CLASS }]
      : []) as MetaPill[],
    {
      label: template.isDefault
        ? isPolish
          ? 'Domyślny'
          : 'Default'
        : isPolish
          ? 'Aktywny'
          : 'Active',
      className: NEUTRAL_PILL_CLASS,
    },
    {
      label: `${template.questionCount ?? 0} ${isPolish ? 'pytań' : 'questions'}`,
      className: NEUTRAL_PILL_CLASS,
    },
    ...(template.estimatedTimeMinutes
      ? [{ label: `${template.estimatedTimeMinutes} min`, className: NEUTRAL_PILL_CLASS }]
      : []) as MetaPill[],
    ...(template.areaTags || []).map((tag) => ({
      label: getTemplateAreaTagLabel(tag, isPolish),
      className: NEUTRAL_PILL_CLASS,
    })) as MetaPill[],
  ];

  const descriptionText = (template.description || '').trim()
    ? template.description!
    : isPolish
      ? 'Brak opisu.'
      : 'No description.';

  const detailsActions = [
    {
      id: 'edit',
      label: isPolish ? 'Edytuj' : 'Edit',
      icon: Pencil,
      onClick: () => onDetailsAction('edit'),
    },
    {
      id: 'duplicate',
      label: isPolish ? 'Duplikuj' : 'Duplicate',
      icon: Copy,
      onClick: () => onDetailsAction('duplicate'),
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            label: isPolish ? 'Usuń' : 'Delete',
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
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {isPolish ? 'Utworzono' : 'Created'}:{' '}
            {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : '—'}
          </span>
        }
      >
        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
          {descriptionText}
        </div>
        {template.audience ? (
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {isPolish ? 'Odbiorcy' : 'Audience'}: {template.audience}
          </div>
        ) : null}
      </PreviewMetaCard>

      <PreviewDetailsSection
        text={descriptionText}
        label={isPolish ? 'Szczegóły' : 'Details'}
        customActions={detailsActions}
      />

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {isPolish ? 'Pytania' : 'Questions'}
        </div>
        <div className="space-y-1.5">
          {questionsLoading ? (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Ładowanie…' : 'Loading…'}
            </div>
          ) : questionItems.length > 0 ? (
            questionItems.map((q, idx) => {
              const text = String(
                q?.questionText || q?.text || q?.title || q?.question || ''
              ).trim();
              return (
                <div
                  key={`${template.id}:q:${idx}`}
                  className="text-xs text-slate-700 dark:text-slate-200"
                >
                  <span className="text-slate-400 dark:text-slate-500 mr-2">{idx + 1}.</span>
                  <span className="line-clamp-2">{text}</span>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Brak pytań do podglądu.' : 'No questions to preview.'}
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
  const relationItems: RelationItem[] = [
    { label: `${isPolish ? 'Kategoria' : 'Category'}: ${template.category || '—'}` },
    { label: `${isPolish ? 'Użycia' : 'Used'}: ${usageCount}` },
  ];

  const actionRows: ActionRow[] = [
    {
      buttons: [
        ...(onAssign
          ? [
              {
                label: isPolish ? 'Przypisz' : 'Assign',
                icon: UserPlus,
                onClick: onAssign,
                colorScheme: 'primary' as const,
                flex: true,
                shortcut: 'A',
              },
            ]
          : []),
        {
          label: canAssign ? (isPolish ? 'Edytuj' : 'Edit') : isPolish ? 'Otwórz' : 'Open',
          icon: ExternalLink,
          onClick: onOpenFull,
          colorScheme: onAssign ? 'primary' : 'primary',
          flex: true,
          shortcut: 'O',
        },
        ...(onClone
          ? [
              {
                label: isPolish ? 'Duplikuj' : 'Duplicate',
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
                label: isPolish ? 'Usuń' : 'Delete',
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
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip hints={aiHints} onRunHint={onRunAiHint} />
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewRelations items={relationItems} />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
