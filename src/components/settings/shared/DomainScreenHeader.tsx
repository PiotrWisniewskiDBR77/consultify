import { ChevronRight } from 'lucide-react';
import React from 'react';

import { cn } from '../../../lib/utils';

export interface DomainBreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface DomainScreenHeaderProps {
  breadcrumbs: DomainBreadcrumbItem[];
  title: string;
  subtitle?: string;
  menuControl?: React.ReactNode;
  actions?: React.ReactNode;
  actionsRef?: React.Ref<HTMLDivElement>;
  sticky?: boolean;
  className?: string;
  titleId?: string;
  /**
   * Ukrywa H1 i podtytuł, zostawiając sam breadcrumb (+ slot akcji).
   * Redesign Organizacji: ostatni okruszek NIESIE już nazwę ekranu, więc H1 był
   * jej dokładnym duplikatem — prototyp ma sam breadcrumb. Pominięte ⇒ nagłówek
   * renderuje się bajt w bajt jak dotąd (Admin, Ustawienia, Organizacja OFF).
   */
  hideTitle?: boolean;
}

/** Shared Wave 3 screen header for Organization, Admin and Settings. */
export const DomainScreenHeader: React.FC<DomainScreenHeaderProps> = ({
  breadcrumbs,
  title,
  subtitle,
  menuControl,
  actions,
  actionsRef,
  sticky = true,
  className,
  titleId,
  hideTitle = false,
}) => (
  <header
    className={cn(
      'domain-screen-header border-b border-[var(--c-border-subtle)] bg-[var(--c-surface)]',
      sticky && 'sticky top-0 z-20',
      className
    )}
  >
    <div
      className={cn(
        'domain-screen-container flex items-center gap-3',
        hideTitle ? 'min-h-[56px]' : 'min-h-[96px]'
      )}
    >
      {menuControl}
      <div className="min-w-0 flex-1">
        <nav aria-label="Breadcrumb" className="mb-1">
          <ol className="flex min-w-0 items-center gap-1.5 type-breadcrumb text-[var(--c-text-muted)]">
            {breadcrumbs.map((item, index) => {
              const isCurrent = index === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${item.label}-${index}`}>
                  {index > 0 && <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0" />}
                  <li className={cn('min-w-0', isCurrent && 'text-[var(--c-text)]')}>
                    {item.onClick && !isCurrent ? (
                      <button
                        type="button"
                        onClick={item.onClick}
                        className="rounded-sm text-left hover:text-[var(--c-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <span
                        aria-current={isCurrent ? 'page' : undefined}
                        className="block truncate"
                      >
                        {item.label}
                      </span>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </nav>
        {!hideTitle && (
          <>
            <h1 id={titleId} className="type-page-title truncate text-[var(--c-text)]">
              {title}
            </h1>
            {subtitle && (
              <p className="type-helper mt-0.5 truncate text-[var(--c-text-secondary)]">
                {subtitle}
              </p>
            )}
          </>
        )}
      </div>
      <div ref={actionsRef} className="domain-screen-actions flex shrink-0 items-center gap-2">
        {actions}
      </div>
    </div>
  </header>
);

export default DomainScreenHeader;
