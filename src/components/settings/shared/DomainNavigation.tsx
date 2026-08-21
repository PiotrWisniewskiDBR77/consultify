import { ArrowLeft, ChevronDown } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { cn } from '../../../lib/utils';

export interface DomainNavigationChild<TChild extends string> {
  id: TChild;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

export interface DomainNavigationModule<TModule extends string, TChild extends string> {
  id: TModule;
  label: string;
  children: DomainNavigationChild<TChild>[];
}

interface DomainNavigationProps<TModule extends string, TChild extends string> {
  title: string;
  description: string;
  navigationLabel: string;
  modules: DomainNavigationModule<TModule, TChild>[];
  activeModule: TModule;
  activeChild: TChild;
  onChildChange: (module: TModule, child: TChild) => void;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

/**
 * Shared domain navigation extracted from the accepted Settings interaction pattern.
 * Organization and Admin provide only their information architecture; selection,
 * focus, expansion and semantic styling remain identical.
 */
export function DomainNavigation<TModule extends string, TChild extends string>({
  title,
  description,
  navigationLabel,
  modules,
  activeModule,
  activeChild,
  onChildChange,
  onBack,
  backLabel = 'Back',
  className,
}: DomainNavigationProps<TModule, TChild>) {
  const [expandedModules, setExpandedModules] = useState<Set<TModule>>(
    () => new Set([activeModule])
  );

  useEffect(() => {
    setExpandedModules((current) => {
      if (current.has(activeModule)) return current;
      return new Set([...current, activeModule]);
    });
  }, [activeModule]);

  const toggleModule = (moduleId: TModule) => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  return (
    <aside
      aria-label={navigationLabel}
      className={cn(
        'flex h-full w-[280px] flex-col border-r border-[var(--c-border-subtle)] bg-[var(--c-surface)]',
        className
      )}
    >
      <div className="border-b border-[var(--c-border-subtle)] px-5 pb-4 pt-5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-2 rounded-lg text-sm text-[var(--c-text-muted)] transition-colors hover:text-[var(--c-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {backLabel}
          </button>
        )}
        <h1 className="text-lg font-bold tracking-wide text-[var(--c-text)]">{title}</h1>
        <p className="mt-1 text-sm leading-5 text-[var(--c-text-muted)]">{description}</p>
      </div>

      <nav
        aria-label={navigationLabel}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4"
      >
        {modules.map((module) => {
          const expanded = expandedModules.has(module.id);
          const containsActive = module.id === activeModule;
          return (
            <section
              key={module.id}
              className={cn(
                'rounded-xl border transition-colors',
                containsActive
                  ? 'border-[var(--c-border)] bg-[var(--c-surface-raised)]/45'
                  : 'border-transparent'
              )}
            >
              <button
                type="button"
                onClick={() => toggleModule(module.id)}
                aria-expanded={expanded}
                aria-controls={`domain-module-${module.id}`}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--c-text-muted)] transition-colors hover:text-[var(--c-text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
              >
                <span>{module.label}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn('h-4 w-4 shrink-0 transition-transform', !expanded && '-rotate-90')}
                />
              </button>
              <div
                id={`domain-module-${module.id}`}
                hidden={!expanded}
                className="space-y-0.5 px-2 pb-2"
              >
                {module.children.map((child) => {
                  const active = containsActive && child.id === activeChild;
                  const Icon = child.icon;
                  return (
                    <button
                      type="button"
                      key={child.id}
                      onClick={() => onChildChange(module.id, child.id)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]',
                        active
                          ? 'bg-[var(--c-selection)] font-medium text-[var(--c-text)] shadow-[inset_3px_0_0_var(--c-focus-solid)]'
                          : 'text-[var(--c-text-secondary)] hover:bg-[var(--c-surface-raised)] hover:text-[var(--c-text)]'
                      )}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-[var(--c-info)]' : 'text-[var(--c-text-muted)]'
                        )}
                      />
                      <span className="min-w-0 flex-1 leading-5">{child.label}</span>
                      {child.badge && (
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--c-warning)]">
                          {child.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

export default DomainNavigation;
