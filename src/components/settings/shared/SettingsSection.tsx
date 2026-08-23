/**
 * SettingsSection - Unified settings section component
 *
 * Provides consistent UI pattern for all settings sections:
 * - Header with icon, title, description, and optional domain actions
 * - Content area with consistent padding
 * - Optional footer with save button and dirty state indicator
 * - Loading state with skeleton
 *
 * @version 2.0
 */

import { Loader2, Save } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../lib/utils';
import { SettingsHeaderActionPortal } from '../SettingsHeaderActions';

interface SettingsSectionProps {
  /** Icon component to display in header */
  icon: React.ElementType;
  /** Section title */
  title: string;
  /** Section description */
  description: string;
  /** Retained temporarily for call-site compatibility; no floating help control is rendered. */
  cardId: string;
  /** Optional additional actions in header */
  actions?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Save handler (if provided, shows save footer) */
  onSave?: () => void;
  /** Whether save is in progress */
  saving?: boolean;
  /** Whether section is loading */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Variant style */
  variant?: 'default' | 'compact' | 'full-width';
  /** Whether to show the border */
  bordered?: boolean;
}

/**
 * Skeleton loader for settings section
 */
export const SettingsSectionSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-6 animate-pulse p-6">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-c-surface-raised rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-5 bg-c-surface-raised rounded w-1/3" />
        <div className="h-4 bg-c-surface-raised rounded w-2/3" />
      </div>
    </div>
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-c-surface-raised rounded-lg" />
      ))}
    </div>
  </div>
);

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  icon: Icon,
  title,
  description,
  cardId: _cardId,
  actions,
  children,
  isDirty = false,
  onSave,
  saving = false,
  loading = false,
  className,
  variant = 'default',
  bordered = true,
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        className={cn(
          'bg-c-surface-raised rounded-xl overflow-hidden',
          bordered && 'border border-c-border-subtle',
          className
        )}
      >
        <SettingsSectionSkeleton />
      </div>
    );
  }

  const contentPadding = variant === 'compact' ? 'p-4' : 'p-6';
  const headerPadding = variant === 'compact' ? 'p-4' : 'p-6';

  return (
    <>
      {onSave && (
        <SettingsHeaderActionPortal>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isDirty}
            className={cn(
              'type-control flex items-center gap-2 rounded-lg px-4 py-2 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]',
              isDirty
                ? 'bg-navy-900 text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'
                : 'cursor-not-allowed bg-[var(--c-surface-raised)] text-[var(--c-text-muted)]'
            )}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
          </button>
        </SettingsHeaderActionPortal>
      )}
      <div
        className={cn(
          'bg-c-surface-raised rounded-xl overflow-hidden transition-all duration-200',
          bordered && 'border border-c-border-subtle',
          isDirty && 'ring-2 ring-amber-500/20',
          className
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-start justify-between',
            headerPadding,
            onSave && 'border-b border-c-border-subtle'
          )}
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-c-accent-soft rounded-lg flex-shrink-0">
              <Icon size={20} className="text-c-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-c-text leading-tight">{title}</h3>
              <p className="text-sm text-c-text-secondary mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        </div>

        {/* Content */}
        <div className={cn(contentPadding, !onSave && 'pt-0')}>{children}</div>

        {/* Persistence state stays with the form; the action is in the canonical screen header. */}
        {onSave && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center px-6 py-4 bg-c-surface-raised border-t border-c-border-subtle"
          >
            <div className="flex items-center gap-2 text-sm">
              {isDirty ? (
                <>
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span className="text-amber-400">
                    {t('settings.unsavedChanges', 'Unsaved changes')}
                  </span>
                </>
              ) : (
                <span className="text-c-text-muted">
                  {t('settings.allChangesSaved', 'All changes saved')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

/**
 * Settings form row - consistent form field layout
 */
interface SettingsFormRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SettingsFormRow: React.FC<SettingsFormRowProps> = ({
  label,
  description,
  htmlFor,
  required,
  children,
  className,
}) => (
  <div className={cn('space-y-2', className)}>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-c-text-secondary">
      {label}
      {required && <span className="text-c-danger ml-1">*</span>}
    </label>
    {children}
    {description && <p className="text-xs text-c-text-muted">{description}</p>}
  </div>
);

/**
 * Settings input - consistent text input styling
 */
interface SettingsInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const SettingsInput: React.FC<SettingsInputProps> = ({ error, className, id, ...props }) => {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div>
      <input
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'w-full px-4 py-2.5 bg-c-surface border rounded-lg text-c-text',
          'placeholder:text-c-text-muted transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent',
          error
            ? 'border-c-danger focus:ring-c-danger'
            : 'border-c-border-subtle hover:border-c-border-strong dark:hover:border-white/20',
          className
        )}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-c-danger">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Settings textarea - consistent textarea styling
 */
interface SettingsTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const SettingsTextarea: React.FC<SettingsTextareaProps> = ({
  error,
  className,
  id,
  ...props
}) => {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div>
      <textarea
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'w-full px-4 py-3 bg-c-surface border rounded-lg text-c-text resize-none',
          'placeholder:text-c-text-muted transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent',
          error
            ? 'border-c-danger focus:ring-c-danger'
            : 'border-c-border-subtle hover:border-c-border-strong dark:hover:border-white/20',
          className
        )}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs text-c-danger">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Settings select - consistent select styling
 */
interface SettingsSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
  error?: string;
}

export const SettingsSelect: React.FC<SettingsSelectProps> = ({
  options,
  error,
  className,
  id,
  ...props
}) => {
  const reactId = React.useId();
  const fieldId = id ?? reactId;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div>
      <select
        {...props}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'w-full px-4 py-2.5 bg-c-surface border rounded-lg text-c-text',
          'transition-all duration-200 cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent',
          error
            ? 'border-c-danger focus:ring-c-danger'
            : 'border-c-border-subtle hover:border-c-border-strong dark:hover:border-white/20',
          className
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-c-danger">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Settings toggle - consistent toggle switch
 */
interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled,
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1">
      <span className="text-sm font-medium text-c-text">{label}</span>
      {description && <p className="text-xs text-c-text-secondary mt-0.5">{description}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:ring-offset-2 focus:ring-offset-c-surface',
        checked ? 'bg-c-focus-solid' : 'bg-c-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  </div>
);

/**
 * Settings divider - visual separator
 */
export const SettingsDivider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('border-t border-c-border-subtle my-6', className)} />
);

/**
 * Settings button group - for option selection
 */
interface SettingsButtonGroupProps {
  options: Array<{ value: string; label: string; icon?: React.ElementType }>;
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const SettingsButtonGroup: React.FC<SettingsButtonGroupProps> = ({
  options,
  value,
  onChange,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <div className="inline-flex rounded-lg bg-c-surface-raised p-1">
      {options.map((option) => {
        const isActive = value === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex items-center gap-2 rounded-md font-medium transition-all duration-200',
              sizeClasses[size],
              isActive
                ? 'bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 shadow-sm'
                : 'text-c-text-secondary hover:text-c-text dark:hover:text-white hover:bg-c-surface dark:hover:bg-navy-800/20'
            )}
          >
            {Icon && <Icon size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SettingsSection;
