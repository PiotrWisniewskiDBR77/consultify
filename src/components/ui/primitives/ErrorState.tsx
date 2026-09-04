/**
 * ErrorState - Shared state primitive (X1 Design System)
 *
 * Friendly error placeholder with an alert icon and optional retry action.
 *
 * @example
 * <ErrorState message="Could not load metrics." retry={refetch} />
 */

import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { getAppErrorCopy } from '../../../services/errors/appErrorCopy';

export interface ErrorStateProps {
  /** Headline (default: "Something went wrong") */
  title?: string;
  /** Supporting copy */
  message?: string;
  /** Typed application-error envelope; raw server messages are never rendered. */
  source?: unknown;
  /** Optional retry handler — renders an outline button when provided */
  retry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  source,
  retry,
  className = '',
}) => {
  const { t } = useTranslation();
  const heading = title ?? t('common.errorTitle', { defaultValue: 'Something went wrong' });
  const appError = source ? getAppErrorCopy(t, source) : null;
  const visibleMessage = appError?.message ?? message;

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`.trim()}
    >
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-token-pill bg-danger-100 text-danger-600 dark:bg-danger-900/40 dark:text-danger-400">
        <AlertTriangle size={40} />
      </div>
      <h3 className="text-hig-title3 font-semibold text-navy-900 dark:text-white">{heading}</h3>
      {visibleMessage && (
        <p className="mt-2 max-w-sm text-sm text-navy-400 dark:text-navy-300">{visibleMessage}</p>
      )}
      {appError?.action && (
        <p className="mt-1 max-w-sm text-sm text-navy-600 dark:text-navy-200">{appError.action}</p>
      )}
      {appError?.correlationLabel && (
        <code className="mt-3 select-all rounded-token-sm bg-navy-50 px-2 py-1 text-xs text-navy-700 dark:bg-navy-800 dark:text-navy-200">
          {appError.correlationLabel}
        </code>
      )}
      {retry && (
        <div className="mt-6">
          <Button variant="outline" onClick={retry}>
            {t('common.retry', { defaultValue: 'Try again' })}
          </Button>
        </div>
      )}
    </div>
  );
};

ErrorState.displayName = 'ErrorState';

export default ErrorState;
