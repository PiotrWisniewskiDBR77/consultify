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

export interface ErrorStateProps {
  /** Headline (default: "Something went wrong") */
  title?: string;
  /** Supporting copy */
  message?: string;
  /** Optional retry handler — renders an outline button when provided */
  retry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  retry,
  className = '',
}) => {
  const { t } = useTranslation();
  const heading = title ?? t('common.errorTitle', { defaultValue: 'Something went wrong' });

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`.trim()}
    >
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-token-pill bg-danger-100 text-danger-600 dark:bg-danger-900/40 dark:text-danger-400">
        <AlertTriangle size={40} />
      </div>
      <h3 className="text-hig-title3 font-semibold text-navy-900 dark:text-white">{heading}</h3>
      {message && (
        <p className="mt-2 max-w-sm text-sm text-navy-400 dark:text-navy-300">{message}</p>
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
