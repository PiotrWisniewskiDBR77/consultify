/**
 * CategorySidebar - Left Navigation for Interview Module
 *
 * 5 Categories: Strategy, Operations, Digital, People, Finance
 * Shows progress per category with question counts and completion status.
 */

import {
  Check,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Monitor,
  Settings,
  Target,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

// Types
export type InterviewCategory =
  | 'strategy'
  | 'operations'
  | 'digital'
  | 'people'
  | 'finance'
  | 'general';

export interface CategoryProgress {
  category: InterviewCategory;
  totalQuestions: number;
  answeredQuestions: number;
  isComplete: boolean;
}

export interface CategorySidebarProps {
  activeCategory: InterviewCategory;
  onCategoryChange: (category: InterviewCategory) => void;
  progress: CategoryProgress[];
  sessionName?: string;
  sessionStatus?: string;
  lastUpdated?: string;
}

// Category configuration
export const CATEGORY_CONFIG: Record<
  InterviewCategory,
  {
    labelEn: string;
    labelPl: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bgColor: string;
    descriptionEn: string;
    descriptionPl: string;
  }
> = {
  strategy: {
    labelEn: 'Strategy',
    labelPl: 'Strategia',
    icon: Target,
    color: 'text-[var(--c-tag-1)]',
    bgColor: 'bg-c-tag-1/12',
    descriptionEn: 'Business goals, vision, strategic directions',
    descriptionPl: 'Cele biznesowe, wizja, kierunki strategiczne',
  },
  operations: {
    labelEn: 'Operations',
    labelPl: 'Operacje',
    icon: Settings,
    color: 'text-[var(--c-tag-3)]',
    bgColor: 'bg-c-tag-3/12',
    descriptionEn: 'Operational processes, efficiency, bottlenecks',
    descriptionPl: 'Procesy operacyjne, efektywność, bottlenecki',
  },
  digital: {
    labelEn: 'Digital',
    labelPl: 'Cyfryzacja',
    icon: Monitor,
    color: 'text-[var(--c-tag-5)]',
    bgColor: 'bg-c-tag-5/12',
    descriptionEn: 'Digital maturity, IT systems, automation',
    descriptionPl: 'Dojrzałość cyfrowa, systemy IT, automatyzacja',
  },
  people: {
    labelEn: 'People',
    labelPl: 'Ludzie',
    icon: Users,
    color: 'text-[var(--c-tag-7)]',
    bgColor: 'bg-c-tag-7/12',
    descriptionEn: 'Competencies, culture, change readiness',
    descriptionPl: 'Kompetencje, kultura, gotowość na zmiany',
  },
  finance: {
    labelEn: 'Finance',
    labelPl: 'Finanse',
    icon: DollarSign,
    color: 'text-[var(--c-tag-9)]',
    bgColor: 'bg-c-tag-9/12',
    descriptionEn: 'Budgets, financial constraints, ROI expectations',
    descriptionPl: 'Budżety, ograniczenia finansowe, ROI expectations',
  },
  general: {
    labelEn: 'General',
    labelPl: 'Ogólne',
    icon: ClipboardList,
    color: 'text-[var(--c-text-secondary)]',
    bgColor: 'bg-[var(--c-surface-raised)]',
    descriptionEn: 'General assessment questions',
    descriptionPl: 'Ogólne pytania diagnostyczne',
  },
};

export const CATEGORY_ORDER: InterviewCategory[] = [
  'general',
  'strategy',
  'operations',
  'digital',
  'people',
  'finance',
];

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  activeCategory,
  onCategoryChange,
  progress,
  sessionName = 'Discovery Interview',
  sessionStatus = 'active',
  lastUpdated,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  // Calculate overall progress
  const totalQuestions = progress.reduce((sum, p) => sum + p.totalQuestions, 0);
  const answeredQuestions = progress.reduce((sum, p) => sum + p.answeredQuestions, 0);
  const overallPercent =
    totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const completedCategories = progress.filter((p) => p.isComplete).length;

  return (
    <div className="w-64 shrink-0 bg-[var(--c-surface)] border-r border-[var(--c-border-subtle)] flex flex-col h-full">
      {/* Session Header */}
      <div className="p-4 border-b border-[var(--c-border-subtle)]">
        <h2 className="font-bold text-[var(--c-text)] truncate">{sessionName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`
            px-2 py-0.5 text-xs font-medium rounded-token-pill
            ${
              sessionStatus === 'completed'
                ? 'bg-c-success/12 text-[var(--c-success)]'
                : sessionStatus === 'active'
                  ? 'bg-c-info/12 text-[var(--c-info)]'
                  : 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]'
            }
          `}
          >
            {sessionStatus === 'completed'
              ? isPolish
                ? 'Zakończona'
                : 'Completed'
              : sessionStatus === 'active'
                ? isPolish
                  ? 'W trakcie'
                  : 'In Progress'
                : sessionStatus}
          </span>
          {lastUpdated && (
            <span className="text-xs text-[var(--c-text-muted)] truncate">
              {new Date(lastUpdated).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <div className="p-4 border-b border-[var(--c-border-subtle)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--c-text)]">
            {isPolish ? 'Postęp' : 'Progress'}
          </span>
          <span className="text-sm text-[var(--c-text-muted)]">
            {completedCategories}/5 {isPolish ? 'kategorii' : 'categories'}
          </span>
        </div>
        <div className="h-2 bg-[var(--c-border-subtle)] rounded-token-pill overflow-hidden">
          <div
            className="h-full bg-[var(--c-success)] rounded-token-pill transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-[var(--c-text-secondary)]">
          {answeredQuestions}/{totalQuestions} {isPolish ? 'pytań' : 'questions'} ({overallPercent}
          %)
        </p>
      </div>

      {/* Category List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {CATEGORY_ORDER.map((category) => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config.icon;
            const categoryProgress = progress.find((p) => p.category === category);
            const isActive = category === activeCategory;
            const isComplete = categoryProgress?.isComplete || false;
            const answered = categoryProgress?.answeredQuestions || 0;
            const total = categoryProgress?.totalQuestions || 0;

            return (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-token-md text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]
                  ${
                    isActive
                      ? 'bg-[var(--c-surface-raised)] ring-1 ring-[var(--c-border)]'
                      : isComplete
                        ? 'bg-c-success/8 hover:bg-c-success/12'
                        : 'hover:bg-[var(--c-surface-raised)]'
                  }
                `}
              >
                <div
                  className={`
                    w-8 h-8 rounded-token-md flex items-center justify-center shrink-0
                    ${
                      isComplete
                        ? 'bg-c-success/12'
                        : isActive
                          ? config.bgColor
                          : 'bg-[var(--c-surface-raised)]'
                    }
                  `}
                >
                  {isComplete ? (
                    <Check size={16} className="text-[var(--c-success)]" />
                  ) : (
                    <Icon
                      size={16}
                      className={isActive ? config.color : 'text-[var(--c-text-muted)]'}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`
                      text-sm font-medium block
                      ${
                        isComplete
                          ? 'text-[var(--c-success)]'
                          : isActive
                            ? 'text-[var(--c-text)]'
                            : 'text-[var(--c-text-secondary)]'
                      }
                    `}
                  >
                    {isPolish ? config.labelPl : config.labelEn}
                  </span>
                  <span className="text-xs text-[var(--c-text-muted)]">
                    {answered}/{total} {isPolish ? 'odp.' : 'ans.'}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className={`
                    shrink-0 transition-transform
                    ${isActive ? 'text-[var(--c-text-muted)] rotate-90' : 'text-[var(--c-text-muted)]'}
                  `}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-[var(--c-border-subtle)]">
        <p className="text-xs text-[var(--c-text-muted)] text-center">
          {isPolish ? 'Tylko fakty - bez rekomendacji' : 'Facts only - no recommendations'}
        </p>
      </div>
    </div>
  );
};

export default CategorySidebar;
