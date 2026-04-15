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
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    descriptionEn: 'Business goals, vision, strategic directions',
    descriptionPl: 'Cele biznesowe, wizja, kierunki strategiczne',
  },
  operations: {
    labelEn: 'Operations',
    labelPl: 'Operacje',
    icon: Settings,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    descriptionEn: 'Operational processes, efficiency, bottlenecks',
    descriptionPl: 'Procesy operacyjne, efektywność, bottlenecki',
  },
  digital: {
    labelEn: 'Digital',
    labelPl: 'Cyfryzacja',
    icon: Monitor,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    descriptionEn: 'Digital maturity, IT systems, automation',
    descriptionPl: 'Dojrzałość cyfrowa, systemy IT, automatyzacja',
  },
  people: {
    labelEn: 'People',
    labelPl: 'Ludzie',
    icon: Users,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    descriptionEn: 'Competencies, culture, change readiness',
    descriptionPl: 'Kompetencje, kultura, gotowość na zmiany',
  },
  finance: {
    labelEn: 'Finance',
    labelPl: 'Finanse',
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    descriptionEn: 'Budgets, financial constraints, ROI expectations',
    descriptionPl: 'Budżety, ograniczenia finansowe, ROI expectations',
  },
  general: {
    labelEn: 'General',
    labelPl: 'Ogólne',
    icon: ClipboardList,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
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
    <div className="w-64 shrink-0 bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-navy-700 flex flex-col h-full">
      {/* Session Header */}
      <div className="p-4 border-b border-slate-200 dark:border-navy-700">
        <h2 className="font-bold text-navy-900 dark:text-white truncate">{sessionName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`
            px-2 py-0.5 text-xs font-medium rounded-full
            ${
              sessionStatus === 'completed'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : sessionStatus === 'active'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
            <span className="text-xs text-slate-500 dark:text-slate-500 truncate">
              {new Date(lastUpdated).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <div className="p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {isPolish ? 'Postęp' : 'Progress'}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {completedCategories}/5 {isPolish ? 'kategorii' : 'categories'}
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
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
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                  ${
                    isActive
                      ? 'bg-slate-100 dark:bg-navy-800 ring-1 ring-slate-300 dark:ring-navy-600'
                      : isComplete
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5'
                  }
                `}
              >
                <div
                  className={`
                    w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                    ${
                      isComplete
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : isActive
                          ? config.bgColor
                          : 'bg-slate-100 dark:bg-slate-800'
                    }
                  `}
                >
                  {isComplete ? (
                    <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Icon
                      size={16}
                      className={isActive ? config.color : 'text-slate-500 dark:text-slate-500'}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`
                      text-sm font-medium block
                      ${
                        isComplete
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isActive
                            ? 'text-navy-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-400'
                      }
                    `}
                  >
                    {isPolish ? config.labelPl : config.labelEn}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    {answered}/{total} {isPolish ? 'odp.' : 'ans.'}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className={`
                    shrink-0 transition-transform
                    ${isActive ? 'text-slate-500 rotate-90' : 'text-slate-400 dark:text-slate-600'}
                  `}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-slate-200 dark:border-navy-700">
        <p className="text-xs text-slate-500 dark:text-slate-500 text-center">
          {isPolish ? 'Tylko fakty - bez rekomendacji' : 'Facts only - no recommendations'}
        </p>
      </div>
    </div>
  );
};

export default CategorySidebar;
