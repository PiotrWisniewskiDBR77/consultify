import {
  AlertTriangle,
  Award,
  CheckCircle,
  HelpCircle,
  Lightbulb,
  Link,
  Lock,
  Target,
  Users,
} from 'lucide-react';
import React from 'react';

export type InsightCategory =
  | 'objective'
  | 'stakeholder'
  | 'risk'
  | 'assumption'
  | 'constraint'
  | 'decision'
  | 'dependency'
  | 'success_criteria';

interface CategoryIconProps {
  category: InsightCategory;
  size?: number;
  className?: string;
}

const CATEGORY_CONFIG: Record<
  InsightCategory,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    bgColor: string;
    label: string;
  }
> = {
  objective: {
    icon: Target,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    label: 'Objective',
  },
  stakeholder: {
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Stakeholder',
  },
  risk: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    label: 'Risk',
  },
  assumption: {
    icon: Lightbulb,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    label: 'Assumption',
  },
  constraint: {
    icon: Lock,
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    label: 'Constraint',
  },
  decision: {
    icon: CheckCircle,
    color: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    label: 'Decision',
  },
  dependency: {
    icon: Link,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    label: 'Dependency',
  },
  success_criteria: {
    icon: Award,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    label: 'Success Criteria',
  },
};

export function CategoryIcon({ category, size = 20, className = '' }: CategoryIconProps) {
  const config = CATEGORY_CONFIG[category];

  if (!config) {
    return (
      <HelpCircle
        size={size}
        className={`text-gray-400 dark:text-gray-500 dark:text-gray-400 ${className}`}
      />
    );
  }

  const IconComponent = config.icon;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg p-2 ${config.bgColor} ${className}`}
    >
      <IconComponent size={size} className={config.color} />
    </div>
  );
}

export function getCategoryLabel(category: InsightCategory): string {
  return CATEGORY_CONFIG[category]?.label || category;
}

export function getCategoryColor(category: InsightCategory): string {
  return CATEGORY_CONFIG[category]?.color || 'text-gray-500 dark:text-gray-400';
}

export function getCategoryBgColor(category: InsightCategory): string {
  return CATEGORY_CONFIG[category]?.bgColor || 'bg-gray-100 dark:bg-navy-800';
}

export { CATEGORY_CONFIG };
