import { AlertTriangle, EyeOff, Lock, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';

export type AdminStateKind = 'unavailable' | 'readOnly' | 'degraded' | 'hidden';

export interface AdminStateProps {
  kind: AdminStateKind;
  title?: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

const config: Record<
  AdminStateKind,
  { icon: typeof AlertTriangle; title: string; description: string; classes: string }
> = {
  unavailable: {
    icon: Wrench,
    title: 'Feature unavailable',
    description: 'This area is not wired to a reliable backend yet.',
    classes:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  },
  readOnly: {
    icon: Lock,
    title: 'Read-only',
    description: 'You can review this data, but changes are disabled for now.',
    classes:
      'border-slate-200 bg-slate-50 text-slate-700 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200',
  },
  degraded: {
    icon: AlertTriangle,
    title: 'Limited data',
    description: 'Some metrics may be incomplete because one or more sources are unavailable.',
    classes:
      'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100',
  },
  hidden: {
    icon: EyeOff,
    title: 'Hidden until ready',
    description: 'This action is intentionally hidden until the implementation is complete.',
    classes:
      'border-slate-200 bg-white text-slate-600 dark:border-navy-700 dark:bg-navy-950 dark:text-slate-300',
  },
};

export function AdminState({
  kind,
  title,
  description,
  action,
  compact = false,
  className = '',
}: AdminStateProps) {
  const state = config[kind];
  const Icon = state.icon;

  return (
    <div
      className={`rounded-xl border ${state.classes} ${compact ? 'p-3' : 'p-4'} ${className}`}
      role={kind === 'degraded' || kind === 'unavailable' ? 'status' : undefined}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title || state.title}</p>
          <p className="mt-1 text-xs opacity-80">{description || state.description}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export const UnavailableState = (props: Omit<AdminStateProps, 'kind'>) => (
  <AdminState {...props} kind="unavailable" />
);

export const ReadOnlyState = (props: Omit<AdminStateProps, 'kind'>) => (
  <AdminState {...props} kind="readOnly" />
);

export const DegradedState = (props: Omit<AdminStateProps, 'kind'>) => (
  <AdminState {...props} kind="degraded" />
);

export const HiddenState = (props: Omit<AdminStateProps, 'kind'>) => (
  <AdminState {...props} kind="hidden" />
);
